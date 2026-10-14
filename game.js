(() => {
'use strict';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
if (window.Telegram && Telegram.WebApp) { Telegram.WebApp.ready(); Telegram.WebApp.expand(); }

// ---------- настройки ----------
const ROAD_W = 9, N = 420, LAPS = 3;
const CAR = { max: 58, acc: 28 };           // старая машина 70-х: скромные характеристики
const AI_COLORS = [0xd33a2c, 0x2c7bd3, 0x3ab56a];
let coins = +(localStorage.getItem('tr_coins') || 0);
$('coins').textContent = coins;

// ---------- сцена ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ab8d0);
scene.fog = new THREE.Fog(0x9ab8d0, 70, 300);
const cam = new THREE.PerspectiveCamera(70, 1, 0.1, 600);
scene.add(new THREE.HemisphereLight(0xffffff, 0x555560, 0.9));
const sun = new THREE.DirectionalLight(0xffeedd, 0.8);
sun.position.set(80, 120, 40);
scene.add(sun);

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const ground = new THREE.Mesh(new THREE.PlaneGeometry(2500, 2500), new THREE.MeshLambertMaterial({ color: 0x4a4d4f }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05;
scene.add(ground);

// ---------- трасса ----------
const P = [[0,0],[130,-30],[210,60],[170,180],[50,215],[-80,160],[-150,50],[-90,-50]];
const curve = new THREE.CatmullRomCurve3(P.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'catmullrom', 0.5);
const pos = [], tan = [];
for (let i = 0; i < N; i++) {
  pos.push(curve.getPointAt(i / N));
  tan.push(curve.getTangentAt(i / N).setY(0).normalize());
}
const SP = curve.getLength() / N;

function ribbon(width, y, color) {
  const v = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const p = pos[i % N], t = tan[i % N];
    v.push(p.x + t.z * width, y, p.z - t.x * width, p.x - t.z * width, y, p.z + t.x * width);
  }
  for (let i = 0; i < N; i++) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  scene.add(m);
}
ribbon(ROAD_W + 1, 0.01, 0xcfcfc4);   // бордюр
ribbon(ROAD_W, 0.03, 0x2a2c31);       // асфальт

// пунктир по центру
{
  const cnt = Math.floor(N / 4);
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.02, 2.4), new THREE.MeshBasicMaterial({ color: 0xf5c542 }), cnt);
  const d = new THREE.Object3D();
  for (let k = 0; k < cnt; k++) {
    const i = k * 4;
    d.position.set(pos[i].x, 0.06, pos[i].z);
    d.rotation.y = Math.atan2(tan[i].x, tan[i].z);
    d.updateMatrix(); im.setMatrixAt(k, d.matrix);
  }
  scene.add(im);
  // стартовая линия
  const sl = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W * 2, 1.4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  sl.rotation.x = -Math.PI / 2; sl.rotation.z = -Math.atan2(tan[0].x, tan[0].z);
  sl.position.set(pos[0].x, 0.07, pos[0].z);
  scene.add(sl);
}

// бедные городские дома по сторонам
{
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const cols = [0x6b625a, 0x7a6a5c, 0x58595e, 0x6e5a52, 0x4f5358];
  let placed = 0;
  for (let tries = 0; tries < 600 && placed < 90; tries++) {
    const x = -330 + rnd() * 660, z = -260 + rnd() * 600;
    let ok = true;
    for (let i = 0; i < N; i += 4) { const dx = x - pos[i].x, dz = z - pos[i].z; if (dx * dx + dz * dz < 26 * 26) { ok = false; break; } }
    if (!ok) continue;
    const w = 12 + rnd() * 16, h = 10 + rnd() * 34, dd = 12 + rnd() * 16;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), new THREE.MeshLambertMaterial({ color: cols[Math.floor(rnd() * cols.length)] }));
    b.position.set(x, h / 2, z); b.rotation.y = rnd() * 3;
    scene.add(b); placed++;
  }
}

