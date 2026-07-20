const { generateDeck } = require('./domino');
const { getStonesPerPlayer } = require('../config/gameConfig');

class Game {
    constructor() {
        this.players = [];
        this.spectators = [];
        this.maxStone = 12;
        this.boneyard = [];
        this.mexicanTrain = [];
        this.hands = {};
        this.currentTurn = 0;
        this.started = false;
        this.startNumber = 12;
        this.currentRound = 1;
        this.gameOver = false;
        this.hasDrawn = false;
        this.requiredDouble = { active: false, value: null, targetId: null };
    }

    addPlayer(id, name) {
        if (this.started) return { error: 'Spel al begonnen!' };
        if (this.players.length >= 8) return { error: 'Spel is vol!' };
        
        this.players.push({ id, name, isOpen: false, train: [], totalScore: 0 });
        return { success: true };
    }

    addSpectator(id) {
        const isPlayer = this.players.some(p => p.id === id);
        if (isPlayer) return { error: 'Je bent al een actieve speler!' };
        
        const specName = `Kijker ${this.spectators.length + 1}`;
        this.spectators.push({ id, name: specName });
        return { success: true };
    }

    removeUser(id) {
        this.players = this.players.filter(p => p.id !== id);
        this.spectators = this.spectators.filter(s => s.id !== id);
        delete this.hands[id];
        if (this.players.length === 0) this.started = false;
    }

    start(maxStone) {
        this.maxStone = parseInt(maxStone) || 12;
        this.startNumber = this.maxStone;
        this.currentRound = 1;
        this.gameOver = false;
        this.started = true;
        this.players.forEach(p => p.totalScore = 0);
        this.initRound();
    }

    initRound() {
        this.boneyard = generateDeck(this.maxStone);
        this.mexicanTrain = [];
        this.currentTurn = (this.currentRound - 1) % this.players.length;
        this.hasDrawn = false;
        this.requiredDouble = { active: false, value: null, targetId: null };

        // Filter de start-dubbelsteen uit de pot
        this.boneyard = this.boneyard.filter(s => !(s[0] === this.startNumber && s[1] === this.startNumber));

        const stonesPerPlayer = getStonesPerPlayer(this.maxStone, this.players.length);

        this.players.forEach(p => {
            this.hands[p.id] = this.boneyard.splice(0, stonesPerPlayer);
            p.train = [];
            p.isOpen = false;
        });
    }

    drawStone(playerId) {
        const activePlayer = this.players[this.currentTurn];
        if (!activePlayer || activePlayer.id !== playerId || this.hasDrawn) return false;

        if (this.boneyard.length > 0) {
            this.hands[playerId].push(this.boneyard.pop());
        }
        this.hasDrawn = true;
        return true;
    }

    passTurn(playerId) {
        const activePlayer = this.players[this.currentTurn];
        if (!activePlayer || activePlayer.id !== playerId || !this.hasDrawn) return false;

        activePlayer.isOpen = true;
        this.hasDrawn = false;
        this.currentTurn = (this.currentTurn + 1) % this.players.length;
        return true;
    }

    getState() {
        return {
            players: this.players,
            spectators: this.spectators,
            maxStone: this.maxStone,
            boneyard: this.boneyard,
            mexicanTrain: this.mexicanTrain,
            hands: this.hands,
            currentTurn: this.currentTurn,
            started: this.started,
            startNumber: this.startNumber,
            currentRound: this.currentRound,
            gameOver: this.gameOver,
            hasDrawn: this.hasDrawn,
            requiredDouble: this.requiredDouble
        };
    }
}

module.exports = Game;
