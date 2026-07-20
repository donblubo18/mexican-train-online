// Blueprints om datastructuren waterdicht te synchroniseren tussen server en client
module.exports = {
    createRequiredDouble: () => ({ active: false, value: null, targetId: null }),
    createPlayerState: (id, name) => ({ id, name, isOpen: false, train: [], totalScore: 0 }),
    createSpectatorState: (id, name) => ({ id, name })
};
