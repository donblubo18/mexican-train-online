const Game = require('../models/game');

class RoomManager {
    constructor(io) {
        this.io = io;
        this.rooms = {}; // Houdt meerdere actieve kamers bij: { kamernaam: GameInstance }
        this.setupSocketEvents();
    }

    // Genereer een overzicht van alle kamers voor het startscherm
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

            // Stuur direct de actieve kamers naar de nieuwe bezoeker
            socket.emit('roomListUpdate', this.getRoomList());

            socket.on('createRoom', (roomName) => {
                const name = roomName.trim();
                if (!name) return socket.emit('errorMsg', 'Kamer naam mag niet leeg zijn.');
                if (this.rooms[name]) return socket.emit('errorMsg', 'Deze kamer bestaat al!');

                this.rooms[name] = new Game();
                console.log(`Nieuwe kamer aangemaakt: ${name}`);
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

                game.start(maxStone);
                this.io.to(currentRoom).emit('gameStarted');
                this.io.to(currentRoom).emit('updateGame', game.toPublicState());
                this.io.to(currentRoom).emit('playSound', 'turn');
                this.io.emit('roomListUpdate', this.getRoomList()); // Update 'bezig' status op startscherm
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
                        
                        // Verwijder lege kamers automatisch om serverruimte te besparen
                        if (game.players.length === 0 && game.spectators.length === 0) {
                            delete this.rooms[currentRoom];
                            console.log(`Kamer opgeruimd wegens inactiviteit: ${currentRoom}`);
                        }
                    }
                }
                this.io.emit('roomListUpdate', this.getRoomList());
                console.log(`Gebruiker verbroken: ${socket.id}`);
            });
        });
    }

    checkSoundTriggers(roomName, oldG, newG) {
        if (oldG.currentTurn !== newG.currentTurn) this.io.to(roomName).emit('playSound', 'turn');
        newG.players.forEach(p => {
            const oldP = oldG.players.find(x => x.id === p.id);
            if (p.isOpen && (!oldP || !oldP.isOpen)) this.io.to(roomName).emit('playSound', 'trainOpen');
            if (p.handCount === 1 && (!oldP || oldP.handCount > 1)) this.io.to(roomName).emit('playSound', 'knock');
        });
    }
}

module.exports = RoomManager;
