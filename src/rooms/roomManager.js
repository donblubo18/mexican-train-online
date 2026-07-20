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
            });

            socket.on('drawStone', () => {
                const success = this.game.drawStone(socket.id);
                if (success) this.io.emit('updateGame', this.game.toPublicState());
            });

            socket.on('passTurn', () => {
                const oldGame = JSON.parse(JSON.stringify(this.game.getState()));
                const success = this.game.passTurn(socket.id);
                if (success) {
                    this.checkSoundTriggers(oldGame, this.game.getState());
                    this.io.emit('updateGame', this.game.toPublicState());
                }
            });

            socket.on('playStone', ({ stoneIndex, targetId }) => {
                const oldGame = JSON.parse(JSON.stringify(this.game.getState()));
                const res = this.game.playStone(socket.id, stoneIndex, targetId);
                if (res && res.error) return socket.emit('errorMsg', res.error);
                
                if (res && res.roundEnded) {
                    this.io.emit('roundEnded', res);
                } else {
                    this.checkSoundTriggers(oldGame, this.game.getState());
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

    checkSoundTriggers(oldG, newG) {
        if (oldG.currentTurn !== newG.currentTurn) this.io.emit('playSound', 'turn');
        newG.players.forEach(p => {
            const oldP = oldG.players.find(x => x.id === p.id);
            if (p.isOpen && (!oldP || !oldP.isOpen)) this.io.emit('playSound', 'trainOpen');
            const newLen = newG.hands[p.id] ? newG.hands[p.id].length : 0;
            const oldLen = oldG.hands[p.id] ? oldG.hands[p.id].length : 0;
            if (newLen === 1 && oldLen > 1) this.io.emit('playSound', 'knock');
        });
    }
}

module.exports = RoomManager;
