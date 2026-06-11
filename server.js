const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

let game = {
    players: [],
    spectators: [],
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
    return train[train.length - 1]; 
}

// Officiele toernooiregels voor aantal startstenen per speler
function getOfficialStoneCount(playerCount, maxStone) {
    if (maxStone <= 12) {
        if (playerCount <= 4) return 15;
        if (playerCount <= 6) return 12;
        return 11; // 7 tot 8 spelers
    } else {
        if (playerCount <= 4) return 15;
        if (playerCount <= 6) return 13;
        return 11; // Bij sets groter dan 12 corrigeren we dit conform toernooirichtlijnen
    }
}

function initRound() {
    game.boneyard = generateDeck(game.maxStone);
    game.mexicanTrain = [];
    game.currentTurn = (game.currentRound - 1) % game.players.length;
    game.hasDrawn = false;
    game.requiredDouble = { active: false, value: null, targetId: null };

    // Haal start-dubbelsteen uit de pot
    game.boneyard = game.boneyard.filter(s => !(s[0] === game.startNumber && s[1] === game.startNumber));

    const stonesPerPlayer = getOfficialStoneCount(game.players.length, game.maxStone);

    game.players.forEach(p => {
        game.hands[p.id] = game.boneyard.splice(0, stonesPerPlayer);
        p.train = [];
        p.isOpen = false;
    });
}

function getSanitizedGame(socketId) {
    let copy = JSON.parse(JSON.stringify(game));
    let isSpectator = game.spectators.includes(socketId);
    
    // Cruciale bugfix: Verberg de inhoud van andere spelers hun handen!
    // Alleen je eigen hand is zichtbaar, tenzij je toeschouwer bent (dan zie je niets)
    for (let id in copy.hands) {
        if (isSpectator || id !== socketId) {
            copy.hands[id] = copy.hands[id].map(() => ['?', '?']);
        }
    }
    return copy;
}

function broadcastState() {
    io.sockets.sockets.forEach((socket) => {
        socket.emit('updateGame', getSanitizedGame(socket.id));
    });
}

io.on('connection', (socket) => {
    socket.on('joinGame', (name) => {
        if (game.started) return socket.emit('errorMsg', 'Spel is al gestart. Je kunt alleen nog meekijken.');
        
        // Bugfix: Blokkeer als deze socket al in het spel zit
        if (game.players.some(p => p.id === socket.id) || game.spectators.includes(socket.id)) {
            return socket.emit('errorMsg', 'Je doet al mee!');
        }

        if (game.players.length >= 8) {
            game.spectators.push(socket.id);
            socket.emit('errorMsg', 'Het spel is vol (max 8). Je bent nu toeschouwer.');
        } else {
            game.players.push({ id: socket.id, name: name, isOpen: false, train: [], totalScore: 0 });
        }
        broadcastState();
    });

    socket.on('joinAsSpectator', () => {
        if (game.players.some(p => p.id === socket.id) || game.spectators.includes(socket.id)) {
            return socket.emit('errorMsg', 'Je zit al in de sessie!');
        }
        game.spectators.push(socket.id);
        broadcastState();
    });

    socket.on('startGame', (maxStone) => {
        if (game.started) return;
        let parsed = parseInt(maxStone);
        if (isNaN(parsed) || parsed < 0) return socket.emit('errorMsg', 'Vul een geldig getal in!');

        game.maxStone = parsed;
        game.startNumber = game.maxStone;
        game.currentRound = 1;
        game.gameOver = false;
        game.started = true;
        
        game.players.forEach(p => p.totalScore = 0);
        initRound();
        
        io.emit('gameStarted');
        broadcastState();
    });

    socket.on('reorderHand', (newHand) => {
        if (!game.started || !game.hands[socket.id]) return;
        // Valideer of de speler niet stiekem stenen verzint tijdens het slepen
        if (newHand.length === game.hands[socket.id].length) {
            game.hands[socket.id] = newHand;
        }
    });

    socket.on('drawStone', () => {
        if (!game.started || game.players[game.currentTurn].id !== socket.id) return;
        if (game.hasDrawn) return socket.emit('errorMsg', 'Je hebt al gepakt!');

        if (game.boneyard.length > 0) {
            const stone = game.boneyard.pop();
            game.hands[socket.id].push(stone);
            game.hasDrawn = true;
            broadcastState();
        } else {
            game.hasDrawn = true;
            socket.emit('errorMsg', 'De pot is leeg! Je mag passen.');
            broadcastState();
        }
    });

    socket.on('passTurn', () => {
        if (!game.started || game.players[game.currentTurn].id !== socket.id) return;
        if (!game.hasDrawn) return socket.emit('errorMsg', 'Eerst pakken!');
        
        const player = game.players.find(p => p.id === socket.id);
        const wasOpen = player.isOpen;
        player.isOpen = true;

        // Geluid triggeren als een trein open gaat
        if (!wasOpen) io.emit('soundTrigger', 'train');

        game.hasDrawn = false;
        game.currentTurn = (game.currentTurn + 1) % game.players.length;
        
        io.emit('soundTrigger', 'ping');
        broadcastState();
    });

    socket.on('playStone', ({ stoneIndex, targetId }) => {
        const playerId = socket.id;
        if (!game.started || game.players[game.currentTurn].id !== playerId) return;

        const hand = game.hands[playerId];
        let stone = hand[stoneIndex];
        if (!stone) return;

        if (game.requiredDouble.active && targetId !== game.requiredDouble.targetId) {
            return socket.emit('errorMsg', `Verplicht! Leg aan op de gemarkeerde dubbel-trein.`);
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

        // Klop geluid sturen als iemand nog maar 1 steen heeft
        if (hand.length === 1) {
            io.emit('soundTrigger', 'knock');
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
            broadcastState();
            return;
        }

        const isDouble = (stone[0] === stone[1]);

        if (isDouble) {
            game.requiredDouble = { active: true, value: stone[0], targetId: targetId };
            game.hasDrawn = false;
            socket.emit('errorMsg', 'Dubbel gelegd! Extra beurt om deze te sluiten.');
        } else {
            game.requiredDouble = { active: false, value: null, targetId: null };
            game.hasDrawn = false;
            game.currentTurn = (game.currentTurn + 1) % game.players.length;
            io.emit('soundTrigger', 'ping');
        }

        broadcastState();
    });

    socket.on('disconnect', () => {
        game.players = game.players.filter(p => p.id !== socket.id);
        game.spectators = game.spectators.filter(id => id !== socket.id);
        delete game.hands[socket.id];
        if (game.players.length === 0) game.started = false;
        broadcastState();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server draait op poort ${PORT}`));
