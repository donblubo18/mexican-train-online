const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

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
    spectators: [], // Staat nu hier direct als lege lijst klaar
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

function getTail(train, startNumber) {
    if (train.length === 0) return startNumber;
    const lastStone = train[train.length - 1];
    return lastStone[1]; 
}

function initRound() {
    game.boneyard = generateDeck(game.maxStone);
    game.mexicanTrain = [];
    game.currentTurn = (game.currentRound - 1) % game.players.length;
    game.hasDrawn = false;
    game.requiredDouble = { active: false, value: null, targetId: null };

    // Filter startsteen eruit
    game.boneyard = game.boneyard.filter(s => !(s[0] === game.startNumber && s[1] === game.startNumber));

    // Officiële verdeling
    let stonesPerPlayer = 11;
    const numPlayers = game.players.length;

    if (game.maxStone === 12) {
        if (numPlayers >= 2 && numPlayers <= 4) stonesPerPlayer = 15;
        else if (numPlayers >= 5 && numPlayers <= 6) stonesPerPlayer = 12;
        else if (numPlayers >= 7 && numPlayers <= 8) stonesPerPlayer = 11;
    } else if (game.maxStone === 15) {
        if (numPlayers >= 2 && numPlayers <= 4) stonesPerPlayer = 19;
        else if (numPlayers >= 5 && numPlayers <= 6) stonesPerPlayer = 15;
        else if (numPlayers >= 7 && numPlayers <= 8) stonesPerPlayer = 13;
    } else {
        const totalStones = game.boneyard.length;
        stonesPerPlayer = Math.floor((totalStones - 25) / numPlayers);
        if (stonesPerPlayer > 20) stonesPerPlayer = 20;
        if (stonesPerPlayer < 5) stonesPerPlayer = 5;
    }

    game.players.forEach(p => {
        game.hands[p.id] = game.boneyard.splice(0, stonesPerPlayer);
        p.train = [];
        p.isOpen = false;
    });
}

function checkSoundTriggers(oldGame, newGame) {
    if (oldGame.currentTurn !== newGame.currentTurn) io.emit('playSound', 'turn');
    newGame.players.forEach(p => {
        const oldP = oldGame.players.find(x => x.id === p.id);
        if (p.isOpen && (!oldP || !oldP.isOpen)) io.emit('playSound', 'trainOpen');
        const newLen = newGame.hands[p.id] ? newGame.hands[p.id].length : 0;
        const oldLen = oldGame.hands[p.id] ? oldGame.hands[p.id].length : 0;
        if (newLen === 1 && oldLen > 1) io.emit('playSound', 'knock');
    });
}

io.on('connection', (socket) => {
    socket.on('joinGame', (name) => {
        if (game.started) return socket.emit('errorMsg', 'Spel al begonnen!');
        if (game.players.length >= 8) return socket.emit('errorMsg', 'Spel is vol.');
        game.players.push({ id: socket.id, name: name, isOpen: false, train: [], totalScore: 0 });
        socket.emit('joinSuccess');
        io.emit('updateGame', game);
    });

    socket.on('joinAsSpectator', () => {
        if (game.players.some(p => p.id === socket.id)) return socket.emit('errorMsg', 'Je bent al speler!');
        const specName = "Kijker " + (game.spectators.length + 1);
        game.spectators.push({ id: socket.id, name: specName });
        socket.emit('joinSuccess');
        io.emit('updateGame', game);
    });

    socket.on('startGame', (maxStone) => {
        game.maxStone = parseInt(maxStone);
        game.startNumber = game.maxStone;
        game.currentRound = 1;
        game.gameOver = false;
        game.started = true;
        game.spectators = game.spectators || []; // Zorg voor geldige array
        game.players.forEach(p => p.totalScore = 0);
        initRound();
        io.emit('gameStarted', game);
    });

    socket.on('drawStone', () => {
        if (game.players[game.currentTurn].id !== socket.id) return;
        if (game.hasDrawn) return socket.emit('errorMsg', 'Je hebt al gepakt!');
        if (game.boneyard.length > 0) {
            game.hands[socket.id].push(game.boneyard.pop());
            game.hasDrawn = true;
        } else {
            game.hasDrawn = true;
        }
        io.emit('updateGame', game);
    });

    socket.on('passTurn', () => {
        if (game.players[game.currentTurn].id !== socket.id || !game.hasDrawn) return;
        const oldGameCopy = JSON.parse(JSON.stringify(game));
        game.players.find(p => p.id === socket.id).isOpen = true;
        game.hasDrawn = false;
        game.currentTurn = (game.currentTurn + 1) % game.players.length;
        checkSoundTriggers(oldGameCopy, game);
        io.emit('updateGame', game);
    });

    socket.on('playStone', ({ stoneIndex, targetId }) => {
        if (game.players[game.currentTurn].id !== socket.id) return;
        const hand = game.hands[socket.id];
        let stone = hand[stoneIndex];
        if (!stone) return;

        if (game.requiredDouble.active && targetId !== game.requiredDouble.targetId) {
            return socket.emit('errorMsg', 'Verplicht op de dubbel!');
        }

        let targetTrain;
        let isOwnTrain = (socket.id === targetId);

        if (targetId === 'mexican') targetTrain = game.mexicanTrain;
        else {
            const tp = game.players.find(p => p.id === targetId);
            if (!tp || (!isOwnTrain && !tp.isOpen)) return socket.emit('errorMsg', 'Trein gesloten!');
            targetTrain = tp.train;
        }

        let tail = getTail(targetTrain, game.startNumber);
        let finalStone = null;

        if (stone[0] === tail) finalStone = [stone[0], stone[1]];
        else if (stone[1] === tail) finalStone = [stone[1], stone[0]];
        else return socket.emit('errorMsg', 'Sluit niet aan! Moet eindigen op: ' + tail);

        const oldGameCopy = JSON.parse(JSON.stringify(game));
        targetTrain.push(finalStone);
        hand.splice(stoneIndex, 1);

        if (isOwnTrain) game.players.find(p => p.id === socket.id).isOpen = false;

        if (hand.length === 0) {
            game.players.forEach(p => {
                const pHand = game.hands[p.id] || [];
                p.totalScore += pHand.reduce((sum, s) => sum + s[0] + s[1], 0);
            });
            if (game.startNumber > 0) {
                game.startNumber -= 1; game.currentRound += 1; initRound();
                io.emit('roundEnded', { winner: game.players[game.currentTurn].name, nextRoundReady: true, game: game });
            } else {
                game.started = false; game.gameOver = true;
                const sorted = [...game.players].sort((a,b) => a.totalScore - b.totalScore);
                io.emit('roundEnded', { winner: game.players[game.currentTurn].name, nextRoundReady: false, champion: sorted[0].name, game: game });
            }
            return;
        }

        if (finalStone[0] === finalStone[1]) {
            game.requiredDouble = { active: true, value: finalStone, targetId: targetId };
            game.hasDrawn = false;
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
        const [moved] = hand.splice(fromIndex, 1);
        hand.splice(toIndex, 0, moved);
        io.emit('updateGame', game);
    });

    socket.on('disconnect', () => {
        game.players = game.players.filter(p => p.id !== socket.id);
        if(game.spectators) game.spectators = game.spectators.filter(s => s.id !== socket.id);
        delete game.hands[socket.id];
        if (game.players.length === 0) game.started = false;
        io.emit('updateGame', game);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Poort: ${PORT}`));
