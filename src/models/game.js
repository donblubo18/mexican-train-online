const { generateDeck } = require('./domino');
const { getStonesPerPlayer } = require('../config/gameConfig');
const { validateAndOrient } = require('./train');

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
        if (this.started) return { error: 'Spel al begonnen! Je kunt wel meekijken als toeschouwer.' };
        if (this.players.length >= 8) return { error: 'Spel is vol. Maximaal 8 spelers toegestaan.' };  
        // REPARATIE BUG: Controleer of de naam al bestaat in deze kamer (ongeacht hoofdletters)
        const nameExists = this.players.some(p => p.name.toLowerCase() === name.toLowerCase());
        if (nameExists) return { error: 'Deze naam is al in gebruik in deze kamer! Kies een andere naam.' };
        
        this.players.push({ id, name, isOpen: false, train: [], totalScore: 0 });
        return { success: true };
    }

    addSpectator(id) {
        if (this.players.some(p => p.id === id)) return { error: 'Je bent al speler!' };
        const specName = "Kijker " + (this.spectators.length + 1);
             // REPARATIE BUG: Controleer of de naam al bestaat in deze kamer (ongeacht hoofdletters)
        const nameExists = this.players.some(p => p.name.toLowerCase() === name.toLowerCase());
        if (nameExists) return { error: 'Deze naam is al in gebruik in deze kamer! Kies een andere naam.' };
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
        this.spectators = this.spectators || [];
        this.players.forEach(p => p.totalScore = 0);
        this.initRound();
    }

    initRound() {
        this.boneyard = generateDeck(this.maxStone);
        this.mexicanTrain = [];
        this.currentTurn = (this.currentRound - 1) % this.players.length;
        this.hasDrawn = false;
        this.requiredDouble = { active: false, value: null, targetId: null };

        this.boneyard = this.boneyard.filter(s => !(s[0] === this.startNumber && s[1] === this.startNumber));
        const stones = getStonesPerPlayer(this.maxStone, this.players.length);

        this.players.forEach(p => {
            this.hands[p.id] = this.boneyard.splice(0, stones);
            p.train = [];
            p.isOpen = false;
        });
    }

    drawStone(id) {
        if (this.players[this.currentTurn].id !== id || this.hasDrawn) return false;
        if (this.boneyard.length > 0) this.hands[id].push(this.boneyard.pop());
        this.hasDrawn = true;
        return true;
    }

    passTurn(id) {
        if (this.players[this.currentTurn].id !== id || !this.hasDrawn) return false;
        this.players.find(p => p.id === id).isOpen = true;
        this.hasDrawn = false;
        this.currentTurn = (this.currentTurn + 1) % this.players.length;
        return true;
    }

    playStone(id, stoneIndex, targetId) {
        if (this.players[this.currentTurn].id !== id) return { error: 'Niet jouw beurt!' };
        const hand = this.hands[id];
        let stone = hand ? hand[stoneIndex] : null;
        if (!stone) return { error: 'Steen bestaat niet.' };

        if (this.requiredDouble.active && targetId !== this.requiredDouble.targetId) {
            return { error: 'Verplicht op de rode dubbelsteen!' };
        }

        let targetTrain = targetId === 'mexican' ? this.mexicanTrain : this.players.find(p => p.id === targetId)?.train;
        if (!targetTrain) return { error: 'Trein niet gevonden.' };
        if (targetId !== 'mexican' && targetId !== id && !this.players.find(p => p.id === targetId).isOpen) {
            return { error: 'Trein is gesloten!' };
        }

        const oriented = validateAndOrient(stone, targetTrain, this.startNumber);
        if (!oriented) return { error: 'Steen sluit niet aan.' };

        targetTrain.push(oriented);
        hand.splice(stoneIndex, 1);

        if (id === targetId) this.players.find(p => p.id === id).isOpen = false;

        if (hand.length === 0) {
            this.players.forEach(p => {
                const pHand = this.hands[p.id] || [];
                p.totalScore += pHand.reduce((sum, s) => sum + s[0] + s[1], 0);
            });
            if (this.startNumber > 0) {
                this.startNumber -= 1; this.currentRound += 1; this.initRound();
                return { roundEnded: true, winner: this.players[this.currentTurn].name, nextRoundReady: true, game: this };
            } else {
                this.started = false; this.gameOver = true;
                const sorted = [...this.players].sort((a,b) => a.totalScore - b.totalScore);
                return { roundEnded: true, winner: this.players[this.currentTurn].name, nextRoundReady: false, champion: sorted[0].name, game: this };
            }
        }

        if (oriented[0] === oriented[1]) {
            this.requiredDouble = { active: true, value: oriented, targetId: targetId };
            this.hasDrawn = false;
        } else {
            this.requiredDouble = { active: false, value: null, targetId: null };
            this.hasDrawn = false;
            this.currentTurn = (this.currentTurn + 1) % this.players.length;
        }
        return { success: true };
    }

    reorderHand(id, from, to) {
        const hand = this.hands[id];
        if (!hand) return;
        const [moved] = hand.splice(from, 1);
        hand.splice(to, 0, moved);
    }

    getState() { return this; }

        toPublicState() {
        const publicPlayers = this.players.map(p => ({
            id: p.id,
            name: p.name,
            isOpen: p.isOpen,
            train: p.train || [],
            totalScore: p.totalScore || 0,
            handCount: this.hands[p.id] ? this.hands[p.id].length : 0 
        }));

        return {
            players: publicPlayers,
            spectators: this.spectators || [],
            creatorId: this.creatorId || null, // REPARATIE: Stuurt de ID van de maker mee naar de frontend
            maxStone: this.maxStone,
            boneyardCount: this.boneyard ? this.boneyard.length : 0,
            mexicanTrain: this.mexicanTrain || [],
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
