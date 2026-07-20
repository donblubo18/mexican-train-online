const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const RoomManager = require('./src/rooms/roomManager');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static('public'));

// Start de netwerk- en kameraansturing
new RoomManager(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server draait live op poort ${PORT}`));
