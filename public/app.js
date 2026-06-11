const socket = io();
let selectedStoneIndex = null;
let selectedTrainId = null;

function join() {
    const name = document.getElementById('nameInp').value.trim();
    if(name) socket.emit('joinGame', name);
}

function start() {
    const max = document.getElementById('maxStoneInp').value;
    socket.emit('startGame', max);
}

function draw() { socket.emit('drawStone'); }
function pass() { socket.emit('passTurn'); }

function selectStone(index, displayValue) {
    selectedStoneIndex = index;
    document.getElementById('selectedStoneLabel').innerText = displayValue;
    checkAndExecute();
}

function selectTrain(id) {
    selectedTrainId = id;
    checkAndExecute();
}

function checkAndExecute() {
    if (selectedStoneIndex !== null && selectedTrainId !== null) {
        socket.emit('playStone', { stoneIndex: selectedStoneIndex, targetId: selectedTrainId });
        selectedStoneIndex = null;
        selectedTrainId = null;
        document.getElementById('selectedStoneLabel').innerText = "-";
    }
}

socket.on('errorMsg', (msg) => alert(msg));

socket.on('updateGame', (game) => {
    const list = document.getElementById('playerList');
    list.innerHTML = game.players.map(p => `<li>${p.name} (Totaal: ${p.totalScore} pnt)</li>`).join('');
    
    if(!game.started && !game.gameOver) return;

    document.getElementById('lobby').classList.add('hidden');
    document.getElementById('board').classList.remove('hidden');

    document.getElementById('roundNumberLabel').innerText = game.currentRound;
    document.getElementById('centerStone').innerText = `${game.startNumber}|${game.startNumber}`;
    document.getElementById('boneyardCount').innerText = game.boneyard.length;
    document.getElementById('activePlayer').innerText = game.players[game.currentTurn]?.name || '-';

    const banner = document.getElementById('doubleWarningBanner');
    if (game.requiredDouble.active) {
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }

    const isMexDouble = game.requiredDouble.active && game.requiredDouble.targetId === 'mexican';
    const mexTrackCard = document.getElementById('mexicanTrackCard');
    mexTrackCard.className = `bg-slate-900 p-4 rounded-xl border-2 cursor-pointer transition ${isMexDouble ? 'border-red-500 bg-red-950/40 animate-pulse' : 'border-transparent hover:border-yellow-500'}`;
    
    const mexTrack = document.getElementById('mexicanTrack');
    mexTrack.innerHTML = game.mexicanTrain.map(s => `<span class="track-stone">${s[0]}:${s[1]}</span>`).join(' → ');

    const tracksDiv = document.getElementById('playerTracks');
    tracksDiv.innerHTML = game.players.map(p => {
        const isCurrent = game.players[game.currentTurn]?.id === p.id;
        const isTargetDouble = game.requiredDouble.active && game.requiredDouble.targetId === p.id;
        
        let borderClass = 'border-transparent';
        if (isTargetDouble) borderClass = 'border-red-500 bg-red-950/40 animate-pulse';
        else if (isCurrent) borderClass = 'border-yellow-400';

        return `
            <div onclick="selectTrain('${p.id}')" class="p-3 rounded-lg bg-slate-900 border-2 ${borderClass} hover:border-blue-400 cursor-pointer">
                <div class="flex justify-between items-center text-sm mb-1">
                    <span class="font-bold ${p.id === socket.id ? 'text-blue-400' : ''}">${p.name}'s Trein (${p.totalScore} pnt)</span>
                    <div class="flex gap-2 items-center">
                        ${isTargetDouble ? '<span class="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">🎯 VERPLICHT DUBBEL</span>' : ''}
                        <span class="px-2 py-0.5 text-xs rounded font-bold ${p.isOpen ? 'bg-red-900 text-red-200' : 'bg-slate-700 text-slate-400'}">
                            ${p.isOpen ? '🔓 OPEN' : '🔒 PRIVÉ'}
                        </span>
                    </div>
                </div>
                <div class="flex gap-1.5 overflow-x-auto p-1.5 bg-slate-950 rounded min-h-[36px] items-center">
                    ${p.train.map(s => `<span class="track-stone">${s[0]}:${s[1]}</span>`).join(' → ')}
                </div>
            </div>
        `;
    }).join('');

    const isMyTurn = game.players[game.currentTurn]?.id === socket.id;
    const drawBtn = document.getElementById('drawBtn');
    const passBtn = document.getElementById('passBtn');
    const drawStatusLabel = document.getElementById('drawStatusLabel');

    if (isMyTurn && !game.gameOver) {
        if (!game.hasDrawn) {
            drawBtn.disabled = false;
            passBtn.disabled = true;
            drawStatusLabel.innerText = game.requiredDouble.active ? "Verplicht op de rode dubbel leggen óf steen pakken!" : "Jouw beurt: Leg een steen of pak uit de pot";
            drawStatusLabel.className = "text-red-400 font-bold";
        } else {
            drawBtn.disabled = true;
            passBtn.disabled = false;
            drawStatusLabel.innerText = "Steen gepakt. Leg aan of klik op Pas.";
            drawStatusLabel.className = "text-emerald-400 font-bold";
        }
    } else {
        drawBtn.disabled = true;
        passBtn.disabled = true;
        drawStatusLabel.innerText = game.gameOver ? "SPEL AFGELOPEN!" : "Wachten op tegenstander...";
        drawStatusLabel.className = "text-slate-500";
    }

    const handDiv = document.getElementById('myHand');
    const myHand = game.hands[socket.id] || [];
    handDiv.innerHTML = myHand.map((s, idx) => `
        <button onclick="selectStone(${idx}, '${s[0]}|${s[1]}')" class="domino p-3 min-w-[65px] flex flex-col items-center justify-center text-lg">
            <span>${s[0]}</span>
            <div class="w-full border-t border-gray-300 my-0.5"></div>
            <span>${s[1]}</span>
        </button>
    `).join('');
});

socket.on('gameStarted', (game) => { socket.emit('updateGame', game); });

socket.on('roundEnded', ({ winner, nextRoundReady, champion, game }) => {
    if (nextRoundReady) {
        alert(`Ronde voorbij! ${winner} heeft uitgespeeld.\n\nKlik op OK voor de volgende ronde (Dubbel ${game.startNumber}).`);
    } else {
        alert(`HET SPEL IS FINALE AFGELOPEN!\n\n🏆 ALGEHELE WINNAAR: ${champion}!`);
        document.getElementById('board').classList.add('hidden');
        document.getElementById('lobby').classList.remove('hidden');
    }
    socket.emit('updateGame', game);
});