// ---------- машины ----------
function makeCar(color, retro) {
  const g = new THREE.Group();
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.65, 4.3), mat(color)); body.position.y = 0.75; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, retro ? 2.3 : 1.9), mat(0x20262c)); cab.position.set(0, 1.35, retro ? -0.2 : -0.5); g.add(cab);
  const wg = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 14), wm = mat(0x0c0c0c);
  [[-1, 1.4], [1, 1.4], [-1, -1.4], [1, -1.4]].forEach(([sx, z]) => {
    const w = new THREE.Mesh(wg, wm); w.rotation.z = Math.PI / 2; w.position.set(sx * 1.02, 0.42, z); g.add(w);
  });
  const tl = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2020 })); tl.position.set(0, 0.85, -2.17); g.add(tl);
  const hl = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 0.1), new THREE.MeshBasicMaterial({ color: 0xfff3c0 })); hl.position.set(0, 0.85, 2.17); g.add(hl);
  scene.add(g); return g;
}

const player = { mesh: makeCar(0xc9a227, true), h: 0, speed: 0, idx: 0, lap: -1, p: 0, steerS: 0, finished: false };
const ais = AI_COLORS.map((c, i) => ({ mesh: makeCar(c, false), p: 0, speed: 0, lat: 0, skill: 0.9 + i * 0.03, finished: false }));
const all = [player, ...ais];
let state = 'menu', nitro = 100, finishOrder = [], camH = 0, bumpT = 0, menuT = 0, DIFF = 0.85;

function modN(v) { return ((v % N) + N) % N; }
function sampleAt(p, lat) {
  const i = modN(p), i0 = Math.floor(i), f = i - i0, i1 = (i0 + 1) % N;
  const a = pos[i0], b = pos[i1], t = tan[i0];
  return { x: a.x + (b.x - a.x) * f + t.z * lat, z: a.z + (b.z - a.z) * f - t.x * lat, h: Math.atan2(t.x, t.z), i0 };
}

function placeGrid() {
  finishOrder = []; nitro = 100;
  const slots = [[0, -4], [0, 4], [1, -4], [1, 4]];   // [ряд, смещение]
  const order = [ais[0], ais[1], ais[2], player];
  order.forEach((c, k) => {
    const [row, lat] = slots[k];
    c.p = -4 - row * 6; c.finished = false; c.speed = 0;
    if (c === player) {
      const s = sampleAt(c.p, lat);
      c.mesh.position.set(s.x, 0, s.z); c.h = s.h; c.idx = modN(c.p) | 0; c.lap = -1; c.steerS = 0;
    } else { c.lat = lat; }
  });
}
placeGrid();

// ---------- управление ----------
const held = new Set();
const KEYMAP = { ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brake', KeyS: 'brake', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'nitro', ShiftLeft: 'nitro' };
addEventListener('keydown', e => { const k = KEYMAP[e.code]; if (k) { held.add(k); e.preventDefault(); } });
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) held.delete(k); });
document.querySelectorAll('.tb').forEach(b => {
  const k = b.dataset.k;
  const on = e => { held.add(k); b.classList.add('on'); e.preventDefault(); };
  const off = e => { held.delete(k); b.classList.remove('on'); e.preventDefault(); };
  b.addEventListener('pointerdown', on);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, off));
});
if (matchMedia('(hover:none)').matches) $('touch').hidden = false;
else if (navigator.maxTouchPoints > 0) $('touch').hidden = false;

// ---------- звук ----------
let actx, eng, engGain, engFilter;
function initAudio() {
  if (actx) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    eng = actx.createOscillator(); eng.type = 'sawtooth';
    engFilter = actx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 500;
    engGain = actx.createGain(); engGain.gain.value = 0.04;
    eng.connect(engFilter); engFilter.connect(engGain); engGain.connect(actx.destination); eng.start();
  } catch (e) { actx = null; }
}
function beep(f, d) {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.frequency.value = f; o.type = 'square'; g.gain.value = 0.08;
  g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + d);
  o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + d);
}
function bump() {
  if (!actx) return;
  const len = actx.sampleRate * 0.15, buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = actx.createBufferSource(), g = actx.createGain(); g.gain.value = 0.25;
  s.buffer = buf; s.connect(g); g.connect(actx.destination); s.start();
}

