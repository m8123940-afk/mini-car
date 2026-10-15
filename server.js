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
const ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const MAX_ROOM = 6, START_DELAY = 7000, MATCH_WAIT = 8000;

let maintenance = false, nextId = 1, nextRoom = 1;
const banned = new Set();
const clients = new Map();   // id -> client
const rooms = new Map();     // id -> room
let queue = [];              // clients waiting
const failed = new Map();    // ip -> {n, t}
const ACCOUNT_FILE = path.join(__dirname, 'accounts.json');
let accounts = {};
try { accounts = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8')); } catch (_) {}
function saveAccounts(){ const tmp=ACCOUNT_FILE+'.tmp'; fs.writeFileSync(tmp, JSON.stringify(accounts)); fs.renameSync(tmp, ACCOUNT_FILE); }
function validAccountName(s){ return /^[a-zA-Z0-9_]{3,14}$/.test(String(s||'')); }
function passwordHash(pass, salt){ return crypto.scryptSync(String(pass), salt, 64).toString('hex'); }
function authAccount(name, pass){ const a=accounts[name.toLowerCase()]; if(!a || String(pass||'').length<6) return false; const x=Buffer.from(passwordHash(pass,a.salt),'hex'), y=Buffer.from(a.hash,'hex'); return x.length===y.length && crypto.timingSafeEqual(x,y); }

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
    let d = ''; req.on('data', c => { d += c; if (d.length > 4096) req.destroy(); });
    req.on('end', () => { try { res(JSON.parse(d || '{}')); } catch (e) { res({}); } });
  });
}
function adminState() {
  return {
    online: clients.size, maintenance, queue: queue.length, banned: [...banned],
    players: [...clients.values()].map(c => ({ id: c.id, name: c.name, car: c.carId, room: c.room ? c.room.id : null, inQueue: queue.includes(c) })),
    rooms: [...rooms.values()].map(r => ({ id: r.id, L: r.L, started: r.started, players: r.players.map(p => p.name), finished: r.finished }))
  };
}
function kick(c, reason) { send(c, { t: 'kick', reason: reason || '' }); try { c.ws.close(); } catch (e) {} }

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const origin = req.headers.origin || '';
  if (origin && (!ORIGINS.length || ORIGINS.includes(origin))) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary','Origin'); res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Admin-Pass'); res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS'); }
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url === '/' || url === '/health') return json(200, { ok: true, online: clients.size });
  if (url === '/api/register' || url === '/api/login') {
    if (req.method !== 'POST') return json(405, { error: 'POST only' });
    const b = await readBody(req), name = String(b.name||'').trim(), pass = String(b.password||'');
    if (!validAccountName(name)) return json(400, { error: 'Имя: 3–14 символов, латиница, цифры и _' });
    if (pass.length < 6 || pass.length > 128) return json(400, { error: 'Пароль должен быть от 6 до 128 символов' });
    const key = name.toLowerCase();
    if (url === '/api/register') { if (accounts[key]) return json(409, { error: 'Это имя уже занято' }); const salt=crypto.randomBytes(16).toString('hex'); accounts[key]={name, salt, hash:passwordHash(pass,salt), created:Date.now()}; saveAccounts(); return json(200,{ok:true,name}); }
    if (!authAccount(name,pass)) return json(401,{error:'Неверное имя или пароль'}); return json(200,{ok:true,name:accounts[key].name});
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
  const c = { ws, id: nextId++, name: 'Гонщик', carId: 'rust', gender: 'boy', outfit: 0, skin: 0, room: null, st: null, place: 0, tokens: 60, ip: ipOf(req) };
  clients.set(c.id, c);
  send(c, { t: 'welcome', id: c.id, online: clients.size });
  broadcastOnline();

  const refill = setInterval(() => { c.tokens = Math.min(60, c.tokens + 40); }, 1000);
  ws.on('message', raw => {
    if (--c.tokens < 0) return;
    let m; try { m = JSON.parse(raw.toString()); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    switch (m.t) {
      case 'hello':
        c.name = clean(m.name) || 'Гонщик';
        if (banned.has(c.name.toLowerCase())) return kick(c, 'Вы заблокированы');
        c.carId = String(m.carId || 'rust').slice(0, 12).replace(/[^a-z0-9_]/gi, '');
        c.gender = m.gender === 'girl' ? 'girl' : 'boy'; c.outfit = Math.max(0, Math.min(5, m.outfit | 0)); c.skin = Math.max(0, Math.min(2, m.skin | 0));
        broadcastOnline(); break;
      case 'queue': if (!c.room && !queue.includes(c)) { queue.push(c); c.queuedAt = Date.now(); notifyQueue(); } break;
      case 'cancel': queue = queue.filter(x => x !== c); notifyQueue(); break;
      case 's': // состояние машины
        if (c.room && c.room.started && !c.place) c.st = { x: num(m.x, 5000), z: num(m.z, 5000), h: num(m.h, 20), s: num(m.s, 200), p: num(m.p, 100000), y: num(m.y, 50) };
        break;
      case 'finish':
        if (c.room && c.room.started && !c.place) { c.place = ++c.room.finished; send(c, { t: 'place', place: c.place }); if (c.room.finished >= c.room.players.length) closeRoom(c.room); }
        break;
      case 'leave': leaveRoom(c); queue = queue.filter(x => x !== c); notifyQueue(); break;
    }
  });
  ws.on('close', () => { clearInterval(refill); leaveRoom(c); queue = queue.filter(x => x !== c); clients.delete(c.id); notifyQueue(); broadcastOnline(); });
  ws.on('error', () => {});
});

