class Domino {
    // Controleert of een steen aansluit op het openstaande cijfer (tail) van een trein
    static canConnect(stone, tail) {
        if (!Array.isArray(stone) || stone.length !== 2) return false;
        return stone[0] === tail || stone[1] === tail;
    }

    // Draait de steen om indien de rechterkant moet aansluiten
    static orient(stone, tail) {
        if (stone[0] === tail) return [stone[0], stone[1]];
        if (stone[1] === tail) return [stone[1], stone[0]];
        return null;
    }

    static isDouble(stone) {
        return Array.isArray(stone) && stone[0] === stone[1];
    }
}
module.exports = Domino;
