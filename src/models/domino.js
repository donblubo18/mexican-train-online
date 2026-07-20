function generateDeck(max) {
    let deck = [];
    for (let i = 0; i <= max; i++) {
        for (let j = i; j <= max; j++) {
            deck.push([i, j]);
        }
    }
    return deck.sort(() => Math.random() - 0.5);
}

module.exports = { generateDeck };
