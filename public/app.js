console.log("Mexican Train: app.js geladen!");
const audioTurn = new Audio('https://mixkit.co'); 
const audioTrainOpen = new Audio('https://mixkit.co'); 
const audioKnock = new Audio('https://mixkit.co'); 

let socket = typeof io !== 'undefined' ? io() : null;
let selectedStoneIndex = null, selectedTrainId = null, draggedStoneIndex = null;

function unlockAudio() {
    audioTurn.play().then(() => { audioTurn.pause(); audioTurn.currentTime = 0; }).catch(() => {});
    audioTrainOpen.play().then(() => { audioTrainOpen.pause(); audioTrainOpen.currentTime = 0; }).catch(() => {});
    audioKnock.play().then(() => { audioKnock.pause(); audioKnock.currentTime = 0; }).catch(() => {});
}

if (sessionStorage.getItem('mexicanTrainJoined') && document.getElementById('nameInp')) {
    document.getElementById('nameInp').disabled = true;
}

function join() {
    unlockAudio();
    if (!socket) return alert("Geen serververbinding.");
    if (sessionStorage.getItem('mexicanTrainJoined')) return alert("Je doet al mee!");
    const name = document.getElementById('nameInp') ? document.getElementById('nameInp').value.trim() : "";
    if (name) socket.emit('joinGame', name);
    else alert("Vul eerst een naam in!");
}

function start() {
    unlockAudio();
    if (!socket) return alert("Geen serververbinding.");
    const max = document.getElementById('maxStoneInp') ? document.getElementById('maxStoneInp').value : "12";
    if (!max || isNaN(max) || parseInt(max) < 1) return alert("Vul een getal in!");
    socket.emit('startGame', parseInt(max));
}

function spectate() { unlockAudio(); if(socket) socket.emit('joinAsSpectator'); }
function draw() { if(socket) socket.emit('drawStone'); }
function pass() { if(socket) socket.emit('passTurn'); }

function selectStone(idx, val) {
    selectedStoneIndex = idx;
    if (document.getElementById('selectedStoneLabel')) document.getElementById('selectedStoneLabel').innerText = val;
    if (selectedStoneIndex !== null && selectedTrainId !== null && socket) {
        socket.emit('playStone', { stoneIndex: selectedStoneIndex, targetId: selectedTrainId });
        selectedStoneIndex = null; selectedTrainId = null;
        if (document.getElementById('selectedStoneLabel')) document.getElementById('selectedStoneLabel').innerText = "-";
    }
}
function selectTrain(id) { selectedTrainId = id; selectStone(selectedStoneIndex, document.getElementById('selectedStoneLabel')?.innerText || "-"); }
function handleDragStart(e, idx) { draggedStoneIndex = idx; e.dataTransfer.effectAllowed = 'move'; }
function handleDragOver(e) { if (e.preventDefault) e.preventDefault(); return false; }
function handleDrop(e, targetIdx) {
    if (e.stopPropagation) e.stopPropagation();
    if (draggedStoneIndex !== null && draggedStoneIndex !== targetIdx && socket) {
        socket.emit('reorderHand', { fromIndex: draggedStoneIndex, toIndex: targetIdx });
    }
    draggedStoneIndex = null;
}
function createStoneEl(s, isHandCard, idx) {
    if (!Array.isArray(s)) return document.createElement("div");
    const btn = document.createElement(isHandCard ? "button" : "div");
    btn.className = isHandCard ? "domino" : "track-stone";
    if (isHandCard) {
        btn.draggable = true;
        btn.ondragstart = (e) => handleDragStart(e, idx);
        btn.ondragover = (e) => handleDragOver(e);
        btn.ondrop = (e) => handleDrop(e, idx);
        btn.onclick = () => selectStone(idx, s[0] + "|" + s[1]);
    }
    btn.innerHTML = "<span>" + s[0] + "</span><div class='line'></div><span>" + s[1] + "</span>";
    return btn;
}

