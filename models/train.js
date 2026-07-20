class Train {
    constructor(ownerId, isMexican = false) {
        this.ownerId = ownerId;
        this.isMexican = isMexican;
        this.stones = [];
    }

    getTail(startNumber) {
        if (this.stones.length === 0) return startNumber;
        const lastStone = this.stones[this.stones.length - 1];
        return lastStone[1]; // Het openstaande eindcijfer van de laatst gelegde steen
    }

    addStone(orientedStone) {
        this.stones.push(orientedStone);
    }

    clear() {
        this.stones = [];
    }
}
module.exports = Train;
