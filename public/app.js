const socket = io();
let selectedStoneIndex = null;
let selectedTrainId = null;
let draggedStoneIndex = null;

// Geluidseffecten via de standaard browser Audio API (vrije geluidsbestanden)
const audioTurn = new Audio('https://mixkit.co'); // Korte ping
const audioTrainOpen = new Audio('https://mixkit.co'); // Stoomtrein fluit
const audioKnock = new Audio('https://mixkit.co'); // Houten klopgeluid

// Blokkeer meervoudig joinen via sessionStorage
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
    if (name) {
        socket.emit('joinGame', name);
    }
}

function start() {
    const max = document.getElementById('maxStoneInp').value;
    if (!max || isNaN(max) || parseInt(max) < 1) {
        alert("Vul een geldig positief getal in voor de maximale steen!");
        return;
    }
    socket.emit('startGame', parseInt(max));
}

function spectate() {
    socket.emit('joinAsSpectator');
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

// Drag & Drop logica voor het herschikken van de hand
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

// Ontvang geluidssignalen vanuit de backend
socket.on('playSound', (type) => {
    if (type === 'turn') audioTurn.play().catch(e => console.log('Audio uitgesteld'));
    if (type === 'trainOpen') audioTrainOpen.play().catch(e => console.log('Audio uitgesteld'));
    if (type === 'knock') audioKnock.play().catch(e => console.log('Audio uitgesteld'));
});

socket.on('updateGame', (game) => {
    // 1. Render Lobby / Wachtruimte spelers en spectators
    const list = document.getElementById('playerList');
    list.innerHTML = "";
    
    game.players.forEach(p => {
        const item = document.createElement("li");
        item.innerText = p.name + " (Totaal: " + p.totalScore + " pnt)";
        list.appendChild(item);
    });
    
    if (game.spectators && game.spectators.length > 0) {
        const specItem = document.createElement("li");
        specItem.className = "text-slate-400 mt-2 border-t border-slate-800 pt-2";
        specItem.innerText = "Kijkers: " + game.spectators.map(s => s.name).join(', ');
        list.appendChild(specItem);
    }
    
    // Grijs maken van lobby knoppen als het spel eenmaal draait
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

    // Toon het speelbord
    document.getElementById('lobby').classList.add('hidden');
    document.getElementById('board').classList.remove('hidden');

    document.getElementById('roundNumberLabel').innerText = game.currentRound;
    document.getElementById('centerStone').innerText = game.startNumber + '|' + game.startNumber;
    document.getElementById('boneyardCount').innerText = game.boneyard.length;
    document.getElementById('activePlayer').innerText = game.players[game.currentTurn]?.name || '-';

    // 2. Toon of verberg de Verplichte Dubbel Banner correct op basis van status
    const banner = document.getElementById('doubleWarningBanner');
    if (game.requiredDouble && game.requiredDouble.active) {
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }

    // 3. Render Algemene Mexican Train
    const isMexDouble = game.requiredDouble && game.requiredDouble.active && game.requiredDouble.targetId === 'mexican';
    const mexTrackCard = document.getElementById('mexicanTrackCard');
    mexTrackCard.className = 'bg-slate-900 p-4 rounded-xl border-2 cursor-pointer transition ' + (isMexDouble ? 'border-red-500 bg-red-950/40 animate-pulse' : 'border-transparent hover:border-yellow-500');
    
    const mexTrack = document.getElementById('mexicanTrack');
    mexTrack.innerHTML = "";
    game.mexicanTrain.forEach((s, i) => {
        const span = document.createElement("span");
        span.className = "track-stone";
        span.innerText = s[0] + ":" + s[1];
        mexTrack.appendChild(span);
        if (i < game.mexicanTrain.length - 1) {
            mexTrack.appendChild(document.createTextNode(" → "));
        }
    });

    // 4. Render Alle Spelerstreinen
    const tracksDiv = document.getElementById('playerTracks');
    tracksDiv.innerHTML = "";
    
    game.players.forEach(p => {
        const isCurrent = game.players[game.currentTurn]?.id === p.id;
        const isTargetDouble = game.requiredDouble && game.requiredDouble.active && game.requiredDouble.targetId === p.id;
        const handLength = game.hands[p.id] ? game.hands[p.id].length : 0;
        
        let borderClass = 'border-transparent';
        if (isTargetDouble) borderClass = 'border-red-500 bg-red-950/40 animate-pulse';
        else if (isCurrent) borderClass = 'border-yellow-400';

        const playerCard = document.createElement("div");
        playerCard.className = "p-3 rounded-lg bg-slate-900 border-2 " + borderClass + " hover:border-blue-400 cursor-pointer";
        playerCard.onclick = () => selectTrain(p.id);

        const headerFlex = document.createElement("div");
        headerFlex.className = "flex justify-between items-center text-sm mb-1";

        const nameSpan = document.createElement("span");
        nameSpan.className = "font-bold " + (p.id === socket.id ? "text-blue-400" : "");
        nameSpan.innerText = p.name + "'s Trein (" + p.totalScore + " pnt) ";
        
        const handSpan = document.createElement("span");
        handSpan.className = "text-xs text-slate-400 font-normal";
        handSpan.innerText = "(" + handLength + " stenen in hand)";
        nameSpan.appendChild(handSpan);

        const badgeFlex = document.createElement("div");
        badgeFlex.className = "flex gap-2 items-center";

        if (isTargetDouble) {
            const doubleBadge = document.createElement("span");
            doubleBadge.className = "text-xs bg-red-600 text-white px-1.5 py-0.5 rounded font-bold";
            doubleBadge.innerText = "🎯 VERPLICHT DUBBEL";
            badgeFlex.appendChild(doubleBadge);
        }
        if (handLength === 1) {
            const lastStoneBadge = document.createElement("span");
            lastStoneBadge.className = "text-xs bg-orange-500 text-slate-950 px-1.5 py-0.5 rounded font-bold animate-bounce";
            lastStoneBadge.innerText = "⚠️ LAATSTE STEEN";
            badgeFlex.appendChild(lastStoneBadge);
        }

        const openBadge = document.createElement("span");
        openBadge.className = "px-2 py-0.5 text-xs rounded font-bold " + (p.isOpen ? "bg-red-900 text-red-200" : "bg-slate-700 text-slate-400");
        openBadge.innerText = p.isOpen ? "🔓 OPEN" : "🔒 PRIVÉ";
        badgeFlex.appendChild(openBadge);

        headerFlex.appendChild(nameSpan);
        headerFlex.appendChild(badgeFlex);

        const trackStonesDiv = document.createElement("div");
        trackStonesDiv.className = "flex gap-1.5 overflow-x-auto p-1.5 bg-slate-950 rounded min-h-[36px] items-center";
        
        p.train.forEach((s, idx) => {
            const stoneSpan = document.createElement("span");
            stoneSpan.className = "track-stone";
            stoneSpan.innerText = s[0] + ":" + s[1];
            trackStonesDiv.appendChild(stoneSpan);
            if (idx < p.train.length - 1) {
                trackStonesDiv.appendChild(document.createTextNode(" → "));
            }
        });

        playerCard.appendChild(headerFlex);
        playerCard.appendChild(trackStonesDiv);
        tracksDiv.appendChild(playerCard);
    });

    // 5. Knoppen Status beheren voor de actieve speler
    const isMyTurn = game.players[game.currentTurn]?.id === socket.id;
    const drawBtn = document.getElementById('drawBtn');
    const passBtn = document.getElementById('passBtn');
const drawStatusLabel = document.getElementById('drawStatusLabel');
const isSpectator = game.spectators && game.spectators.some(s => s.id === socket.id);

if (isSpectator) {
    drawBtn.disabled = true;
    passBtn.disabled = true;
    drawStatusLabel.innerText = "Je kijkt mee als toeschouwer.";
    drawStatusLabel.className = "text-slate-400";
} else if (isMyTurn && !game.gameOver) {
    if (!game.hasDrawn) {
        drawBtn.disabled = false;
        passBtn.disabled = true;
        drawStatusLabel.innerText = game.requiredDouble && game.requiredDouble.active ? "Verplicht op de rode dubbel leggen óf steen pakken!" : "Jouw beurt: Leg een steen of pak uit de pot";
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

// 6. Render Mijn Hand (Met Drag-and-Drop functionaliteit)
const handDiv = document.getElementById('myHand');
handDiv.innerHTML = "";
const myHand = game.hands[socket.id] || [];

if (isSpectator) {
    const specDiv = document.createElement("div");
    specDiv.className = "p-4 text-slate-400 text-sm italic";
    specDiv.innerText = "Spectatormodus: Je hebt geen eigen dominostenen.";
    handDiv.appendChild(specDiv);
} else {
    myHand.forEach((s, idx) => {
        const btn = document.createElement("button");
        btn.className = "domino p-3 min-w-[65px] flex flex-col items-center justify-center text-lg cursor-grab active:cursor-grabbing";
        btn.draggable = true;
        
        btn.ondragstart = (e) => handleDragStart(e, idx);
        btn.ondragover = (e) => handleDragOver(e);
        btn.ondrop = (e) => handleDrop(e, idx);
        btn.onclick = () => selectStone(idx, s[0] + "|" + s[1]);
        
        const topSpan = document.createElement("span");
        topSpan.innerText = s[0];
        
        const line = document.createElement("div");
        line.className = "w-full border-t border-gray-300 my-0.5";
        
        const botSpan = document.createElement("span");
        botSpan.innerText = s[1];
        
        btn.appendChild(topSpan);
        btn.appendChild(line);
        btn.appendChild(botSpan);
        handDiv.appendChild(btn);
    });
}

// Sluiting van de updateGame socket-luisteraar (was afgebroken in je tekst)
});

socket.on('gameStarted', (game) => {
    socket.emit('updateGame', game);
});

socket.on('roundEnded', ({ winner, nextRoundReady, champion, game }) => {
    if (nextRoundReady) {
        alert("Ronde voorbij! " + winner + " heeft uitgespeeld.\n\nKlik op OK voor de volgende ronde (Dubbel " + game.startNumber + ").");
    } else {
        alert("HET SPEL IS FINALE AFGELOPEN!\n\n🏆 ALGEHELE WINNAAR: " + champion + "!");
        sessionStorage.removeItem('mexicanTrainJoined');
        document.getElementById('board').classList.add('hidden');
        document.getElementById('lobby').classList.remove('hidden');
    }
    socket.emit('updateGame', game);
});
