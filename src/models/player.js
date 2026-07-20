class Player {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.isOpen = false;
        this.train = [];
        this.totalScore = 0;
    }
}
module.exports = Player;
