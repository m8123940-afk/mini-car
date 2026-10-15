// Turbo Rivals 3D — сервер онлайн-гонок и админ-панели (Node.js + ws).
// Переменные окружения: ADMIN_PASSWORD (обязательно для админки), ALLOWED_ORIGINS (через запятую, напр. https://user.github.io), PORT.
// ВАЖНО: позиции машин присылают клиенты (client-authoritative) — сервер проверяет формат и частоту, но не физику.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
// Принимаем как чистый origin, так и полный URL GitHub Pages с путём (/mini-car/).
// Браузер передаёт Origin только вида https://username.github.io, без пути.
const ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean).map(value => {
  try { return new URL(value).origin; } catch (_) { return value.replace(/\/+$/, ''); }
});
// Одна общая очередь: первые двое ожидающих начинают гонку сразу.
const MAX_ROOM = 2, START_DELAY = 4000, MATCH_WAIT = 0;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const TOKEN_SESSIONS = new Map(); // token -> normalized username
const accounts = new Map();
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const parsed = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) accounts.set(key, value);
} catch (e) { /* первая установка: файла аккаунтов пока нет */ }
function saveAccounts() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); const tmp = ACCOUNTS_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(accounts)), { mode: 0o600 }); fs.renameSync(tmp, ACCOUNTS_FILE); }
  catch (e) { console.error('Account storage write failed:', e.message); }
}
const usernameClean = v => String(v || '').normalize('NFKC').trim().replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 14);
function profileSafe(value, username) {
  const p = value && typeof value === 'object' ? value : {};
  const out = {};
  out.v = 2; out.name = username;
  out.coins = Math.max(0, Math.min(100000000, Math.floor(Number(p.coins) || 0)));
  out.cur = /^[a-z0-9_]{1,12}$/i.test(String(p.cur || 'rust')) ? String(p.cur || 'rust') : 'rust';
  out.cars = p.cars && typeof p.cars === 'object' ? p.cars : { rust: { up: [0,0,0,0,0,0], dmg: 0 } };
  out.level = Math.max(1, Math.min(9999, Math.floor(Number(p.level) || 1)));
  out.char = p.char && typeof p.char === 'object' ? { g: p.char.g === 'girl' ? 'girl' : 'boy', col: Math.max(0,Math.min(5,p.char.col|0)), skin: Math.max(0,Math.min(2,p.char.skin|0)) } : { g:'boy', col:0, skin:0 };
  out.tour = p.tour && typeof p.tour === 'object' ? p.tour : null;
  out.set = p.set && typeof p.set === 'object' ? { snd: p.set.snd ? 1 : 0, mus: p.set.mus ? 1 : 0, gfx: ['low','med','high'].includes(p.set.gfx) ? p.set.gfx : 'high', theme: p.set.theme === 'light' ? 'light' : 'dark' } : { snd:1,mus:1,gfx:'high',theme:'dark' };
  out.history = Array.isArray(p.history) ? p.history.slice(-40) : [];
  return out;
}
function tokenUser(req) { const t = String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''); return TOKEN_SESSIONS.get(t) || ''; }
function newToken(user) { const token = crypto.randomBytes(32).toString('hex'); TOKEN_SESSIONS.set(token, user); return token; }
function authResponse(req, res) { const user = tokenUser(req), a = accounts.get(user); if (!a) { res.writeHead(401, { 'Content-Type':'application/json' }); res.end(JSON.stringify({ error:'Нужно войти заново' })); return null; } return { user, a }; }
function safeAccount(a) { return { username: a.username, profile: profileSafe(a.profile, a.username) }; }

let maintenance = false, nextId = 1, nextRoom = 1;
const banned = new Set();
const clients = new Map();   // id -> client
const rooms = new Map();     // id -> room
let queue = [];              // clients waiting
const failed = new Map();    // ip -> {n, t}

