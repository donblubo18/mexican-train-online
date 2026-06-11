const socket = io();
let selectedStoneIndex = null;
let selectedTrainId = null;
let draggedStoneIndex = null;

const audioTurn = new Audio('https://mixkit.co');
const audioTrainOpen = new Audio('https://mixkit.co');
const audioKnock = new Audio('https://mixkit.co');

if (sessionStorage.getItem('mexicanTrainJoined')) {
    const nameInp = document.getElementById('nameInp');
    if (nameInp) nameInp.disabled = true;
}

function join() {
    if (sessionStorage.getItem('mexicanTrainJoined')) {
        alert("Je doet al mee aan dit spel vanaf deze browser!");
        return;
    }
    const name = document.getElementById('nameInp').value.trim();
    if (name) socket.emit('joinGame', name);
}

function start() {
    const max = document.getElementById('maxStoneInp').value;
    if (!max || isNaN(max) || parseInt(max) < 1) {
        alert("Vul een geldig getal in!");
        return;
    }
    socket.emit('startGame', parseInt(max));
}

function spectate() { socket.emit('joinAsSpectator'); }
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

function handleDragStart(e, index) {
    draggedStoneIndex = index;
    e.dataTransfer.effectAllowed = 'move';
}
function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    return false;
}
function handleDrop(e, targetIndex) {
    if (e.stopPropagation) e.stopPropagation();
    if (draggedStoneIndex !== null && draggedStoneIndex !== targetIndex) {
        socket.emit('reorderHand', { fromIndex: draggedStoneIndex, toIndex: targetIndex });
    }
    draggedStoneIndex = null;
}

socket.on('joinSuccess', () => {
    sessionStorage.setItem('mexicanTrainJoined', 'true');
    const joinBtn = document.querySelector("button[onclick='join()']");
    if (joinBtn) joinBtn.disabled = true;
});

socket.on('errorMsg', (msg) => alert(msg));

socket.on('playSound', (type) => {
    if (type === 'turn') audioTurn.play().catch(e => {});
    if (type === 'trainOpen') audioTrainOpen.play().catch(e => {});
    if (type === 'knock') audioKnock.play().catch(e => {});
});

