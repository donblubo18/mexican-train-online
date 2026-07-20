console.log("Mexican Train: app.js succesvol geladen!");

// 1. Maak de geluiden aan vanaf je eigen Render-server map
const audioTurn = new Audio('/sounds/turn.mp3'); 
const audioTrainOpen = new Audio('/sounds/trainOpen.mp3'); 
const audioKnock = new Audio('/sounds/knock.mp3'); 

// 2. Maak de Socket.io netwerkverbinding aan
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
        }).catch(err => console.log("Unlock nog niet toegestaan:", err));
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
