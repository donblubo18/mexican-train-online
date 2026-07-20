console.log("Mexican Train: public/engine/gameEngine.js succesvol geladen!");

function createStoneEl(s, isHandCard, idx) {
    if (!Array.isArray(s)) return document.createElement("div");
    const btn = document.createElement(isHandCard ? "button" : "div");
    btn.className = isHandCard ? "domino" : "track-stone";
    if (isHandCard) {
        btn.draggable = true;
        btn.ondragstart = (e) => window.draggedStoneIndex = idx;
        btn.ondragover = (e) => e.preventDefault();
        btn.ondrop = (e) => { window.socket.emit('reorderHand', { fromIndex: window.draggedStoneIndex, toIndex: idx }); };
        btn.onclick = () => {
            window.selectedStoneIndex = idx;
            if (document.getElementById('selectedStoneLabel')) {
                document.getElementById('selectedStoneLabel').innerText = s.join("|");
            }
            if (window.selectedTrainId !== null) executePlay();
        };
    }
    btn.innerHTML = `<span>${s}</span><div class='line'></div><span>${s}</span>`;
    return btn;
}
window.createStoneEl = createStoneEl;

function executePlay() {
    window.socket.emit('playStone', { stoneIndex: window.selectedStoneIndex, targetId: window.selectedTrainId });
    window.selectedStoneIndex = null; window.selectedTrainId = null;
    if (document.getElementById('selectedStoneLabel')) document.getElementById('selectedStoneLabel').innerText = "-";
}

function selectTrain(id) {
    window.selectedTrainId = id;
    if (window.selectedStoneIndex !== null) executePlay();
}
window.selectTrain = selectTrain;

if (window.socket) {
    window.socket.on('joinSuccess', () => {
        sessionStorage.setItem('mexicanTrainJoined', 'true');
        if (document.getElementById('lobbyJoinBtn')) document.getElementById('lobbyJoinBtn').disabled = true;
    });

    window.socket.on('errorMsg', alert);

    window.socket.on('playSound', (type) => {
        console.log("gameEngine: Netwerksignaal ontvangen voor geluid ->", type);
        if (type === 'turn' && window.audioTurn) window.audioTurn.play().catch(() => {});
        if (type === 'trainOpen' && window.audioTrainOpen) window.audioTrainOpen.play().catch(() => {});
        if (type === 'knock' && window.audioKnock) window.audioKnock.play().catch(() => {});
    });

    window.socket.on('updateGame', (game) => {
        if (!game || !game.players) return;

        const list = document.getElementById('playerList');
        if (list) {
            list.innerHTML = game.players.map(p => `<li>${p.name} (Totaal: ${p.totalScore} pnt)</li>`).join('');
            if (game.spectators && game.spectators.length > 0) {
                list.innerHTML += `<li style="color:#94a3b8;margin-top:10px;list-style:none">👀 Kijkers: ${game.spectators.map(s => s.name).join(', ')}</li>`;
            }
        }

        // REPARATIE: Toon de startknop UITSLUITEND als jij de maker (creator) bent van deze kamer!
        const startBtn = document.getElementById('lobbyStartBtn');
        if (startBtn) {
            if (game.creatorId && game.creatorId === window.socket.id) {
                startBtn.classList.remove('hidden'); 
            } else {
                startBtn.classList.add('hidden');    
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
        // Wissel schermen om naar het actieve speelbord
        if (document.getElementById('lobby')) document.getElementById('lobby').classList.add('hidden');
        if (document.getElementById('board')) document.getElementById('board').classList.remove('hidden');
        
        if (document.getElementById('roundNumberLabel')) document.getElementById('roundNumberLabel').innerText = game.currentRound;
        if (document.getElementById('centerStone')) document.getElementById('centerStone').innerText = game.startNumber + '|' + game.startNumber;
        if (document.getElementById('boneyardCount')) document.getElementById('boneyardCount').innerText = game.boneyardCount || 0;

        const headerRow = document.getElementById('playerHeaderRow');
        if (headerRow) {
            headerRow.innerHTML = game.players.map((p, idx) => {
                const isCurrent = game.currentTurn === idx;
                const handLen = p.handCount || 0;
                return `<div class="player-status-card ${isCurrent ? 'active' : ''}">
                    <span>${p.name}</span>
                    <div class="stats">${handLen} stn | ${p.totalScore} pnt</div>
                </div>`;
            }).join('');
        }

        if (document.getElementById('doubleWarningBanner')) {
            document.getElementById('doubleWarningBanner').classList.toggle('hidden', !(game.requiredDouble && game.requiredDouble.active));
        }

        if (document.getElementById('mexicanTrackCard')) {
            const isMexDouble = game.requiredDouble && game.requiredDouble.active && game.requiredDouble.targetId === 'mexican';
            document.getElementById('mexicanTrackCard').classList.toggle('double-highlight', !!isMexDouble);
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
                const handLen = p.handCount || 0;
                
                const col = document.createElement("div");
                col.className = "train-column " + (isDouble ? "double-highlight" : "");
                if (isCurrent) col.style = "border-top: 4px solid #f59e0b; background-color: rgba(245, 158, 11, 0.03);";
                col.onclick = () => selectTrain(p.id);

                let html = `<div class='column-header'>
                    <div class='title ${p.id === window.socket.id ? "me" : ""}'>${isCurrent ? "⭐ " : ""}${p.name}</div>
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

        const drawBtn = document.getElementById('drawBtn');
        const passBtn = document.getElementById('passBtn');
        const label = document.getElementById('drawStatusLabel');
        if (drawBtn && passBtn && label) {
            const isMyTurn = game.players[game.currentTurn]?.id === window.socket.id;
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

        const handDiv = document.getElementById('myHand');
        if (handDiv) {
            handDiv.innerHTML = "";
            const isSpectator = game.spectators && game.spectators.some(s => s.id === window.socket.id);
            
            if (isSpectator) {
                const specDiv = document.createElement("div");
                specDiv.style = "color:#94a3b8; font-size:12px; font-style:italic; padding:10px;";
                specDiv.innerText = "Je kijkt live mee.";
                handDiv.appendChild(specDiv);
            } else if (game.hands && game.hands[window.socket.id]) {
                game.hands[window.socket.id].forEach((s, idx) => { 
                    if (Array.isArray(s)) handDiv.appendChild(createStoneEl(s, true, idx)); 
                });
            }
        }
    });

    // REPARATIE: Vangt het startsignaal op en forceert de schermwissel direct bij het starten!
    window.socket.on('gameStarted', () => {
        if (document.getElementById('lobby')) document.getElementById('lobby').classList.add('hidden');
        if (document.getElementById('board')) document.getElementById('board').classList.remove('hidden');
    });

    window.socket.on('roundEnded', (data) => {
        alert(data.nextRoundReady ? `Ronde voorbij! ${data.winner} heeft uitgespeeld.\n\nVolgende ronde met Dubbel ${data.game.startNumber}.` : `FINALE AFGELOPEN!\n\n🏆 WINNAAR: ${data.champion}!`);
        if (!data.nextRoundReady) {
            sessionStorage.removeItem('mexicanTrainJoined');
            if (document.getElementById('board')) document.getElementById('board').classList.add('hidden');
            if (document.getElementById('lobby')) document.getElementById('lobby').classList.remove('hidden');
        }
        if (data.game) window.socket.emit('updateGame', data.game);
    });
}
