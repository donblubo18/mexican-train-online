const Game = require('../models/game');

class RoomManager {
    constructor(io) {
        this.io = io;
        this.game = new Game();
        this.setupSocketEvents();
    }

    setupSocketEvents() {
        this.io.on('connection', (socket) => {
            console.log(`Gebruiker verbonden: ${socket.id}`);

            socket.on('joinGame', (name) => {
                const res = this.game.addPlayer(socket.id, name);
                if (res.error) return socket.emit('errorMsg', res.error);
                socket.emit('joinSuccess');
                this.io.emit('updateGame', this.game.toPublicState());
            });

            socket.on('joinAsSpectator', () => {
                const res = this.game.addSpectator(socket.id);
                if (res.error) return socket.emit('errorMsg', res.error);
                socket.emit('joinSuccess');
                this.io.emit('updateGame', this.game.toPublicState());
            });

            socket.on('startGame', (maxStone) => {
                this.game.start(maxStone);
                this.io.emit('gameStarted');
                this.io.emit('updateGame', this.game.toPublicState());
                // Trigger altijd beurtgeluid voor de allereerste speler die mag beginnen
                this.io.emit('playSound', 'turn');
            });

            socket.on('drawStone', () => {
                const success = this.game.drawStone(socket.id);
                if (success) this.io.emit('updateGame', this.game.toPublicState());
            });

            socket.on('passTurn', () => {
                const oldGame = JSON.parse(JSON.stringify(this.game.toPublicState()));
                const success = this.game.passTurn(socket.id);
                if (success) {
                    this.checkSoundTriggers(oldGame, this.game.toPublicState());
                    this.io.emit('updateGame', this.game.toPublicState());
                }
            });

            socket.on('playStone', ({ stoneIndex, targetId }) => {
                const oldGame = JSON.parse(JSON.stringify(this.game.toPublicState()));
                const res = this.game.playStone(socket.id, stoneIndex, targetId);
                if (res && res.error) return socket.emit('errorMsg', res.error);
                
                if (res && res.roundEnded) {
                    this.io.emit('roundEnded', res);
                } else {
                    this.checkSoundTriggers(oldGame, this.game.toPublicState());
                    this.io.emit('updateGame', this.game.toPublicState());
                }
            });

            socket.on('reorderHand', ({ fromIndex, toIndex }) => {
                this.game.reorderHand(socket.id, fromIndex, toIndex);
                this.io.emit('updateGame', this.game.toPublicState());
            });

            socket.on('disconnect', () => {
                this.game.removeUser(socket.id);
                this.io.emit('updateGame', this.game.toPublicState());
                console.log(`Gebruiker verbroken: ${socket.id}`);
            });
        });
    }

    // Gecorrigeerde triggers op basis van de toPublicState data
    checkSoundTriggers(oldG, newG) {
        // 1. Controleer beurtwissel (turn ping)
        if (oldG.currentTurn !== newG.currentTurn) {
            this.io.emit('playSound', 'turn');
        }
        
        // 2. Controleer open trein en kloppen (1 steen over)
        newG.players.forEach(p => {
            const oldP = oldG.players.find(x => x.id === p.id);
            
            // Trein gaat open
            if (p.isOpen && (!oldP || !oldP.isOpen)) {
                this.io.emit('playSound', 'trainOpen');
            }
            
            // Speler komt op exact 1 steen (houten klopgeluid)
            if (p.handCount === 1 && (!oldP || oldP.handCount > 1)) {
                this.io.emit('playSound', 'knock');
            }
        });
    }
}

module.exports = RoomManager;
