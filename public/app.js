console.log("Mexican Train: app.js succesvol geladen!");

// Geluidseffecten ALTIJD bovenaan
const audioTurn = new Audio('https://mixkit.co'); 
const audioTrainOpen = new Audio('https://mixkit.co'); 
const audioKnock = new Audio('https://mixkit.co'); 

// Failsafe socket initialisatie: controleer of 'io' bestaat
let socket;
if (typeof io !== 'undefined') {
    socket = io();
    console.log("Verbinding met de spelserver succesvol opgezet!");
} else {
    console.error("CRITIEKE FOUT: Socket.io is niet geladen door de browser! Zorg dat je de site opent via http://localhost:3000");
}

let selectedStoneIndex = null;
let selectedTrainId = null;
let draggedStoneIndex = null;

function unlockAudio() {
    console.log("Audio proberen te ontgrendelen...");
    audioTurn.play().then(() => { audioTurn.pause(); audioTurn.currentTime = 0; }).catch(() => {});
    audioTrainOpen.play().then(() => { audioTrainOpen.pause(); audioTrainOpen.currentTime = 0; }).catch(() => {});
    audioKnock.play().then(() => { audioKnock.pause(); audioKnock.currentTime = 0; }).catch(() => {});
}

// Controleer direct bij laden van de pagina
try {
    if (sessionStorage.getItem('mexicanTrainJoined')) {
        const nameInp = document.getElementById('nameInp');
        if (nameInp) nameInp.disabled = true;
        console.log("Browser herkent eerdere join in deze sessie.");
    }
} catch(e) { console.error("Fout bij laden van sessie:", e); }

function join() {
    console.log("Join functie aangeroepen!");
    unlockAudio();
    
    if (!socket) {
        alert("Kan geen verbinding maken met de server. Open de site via http://localhost:3000 of herstart node server.js!");
        return;
    }
    
    if (sessionStorage.getItem('mexicanTrainJoined')) {
        alert("Je doet al mee aan dit spel vanaf deze browser!");
        return;
    }
    
    const nameInp = document.getElementById('nameInp');
    if (!nameInp) {
        console.error("Fout: Element 'nameInp' niet gevonden in de HTML!");
        return;
    }
    
    const name = nameInp.value.trim();
    console.log("Ingevulde naam:", name);
    
    if (name) {
        console.log("Signaal 'joinGame' versturen naar server voor:", name);
        socket.emit('joinGame', name);
    } else {
        alert("Vul eerst een naam in!");
    }
}

function start() {
    console.log("Start functie aangeroepen!");
    unlockAudio();
    if (!socket) return alert("Geen serververbinding.");
    const maxInp = document.getElementById('maxStoneInp');
    const max = maxInp ? maxInp.value : "12";
    if (!max || isNaN(max) || parseInt(max) < 1) {
        alert("Vul een geldig getal in!");
        return;
    }
    console.log("Signaal 'startGame' versturen naar server met max stenen:", max);
    socket.emit('startGame', parseInt(max));
}

function spectate() { console.log("Spectate aangeroepen"); unlockAudio(); if(socket) socket.emit('joinAsSpectator'); }
function draw() { console.log("Draw aangeroepen"); if(socket) socket.emit('drawStone'); }
function pass() { console.log("Pass aangeroepen"); if(socket) socket.emit('passTurn'); }

function selectStone(index, displayValue) {
    selectedStoneIndex = index;
    const label = document.getElementById('selectedStoneLabel');
    if (label) label.innerText = displayValue;
    checkAndExecute();
}

function selectTrain(id) {
    selectedTrainId = id;
    checkAndExecute();
}

function checkAndExecute() {
    if (selectedStoneIndex !== null && selectedTrainId !== null && socket) {
        socket.emit('playStone', { stoneIndex: selectedStoneIndex, targetId: selectedTrainId });
        selectedStoneIndex = null;
        selectedTrainId = null;
        const label = document.getElementById('selectedStoneLabel');
        if (label) label.innerText = "-";
    }
}

function handleDragStart(e, index) { draggedStoneIndex = index; e.dataTransfer.effectAllowed = 'move'; }
function handleDragOver(e) { if (e.preventDefault) e.preventDefault(); return false; }
function handleDrop(e, targetIndex) {
    if (e.stopPropagation) e.stopPropagation();
    if (draggedStoneIndex !== null && draggedStoneIndex !== targetIndex && socket) {
        socket.emit('reorderHand', { fromIndex: draggedStoneIndex, toIndex: targetIndex });
    }
    draggedStoneIndex = null;
}

