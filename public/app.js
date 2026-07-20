console.log("Mexican Train: app.js succesvol geladen!");

const audioTurn = new Audio('/sounds/turn.mp3'); 
const audioTrainOpen = new Audio('/sounds/trainOpen.mp3'); 
const audioKnock = new Audio('/sounds/knock.mp3'); 

const socket = io(); 

let selectedStoneIndex = null;
let selectedTrainId = null;
let draggedStoneIndex = null;
let activeRoomName = null; 

function unlockAudio() {
    console.log("AudioController: Browser toestemming aanvragen...");
    [audioTurn, audioTrainOpen, audioKnock].forEach(audio => {
        audio.muted = true;
        audio.play().then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = false;
        }).catch(() => {});
    });
}

function createNewRoom() {
    const roomInp = document.getElementById('newRoomInp');
    const roomName = roomInp ? roomInp.value.trim() : "";
    if (roomName) {
        socket.emit('createRoom', roomName);
        roomInp.value = "";
    } else {
        alert("Vul een naam in voor de nieuwe kamer!");
    }
}

function joinRoom(roomName) {
    unlockAudio();
    const nameInp = document.getElementById('nameInp');
    const playerName = nameInp ? nameInp.value.trim() : "";
    if (!playerName) return alert("Vul eerst een spelersnaam in bovenin!");

    activeRoomName = roomName;
    socket.emit('joinGame', { roomName, playerName });
}

function spectateRoom(roomName) {
    unlockAudio();
    activeRoomName = roomName;
    socket.emit('joinAsSpectator', roomName);
}

function start() {
    unlockAudio(); 
    const m = document.getElementById('maxStoneInp')?.value;
    socket.emit('startGame', parseInt(m) || 12);
}

function draw() { socket.emit('drawStone'); }
function pass() { socket.emit('passTurn'); }

// Ontvang live kamer updates voor het startscherm
socket.on('roomListUpdate', (rooms) => {
    const container = document.getElementById('roomListContainer');
    if (!container) return;

    if (!rooms || rooms.length === 0) {
        container.innerHTML = `<div style="color: #94a3b8; font-size: 14px; font-style: italic; text-align: center; padding: 10px;">Geen actieve kamers. Maak hierboven een kamer aan!</div>`;
        return;
    }

    container.innerHTML = rooms.map(r => {
        const statusText = r.started ? `<span style="color:#f87171; font-weight:bold;">⚠️ Bezig</span>` : `<span style="color:#4ade80; font-weight:bold;">⏳ Lobby</span>`;
        
        return `<div class="room-box">
            <div class="room-info">
                <strong>Kamer: ${r.name}</strong> (${statusText})<br>
                <span style="color:#94a3b8; font-size:12px;">Spelers: ${r.playerCount}/8 | Kijkers: ${r.spectatorCount}</span>
            </div>
            <div class="room-actions">
                <button onclick="joinRoom('${r.name}')" class="btn-sm btn-yellow" ${r.started ? 'disabled style="opacity:0.2; cursor:not-allowed;"' : ''}>Deelnemen</button>
                <button onclick="spectateRoom('${r.name}')" class="btn-sm btn-slate">Kijken</button>
            </div>
        </div>`;
    }).join('');
});

// REPARATIE: Maakt de wachtruimte-sectie én de startknop direct zichtbaar na een succesvolle join
socket.on('joinSuccess', (roomName) => {
    sessionStorage.setItem('mexicanTrainJoined', 'true');
    
    const wachtruimte = document.getElementById('wachtruimteSectie');
    if (wachtruimte) wachtruimte.classList.remove('hidden');
    
    const titleLabel = document.getElementById('currentRoomTitle');
    if (titleLabel) titleLabel.innerText = roomName;
    
    if (document.getElementById('nameInp')) document.getElementById('nameInp').disabled = true;
});

// Deel variabelen met de browser engine via het window-object
window.audioTurn = audioTurn;
window.audioTrainOpen = audioTrainOpen;
window.audioKnock = audioKnock;
window.socket = socket;
window.selectedStoneIndex = selectedStoneIndex;
window.selectedTrainId = selectedTrainId;
window.draggedStoneIndex = draggedStoneIndex;
