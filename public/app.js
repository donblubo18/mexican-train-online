console.log("Mexican Train: app.js succesvol geladen!");

// 1. Maak de geluiden aan vanaf je eigen Render-server map
const audioTurn = new Audio('/sounds/turn.mp3'); 
const audioTrainOpen = new Audio('/sounds/trainOpen.mp3'); 
const audioKnock = new Audio('/sounds/knock.mp3'); 

// 2. Maak de Socket.io netwerkverbinding aan (leeg laten voor automatische Render-poort)
const socket = io(); 

let selectedStoneIndex = null;
let selectedTrainId = null;
let draggedStoneIndex = null;

// 3. Browser audio-beveiliging omzeilen bij een klik
function unlockAudio() {
    console.log("AudioController: Browser toestemming aanvragen...");
    [audioTurn, audioTrainOpen, audioKnock].forEach(audio => {
        audio.muted = true;
        audio.play().then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = false;
            console.log("Geluid succesvol ontgrendeld!");
        }).catch(err => console.log("Unlock noch niet toegestaan:", err));
    });
}

if (sessionStorage.getItem('mexicanTrainJoined') && document.getElementById('nameInp')) {
    document.getElementById('nameInp').disabled = true;
}

// 4. Koppel de unlock aan de lobby-knoppen
function join() {
    unlockAudio(); 
    const name = document.getElementById('nameInp')?.value.trim();
    if (name) socket.emit('joinGame', name);
    else alert("Naam invullen!");
}

function start() {
    unlockAudio(); 
    const m = document.getElementById('maxStoneInp')?.value;
    socket.emit('startGame', parseInt(m) || 12);
}

function spectate() {
    unlockAudio(); 
    socket.emit('joinAsSpectator');
}

function draw() { socket.emit('drawStone'); }
function pass() { socket.emit('passTurn'); }

// Deel deze variabelen met gameEngine.js via het globale window-object
window.audioTurn = audioTurn;
window.audioTrainOpen = audioTrainOpen;
window.audioKnock = audioKnock;
window.socket = socket;
window.selectedStoneIndex = selectedStoneIndex;
window.selectedTrainId = selectedTrainId;
window.draggedStoneIndex = draggedStoneIndex;

// 5. Domino en speelveld functies
function createStoneEl(s, isHandCard, idx) {
    if (!Array.isArray(s)) return document.createElement("div");
    const btn = document.createElement(isHandCard ? "button" : "div");
    btn.className = isHandCard ? "domino" : "track-stone";
    if (isHandCard) {
        btn.draggable = true;
        btn.ondragstart = (e) => draggedStoneIndex = idx;
        btn.ondragover = (e) => e.preventDefault();
        btn.ondrop = (e) => { socket.emit('reorderHand', { fromIndex: draggedStoneIndex, toIndex: idx }); };
        btn.onclick = () => {
            selectedStoneIndex = idx;
            if (document.getElementById('selectedStoneLabel')) {
                document.getElementById('selectedStoneLabel').innerText = s.join("|");
            }
            if (selectedTrainId !== null) executePlay();
        };
    }
    btn.innerHTML = `<span>${s[0]}</span><div class='line'></div><span>${s[1]}</span>`;
    return btn;
}

function executePlay() {
    socket.emit('playStone', { stoneIndex: selectedStoneIndex, targetId: selectedTrainId });
    selectedStoneIndex = null;
    selectedTrainId = null;
    if (document.getElementById('selectedStoneLabel')) {
        document.getElementById('selectedStoneLabel').innerText = "-";
    }
}

function selectTrain(id) {
    selectedTrainId = id;
    if (selectedStoneIndex !== null) executePlay();
}

