function getStonesPerPlayer(maxStone, numPlayers) {
    let stones = 11;

    if (maxStone === 12) {
        if (numPlayers >= 2 && numPlayers <= 4) stones = 15;
        else if (numPlayers >= 5 && numPlayers <= 6) stones = 12;
        else stones = 11;
    } else if (maxStone === 15) {
        if (numPlayers >= 2 && numPlayers <= 4) stones = 19;
        else if (numPlayers >= 5 && numPlayers <= 6) stones = 15;
        else stones = 13;
    } else {
        stones = Math.floor((maxStone * 6 - 25) / numPlayers);
        if (stones > 20) stones = 20;
        if (stones < 5) stones = 5;
    }
    return stones;
}

module.exports = { getStonesPerPlayer };