function notifyQueue() { queue.forEach(c => send(c, { t: 'queue', n: queue.length, online: clients.size })); broadcastOnline(); }
function broadcastOnline(){ const list=[...clients.values()].map(c=>({id:c.id,name:c.name, status:c.room?'В гонке':queue.includes(c)?'Ищет гонку':'В меню'})); clients.forEach(c=>send(c,{t:'onlineList',online:clients.size,players:list})); }
function leaveRoom(c) {
  const r = c.room; if (!r) return; c.room = null; c.st = null;
  r.players = r.players.filter(p => p !== c);
  r.players.forEach(p => send(p, { t: 'left', id: c.id }));
  if (!r.players.length) closeRoom(r);
}
function closeRoom(r, force) {
  clearInterval(r.timer); rooms.delete(r.id);
  r.players.forEach(p => { p.room = null; p.st = null; if (force) send(p, { t: 'kick', reason: 'Комната закрыта' }); });
}

// матчмейкинг: каждые 1 с
setInterval(() => {
  if (queue.length < 2) return;
  // Начинаем матч сразу, как только есть минимум два игрока.
  const group = queue.splice(0, Math.min(MAX_ROOM, queue.length));
  const L = 1 + Math.floor(Math.random() * 30), id = nextRoom++;
  const r = { id, L, laps: 3, players: group, started: false, finished: 0, timer: null };
  rooms.set(id, r);
  group.forEach((c, i) => { c.room = r; c.place = 0; c.st = null; c.slot = i; });
  const list = group.map(c => ({ id: c.id, name: c.name, carId: c.carId, gender: c.gender, outfit: c.outfit, skin: c.skin, slot: c.slot }));
  group.forEach(c => send(c, { t: 'room', roomId: id, L, laps: r.laps, startIn: START_DELAY, you: c.slot, players: list }));
  setTimeout(() => {
    if (!rooms.has(id)) return; r.started = true;
    r.timer = setInterval(() => {
      const snap = r.players.filter(p => p.st).map(p => [p.id, p.st.x, p.st.z, p.st.h, p.st.s, p.st.p, p.st.y, p.place ? 1 : 0]);
      if (snap.length) r.players.forEach(p => send(p, { t: 'snap', p: snap }));
    }, 66);
    setTimeout(() => { if (rooms.has(id)) closeRoom(r, false); }, 6 * 60 * 1000); // жёсткий лимит 6 минут
  }, START_DELAY);
  notifyQueue();
}, 1000);

server.listen(PORT, () => console.log('Turbo Rivals server on :' + PORT + (ADMIN_PASSWORD ? '' : ' (ADMIN_PASSWORD не задан — админка отключена)')));