// 6. Netwerk luisteraars (Socket.io Events)
if (socket) {
    socket.on('joinSuccess', () => {
        sessionStorage.setItem('mexicanTrainJoined', 'true');
        if (document.getElementById('lobbyJoinBtn')) document.getElementById('lobbyJoinBtn').disabled = true;
    });

    socket.on('errorMsg', alert);

    // Luister naar geluiden vanuit de server
    socket.on('playSound', (type) => {
        console.log("Netwerksignaal ontvangen voor geluid ->", type);
        if (type === 'turn' && audioTurn) audioTurn.play().catch(() => {});
        if (type === 'trainOpen' && audioTrainOpen) audioTrainOpen.play().catch(() => {});
        if (type === 'knock' && audioKnock) audioKnock.play().catch(() => {});
    });

    // Spel status en interface updates
    socket.on('updateGame', (game) => {
        if (!game || !game.players) return;

        // Lobby wachtlijst
        const list = document.getElementById('playerList');
        if (list) {
            list.innerHTML = game.players.map(p => `<li>${p.name} (Totaal: ${p.totalScore} pnt)</li>`).join('');
            if (game.spectators && game.spectators.length > 0) {
                list.innerHTML += `<li style="color:#94a3b8;margin-top:10px;list-style:none">👀 Kijkers: ${game.spectators.map(s => s.name).join(', ')}</li>`;
            }
        }

        ["lobbyJoinBtn", "lobbyStartBtn", "lobbySpectateBtn"].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = game.started;
        });

        if (!game.started && !game.gameOver) return;

        if (document.getElementById('lobby')) document.getElementById('lobby').classList.add('hidden');
        if (document.getElementById('board')) document.getElementById('board').classList.remove('hidden');
        if (document.getElementById('roundNumberLabel')) document.getElementById('roundNumberLabel').innerText = game.currentRound;
        if (document.getElementById('centerStone')) document.getElementById('centerStone').innerText = game.startNumber + '|' + game.startNumber;
        if (document.getElementById('boneyardCount')) document.getElementById('boneyardCount').innerText = game.boneyard ? game.boneyard.length : 0;

        // Scorebalk bovenaan
        const headerRow = document.getElementById('playerHeaderRow');
        if (headerRow) {
            headerRow.innerHTML = game.players.map((p, idx) => {
                const isCurrent = game.currentTurn === idx;
                const handLen = game.hands && game.hands[p.id] ? game.hands[p.id].length : 0;
                return `<div class="player-status-card ${isCurrent ? 'active' : ''}">
                    <span>${p.name}</span>
                    <div class="stats">${handLen} stn | ${p.totalScore} pnt</div>
                </div>`;
            }).join('');
        }

        if (document.getElementById('doubleWarningBanner')) {
            document.getElementById('doubleWarningBanner').classList.toggle('hidden', !(game.requiredDouble && game.requiredDouble.active));
        }

        // Render Mexican Train
        const mexTrack = document.getElementById('mexicanTrack');
        if (mexTrack && game.mexicanTrain) {
            mexTrack.innerHTML = "";
            game.mexicanTrain.forEach(s => { if (Array.isArray(s)) mexTrack.appendChild(createStoneEl(s, false)); });
        }

        // Render Verticale kolommen met zwarte lijnen en het beurt-sterretje ⭐
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

                let html = `<div class='column-header'>
                    <div class='title ${p.id === socket.id ? "me" : ""}'>${isCurrent ? "⭐ " : ""}${p.name}</div>
                    <div class='score-stn'>${p.totalScore} pnt | ${handLen} stn</div>
                    <div class='status-badge ${p.isOpen ? "open" : ""}'>${p.isOpen ? "🔓 OPEN" : "🔒 PRIVÉ"}</div>
                    ${handLen === 1 ? "<div class='bounce-badge'>1 STEEN</div>" : ""}
                </div><div class='stones-scroll-area no-scrollbar'></div>`;
                col.innerHTML = html;

                const scrollArea = col.querySelector('.stones-scroll-area');
                if (p.train && scrollArea) {
                    p.train.forEach(s => { if (Array.isArray(s)) scrollArea.appendChild(createStoneEl(s, false)); });
                }
                tracksContainer.appendChild(col);
            });
        }

        // Knoppenstatussen beheren
        const drawBtn = document.getElementById('drawBtn');
        const passBtn = document.getElementById('passBtn');
        const label = document.getElementById('drawStatusLabel');
        if (drawBtn && passBtn && label) {
            const isMyTurn = game.players[game.currentTurn]?.id === socket.id;
            if (isMyTurn && !game.gameOver) {
                drawBtn.disabled = game.hasDrawn; 
                passBtn.disabled = !game.hasDrawn;
                label.innerText = game.hasDrawn ? "Leg aan of klik op Pas." : (game.requiredDouble && game.requiredDouble.active ? "Leg op de dubbel of pak!" : "Jouw beurt: Leg of pak.");
            } else {
                drawBtn.disabled = true; 
                passBtn.disabled = true;
                label.innerText = game.gameOver ? "SPEL AFGELOPEN!" : "Wachten op tegenstander...";
            }
        }

        // Horizontaal scrollende hand onderaan renderen
        const handDiv = document.getElementById('myHand');
        if (handDiv) {
            handDiv.innerHTML = "";
            handDiv.style = "display:flex !important; flex-direction:row !important; flex-wrap:nowrap !important; overflow-x:auto !important; justify-content:flex-start !important; padding:5px; width:100%; box-sizing:border-box;";
            
            const isSpectator = game.spectators && game.spectators.some(s => s.id === socket.id);
            if (isSpectator) {
                const specDiv = document.createElement("div");
                specDiv.style = "color:#94a3b8; font-size:12px; font-style:italic; padding:10px;";
                specDiv.innerText = "Je kijkt live mee.";
                handDiv.appendChild(specDiv);
                                } 
            else if (
                game.hands && game.hands[socket.id]) {
                game.hands[socket.id].forEach((s, idx) => { 
                if (Array.isArray(s)) handDiv.appendChild(createStoneEl(s, true, idx)); });
            }}});
    socket.on('gameStarted', (game) => { 
        if(game) socket.emit('updateGame', game); });
    socket.on('roundEnded', (data) => {alert(data.nextRoundReady ? Ronde voorbij! ${data.winner} heeft uitgespeeld.\n\nVolgende ronde met Dubbel ${data.game.startNumber}. : FINALE AFGELOPEN!\n\n🏆 WINNAAR: ${data.champion}!);
    if (!data.nextRoundReady) {sessionStorage.removeItem('mexicanTrainJoined');
        if (document.getElementById('board')) document.getElementById('board').classList.add('hidden');
        if (document.getElementById('lobby')) document.getElementById('lobby').classList.remove('hidden');}
    if (data.game) socket.emit('updateGame', data.game);
});
}
