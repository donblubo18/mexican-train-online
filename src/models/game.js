const Train = require('./train');
const types = require('../types');
const config = require('../config/gameConfig');

class Game {
    constructor() {
        this.players = [];
        this.spectators = []; // Hardcoded als lege array vanaf boot
        this.maxStone = config.DEFAULT_MAX_STONE;
        this.startNumber = config.DEFAULT_MAX_STONE;
        this.currentRound = 1;
        this.currentTurn = 0;
        this.started = false;
        this.gameOver = false;
        this.hasDrawn = false;
        this.requiredDouble = types.createRequiredDouble();
        this.mexicanTrain = new Train('mexican', true);
        this.boneyard = [];
    }

    getActivePlayer() {
        return this.players[this.currentTurn];
    }

    nextTurn() {
        this.hasDrawn = false;
        this.currentTurn = (this.currentTurn + 1) % this.players.length;
    }

    // Converteert de complete OOP klasse naar een plat object voor Socket.io verzending
    toPublicState() {
        const handsState = {};
        this.players.forEach(p => { handsState[p.id] = p.hand; });

        return {
            maxStone: this.maxStone,
            startNumber: this.startNumber,
            currentRound: this.currentRound,
            currentTurn: this.currentTurn,
            started: this.started,
            gameOver: this.gameOver,
            hasDrawn: this.hasDrawn,
            requiredDouble: this.requiredDouble,
            boneyard: { length: this.boneyard.length },
            mexicanTrain: this.mexicanTrain.stones,
            hands: handsState,
            spectators: this.spectators.map(s => ({ id: s.id, name: s.name })),
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                isOpen: p.isOpen,
                totalScore: p.totalScore,
                train: p.train.stones
            }))
        };
    }
}
module.exports = Game;
