const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Game = require('./models/game');
const roomManager = require('./rooms/roomManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

app.use(express.static('public'));

// Instantieer het centrale spelsysteem
const centralGame = new Game();

// Koppel de netwerk-routing manager
roomManager(io, centralGame);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Modular Game Server draait live op poort ${PORT}`));
