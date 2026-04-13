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

/** Strip everything except safe printable characters */
function sanitizeName(str) {
  if (typeof str !== 'string') return 'Wanderer';
  return str.replace(/[^\w\s\-_.]/g, '').slice(0, 20).trim() || 'Wanderer';
}

/** Only allow hex colour codes */
function sanitizeColor(str) {
  if (typeof str !== 'string') return '#ff4444';
  if (/^#[0-9a-fA-F]{6}$/.test(str)) return str;
  return '#ff4444';
}

/** Strip HTML tags and limit length */
function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 200);
}

/** Rate limiter — max `maxCalls` calls per window per socket */
function createRateLimiter(maxCalls, windowMs) {
  const buckets = new Map();
  return function check(socketId) {
    const now = Date.now();
    let entry = buckets.get(socketId);
    if (!entry || now - entry.start > windowMs) {
      entry = { start: now, count: 0 };
      buckets.set(socketId, entry);
    }
    entry.count++;
    return entry.count <= maxCalls;
  };
}

app.prepare().then(() => {
  const expressApp = express();
  const httpServer = createServer(expressApp);

  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    console.log(`[+] Player connected: ${socket.id}`);

    // Per-socket rate limiters
    const moveLimiter  = createRateLimiter(40, 1000);   // 40 moves/sec
    const chatLimiter  = createRateLimiter(2, 2000);    // 2 msgs / 2 sec

    // Send the full world state to the newly connected player
    socket.emit(
      'world:state',
      Array.from(players.values())
    );

    // Player joins with their chosen character info
    socket.on('player:join', (data) => {
      const player = {
        id: socket.id,
        name: sanitizeName(data?.name),
        characterType: typeof data?.characterType === 'number'
          ? Math.max(0, Math.min(5, Math.round(data.characterType)))
          : 0,
        color: sanitizeColor(data?.color),
        x: typeof data?.x === 'number' ? data.x : (Math.random() - 0.5) * 200,
        y: typeof data?.y === 'number' ? data.y : 20,
        z: typeof data?.z === 'number' ? data.z : (Math.random() - 0.5) * 200,
        rotation: typeof data?.rotation === 'number' ? data.rotation : 0,
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
      if (!moveLimiter(socket.id)) return; // rate limited
      const player = players.get(socket.id);
      if (!player) return;
      if (typeof data.x !== 'number' || typeof data.z !== 'number') return;
      player.x = data.x;
      player.y = typeof data.y === 'number' ? data.y : player.y;
      player.z = data.z;
      player.rotation = typeof data.rotation === 'number' ? data.rotation : player.rotation;
      player.animation = typeof data.animation === 'string' ? data.animation : 'idle';
      socket.broadcast.emit('player:moved', {
        id: socket.id,
        x: player.x,
        y: player.y,
        z: player.z,
        rotation: player.rotation,
        animation: player.animation,
      });
    });

    // Chat messages
    socket.on('chat:message', (data) => {
      if (!chatLimiter(socket.id)) return; // rate limited
      const player = players.get(socket.id);
      if (!player) return;
      const text = sanitizeText(data?.text);
      if (!text) return;
      const msg = {
        id: socket.id,
        name: player.name,
        text,
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