socket.on('updateGame', (game) => {
    // Lobby elementen bijwerken
    const list = document.getElementById('playerList');
    list.innerHTML = "";
    game.players.forEach(p => {
        const item = document.createElement("li");
        item.innerText = p.name + " (Totaal: " + p.totalScore + " pnt)";
        list.appendChild(item);
    });

    const joinBtn = document.querySelector("button[onclick='join()']");
    const startBtn = document.querySelector("button[onclick='start()']");
    const spectateBtn = document.querySelector("button[onclick='spectate()']");
    
    if (game.started) {
        if (joinBtn) joinBtn.disabled = true;
        if (startBtn) startBtn.disabled = true;
        if (spectateBtn) spectateBtn.disabled = true;
    } else {
        if (joinBtn && !sessionStorage.getItem('mexicanTrainJoined')) joinBtn.disabled = false;
        if (startBtn) startBtn.disabled = false;
        if (spectateBtn) spectateBtn.disabled = false;
    }

    if (!game.started && !game.gameOver) return;

    document.getElementById('lobby').classList.add('hidden');
    document.getElementById('board').classList.remove('hidden');

    document.getElementById('roundNumberLabel').innerText = game.currentRound;
    document.getElementById('centerStone').innerText = game.startNumber + '|' + game.startNumber;
    document.getElementById('boneyardCount').innerText = game.boneyard.length;

    // A. APPLICATIE-UPDATE 1: BOVENSTE BALK RENDEREN (SPELERS NAAST ELKAAR)
    const headerRow = document.getElementById('playerHeaderRow');
    headerRow.innerHTML = "";

    game.players.forEach((p, idx) => {
        const isCurrent = game.currentTurn === idx;
        const handLength = game.hands[p.id] ? game.hands[p.id].length : 0;

        const pBox = document.createElement("div");
        // Kleurt goud/geel op als de speler aan de beurt is
        pBox.className = "px-3 py-1.5 rounded-lg border text-xs flex flex-col items-center transition " + 
            (isCurrent ? "bg-yellow-500/20 border-yellow-400 font-bold shadow-md shadow-yellow-500/10 text-yellow-300" : "bg-slate-800 border-slate-700 text-slate-300");

        const nameSpan = document.createElement("span");
        nameSpan.innerText = (p.id === socket.id ? "⭐ " : "") + p.name;
        nameSpan.className = "truncate max-w-[100px]";

        const statsSpan = document.createElement("span");
        statsSpan.className = "text-[10px] text-slate-400 mt-0.5";
        statsSpan.innerText = handLength + " stn | " + p.totalScore + " pnt";

        pBox.appendChild(nameSpan);
        pBox.appendChild(statsSpan);
        headerRow.appendChild(pBox);
    });

    // Dubbel banner tonen/verbergen
    const banner = document.getElementById('doubleWarningBanner');
    if (game.requiredDouble && game.requiredDouble.active) {
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }

    // B. APPLICATIE-UPDATE 2: MEXICAN TRAIN (NAAR BENEDEN)
    const isMexDouble = game.requiredDouble && game.requiredDouble.active && game.requiredDouble.targetId === 'mexican';
    const mexTrackCard = document.getElementById('mexicanTrackCard');
    mexTrackCard.className = 'bg-slate-900 p-3 rounded-xl border-2 cursor-pointer transition flex flex-col min-w-[120px] max-h-full ' + 
        (isMexDouble ? 'border-red-500 bg-red-950/20 animate-pulse' : 'border-transparent hover:border-yellow-500');
    
    const mexTrack = document.getElementById('mexicanTrack');
    mexTrack.innerHTML = "";
    game.mexicanTrain.forEach((s) => {
        const span = document.createElement("div");
        span.className = "track-stone";
        span.innerText = s[0] + "\n" + s[1]; // Getallen onder elkaar op de steen
        mexTrack.appendChild(span);
    });

    // C. APPLICATIE-UPDATE 3: SPELERSTREINEN (NAAR BENEDEN)
    const tracksContainer = document.getElementById('playerTracksContainer');
    tracksContainer.innerHTML = "";

    game.players.forEach(p => {
        const isTargetDouble = game.requiredDouble && game.requiredDouble.active && game.requiredDouble.targetId === p.id;
        const handLength = game.hands[p.id] ? game.hands[p.id].length : 0;
        
        let borderClass = 'border-transparent';
        if (isTargetDouble) borderClass = 'border-red-500 bg-red-950/20 animate-pulse';

        const colDiv = document.createElement("div");
        colDiv.className = "bg-slate-900 p-3 rounded-xl border-2 flex flex-col min-w-[120px] max-h-full cursor-pointer transition " + borderClass + " hover:border-blue-500";
        colDiv.onclick = () => selectTrain(p.id);

        // Kolomkop met status-indicators
        const colHeader = document.createElement("div");
        colHeader.className = "text-center border-b border-slate-700 pb-1.5 mb-2 text-[11px] flex flex-col items-center gap-0.5";
        
        const titleSpan = document.createElement("span");
        titleSpan.className = "font-bold truncate max-w-[100px] " + (p.id === socket.id ? "text-blue-400" : "text-slate-200");
        titleSpan.innerText = p.name;
        
        const statusSpan = document.createElement("span");
        statusSpan.className = "text-[9px] px-1 rounded font-bold " + (p.isOpen ? "bg-red-950 text-red-400" : "bg-slate-800 text-slate-500");
        statusSpan.innerText = p.isOpen ? "🔓 OPEN" : "🔒 PRIVÉ";

        colHeader.appendChild(titleSpan);
        colHeader.appendChild(statusSpan);

        if (handLength === 1) {
            const bounceBadge = document.createElement("span");
            bounceBadge.className = "text-[9px] bg-orange-500 text-slate-950 px-1 rounded font-black animate-bounce mt-0.5";
            bounceBadge.innerText = "1 STEEN";
            colHeader.appendChild(bounceBadge);
        }

        const stonesScrollDiv = document.createElement("div");
        stonesScrollDiv.className = "flex flex-col gap-1.5 overflow-y-auto no-scrollbar items-center flex-1";

        p.train.forEach((s) => {
            const stoneSpan = document.createElement("div");
            stoneSpan.className = "track-stone";
            stoneSpan.innerText = s[0] + "\n" + s[1];
            stonesScrollDiv.appendChild(stoneSpan);
        });

        colDiv.appendChild(colHeader);
        colDiv.appendChild(stonesScrollDiv);
        tracksContainer.appendChild(colDiv);
    });

    // D. APPLICATIE-UPDATE 4: INTERFACE BEDIENING & HAND
    const drawBtn = document.getElementById('drawBtn');
    const passBtn = document.getElementById('passBtn');
    const drawStatusLabel = document.getElementById('drawStatusLabel');
    const isSpectator = game.spectators && game.spectators.some(s => s.id === socket.id);
    const isMyTurn = game.players[game.currentTurn]?.id === socket.id;

    if (isSpectator) {
        drawBtn.disabled = true;
        passBtn.disabled = true;
        drawStatusLabel.innerText = "Spectatormodus";
        drawStatusLabel.className = "text-slate-500";
    } else if (isMyTurn && !game.gameOver) {
        if (!game.hasDrawn) {
            drawBtn.disabled = false;
            passBtn.disabled = true;
        drawStatusLabel.innerText = game.requiredDouble && game.requiredDouble.active ? "Leg op de dubbel of pak!" : "Jouw beurt: Leg of pak een steen";
        drawStatusLabel.className = "text-red-400 font-bold";
    } else {
        drawBtn.disabled = true;
        passBtn.disabled = false;
        drawStatusLabel.innerText = "Leg aan of Pas.";
        drawStatusLabel.className = "text-emerald-400 font-bold";
    }
} else {
    drawBtn.disabled = true;
    passBtn.disabled = true;
    drawStatusLabel.innerText = game.gameOver ? "SPEL AFGELOPEN!" : "Wachten op tegenstander...";
    drawStatusLabel.className = "text-slate-500";
}

const handDiv = document.getElementById('myHand');
handDiv.innerHTML = "";
const myHand = game.hands[socket.id] || [];

if (isSpectator) {
    const specDiv = document.createElement("div");
    specDiv.className = "text-slate-400 text-xs italic p-2";
    specDiv.innerText = "Je kijkt live mee.";
    handDiv.appendChild(specDiv);
} else {
    myHand.forEach((s, idx) => {
        const btn = document.createElement("button");
        btn.className = "domino p-2 min-w-[55px] max-w-[55px] flex flex-col items-center justify-center text-md cursor-grab active:cursor-grabbing";
        btn.draggable = true;
        
        btn.ondragstart = (e) => handleDragStart(e, idx);
        btn.ondragover = (e) => handleDragOver(e);
        btn.ondrop = (e) => handleDrop(e, idx);
        btn.onclick = () => selectStone(idx, s[0] + "|" + s[1]);
        
        const topSpan = document.createElement("span");
        topSpan.innerText = s[0];
        
        const line = document.createElement("div");
        line.className = "w-full border-t border-gray-400 my-0.5";
        
        const botSpan = document.createElement("span");
        botSpan.innerText = s[1];
        
        btn.appendChild(topSpan);
        btn.appendChild(line);
        btn.appendChild(botSpan);
        handDiv.appendChild(btn);
    });
}

// Sluiting van de grotere updateGame functie (die hierboven was afgebroken)
});

socket.on('gameStarted', (game) => { 
    socket.emit('updateGame', game); 
});

socket.on('roundEnded', ({ winner, nextRoundReady, champion, game }) => {
    if (nextRoundReady) {
        alert("Ronde voorbij! " + winner + " heeft uitgespeeld.\n\nVolgende ronde start met Dubbel " + game.startNumber + ".");
    } else {
        alert("HET SPEL IS FINALE AFGELOPEN!\n\n🏆 WINNAAR: " + champion + "!");
        sessionStorage.removeItem('mexicanTrainJoined');
        document.getElementById('board').classList.add('hidden');
        document.getElementById('lobby').classList.remove('hidden');
    }
    socket.emit('updateGame', game);
});