// ---------- гонка ----------
function startRace() {
  initAudio(); if (actx && actx.state === 'suspended') actx.resume();
  placeGrid(); state = 'count';
  $('menu').hidden = true; $('result').hidden = true; $('hud').hidden = false;
  const c = $('count'); c.hidden = false;
  [['3', 0], ['2', 1000], ['1', 2000], ['GO!', 3000]].forEach(([t, ms]) => setTimeout(() => {
    c.textContent = t; beep(t === 'GO!' ? 880 : 440, t === 'GO!' ? 0.5 : 0.2);
    if (t === 'GO!') { state = 'race'; setTimeout(() => c.hidden = true, 700); }
  }, ms));
}
$('startBtn').onclick = startRace;
$('againBtn').onclick = startRace;

function angDiff(a, b) { return ((a - b + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; }

function updatePlayer(dt) {
  const racing = state === 'race';
  const gas = racing && held.has('gas'), brk = racing && held.has('brake');
  const steer = racing ? (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0) : 0;
  const boost = racing && held.has('nitro') && nitro > 0;
  nitro = boost ? Math.max(0, nitro - 35 * dt) : Math.min(100, nitro + 5 * dt);

  const m = player.mesh.position;
  const [bi, dist] = nearest(m, player.idx);
  const off = dist > ROAD_W;
  const max = CAR.max * (boost ? 1.35 : 1) * (off ? 0.5 : 1);

  if (gas || boost) player.speed += CAR.acc * (boost ? 1.8 : 1) * (1 - clamp(player.speed / max, 0, 1)) * dt;
  if (brk) player.speed -= (player.speed > 0 ? 55 : 12) * dt;
  if (!gas && !brk) player.speed -= player.speed * 0.4 * dt;
  if (player.speed > max) player.speed -= 30 * dt;
  if (off) player.speed -= player.speed * 1.2 * dt;
  player.speed = Math.max(player.speed, -12);

  player.steerS += (steer - player.steerS) * Math.min(1, 8 * dt);
  const sp = Math.abs(player.speed);
  const turn = player.steerS * 2.0 * clamp(sp / 18, 0, 1) / (1 + sp / 55);
  player.h -= turn * dt * (player.speed >= 0 ? 1 : -1);
  m.x += Math.sin(player.h) * player.speed * dt;
  m.z += Math.cos(player.h) * player.speed * dt;
  player.mesh.rotation.y = player.h;
  player.mesh.rotation.z = -player.steerS * Math.min(sp / 60, 1) * 0.05;

  // круги
  if (bi < N * 0.2 && player.idx > N * 0.8) player.lap++;
  else if (bi > N * 0.8 && player.idx < N * 0.2) player.lap--;
  player.idx = bi; player.p = player.lap * N + bi;
}

function nearest(p, last) {
  let best = 1e12, bi = last;
  for (let k = -30; k <= 30; k++) {
    const i = (last + k + N) % N, dx = p.x - pos[i].x, dz = p.z - pos[i].z, d = dx * dx + dz * dz;
    if (d < best) { best = d; bi = i; }
  }
  return [bi, Math.sqrt(best)];
}

function updateAI(a, dt) {
  const racing = state === 'race';
  const i = modN(a.p) | 0, ang = Math.acos(clamp(tan[i].x * tan[(i + 14) % N].x + tan[i].z * tan[(i + 14) % N].z, -1, 1));
  const curv = 1 - Math.min(0.5, ang * 1.6);
  const gap = a.p - player.p;
  const rubber = 1 - clamp(gap * 0.0008, -0.08, 0.1);
  const target = racing ? CAR.max * 1.02 * DIFF * a.skill * curv * rubber : 0;
  a.speed += (target - a.speed) * Math.min(1, 1.6 * dt);
  a.p += a.speed * dt / SP;
  const s = sampleAt(a.p, a.lat);
  a.mesh.position.set(s.x, 0, s.z); a.mesh.rotation.y = s.h;
}

function collide() {
  const pm = player.mesh.position;
  for (const a of ais) {
    const am = a.mesh.position, dx = pm.x - am.x, dz = pm.z - am.z, d = Math.hypot(dx, dz);
    if (d < 3.6 && d > 0.01) {
      const nx = dx / d, nz = dz / d, push = (3.6 - d);
      pm.x += nx * push * 0.7; pm.z += nz * push * 0.7;
      // боковой толчок ИИ
      a.lat += clamp(-(nx * Math.cos(player.h) - nz * Math.sin(player.h)) * push, -1, 1) * 0.0;
      if (performance.now() - bumpT > 300) { bump(); bumpT = performance.now(); }
      player.speed *= 0.93; a.speed *= 0.97;
    }
  }
}

function updateCamera(dt, t) {
  if (state === 'menu') {
    menuT += dt * 0.35; const m = player.mesh.position;
    cam.position.set(m.x + Math.sin(menuT) * 9, 3.2, m.z + Math.cos(menuT) * 9);
    cam.lookAt(m.x, 1, m.z); cam.fov = 60; cam.updateProjectionMatrix(); return;
  }
  camH += angDiff(player.h, camH) * Math.min(1, 4 * dt);
  const m = player.mesh.position;
  cam.position.set(m.x - Math.sin(camH) * 9, 4.6, m.z - Math.cos(camH) * 9);
  cam.lookAt(m.x + Math.sin(camH) * 6, 1.4, m.z + Math.cos(camH) * 6);
  const fov = 68 + clamp(Math.abs(player.speed) / 60, 0, 1) * 14 + (held.has('nitro') && nitro > 0 ? 6 : 0);
  cam.fov += (fov - cam.fov) * Math.min(1, 5 * dt); cam.updateProjectionMatrix();
}

function finishCheck() {
  for (const c of all) if (!c.finished && c.p >= LAPS * N) { c.finished = true; finishOrder.push(c); }
  if (player.finished || !finishOrder.includes(player)) return;
  player.finished = true;
  const place = finishOrder.indexOf(player) + 1;
  const reward = [120, 70, 40, 15][place - 1];
  coins += reward; localStorage.setItem('tr_coins', coins);
  $('coins').textContent = coins; $('resCoins').textContent = reward;
  $('resTitle').textContent = place === 1 ? 'Победа!' : place + '-е место';
  state = 'done';
  setTimeout(() => { $('result').hidden = false; $('hud').hidden = true; }, 900);
}

function updateHUD() {
  const rank = [...all].sort((a, b) => b.p - a.p).indexOf(player) + 1;
  $('pos').textContent = rank + '/' + all.length;
  $('lap').textContent = clamp(Math.floor(player.p / N) + 1, 1, LAPS) + '/' + LAPS;
  $('spd').textContent = Math.round(Math.abs(player.speed) * 3.6);
  $('nitro').style.width = nitro + '%';
}

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (state !== 'menu') {
    updatePlayer(dt);
    ais.forEach(a => updateAI(a, dt));
    if (state === 'race') { collide(); finishCheck(); }
    updateHUD();
  }
  if (state === 'done') player.speed *= 1 - 0.8 * dt;
  if (eng) {
    const s = Math.abs(player.speed);
    eng.frequency.value = 45 + s * 3.2 + (held.has('nitro') && state === 'race' ? 25 : 0);
    engFilter.frequency.value = 350 + s * 12;
    engGain.gain.value = state === 'menu' ? 0 : 0.04;
  }
  updateCamera(dt, now);
  renderer.render(scene, cam);
}
requestAnimationFrame(loop);
})();