if (socket) {
    socket.on('joinSuccess', () => {
        sessionStorage.setItem('mexicanTrainJoined', 'true');
        if (document.getElementById('lobbyJoinBtn')) document.getElementById('lobbyJoinBtn').disabled = true;
    });
    socket.on('errorMsg', (msg) => alert(msg));
    socket.on('playSound', (type) => {
        if (type === 'turn') audioTurn.play().catch(() => {});
        if (type === 'trainOpen') audioTrainOpen.play().catch(() => {});
        if (type === 'knock') audioKnock.play().catch(() => {});
    });

    socket.on('updateGame', (game) => {
        if (!game || !game.players) return;
        const list = document.getElementById('playerList');
        if (list) {
            list.innerHTML = "";
            game.players.forEach(p => {
                const item = document.createElement("li");
                item.innerText = p.name + " (Totaal: " + p.totalScore + " pnt)";
                list.appendChild(item);
            });
            if (game.spectators && game.spectators.length > 0) {
                const spec = document.createElement("li");
                spec.style = "color: #94a3b8; margin-top: 10px; list-style-type: none;";
                spec.innerText = "👀 Kijkers: " + game.spectators.map(s => s.name).join(', ');
                list.appendChild(spec);
            }
        }
        ["lobbyJoinBtn", "lobbyStartBtn", "lobbySpectateBtn"].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = game.started;
        });
        if (document.getElementById('lobbyJoinBtn') && sessionStorage.getItem('mexicanTrainJoined') && !game.started) {
            document.getElementById('lobbyJoinBtn').disabled = true;
        }
        if (!game.started && !game.gameOver) return;

        if (document.getElementById('lobby')) document.getElementById('lobby').classList.add('hidden');
        if (document.getElementById('board')) document.getElementById('board').classList.remove('hidden');
        if (document.getElementById('roundNumberLabel')) document.getElementById('roundNumberLabel').innerText = game.currentRound;
        if (document.getElementById('centerStone')) document.getElementById('centerStone').innerText = game.startNumber + '|' + game.startNumber;
        if (document.getElementById('boneyardCount')) document.getElementById('boneyardCount').innerText = game.boneyard ? game.boneyard.length : 0;

        const headerRow = document.getElementById('playerHeaderRow');
        if (headerRow) {
            headerRow.innerHTML = "";
            game.players.forEach((p, idx) => {
                const card = document.createElement("div");
                card.className = "player-status-card " + (game.currentTurn === idx ? "active" : "");
                card.innerHTML = "<span>" + p.name + "</span><div class='stats'>" + (game.hands && game.hands[p.id] ? game.hands[p.id].length : 0) + " stn | " + p.totalScore + " pnt</div>";
                headerRow.appendChild(card);
            });
        }
        if (document.getElementById('doubleWarningBanner')) {
            document.getElementById('doubleWarningBanner').classList.toggle('hidden', !(game.requiredDouble && game.requiredDouble.active));
        }
        if (document.getElementById('mexicanTrackCard')) {
            document.getElementById('mexicanTrackCard').classList.toggle('double-highlight', !!(game.requiredDouble && game.requiredDouble.active && game.requiredDouble.targetId === 'mexican'));
        }
        const mexTrack = document.getElementById('mexicanTrack');
        if (mexTrack && game.mexicanTrain) {
            mexTrack.innerHTML = "";
            game.mexicanTrain.forEach(s => { if (Array.isArray(s)) mexTrack.appendChild(createStoneEl(s, false)); });
        }
        const tracksContainer = document.getElementById('playerTracksContainer');
        if (tracksContainer) {
            tracksContainer.innerHTML = "";
            game.players.forEach((p, idx) => {
                const isCurrent = game.currentTurn === idx;
                const isDouble = game.requiredDouble && game.requiredDouble.active && game.requiredDouble.targetId === p.id;
                const handLen = game.hands && game.hands[p.id] ? game.hands[p.id].length : 0;
                
                const col = document.createElement("div");
                col.className = "train-column " + (isDouble ? "double-highlight" : "");
                if (isCurrent) col.style = "border-top: 4px solid #f59e0b; background-color: rgba(245, 158, 11, 0.03);";
                col.onclick = () => selectTrain(p.id);

                let html = "<div class='column-header'><div class='title " + (p.id === socket.id ? "me" : "") + "'>" + (isCurrent ? "⭐ " : "") + p.name + "</div>";
                html += "<div class='score-stn'>" + p.totalScore + " pnt | " + handLen + " stn</div>";
                html += "<div class='status-badge " + (p.isOpen ? "open" : "") + "'>" + (p.isOpen ? "🔓 OPEN" : "🔒 PRIVÉ") + "</div>";
                if (handLen === 1) html += "<div class='bounce-badge'>1 STEEN</div>";
                html += "</div><div class='stones-scroll-area no-scrollbar'>";
                col.innerHTML = html;

                const scrollArea = col.querySelector('.stones-scroll-area');
                if (p.train) { p.train.forEach(s => { if (Array.isArray(s)) scrollArea.appendChild(createStoneEl(s, false)); }); }
                tracksContainer.appendChild(col);
            });
        }
        const drawBtn = document.getElementById('drawBtn'), passBtn = document.getElementById('passBtn'), label = document.getElementById('drawStatusLabel');
        if (drawBtn && passBtn && label) {
            const isMyTurn = game.players[game.currentTurn]?.id === socket.id;
            if (isMyTurn && !game.gameOver) {
                drawBtn.disabled = game.hasDrawn; passBtn.disabled = !game.hasDrawn;
                label.innerText = game.hasDrawn ? "Leg aan of klik op Pas." : (game.requiredDouble && game.requiredDouble.active ? "Leg op de dubbel of pak!" : "Jouw beurt: Leg of pak.");
            } else {
                drawBtn.disabled = true; passBtn.disabled = true;
                label.innerText = game.gameOver ? "SPEL AFGELOPEN!" : "Wachten op tegenstander...";
            }
        }
        const handDiv = document.getElementById('myHand');
        if (handDiv) {
            handDiv.innerHTML = ""; 
            // OPLOSSING WEERGAVE: Hand schuift nu altijd netjes horizontaal door bij veel stenen
            handDiv.style = "display:flex !important; flex-direction:row !important; flex-wrap:nowrap !important; overflow-x:auto !important; justify-content:flex-start !important; padding:5px; width:100%; box-sizing:border-box;";
            const myHand = game.hands && game.hands[socket.id] ? game.hands[socket.id] : [];
            myHand.forEach((s, idx) => { if (Array.isArray(s)) handDiv.appendChild(createStoneEl(s, true, idx)); });
        }
    });

    socket.on('gameStarted', (game) => { if(game) socket.emit('updateGame', game); });
    socket.on('roundEnded', (data) => {
        alert(data.nextRoundReady ? "Ronde voorbij! " + data.winner + " heeft uitgespeeld.\n\nVolgende ronde met Dubbel " + data.game.startNumber + "." : "FINALE AFGELOPEN!\n\n🏆 WINNAAR: " + data.champion + "!");
        if (!data.nextRoundReady) {
            sessionStorage.removeItem('mexicanTrainJoined');
            if (document.getElementById('board')) document.getElementById('board').classList.add('hidden');
            if (document.getElementById('lobby')) document.getElementById('lobby').classList.remove('hidden');
        }
        if (data.game) socket.emit('updateGame', data.game);
    });
}
