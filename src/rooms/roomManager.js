const Game = require('../models/game');

class RoomManager {
    constructor(io) {
        this.io = io;
        this.rooms = {}; 
        this.setupSocketEvents();
    }

    getRoomList() {
        return Object.keys(this.rooms).map(roomName => {
            const game = this.rooms[roomName];
            return {
                name: roomName,
                started: game.started,
                playerCount: game.players.length,
                spectatorCount: game.spectators ? game.spectators.length : 0
            };
        });
    }

    setupSocketEvents() {
        this.io.on('connection', (socket) => {
            console.log(`Gebruiker verbonden: ${socket.id}`);
            let currentRoom = null;

            socket.emit('roomListUpdate', this.getRoomList());

            // REPARATIE: Maakt kamer aan én slaat op wie de maker (creator) is
            socket.on('createRoom', ({ roomName, playerName }) => {
                const rName = roomName.trim();
                const pName = playerName.trim();
                
                if (!pName) return socket.emit('errorMsg', 'Vul eerst je spelersnaam in bovenin!');
                if (!rName) return socket.emit('errorMsg', 'Kamer naam mag niet leeg zijn.');
                if (this.rooms[rName]) return socket.emit('errorMsg', 'Deze kamer bestaat al!');

                // Maak de kamer aan en wijs de maker toe
                const newGame = new Game();
                newGame.creatorId = socket.id; // Sla de Socket-ID van de maker op
                this.rooms[rName] = newGame;
                
                console.log(`Kamer '${rName}' succesvol aangemaakt door ${pName}`);

                // Voeg de maker DIRECT automatisch toe aan zijn eigen kamer
                const res = newGame.addPlayer(socket.id, pName);
                if (res.error) return socket.emit('errorMsg', res.error);

                currentRoom = rName;
                socket.join(rName);
                socket.emit('joinSuccess', rName);
                
                this.io.to(rName).emit('updateGame', newGame.toPublicState());
                this.io.emit('roomListUpdate', this.getRoomList());
            });

            socket.on('joinGame', ({ roomName, playerName }) => {
                const game = this.rooms[roomName];
                if (!game) return socket.emit('errorMsg', 'Kamer niet gevonden.');
                
                const res = game.addPlayer(socket.id, playerName);
                if (res.error) return socket.emit('errorMsg', res.error);

                currentRoom = roomName;
                socket.join(roomName);
                socket.emit('joinSuccess', roomName);
                this.io.to(roomName).emit('updateGame', game.toPublicState());
                this.io.emit('roomListUpdate', this.getRoomList());
            });

            socket.on('joinAsSpectator', (roomName) => {
                const game = this.rooms[roomName];
                if (!game) return socket.emit('errorMsg', 'Kamer niet gevonden.');

                const res = game.addSpectator(socket.id);
                if (res.error) return socket.emit('errorMsg', res.error);

                currentRoom = roomName;
                socket.join(roomName);
                socket.emit('joinSuccess', roomName);
                this.io.to(roomName).emit('updateGame', game.toPublicState());
                this.io.emit('roomListUpdate', this.getRoomList());
            });

            socket.on('startGame', (maxStone) => {
                if (!currentRoom) return;
                const game = this.rooms[currentRoom];
                if (!game) return;

                // REPARATIE: Beveiliging aan de backend -> Alleen de maker mag starten!
                if (game.creatorId !== socket.id) {
                    return socket.emit('errorMsg', 'Alleen de maker van deze kamer mag het spel starten.');
                }

                game.start(maxStone);
                this.io.to(currentRoom).emit('gameStarted');
                this.io.to(currentRoom).emit('updateGame', game.toPublicState());
                
                const firstPlayer = game.players[game.currentTurn];
                if (firstPlayer) {
                    this.io.to(firstPlayer.id).emit('playSound', 'turn');
                }
                this.io.emit('roomListUpdate', this.getRoomList());
            });

            socket.on('drawStone', () => {
                if (!currentRoom) return;
                const game = this.rooms[currentRoom];
                if (game && game.drawStone(socket.id)) {
                    this.io.to(currentRoom).emit('updateGame', game.toPublicState());
                }
            });

            socket.on('passTurn', () => {
                if (!currentRoom) return;
                const game = this.rooms[currentRoom];
                if (!game) return;

                const oldGame = JSON.parse(JSON.stringify(game.toPublicState()));
                if (game.passTurn(socket.id)) {
                    this.checkSoundTriggers(currentRoom, oldGame, game.toPublicState());
                    this.io.to(currentRoom).emit('updateGame', game.toPublicState());
                }
            });

            socket.on('playStone', ({ stoneIndex, targetId }) => {
                if (!currentRoom) return;
                const game = this.rooms[currentRoom];
                if (!game) return;

                const oldGame = JSON.parse(JSON.stringify(game.toPublicState()));
                const res = game.playStone(socket.id, stoneIndex, targetId);
                if (res && res.error) return socket.emit('errorMsg', res.error);
                
                if (res && res.roundEnded) {
                    this.io.to(currentRoom).emit('roundEnded', res);
                } else {
                    this.checkSoundTriggers(currentRoom, oldGame, game.toPublicState());
                    this.io.to(currentRoom).emit('updateGame', game.toPublicState());
                }
            });

            socket.on('reorderHand', ({ fromIndex, toIndex }) => {
                if (!currentRoom) return;
                const game = this.rooms[currentRoom];
                if (game) {
                    game.reorderHand(socket.id, fromIndex, toIndex);
                    this.io.to(currentRoom).emit('updateGame', game.toPublicState());
                }
            });

            socket.on('disconnect', () => {
                if (currentRoom) {
                    const game = this.rooms[currentRoom];
                    if (game) {
                        game.removeUser(socket.id);
                        this.io.to(currentRoom).emit('updateGame', game.toPublicState());
                        if (game.players.length === 0 && game.spectators.length === 0) {
                            delete this.rooms[currentRoom];
                        }
                    }
                }
                this.io.emit('roomListUpdate', this.getRoomList());
                console.log(`Gebruiker verbroken: ${socket.id}`);
            });
        });
    }

    checkSoundTriggers(roomName, oldG, newG) {
        if (oldG.currentTurn !== newG.currentTurn) {
            const nextPlayer = newG.players[newG.currentTurn];
            if (nextPlayer) this.io.to(nextPlayer.id).emit('playSound', 'turn');
        }
        newG.players.forEach(p => {
            const oldP = oldG.players.find(x => x.id === p.id);
            if (p.isOpen && (!oldP || !oldP.isOpen)) this.io.to(roomName).emit('playSound', 'trainOpen');
            if (p.handCount === 1 && (!oldP || oldP.handCount > 1)) this.io.to(roomName).emit('playSound', 'knock');
        });
    }
}

module.exports = RoomManager;
