const Train = require('./train');

class Player {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.isOpen = false;
        this.totalScore = 0;
        this.hand = [];
        this.train = new Train(id, false);
    }

    calculatePenalty() {
        return this.hand.reduce((sum, stone) => sum + stone[0] + stone[1], 0);
    }

    resetForNewRound() {
        this.hand = [];
        this.isOpen = false;
        this.train.clear();
    }
}
module.exports = Player;
