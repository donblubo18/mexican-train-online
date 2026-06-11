const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
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

    // Verwijder de centrale start-dubbelsteen uit de pot
    game.boneyard = game.boneyard.filter(s => !(s[0] === game.startNumber && s[1] === game.startNumber));

    let stonesPerPlayer = game.maxStone >= 15 ? 13 : 11;
    if (game.players.length >= 7) stonesPerPlayer -= 2;

    game.players.forEach(p => {
        game.hands[p.id] = game.boneyard.splice(0, stonesPerPlayer);
        p.train = [];
        p.isOpen = false;
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
            socket.emit('errorMsg', 'De pot is leeg! Je mag passen.');
            io.emit('updateGame', game);
        }
    });

    socket.on('passTurn', () => {
        if (game.players[game.currentTurn].id !== socket.id) return;
        if (!game.hasDrawn) return socket.emit('errorMsg', 'Eerst pakken!');
        
        const player = game.players.find(p => p.id === socket.id);
        player.isOpen = true;

        game.hasDrawn = false;
        game.currentTurn = (game.currentTurn + 1) % game.players.length;
        io.emit('updateGame', game);
    });

    socket.on('playStone', ({ stoneIndex, targetId }) => {
        const playerId = socket.id;
        if (game.players[game.currentTurn].id !== playerId) return;

        const hand = game.hands[playerId];
        let stone = hand[stoneIndex];
        if (!stone) return;

        if (game.requiredDouble.active && targetId !== game.requiredDouble.targetId) {
            return socket.emit('errorMsg', `Verplicht! Leg aan op de gemarkeerde dubbel trein.`);
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
        
        if (stone[0] === tail) {
            // Sluit direct aan
        } else if (stone[1] === tail) {
            stone = [stone[1], stone[0]]; // Draai om
        } else {
            return socket.emit('errorMsg', 'Steen sluit niet aan!');
        }

        targetTrain.push(stone);
        hand.splice(stoneIndex, 1);

        if (isOwnTrain) {
            game.players.find(p => p.id === playerId).isOpen = false;
        }

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

        const isDouble = (stone[0] === stone[1]);

        if (isDouble) {
            game.requiredDouble = { active: true, value: stone, targetId: targetId };
            game.hasDrawn = false;
            socket.emit('errorMsg', 'Dubbel gelegd! Extra beurt om deze te sluiten.');
        } else {
            game.requiredDouble = { active: false, value: null, targetId: null };
            game.hasDrawn = false;
            game.currentTurn = (game.currentTurn + 1) % game.players.length;
        }

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
server.listen(PORT, () => console.log(`Server draait op poort ${PORT}`));
