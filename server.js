const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const players = new Map();

app.prepare().then(() => {
  const expressApp = express();
  const httpServer = createServer(expressApp);

  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    console.log(`[+] Player connected: ${socket.id}`);

    // Send the full world state to the newly connected player
    socket.emit(
      'world:state',
      Array.from(players.values())
    );

    // Player joins with their chosen character info
    socket.on('player:join', (data) => {
      const player = {
        id: socket.id,
        name: data.name || 'Wanderer',
        characterType: data.characterType || 0,
        color: data.color || '#ff4444',
        x: data.x ?? (Math.random() - 0.5) * 200,
        y: data.y ?? 20,
        z: data.z ?? (Math.random() - 0.5) * 200,
        rotation: data.rotation || 0,
        animation: 'idle',
      };
      players.set(socket.id, player);
      socket.emit('player:id', socket.id);
      socket.broadcast.emit('player:joined', player);
      io.emit('server:info', {
        message: `${player.name} has entered the world`,
        count: players.size,
      });
      console.log(
        `[>] ${player.name} joined (${players.size} online)`
      );
    });

    // Position / rotation updates at ~20 Hz
    socket.on('player:move', (data) => {
      const player = players.get(socket.id);
      if (!player) return;
      player.x = data.x;
      player.y = data.y;
      player.z = data.z;
      player.rotation = data.rotation;
      player.animation = data.animation || 'idle';
      socket.broadcast.emit('player:moved', {
        id: socket.id,
        x: data.x,
        y: data.y,
        z: data.z,
        rotation: data.rotation,
        animation: data.animation,
      });
    });

    // Chat messages
    socket.on('chat:message', (data) => {
      const player = players.get(socket.id);
      if (!player) return;
      const msg = {
        id: socket.id,
        name: player.name,
        text: (data.text || '').slice(0, 200),
        time: Date.now(),
      };
      io.emit('chat:message', msg);
    });

    socket.on('disconnect', () => {
      const player = players.get(socket.id);
      if (player) {
        players.delete(socket.id);
        io.emit('player:left', { id: socket.id });
        io.emit('server:info', {
          message: `${player.name} left the world`,
          count: players.size,
        });
        console.log(
          `[<] ${player.name} disconnected (${players.size} online)`
        );
      }
    });
  });

  // Let Next.js handle every HTTP request
  expressApp.all('/{*splat}', (req, res) => handle(req, res));

  httpServer.listen(port, hostname, () => {
    console.log(`\n  ▸ Game server  → http://${hostname}:${port}`);
    console.log(`  ▸ Socket.IO    → ws://${hostname}:${port}/socket.io\n`);
  });
});
