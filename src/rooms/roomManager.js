const Player = require('../models/player');
const Domino = require('../models/domino');
const Game = require('../models/game');

module.exports = (io, game) => {
    io.on('connection', (socket) => {

        socket.on('joinGame', (name) => {
            if (game.started) return socket.emit('errorMsg', 'Spel is al begonnen!');
            if (game.players.length >= 8) return socket.emit('errorMsg', 'Spel is vol.');
            
            game.players.push(new Player(socket.id, name));
            socket.emit('joinSuccess');
            io.emit('updateGame', game.toPublicState());
        });

        socket.on('joinAsSpectator', () => {
            if (game.players.some(p => p.id === socket.id)) return socket.emit('errorMsg', 'Je bent al een actieve speler!');
            game.spectators.push({ id: socket.id, name: `Kijker ${game.spectators.length + 1}` });
            socket.emit('joinSuccess');
            io.emit('updateGame', game.toPublicState());
        });

        socket.on('startGame', (maxStone) => {
            game.maxStone = parseInt(maxStone) || 12;
            game.startNumber = game.maxStone;
            game.currentRound = 1;
            game.gameOver = false;
            game.started = true;
            game.players.forEach(p => p.totalScore = 0);
            
            GameEngine.startRound(game);
            io.emit('gameStarted', game.toPublicState());
            io.emit('updateGame', game.toPublicState());
        });

        socket.on('drawStone', () => {
            if (game.getActivePlayer().id !== socket.id || game.hasDrawn) return;
            if (game.boneyard.length > 0) {
                game.getActivePlayer().hand.push(game.boneyard.pop());
            }
            game.hasDrawn = true;
            io.emit('updateGame', game.toPublicState());
        });

        socket.on('passTurn', () => {
            if (game.getActivePlayer().id !== socket.id || !game.hasDrawn) return;
            GameEngine.executePass(game, socket.id);
            io.emit('playSound', 'trainOpen');
            io.emit('updateGame', game.toPublicState());
        });

        socket.on('playStone', ({ stoneIndex, targetId }) => {
            const activePlayer = game.getActivePlayer();
            if (activePlayer.id !== socket.id) return;

            const stone = activePlayer.hand[stoneIndex];
            if (!stone) return;

            if (game.requiredDouble.active && targetId !== game.requiredDouble.targetId) {
                return socket.emit('errorMsg', 'Je bent verplicht op de dubbel te spelen!');
            }

            let targetTrain = targetId === 'mexican' ? game.mexicanTrain : game.players.find(p => p.id === targetId)?.train;
            if (!targetTrain || (targetId !== socket.id && !targetTrain.isMexican && !game.players.find(p => p.id === targetId).isOpen)) {
                return socket.emit('errorMsg', 'Deze trein is gesloten!');
            }

            const tail = targetTrain.getTail(game.startNumber);
            const oriented = Domino.orient(stone, tail);
            if (!oriented) return socket.emit('errorMsg', `Steen sluit niet aan! Vereist: ${tail}`);

            targetTrain.addStone(oriented);
            activePlayer.hand.splice(stoneIndex, 1);

            if (targetId === socket.id) activePlayer.isOpen = false;

            if (activePlayer.hand.length === 0) {
                const res = GameEngine.processRoundEnd(game);
                if (res.nextRoundReady) {
                    io.emit('roundEnded', { winner: activePlayer.name, nextRoundReady: true, game: game.toPublicState() });
                } else {
                    const champion = [...game.players].sort((a,b) => a.totalScore - b.totalScore)[0].name;
                    io.emit('roundEnded', { winner: activePlayer.name, nextRoundReady: false, champion: champion, game: game.toPublicState() });
                }
                return;
            }

            if (Domino.isDouble(oriented)) {
                game.requiredDouble = { active: true, value: oriented, targetId: targetId };
                game.hasDrawn = false;
            } else {
                game.requiredDouble = { active: false, value: null, targetId: null };
                game.nextTurn();
            }

            if (activePlayer.hand.length === 1) io.emit('playSound', 'knock');
            io.emit('playSound', 'turn');
            io.emit('updateGame', game.toPublicState());
        });

        socket.on('reorderHand', ({ fromIndex, toIndex }) => {
            const hand = game.hands ? game.hands[socket.id] : game.players.find(p => p.id === socket.id)?.hand;
            if (!hand) return;
            const [moved] = hand.splice(fromIndex, 1);
            hand.splice(toIndex, 0, moved);
            io.emit('updateGame', game.toPublicState());
        });

        socket.on('disconnect', () => {
            game.players = game.players.filter(p => p.id !== socket.id);
            game.spectators = game.spectators.filter(s => s.id !== socket.id);
            if (game.players.length === 0) game.started = false;
            io.emit('updateGame', game.toPublicState());
        });
    });
};