if (socket) {
    socket.on('joinSuccess', () => {
        console.log("Server keurt join goed!");
        sessionStorage.setItem('mexicanTrainJoined', 'true');
        const lobbyJoinBtn = document.getElementById('lobbyJoinBtn');
        if (lobbyJoinBtn) lobbyJoinBtn.disabled = true;
    });

    socket.on('errorMsg', (msg) => alert(msg));

    socket.on('playSound', (type) => {
        console.log("Geluidssignaal ontvangen:", type);
        if (type === 'turn') audioTurn.play().catch(() => {});
        if (type === 'trainOpen') audioTrainOpen.play().catch(() => {});
        if (type === 'knock') audioKnock.play().catch(() => {});
    });

    socket.on('updateGame', (game) => {
        console.log("Centrale game-update ontvangen van server:", game);
        if (!game || !game.players) return;

        const list = document.getElementById('playerList');
        if (list) {
            list.innerHTML = "";
            game.players.forEach(p => {
                const item = document.createElement("li");
                item.innerText = p.name + " (Totaal: " + p.totalScore + " pnt)";
                list.appendChild(item);
            });
        }

        const lobbyJoinBtn = document.getElementById('lobbyJoinBtn');
        const lobbyStartBtn = document.getElementById('lobbyStartBtn');
        const lobbySpectateBtn = document.getElementById('lobbySpectateBtn');
        
        if (game.started) {
            if (lobbyJoinBtn) lobbyJoinBtn.disabled = true;
            if (lobbyStartBtn) lobbyStartBtn.disabled = true;
            if (lobbySpectateBtn) lobbySpectateBtn.disabled = true;
        } else {
            if (lobbyJoinBtn && !sessionStorage.getItem('mexicanTrainJoined')) lobbyJoinBtn.disabled = false;
            if (lobbyStartBtn) lobbyStartBtn.disabled = false;
            if (lobbySpectateBtn) lobbySpectateBtn.disabled = false;
        }

        if (!game.started && !game.gameOver) {
            console.log("Spel is noch in de lobby-fase.");
            return;
        }

        const lobbyDiv = document.getElementById('lobby');
        const boardDiv = document.getElementById('board');
        if (lobbyDiv) lobbyDiv.classList.add('hidden');
        if (boardDiv) boardDiv.classList.remove('hidden');

        const roundLabel = document.getElementById('roundNumberLabel');
        const centerLabel = document.getElementById('centerStone');
        const boneyardLabel = document.getElementById('boneyardCount');

        if (roundLabel) roundLabel.innerText = game.currentRound;
        if (centerLabel) centerLabel.innerText = game.startNumber + '|' + game.startNumber;
        if (boneyardLabel) boneyardLabel.innerText = game.boneyard ? game.boneyard.length : 0;

        const headerRow = document.getElementById('playerHeaderRow');
        if (headerRow) {
            headerRow.innerHTML = "";
            game.players.forEach((p, idx) => {
                const isCurrent = game.currentTurn === idx;
                const handLength = game.hands && game.hands[p.id] ? game.hands[p.id].length : 0;

                const pBox = document.createElement("div");
                pBox.className = "player-status-card " + (isCurrent ? "active" : "");

                const nameSpan = document.createElement("span");
                nameSpan.innerText = (p.id === socket.id ? "⭐ " : "") + p.name;

                const statsSpan = document.createElement("div");
                statsSpan.className = "stats";
                statsSpan.innerText = handLength + " stn | " + p.totalScore + " pnt";

                pBox.appendChild(nameSpan);
                pBox.appendChild(statsSpan);
                headerRow.appendChild(pBox);
            });
        }

        const banner = document.getElementById('doubleWarningBanner');
        if (banner) {
            if (game.requiredDouble && game.requiredDouble.active === true) {
                banner.classList.remove('hidden');
            } else {
                banner.classList.add('hidden');
            }
        }

        const isMexDouble = game.requiredDouble && game.requiredDouble.active === true && game.requiredDouble.targetId === 'mexican';
        const mexTrackCard = document.getElementById('mexicanTrackCard');
        if (mexTrackCard) {
            if (isMexDouble) mexTrackCard.classList.add('double-highlight');
            else mexTrackCard.classList.remove('double-highlight');
        }
        
        const mexTrack = document.getElementById('mexicanTrack');
        if (mexTrack && game.mexicanTrain) {
            mexTrack.innerHTML = "";
            game.mexicanTrain.forEach((s) => {
                if (!Array.isArray(s)) return;
                const stoneBox = document.createElement("div");
                stoneBox.className = "track-stone";
                
                const top = document.createElement("span"); top.innerText = s[0];
                const line = document.createElement("div"); line.className = "line";
                const bot = document.createElement("span"); bot.innerText = s[1];
                
                stoneBox.appendChild(top); stoneBox.appendChild(line); stoneBox.appendChild(bot);
                mexTrack.appendChild(stoneBox);
            });
        }

        const tracksContainer = document.getElementById('playerTracksContainer');
        if (tracksContainer) {
            tracksContainer.innerHTML = "";
            game.players.forEach(p => {
                const isTargetDouble = game.requiredDouble && game.requiredDouble.active === true && game.requiredDouble.targetId === p.id;
                const handLength = game.hands && game.hands[p.id] ? game.hands[p.id].length : 0;

const colDiv = document.createElement("div");
colDiv.className = "train-column " + (isTargetDouble ? "double-highlight" : "");
colDiv.onclick = () => selectTrain(p.id);

const colHeader = document.createElement("div");
colHeader.className = "column-header";

const titleSpan = document.createElement("div");
titleSpan.className = "title " + (p.id === socket.id ? "me" : "");
titleSpan.innerText = p.name;

const scoreSpan = document.createElement("div");
scoreSpan.className = "score-stn";
scoreSpan.innerText = p.totalScore + " pnt  |  " + handLength + " stn";

const statusSpan = document.createElement("div");
statusSpan.className = "status-badge " + (p.isOpen ? "open" : "");
statusSpan.innerText = p.isOpen ? "🔓 OPEN" : "🔒 PRIVÉ";

colHeader.appendChild(titleSpan);
colHeader.appendChild(scoreSpan);
colHeader.appendChild(statusSpan);

if (handLength === 1) {
    const bounceBadge = document.createElement("div");
    bounceBadge.className = "bounce-badge";
    bounceBadge.innerText = "1 STEEN";
    colHeader.appendChild(bounceBadge);
}

const stonesScrollDiv = document.createElement("div");
stonesScrollDiv.className = "stones-scroll-area no-scrollbar";

if (p.train) {
    p.train.forEach((s) => {
        if (!Array.isArray(s)) return;
        const stoneBox = document.createElement("div");
        stoneBox.className = "track-stone";

        const top = document.createElement("span"); 
        top.innerText = s[0];

        const line = document.createElement("div"); 
        line.className = "line";

        const bot = document.createElement("span"); 
        bot.innerText = s[1];

        stoneBox.appendChild(top); 
        stoneBox.appendChild(line); 
        stoneBox.appendChild(bot);
        stonesScrollDiv.appendChild(stoneBox);
    });
}

colDiv.appendChild(colHeader);
colDiv.appendChild(stonesScrollDiv);
tracksContainer.appendChild(colDiv);
}); // Sluiting van de spelers-lus (bijv. game.players.forEach)
} // Sluiting van de bovenliggende check

// 4. HAND & KNOOPSTATUS
const drawBtn = document.getElementById('drawBtn');
const passBtn = document.getElementById('passBtn');
const drawStatusLabel = document.getElementById('drawStatusLabel');

const isMyTurn = game.players[game.currentTurn]?.id === socket.id;

if (drawBtn && passBtn && drawStatusLabel) {
    if (isMyTurn && !game.gameOver) {
        if (!game.hasDrawn) {
            drawBtn.disabled = false;
            passBtn.disabled = true;
            drawStatusLabel.innerText = game.requiredDouble && game.requiredDouble.active === true ? "Leg op de dubbel of pak!" : "Jouw beurt: Leg of pak een steen";
        } else {
            drawBtn.disabled = true;
            passBtn.disabled = false;
            drawStatusLabel.innerText = "Leg aan of klik op Pas.";
        }
    } else {
        drawBtn.disabled = true;
        passBtn.disabled = true;
        drawStatusLabel.innerText = game.gameOver ? "SPEL AFGELOPEN!" : "Wachten op tegenstander...";
    }
}

const handDiv = document.getElementById('myHand');
if (handDiv) {
    handDiv.innerHTML = "";
    const myHand = game.hands && game.hands[socket.id] ? game.hands[socket.id] : [];
    
    myHand.forEach((s, idx) => {
        if (!Array.isArray(s)) return;
        
        const btn = document.createElement("button");
        btn.className = "domino";
        btn.draggable = true;
        btn.ondragstart = (e) => handleDragStart(e, idx);
        btn.ondragover = (e) => handleDragOver(e);
        btn.ondrop = (e) => handleDrop(e, idx);
        btn.onclick = () => selectStone(idx, s[0] + "|" + s[1]);

        const topSpan = document.createElement("span"); 
        topSpan.innerText = s[0];

        const line = document.createElement("div"); 
        line.className = "line";

        const botSpan = document.createElement("span"); 
        botSpan.innerText = s[1];

        btn.appendChild(topSpan); 
        btn.appendChild(line); 
        btn.appendChild(botSpan);
        handDiv.appendChild(btn);
    });
}
// Sluiting van de hoofd luisteraar (bijv. socket.on('updateBoard'))
});

socket.on('gameStarted', (game) => { 
    if(game) socket.emit('updateGame', game); 
});

socket.on('roundEnded', ({ winner, nextRoundReady, champion, game }) => {
    alert(nextRoundReady ?
        "Ronde voorbij! " + winner + " heeft uitgespeeld.\n\nVolgende ronde start met Dubbel " + game.startNumber + "." :
        "HET SPEL IS FINALE AFGELOPEN!\n\n🏆 WINNAAR: " + champion + "!"
    );
    
    if (!nextRoundReady) {
        sessionStorage.removeItem('mexicanTrainJoined');
        const boardDiv = document.getElementById('board');
        const lobbyDiv = document.getElementById('lobby');
        if (boardDiv) boardDiv.classList.add('hidden');
        if (lobbyDiv) lobbyDiv.classList.remove('hidden');
    }
    
    if(game) socket.emit('updateGame', game);
});
} // Sluiting van de uiterste scope/functie waarin deze code staat
