module.exports = {
    DEFAULT_MAX_STONE: 12,
    MIN_BONEYARD_RESERVE: 25,
    MAX_PLAYERS: 8,
    
    // Officiële toernooiregels voor stenenverdeling per spelersaantal
    getInitialStonesCount: (maxStone, numPlayers) => {
        if (maxStone === 12) {
            if (numPlayers <= 4) return 15;
            if (numPlayers <= 6) return 12;
            return 11;
        } else if (maxStone === 15) {
            if (numPlayers <= 4) return 19;
            if (numPlayers <= 6) return 15;
            return 13;
        }
        // Dynamische fallback voor afwijkende sets (bijv. dubbel 9 of 18)
        return 10;
    }
};
