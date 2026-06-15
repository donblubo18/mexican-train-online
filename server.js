const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// OPLOSSING CORS BUG SERVER: Accepteer expliciet alle polling en websocket verbindingen
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    allowEIO3: true
});

app.use(express.static('public'));

let game = {
    players: [],
    maxStone: 12,
    boneyard: [],
    mexicanTrain: [],
    hands: {},
    currentTurn: 0,
    started: false,
    startNumber: 12,
    currentRound: 1,
    gameOver: false,
    hasDrawn: false,
    requiredDouble: { active: false, value: null, targetId: null }
};

function generateDeck(max) {
    let deck = [];
    for (let i = 0; i <= max; i++) {
        for (let j = i; j <= max; j++) {
            deck.push([i, j]);
        }
    }
    return deck.sort(() => Math.random() - 0.5);
}

// Haalt het openstaande cijfer van een trein op
function getTail(train, startNumber) {
    if (train.length === 0) return startNumber;
    // Pak de allerlaatste steen op de trein
    const lastStone = train[train.length - 1];
    // De tail is altijd de tweede waarde van het op de trein geplaatste array-item
    return lastStone[1]; 
}

function initRound() {
    game.boneyard = generateDeck(game.maxStone);
    game.mexicanTrain = [];
    game.currentTurn = (game.currentRound - 1) % game.players.length;
    game.hasDrawn = false;
    game.requiredDouble = { active: false, value: null, targetId: null };

    // OPLOSSING BUG 2: Filter de dubbele startsteen nu WATERDICHT uit de pot (controleert beide array elementen)
    game.boneyard = game.boneyard.filter(s => !(s[0] === game.startNumber && s[1] === game.startNumber));

    // Bepaal handgrootte op basis van de officiële toernooiregels
    let stonesPerPlayer = 11;
    if (game.maxStone >= 15) stonesPerPlayer = 13;
    if (game.players.length >= 7) stonesPerPlayer -= 2;

    game.players.forEach(p => {
        game.hands[p.id] = game.boneyard.splice(0, stonesPerPlayer);
        p.train = [];
        p.isOpen = false;
    });
}

function checkSoundTriggers(oldGame, newGame) {
    if (oldGame.currentTurn !== newGame.currentTurn) {
        io.emit('playSound', 'turn');
    }
    newGame.players.forEach(p => {
        const oldP = oldGame.players.find(x => x.id === p.id);
        if (p.isOpen && (!oldP || !oldP.isOpen)) {
            io.emit('playSound', 'trainOpen');
        }
        const newHandLen = newGame.hands[p.id] ? newGame.hands[p.id].length : 0;
        const oldHandLen = oldGame.hands[p.id] ? oldGame.hands[p.id].length : 0;
        if (newHandLen === 1 && oldHandLen > 1) {
            io.emit('playSound', 'knock');
        }
    });
}

