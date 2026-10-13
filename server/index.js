import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 5200;
const ROOT = resolve(import.meta.dirname, '..', 'dist');
const MAX_PLAYERS = 4;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    let file = resolve(join(ROOT, decodeURIComponent(pathname)));
    if (file !== ROOT && !file.startsWith(ROOT + sep)) {
      res.writeHead(403).end();
      return;
    }
    const info = await stat(file).catch(() => null);
    if (!info || info.isDirectory()) file = join(ROOT, 'index.html');
    const body = await readFile(file);
    const immutable = file.includes(`${sep}assets${sep}`);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] || 'application/octet-stream',
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Game not built yet. Run `npm run online`.');
  }
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 256 * 1024 });
const rooms = new Map();
let nextId = 1;

const send = (ws, msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg));

function makeCode() {
  let code;
  do code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  while (rooms.has(code));
  return code;
}

function leave(ws) {
  const room = ws.room && rooms.get(ws.room);
  ws.room = null;
  if (!room) return;
  if (room.host === ws) {
    for (const peer of room.peers.values()) {
      peer.room = null;
      send(peer, { t: 'host-left' });
    }
    rooms.delete(room.code);
  } else {
    room.peers.delete(ws.id);
    send(room.host, { t: 'peer-leave', id: ws.id });
  }
}

wss.on('connection', (ws) => {
  ws.id = nextId++;
  ws.room = null;
  ws.alive = true;
  ws.on('pong', () => (ws.alive = true));
  ws.on('message', (raw) => {
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    const room = ws.room && rooms.get(ws.room);
    switch (m?.t) {
      case 'create': {
        if (ws.room) return;
        const code = makeCode();
        rooms.set(code, { code, host: ws, peers: new Map(), locked: false });
        ws.room = code;
        send(ws, { t: 'created', code, id: ws.id });
        break;
      }
      case 'join': {
        if (ws.room) return;
        const target = rooms.get(String(m.code || '').toUpperCase().trim());
        if (!target) return send(ws, { t: 'error', msg: 'No room with that code.' });
        if (target.locked) return send(ws, { t: 'error', msg: 'That room is mid-game. Try again when the round ends.' });
        if (target.peers.size + 1 >= MAX_PLAYERS) return send(ws, { t: 'error', msg: 'That room is full.' });
        target.peers.set(ws.id, ws);
        ws.room = target.code;
        send(ws, { t: 'joined', code: target.code, id: ws.id });
        send(target.host, { t: 'peer-join', id: ws.id, data: m.data });
        break;
      }
      case 'to-host':
        if (room && room.host !== ws) send(room.host, { t: 'from', id: ws.id, data: m.data });
        break;
      case 'broadcast':
        if (room && room.host === ws) for (const peer of room.peers.values()) send(peer, { t: 'host', data: m.data });
        break;
      case 'to':
        if (room && room.host === ws) {
          const peer = room.peers.get(m.id);
          if (peer) send(peer, { t: 'host', data: m.data });
        }
        break;
      case 'lock':
        if (room && room.host === ws) room.locked = !!m.locked;
        break;
      case 'leave':
        leave(ws);
        break;
    }
  });
  ws.on('close', () => leave(ws));
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) {
      ws.terminate();
      continue;
    }
    ws.alive = false;
    ws.ping();
  }
}, 15000);

function onListenError(err) {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use (another Chef Showdown server?). Stop it, or pick another port: PORT=5300 npm run online`);
    process.exit(1);
  }
  throw err;
}
server.on('error', onListenError);
wss.on('error', onListenError);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Chef Showdown server on http://localhost:${PORT}  (websocket /ws, serving ${ROOT})`);
});
