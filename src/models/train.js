function getTail(train, startNumber) {
    if (!train || train.length === 0) return startNumber;
    const lastStone = train[train.length - 1];
    return lastStone[1]; 
}

function validateAndOrient(stone, train, startNumber) {
    const tail = getTail(train, startNumber);
    if (stone[0] === tail) return [stone[0], stone[1]];
    if (stone[1] === tail) return [stone[1], stone[0]];
    return null;
}

module.exports = { getTail, validateAndOrient };
