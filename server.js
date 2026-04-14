const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

// ── In-memory state ──────────────────────────────────────────────
const players = new Map();
const rateLimiters = new Map();

function sanitizeName(str) {
  if (typeof str !== 'string') return 'Wanderer';
  return str.replace(/[^\w\s\-_.]/g, '').slice(0, 20).trim() || 'Wanderer';
}

function sanitizeColor(str) {
  if (typeof str !== 'string') return '#ff4444';
  if (/^#[0-9a-fA-F]{6}$/.test(str)) return str;
  return '#ff4444';
}

function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 200);
}

function createRateLimiter(maxCalls, windowMs) {
  let start = Date.now();
  let count = 0;
  return function check() {
    const now = Date.now();
    if (now - start > windowMs) {
      start = now;
      count = 0;
    }
    count++;
    return count <= maxCalls;
  };
}

// ── Global error handlers ────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection:', reason);
});

// ── Next.js app ──────────────────────────────────────────────────
const app = next({ dev, hostname, port: port });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    console.log('[Server] Next.js prepared successfully');

    // ── HTTP server — Next.js handles ALL requests ──
    const server = createServer((req, res) => {
      try {
        handle(req, res);
      } catch (err) {
        console.error('[Server] Request handler error:', err.message);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end('Internal Server Error');
        }
      }
    });

    // ── Socket.IO attached to the same server ────────────────────
    const io = new Server(server, {
      path: '/socket.io',
      cors: { origin: '*' },
    });

    io.on('connection', (socket) => {
      console.log('[+] Player connected:', socket.id);

      const moveLimiter = createRateLimiter(40, 1000);
      const chatLimiter = createRateLimiter(2, 2000);
      rateLimiters.set(socket.id, { moveLimiter, chatLimiter });

      socket.emit('world:state', Array.from(players.values()));

      socket.on('player:join', (data) => {
        try {
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
          console.log(`[>] ${player.name} joined (${players.size} online)`);
        } catch (err) {
          console.error('[Server] player:join error:', err.message);
        }
      });

      socket.on('player:move', (data) => {
        try {
          if (!moveLimiter()) return;
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
        } catch (err) {
          // Silently ignore move errors to avoid spam
        }
      });

      socket.on('chat:message', (data) => {
        try {
          if (!chatLimiter()) return;
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
        } catch (err) {
          console.error('[Server] chat:message error:', err.message);
        }
      });

      socket.on('disconnect', () => {
        try {
          const player = players.get(socket.id);
          if (player) {
            players.delete(socket.id);
            io.emit('player:left', { id: socket.id });
            io.emit('server:info', {
              message: `${player.name} left the world`,
              count: players.size,
            });
            console.log(`[<] ${player.name} disconnected (${players.size} online)`);
          }
          rateLimiters.delete(socket.id);
        } catch (err) {
          console.error('[Server] disconnect error:', err.message);
        }
      });
    });

    // ── Start ─────────────────────────────────────────────────────
    server.listen(port, hostname, () => {
      console.log(`\n  Game server  -> http://localhost:${port}`);
      console.log(`  Socket.IO    -> ws://localhost:${port}/socket.io\n`);
    });

    server.on('error', (err) => {
      console.error('[Server] HTTP server error:', err.message);
      if (err.code === 'EADDRINUSE') {
        console.error(`[Server] Port ${port} is already in use. Kill the existing process and try again.`);
      }
    });
  })
  .catch((err) => {
    console.error('[Server] Failed to prepare Next.js:', err);
    process.exit(1);
  });