const clean = s => String(s || '').replace(/[\u0000-\u001f<>&"'`]/g, '').trim().slice(0, 14);
const num = (v, lim) => (typeof v === 'number' && isFinite(v)) ? Math.max(-lim, Math.min(lim, v)) : 0;
const send = (c, o) => { try { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(o)); } catch (e) {} };
const ipOf = req => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();

// ---------- HTTP: health + админка ----------
function authOk(req) {
  if (!ADMIN_PASSWORD) return false;
  const ip = ipOf(req), f = failed.get(ip);
  if (f && f.n >= 10 && Date.now() - f.t < 10 * 60 * 1000) return false;
  const a = crypto.createHash('sha256').update(String(req.headers['x-admin-pass'] || '')).digest();
  const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  const ok = crypto.timingSafeEqual(a, b);
  if (!ok) failed.set(ip, { n: (f && Date.now() - f.t < 10 * 60 * 1000 ? f.n : 0) + 1, t: Date.now() }); else failed.delete(ip);
  return ok;
}
function readBody(req) {
  return new Promise(res => {
    let d = ''; req.on('data', c => { d += c; if (d.length > 180000) req.destroy(); });
    req.on('end', () => { try { res(JSON.parse(d || '{}')); } catch (e) { res({}); } });
  });
}
function adminState() {
  return {
    online: lobbyState().length, maintenance, queue: queue.length, banned: [...banned], lobby: lobbyState(),
    players: [...clients.values()].map(c => ({ id: c.id, name: c.name, car: c.carId, room: c.room ? c.room.id : null, inQueue: queue.includes(c) })),
    rooms: [...rooms.values()].map(r => ({ id: r.id, L: r.L, started: r.started, players: r.players.map(p => p.name), finished: r.finished }))
  };
}
function lobbyState() { return [...clients.values()].filter(c => c.account).map(c => ({ id: c.id, name: c.name, car: c.carId, status: c.room ? 'В гонке' : queue.includes(c) ? 'Ищет гонку' : 'В лобби' })); }
function broadcastLobby() { const players = lobbyState(); clients.forEach(c => { if (c.account) send(c, { t: 'lobby', online: players.length, players }); }); }
function kick(c, reason) { send(c, { t: 'kick', reason: reason || '' }); try { c.ws.close(); } catch (e) {} }

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url === '/' || url === '/health') { const origin = req.headers.origin || ''; if (origin && (!ORIGINS.length || ORIGINS.includes(origin))) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); } return json(200, { ok: true, service: 'Turbo Rivals 3D', online: lobbyState().length, queue: queue.length }); }
  if (url.startsWith('/api/')) {
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': ORIGINS.includes(req.headers.origin || '') ? req.headers.origin : '', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Vary': 'Origin' }); return res.end(); }
    const origin = req.headers.origin || '';
    if (ORIGINS.length && origin && !ORIGINS.includes(origin)) return json(403, { error: 'origin_not_allowed' });
    if (origin && (!ORIGINS.length || ORIGINS.includes(origin))) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); }
    if (req.method !== 'POST' && url !== '/api/profile' && url !== '/api/players') return json(405, { error: 'POST only' });
    if (url === '/api/register' || url === '/api/login') {
      const b = await readBody(req); const username = usernameClean(b.username); const key = username.toLocaleLowerCase(); const password = String(b.password || '');
      if (username.length < 3 || username.length > 14) return json(400, { error: 'Имя должно содержать 3–14 букв, цифр, _ или -' });
      if (password.length < 6 || password.length > 128) return json(400, { error: 'Пароль должен содержать 6–128 символов' });
      let a = accounts.get(key);
      if (url === '/api/register') {
        if (a) return json(409, { error: 'Это имя уже занято. Попробуй войти.' });
        const salt = crypto.randomBytes(16).toString('hex'); const hash = crypto.scryptSync(password, salt, 64).toString('hex');
        a = { username, salt, hash, profile: profileSafe(b.profile, username), createdAt: Date.now() }; accounts.set(key, a); saveAccounts();
      } else {
        if (!a) return json(401, { error: 'Аккаунт не найден или пароль неверный' });
        const hash = crypto.scryptSync(password, a.salt, 64); const expected = Buffer.from(a.hash, 'hex');
        if (hash.length !== expected.length || !crypto.timingSafeEqual(hash, expected)) return json(401, { error: 'Аккаунт не найден или пароль неверный' });
      }
      const token = newToken(key); return json(200, { ok: true, token, ...safeAccount(a) });
    }
    if (url === '/api/profile' && req.method === 'GET') {
      const session = authResponse(req, res); if (!session) return;
      return json(200, { ok: true, ...safeAccount(session.a) });
    }
    if (url === '/api/save') {
      const session = authResponse(req, res); if (!session) return;
      const b = await readBody(req); session.a.profile = profileSafe(b.profile, session.a.username); saveAccounts();
      return json(200, { ok: true });
    }
    if (url === '/api/players' && req.method === 'GET') return json(200, { ok: true, online: lobbyState() });
    return json(404, { error: 'not found' });
  }
  if (url === '/admin') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'DENY' });
    return res.end(fs.readFileSync(path.join(__dirname, 'admin.html')));
  }
  if (url.startsWith('/admin/api/')) {
    if (!authOk(req)) return json(401, { error: 'unauthorized' });
    if (url === '/admin/api/state') return json(200, adminState());
    if (req.method !== 'POST') return json(405, { error: 'POST only' });
    const b = await readBody(req);
    if (url === '/admin/api/kick') { const c = clients.get(+b.id); if (c) kick(c, 'Отключён администратором'); return json(200, { ok: !!c }); }
    if (url === '/admin/api/ban') {
      const n = clean(b.name).toLowerCase(); if (!n) return json(400, { error: 'name' });
      banned.add(n); clients.forEach(c => { if (c.name.toLowerCase() === n) kick(c, 'Вы заблокированы'); }); return json(200, { ok: true });
    }
    if (url === '/admin/api/unban') { banned.delete(clean(b.name).toLowerCase()); return json(200, { ok: true }); }
    if (url === '/admin/api/broadcast') { const text = String(b.text || '').replace(/[\u0000-\u001f]/g, '').slice(0, 120); clients.forEach(c => send(c, { t: 'msg', text })); return json(200, { ok: true }); }
    if (url === '/admin/api/maintenance') { maintenance = !!b.on; if (maintenance) clients.forEach(c => kick(c, 'Технические работы')); return json(200, { ok: true, maintenance }); }
    if (url === '/admin/api/closeRoom') { const r = rooms.get(+b.id); if (r) closeRoom(r, true); return json(200, { ok: !!r }); }
    return json(404, { error: 'not found' });
  }
  json(404, { error: 'not found' });
});

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server, maxPayload: 2048 });
wss.on('connection', (ws, req) => {
  const origin = req.headers.origin || '';
  if (ORIGINS.length && !ORIGINS.includes(origin)) { ws.close(); return; }
  if (maintenance) { ws.send(JSON.stringify({ t: 'kick', reason: 'Технические работы' })); ws.close(); return; }
  if (clients.size >= 300) { ws.close(); return; }
  const c = { ws, id: nextId++, name: 'Гонщик', carId: 'rust', gender: 'boy', outfit: 0, skin: 0, room: null, st: null, place: 0, tokens: 60, ip: ipOf(req), account: '' };
  clients.set(c.id, c);
  send(c, { t: 'welcome', id: c.id, online: clients.size });

  const refill = setInterval(() => { c.tokens = Math.min(60, c.tokens + 40); }, 1000);
  ws.on('message', raw => {
    if (--c.tokens < 0) return;
    let m; try { m = JSON.parse(raw.toString()); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    switch (m.t) {
      case 'hello': {
        const key = TOKEN_SESSIONS.get(String(m.token || ''));
        const account = key && accounts.get(key);
        if (!account) return kick(c, 'Сессия закончилась. Войди в аккаунт заново.');
        c.account = key; c.name = account.username;
        if (banned.has(c.name.toLowerCase())) return kick(c, 'Вы заблокированы');
        c.carId = String(m.carId || 'rust').slice(0, 12).replace(/[^a-z0-9_]/gi, '');
        c.gender = m.gender === 'girl' ? 'girl' : 'boy'; c.outfit = Math.max(0, Math.min(5, m.outfit | 0)); c.skin = Math.max(0, Math.min(2, m.skin | 0));
        broadcastLobby(); break;
      }
      case 'queue': if (!c.account) return kick(c, 'Сначала войди в аккаунт'); if (!c.room && !queue.includes(c)) { queue.push(c); c.queuedAt = Date.now(); notifyQueue(); broadcastLobby(); } break;
      case 'cancel': queue = queue.filter(x => x !== c); notifyQueue(); broadcastLobby(); break;
      case 's': // состояние машины
        if (c.room && c.room.started && !c.place) c.st = { x: num(m.x, 5000), z: num(m.z, 5000), h: num(m.h, 20), s: num(m.s, 200), p: num(m.p, 100000), y: num(m.y, 50) };
        break;
      case 'finish':
        if (c.room && c.room.started && !c.place) {
          c.place = ++c.room.finished; c.finishTime = Math.max(0, Math.min(9999, Number(m.time) || (Date.now() - c.room.startedAt) / 1000));
          const event = { t: 'finisher', id: c.id, name: c.name, place: c.place, time: c.finishTime };
          c.room.players.forEach(p => send(p, event)); send(c, { t: 'place', place: c.place });
          if (c.room.finished >= c.room.players.length) closeRoom(c.room);
          broadcastLobby();
        }
        break;
      case 'leave': leaveRoom(c); queue = queue.filter(x => x !== c); notifyQueue(); broadcastLobby(); break;
    }
  });
  ws.on('close', () => { clearInterval(refill); leaveRoom(c); queue = queue.filter(x => x !== c); clients.delete(c.id); notifyQueue(); broadcastLobby(); });
  ws.on('error', () => {});
});

function notifyQueue() { queue.forEach(c => send(c, { t: 'queue', n: queue.length, online: lobbyState().length })); broadcastLobby(); }
function leaveRoom(c) {
  const r = c.room; if (!r) return; c.room = null; c.st = null;
  r.players = r.players.filter(p => p !== c);
  r.players.forEach(p => send(p, { t: 'left', id: c.id }));
  if (!r.players.length) closeRoom(r);
}
function closeRoom(r, force) {
  clearInterval(r.timer); rooms.delete(r.id);
  r.players.forEach(p => { p.room = null; p.st = null; if (force) send(p, { t: 'kick', reason: 'Комната закрыта' }); }); broadcastLobby();
}

// матчмейкинг: каждые 1 с
setInterval(() => {
  if (queue.length < 2) return;
  if (queue.length < MAX_ROOM) return;
  const group = queue.splice(0, MAX_ROOM);
  const L = 1 + Math.floor(Math.random() * 30), id = nextRoom++;
  const r = { id, L, laps: 3, players: group, started: false, finished: 0, startedAt: 0, timer: null };
  rooms.set(id, r);
  group.forEach((c, i) => { c.room = r; c.place = 0; c.st = null; c.slot = i; });
  const list = group.map(c => ({ id: c.id, name: c.name, carId: c.carId, gender: c.gender, outfit: c.outfit, skin: c.skin, slot: c.slot }));
  group.forEach(c => send(c, { t: 'room', roomId: id, L, laps: r.laps, startIn: START_DELAY, you: c.slot, players: list }));
  setTimeout(() => {
    if (!rooms.has(id)) return; r.started = true; r.startedAt = Date.now(); broadcastLobby();
    r.timer = setInterval(() => {
      const snap = r.players.filter(p => p.st).map(p => [p.id, p.st.x, p.st.z, p.st.h, p.st.s, p.st.p, p.st.y, p.place ? 1 : 0]);
      if (snap.length) r.players.forEach(p => send(p, { t: 'snap', p: snap }));
    }, 66);
    setTimeout(() => { if (rooms.has(id)) closeRoom(r, false); }, 6 * 60 * 1000); // жёсткий лимит 6 минут
  }, START_DELAY);
  notifyQueue(); broadcastLobby();
}, 400);

server.listen(PORT, () => console.log('Turbo Rivals server on :' + PORT + (ADMIN_PASSWORD ? '' : ' (ADMIN_PASSWORD не задан — админка отключена)')));