io.on('connection', (socket) => {
    socket.on('joinGame', (name) => {
        if (game.started) return socket.emit('errorMsg', 'Spel is al begonnen.');
        if (game.players.length >= 8) return socket.emit('errorMsg', 'Spel is vol.');
        game.players.push({ id: socket.id, name: name, isOpen: false, train: [], totalScore: 0 });
        io.emit('updateGame', game);
    });

    socket.on('startGame', (maxStone) => {
        game.maxStone = parseInt(maxStone);
        game.startNumber = game.maxStone;
        game.currentRound = 1;
        game.gameOver = false;
        game.started = true;
        game.players.forEach(p => p.totalScore = 0);
        initRound();
        io.emit('gameStarted', game);
    });

    socket.on('drawStone', () => {
        if (game.players[game.currentTurn].id !== socket.id) return;
        if (game.hasDrawn) return socket.emit('errorMsg', 'Je hebt al gepakt!');
        if (game.boneyard.length > 0) {
            const stone = game.boneyard.pop();
            game.hands[socket.id].push(stone);
            game.hasDrawn = true;
            io.emit('updateGame', game);
        } else {
            game.hasDrawn = true;
            io.emit('updateGame', game);
        }
    });

    socket.on('passTurn', () => {
        if (game.players[game.currentTurn].id !== socket.id) return;
        if (!game.hasDrawn) return socket.emit('errorMsg', 'Eerst pakken!');
        
        const oldGameCopy = JSON.parse(JSON.stringify(game));
        const player = game.players.find(p => p.id === socket.id);
        player.isOpen = true;
        game.hasDrawn = false;
        game.currentTurn = (game.currentTurn + 1) % game.players.length;

        checkSoundTriggers(oldGameCopy, game);
        io.emit('updateGame', game);
    });

    socket.on('playStone', ({ stoneIndex, targetId }) => {
        const playerId = socket.id;
        if (game.players[game.currentTurn].id !== playerId) return;

        const hand = game.hands[playerId];
        let stone = hand[stoneIndex]; // Dit is een array, bijv: [12, 5]
        if (!stone) return;

        if (game.requiredDouble.active && targetId !== game.requiredDouble.targetId) {
            return socket.emit('errorMsg', `Verplicht! Leg aan op de gemarkeerde dubbel.`);
        }

        let targetTrain;
        let isOwnTrain = (playerId === targetId);

        if (targetId === 'mexican') {
            targetTrain = game.mexicanTrain;
        } else {
            const targetPlayer = game.players.find(p => p.id === targetId);
            if (!targetPlayer) return;
            if (!isOwnTrain && !targetPlayer.isOpen) return socket.emit('errorMsg', 'Trein is gesloten!');
            targetTrain = targetPlayer.train;
        }

        let tail = getTail(targetTrain, game.startNumber);
        let finalStoneOriented = null;

        // OPLOSSING BUG 1: Array-cijfer validatie en automatische rotatie (omdraaien)
        if (stone[0] === tail) {
            finalStoneOriented = [stone[0], stone[1]]; // Sluit direct aan met de linkerkant
        } else if (stone[1] === tail) {
            finalStoneOriented = [stone[1], stone[0]]; // Draai de steen om zodat de rechterkant aansluit
        } else {
            return socket.emit('errorMsg', 'Steen sluit niet aan! Eindcijfer van deze trein moet zijn: ' + tail);
        }

        const oldGameCopy = JSON.parse(JSON.stringify(game));
        
        // Push de juist georiënteerde steen naar de trein array
        targetTrain.push(finalStoneOriented);
        hand.splice(stoneIndex, 1);

        if (isOwnTrain) {
            game.players.find(p => p.id === playerId).isOpen = false;
        }

        // Check einde ronde
        if (hand.length === 0) {
            game.players.forEach(p => {
                const pHand = game.hands[p.id] || [];
                const penalty = pHand.reduce((sum, s) => sum + s[0] + s[1], 0);
                p.totalScore += penalty;
            });
            const winnerName = game.players[game.currentTurn].name;
            if (game.startNumber > 0) {
                game.startNumber -= 1;
                game.currentRound += 1;
                initRound();
                io.emit('roundEnded', { winner: winnerName, nextRoundReady: true, game: game });
            } else {
                game.started = false;
                game.gameOver = true;
                const sorted = [...game.players].sort((a,b) => a.totalScore - b.totalScore);
                io.emit('roundEnded', { winner: winnerName, nextRoundReady: false, champion: sorted[0].name, game: game });
            }
            return;
        }

        // Check of de zojuist gelegde steen een dubbelsteen was
        const isDouble = (finalStoneOriented[0] === finalStoneOriented[1]);
        if (isDouble) {
            game.requiredDouble = { active: true, value: finalStoneOriented[0], targetId: targetId };
            game.hasDrawn = false; // Je krijgt direct een extra beurt om hem dicht te leggen
        } else {
            game.requiredDouble = { active: false, value: null, targetId: null };
            game.hasDrawn = false;
            game.currentTurn = (game.currentTurn + 1) % game.players.length;
        }

        checkSoundTriggers(oldGameCopy, game);
        io.emit('updateGame', game);
    });

    socket.on('reorderHand', ({ fromIndex, toIndex }) => {
        const hand = game.hands[socket.id];
        if (!hand) return;
        const [movedStone] = hand.splice(fromIndex, 1);
        hand.splice(toIndex, 0, movedStone);
        io.emit('updateGame', game);
    });

    socket.on('disconnect', () => {
        game.players = game.players.filter(p => p.id !== socket.id);
        delete game.hands[socket.id];
        if (game.players.length === 0) game.started = false;
        io.emit('updateGame', game);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server gestart op poort ${PORT}`));
