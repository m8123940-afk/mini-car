(() => {
'use strict';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rr = (a, b) => a + Math.random() * (b - a);
const N = 420, ROAD_W = 9, WALL = ROAD_W + 2.2;
const tg = window.Telegram && Telegram.WebApp;
if (tg) { tg.ready(); tg.expand(); }

// ================= сохранение (localStorage: только это устройство, без серверной защиты) =================
const defSave = () => ({ v: 2, name: 'Гонщик', coins: 0, cur: 'rust', cars: { rust: { up: [0, 0, 0, 0, 0, 0], dmg: 0 } }, level: 1,
  char: { g: 'boy', col: 0, skin: 0 }, tour: null, set: { snd: 1, mus: 1, gfx: 'med', theme: 'dark', server: SERVER_URL } });
let save;
try { save = Object.assign(defSave(), JSON.parse(localStorage.getItem('tr_save') || '{}')); } catch (e) { save = defSave(); }
save.set = Object.assign(defSave().set, save.set); save.char = Object.assign(defSave().char, save.char);
if (!save.cars[save.cur]) save.cur = 'rust';
if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && save.name === 'Гонщик') save.name = String(tg.initDataUnsafe.user.first_name || 'Гонщик').slice(0, 14);
const store = () => { try { localStorage.setItem('tr_save', JSON.stringify(save)); } catch (e) {} };
window.addEventListener('tr-account-login', e => { if (e.detail && e.detail.name) { save.name = String(e.detail.name).slice(0,14); store(); if ($('who')) $('who').textContent = 'Гонщик: ' + save.name; } });

// ================= машины и физика =================
const carDef = id => CARS.find(c => c.id === id) || CARS[0];
const carIdx = id => Math.max(0, CARS.findIndex(c => c.id === id));
function eff(id) {
  const d = carDef(id), o = save.cars[id] || { up: [0, 0, 0, 0, 0, 0] }, e = {};
  STATS.forEach(([k], i) => e[k] = d.s[i] + o.up[i] * 0.6); return e;
}
function physFor(id) {
  const e = eff(id), o = save.cars[id] || { dmg: 0 }, d = o.dmg / 100;
  return { max: (40 + e.speed * 2.4) * (1 - d * 0.3), acc: (14 + e.accel * 2.2) * (1 - d * 0.25), brk: 30 + e.brake * 5,
    hnd: 1.6 + e.handle * 0.1, grip: 2 + e.grip * 0.8, nCap: 60 + e.nitro * 8, nPow: 1.2 + e.nitro * 0.03 };
}
let phys = physFor(save.cur);
let raceStartedAt = 0;

// ================= данные режимов =================
const THEMES = [
  { name: 'Бедные улицы', sky: [0x151c2b, 0x6b6a66], fog: 0x4a4c50, ground: 0x2e3033, bh: [8, 26], bcol: [0x5a524a, 0x66584c, 0x4b4e54, 0x5e4a44], lit: 0.45, lamp: 0xffc070, hemi: [0x8090b0, 0x302820, 0.7], sun: [0xaabbdd, 0.7], stars: 1, moon: '#e8eeff', rain: 0 },
  { name: 'Нью-Йорк', sky: [0x070b1c, 0x4a4260], fog: 0x2a2a40, ground: 0x1c1d22, bh: [35, 130], bcol: [0x2c3340, 0x39414f, 0x262a33, 0x3d3a46], lit: 0.8, lamp: 0xffe3a0, hemi: [0x7080c0, 0x202030, 0.65], sun: [0x99aaff, 0.55], stars: 1, moon: '#d8e0ff', rain: 1 },
  { name: 'Побережье', sky: [0x2a4a7a, 0xff9a5a], fog: 0xd88a60, ground: 0xc2a070, bh: [6, 16], bcol: [0xe8d8c0, 0xd8b090, 0xf0e8d8, 0xc89878], lit: 0.1, lamp: 0xfff0c0, hemi: [0xffd0a0, 0x806040, 0.9], sun: [0xffb070, 1.0], stars: 0, moon: '#fff2c0', rain: 0 }
];
const themeFor = L => L <= 10 ? 0 : L <= 20 ? 1 : L <= 30 ? 2 : Math.floor((L - 1) / 10) % 3;
const SHAPES_PTS = [
  [[0,0],[130,-30],[210,60],[170,180],[50,215],[-80,160],[-150,50],[-90,-50]],
  [[0,0],[160,0],[240,100],[160,200],[60,160],[-20,240],[-120,160],[-100,40]],
  [[0,0],[100,-60],[220,-20],[260,90],[180,160],[90,120],[20,200],[-90,230],[-170,120],[-100,20]],
  [[0,0],[200,0],[260,120],[120,180],[40,100],[-60,170],[-160,100],[-120,-30]]
];
const BOSSES = ['Рыжий Кабан', 'Ржавый Лис', 'Тень Бронкса', 'Железный Макс', 'Мистер Нитро', 'Король Трассы'];
const isBoss = L => L % 20 === 0, isMini = L => L % 10 === 0 && L % 20 !== 0;
const lapsFor = L => isBoss(L) ? 5 : isMini(L) ? 4 : 3;
const bossName = L => BOSSES[(Math.floor(L / 10) - 1) % BOSSES.length];
const DIFFS = [
  { n: 'Очень легко', top: 34, sk: [0.85, 0.92], aware: 0.3, unlock: 1 },
  { n: 'Легко', top: 41, sk: [0.9, 0.97], aware: 0.5, unlock: 3 },
  { n: 'Средне', top: 50, sk: [0.94, 1.01], aware: 0.7, unlock: 6 },
  { n: 'Сложно', top: 62, sk: [0.98, 1.05], aware: 0.88, unlock: 10 },
  { n: 'Невозможно', top: 78, sk: [1.05, 1.12], aware: 1, unlock: 20 }
];
const TOURS = [
  { id: 'street', name: 'Уличный турнир', desc: '3 гонки · бедные улицы', Ls: [1, 2, 3], top: 43, inc: 3, unlock: 1, prize: [700, 350, 180] },
  { id: 'night', name: 'Ночной стрит-кубок', desc: '4 гонки · улицы', Ls: [4, 5, 6, 7], top: 51, inc: 3, unlock: 5, prize: [1500, 800, 400] },
  { id: 'pro', name: 'Профессиональный чемпионат', desc: '5 гонок · Нью-Йорк', Ls: [11, 12, 13, 14, 15], top: 63, inc: 3, unlock: 11, prize: [9000, 4500, 2200, 1000] },
  { id: 'world', name: 'Мировой чемпионат', desc: '6 гонок · побережье', Ls: [21, 22, 23, 24, 25, 26], top: 77, inc: 2.5, unlock: 21, prize: [30000, 15000, 8000, 4000] }
];
const PTS = [10, 7, 5, 4, 3, 2];
const NAMES = ['Макс', 'Лис', 'Дэн', 'Ника', 'Тоха', 'Рекс', 'Вольт', 'Зара', 'Бык', 'Йети', 'Ася', 'Гром', 'Мира', 'Тим', 'Кай'];

// ================= сцена =================
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true });
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(70, 1, 0.1, 900);
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 300 }); sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);
const spot = new THREE.SpotLight(0xfff2d0, 1.6, 80, 0.5, 0.55); scene.add(spot, spot.target);
const pmrem = new THREE.PMREMGenerator(renderer); let envRT = null;
let starsG = null, rainG = null, rainOn = false;
const RAIN_N = 600, rainP = new Float32Array(RAIN_N * 6), rainB = new Float32Array(RAIN_N * 3);

function applyGfx() {
  const g = save.set.gfx;
  renderer.setPixelRatio(g === 'high' ? Math.min(devicePixelRatio, 2) : g === 'med' ? Math.min(devicePixelRatio, 1.5) : 1);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = g !== 'low'; sun.castShadow = g !== 'low';
  const sz = g === 'high' ? 2048 : 1024;
  if (sun.shadow.mapSize.x !== sz) { sun.shadow.mapSize.set(sz, sz); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  spot.visible = g !== 'low'; rainOn = g !== 'low';
  if (rainG) rainG.visible = rainOn && !!rainG.userData.want;
  scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); });
}
function resize() { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
addEventListener('resize', resize);

function canvasTex(w, h, draw, srgb) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  if (srgb !== false) t.encoding = THREE.sRGBEncoding; return t;
}
const hex = n => '#' + n.toString(16).padStart(6, '0');
const roadT = canvasTex(128, 256, (x, w, h) => {
  x.fillStyle = '#2b2d31'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 3500; i++) { const v = 26 + Math.random() * 36 | 0; x.fillStyle = `rgb(${v},${v},${v + 3})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  x.strokeStyle = '#1b1c1f'; x.lineWidth = 1; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(Math.random() * w, Math.random() * h); x.lineTo(Math.random() * w, Math.random() * h); x.stroke(); }
  x.fillStyle = '#d9d4c0'; x.fillRect(3, 0, 3, h); x.fillRect(122, 0, 3, h);
  x.fillStyle = '#f5c542'; for (let y = 0; y < h; y += 64) x.fillRect(62, y, 4, 32);
});
roadT.wrapS = THREE.ClampToEdgeWrapping;
const curbT = canvasTex(16, 32, x => { x.fillStyle = '#c92a2a'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#eee'; x.fillRect(0, 16, 16, 16); });
const winT = canvasTex(64, 64, (x, w, h) => {
  x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (Math.random() < 0.55) { x.fillStyle = Math.random() < 0.7 ? '#ffd27a' : '#9fd0ff'; x.fillRect(i * 16 + 4, j * 16 + 4, 8, 8); }
});
const glowT = canvasTex(64, 64, x => {
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
});

function setSky(th) {
  const tex = canvasTex(512, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hex(th.sky[0])); g.addColorStop(0.5, hex(th.sky[1])); g.addColorStop(0.52, hex(th.fog)); g.addColorStop(1, hex(th.ground));
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const sg = x.createRadialGradient(w * 0.3, h * 0.38, 0, w * 0.3, h * 0.38, h * 0.16);
    sg.addColorStop(0, th.moon); sg.addColorStop(0.25, th.moon); sg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = sg; x.fillRect(0, 0, w, h);
  });
  tex.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = tex;
  if (envRT) envRT.dispose(); envRT = pmrem.fromEquirectangular(tex); scene.environment = envRT.texture;
  scene.fog = new THREE.Fog(th.fog, 60, 320);
  hemi.color.setHex(th.hemi[0]); hemi.groundColor.setHex(th.hemi[1]); hemi.intensity = th.hemi[2];
  sun.color.setHex(th.sun[0]); sun.intensity = th.sun[1];
  if (starsG) scene.remove(starsG);
  starsG = null;
  if (th.stars) {
    const p = []; for (let i = 0; i < 350; i++) { const a = Math.random() * 6.28, e = 0.15 + Math.random() * 1.2; p.push(Math.cos(a) * Math.cos(e) * 500, Math.sin(e) * 500, Math.sin(a) * Math.cos(e) * 500); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    starsG = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, depthWrite: false }));
    starsG.frustumCulled = false; scene.add(starsG);
  }
  if (!rainG) {
    for (let i = 0; i < RAIN_N; i++) { rainB[i * 3] = rr(-30, 30); rainB[i * 3 + 1] = rr(0, 35); rainB[i * 3 + 2] = rr(-30, 30); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(rainP, 3));
    rainG = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9fb4d0, transparent: true, opacity: 0.35, fog: false }));
    rainG.frustumCulled = false; scene.add(rainG);
  }
  rainG.userData.want = th.rain; rainG.visible = rainOn && !!th.rain;
  Snd.setTheme(themeIdx);
}
let themeIdx = 0;
function updateRain(dt) {
  if (!rainG || !rainG.visible) return;
  for (let i = 0; i < RAIN_N; i++) {
    let y = rainB[i * 3 + 1] - dt * 38; if (y < 0) y += 35; rainB[i * 3 + 1] = y;
    const x = rainB[i * 3], z = rainB[i * 3 + 2];
    rainP.set([x, y, z, x + 0.05, y + 0.9, z], i * 6);
  }
  rainG.geometry.attributes.position.needsUpdate = true;
  rainG.position.set(cam.position.x, cam.position.y - 8, cam.position.z);
}

// ================= трасса =================
let trackG = null, pos = [], tan = [], SP = 1, items = [], builtL = -1;
const modN = v => ((v % N) + N) % N;
const sdiff = (a, b) => ((a - b + N / 2) % N + N) % N - N / 2;
function sampleAt(p, lat) {
  const i = modN(p), i0 = Math.floor(i), f = i - i0, i1 = (i0 + 1) % N, a = pos[i0], b = pos[i1], t = tan[i0];
  return { x: a.x + (b.x - a.x) * f + t.z * lat, z: a.z + (b.z - a.z) * f - t.x * lat, h: Math.atan2(t.x, t.z) };
}
function nearest(p, last) {
  let best = 1e12, bi = last;
  for (let k = -30; k <= 30; k++) { const i = (last + k + N) % N, dx = p.x - pos[i].x, dz = p.z - pos[i].z, d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } }
  return [bi, Math.sqrt(best)];
}

function wedgeGeo() {
  const s = new THREE.Shape(); s.moveTo(-3, 0); s.lineTo(3, 0); s.lineTo(3, 0.9); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 7, bevelEnabled: false }); g.rotateY(-Math.PI / 2); g.translate(3.5, 0, 0); return g;
}
const WEDGE = wedgeGeo();
function itemMesh(type, h) {
  const g = new THREE.Group(); let m;
  const std = (c, e) => new THREE.MeshStandardMaterial({ color: c, emissive: e || 0, roughness: 0.4 });
  if (type === 'coin') { m = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.15, 18), std(0xf5c542, 0x7a5a00)); m.rotation.x = Math.PI / 2; m.position.y = 1.2; }
  else if (type === 'nitro') { m = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 12), std(0x2fb7ff, 0x0a4a80)); m.position.y = 1.1; }
  else if (type === 'repair') { m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), std(0x3ad06a, 0x0a5a22)); m.position.y = 1.1; }
  else if (type === 'oil') { m = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.04, 20), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1, metalness: 0.8 })); m.position.y = 0.07; }
  else if (type === 'cone') {
    m = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 0.5), std(0xd23030)); m.position.y = 0.45;
    const s = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.2, 0.52), std(0xf2f2f2)); s.position.y = 0.55; g.add(s);
  } else { m = new THREE.Mesh(WEDGE, std(0xf5c542, 0x403000)); g.rotation.y = h; }
  m.castShadow = true; g.add(m); g.userData.spin = (type === 'coin' || type === 'nitro' || type === 'repair'); g.userData.body = m;
  return g;
}

function buildTrack(L) {
  if (trackG) { scene.remove(trackG); trackG.traverse(o => { if (o.geometry && o.geometry !== WEDGE) o.geometry.dispose(); }); }
  themeIdx = themeFor(L); const th = THEMES[themeIdx]; setSky(th);
  trackG = new THREE.Group(); scene.add(trackG);
  let seed = L * 977 + 13; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const curve = new THREE.CatmullRomCurve3(SHAPES_PTS[(L - 1) % 4].map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'catmullrom', 0.5);
  pos = []; tan = [];
  for (let i = 0; i < N; i++) { pos.push(curve.getPointAt(i / N)); tan.push(curve.getTangentAt(i / N).setY(0).normalize()); }
  SP = curve.getLength() / N;

  const gr = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: th.ground, roughness: 1, envMapIntensity: 0.3 }));
  gr.rotation.x = -Math.PI / 2; gr.position.y = -0.05; gr.receiveShadow = true; trackG.add(gr);

  function ribbon(w, y, mat, vs) {
    const v = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) { const p = pos[i % N], t = tan[i % N]; v.push(p.x + t.z * w, y, p.z - t.x * w, p.x - t.z * w, y, p.z + t.x * w); uv.push(0, i * SP / vs, 1, i * SP / vs); }
    for (let i = 0; i < N; i++) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; trackG.add(m);
  }
  ribbon(ROAD_W + 1.3, 0.01, new THREE.MeshStandardMaterial({ map: curbT, roughness: 0.8, side: THREE.DoubleSide }), 4);
  ribbon(ROAD_W, 0.03, new THREE.MeshStandardMaterial({ map: roadT, roughness: themeIdx === 1 ? 0.35 : 0.65, metalness: 0.1, envMapIntensity: 0.7, side: THREE.DoubleSide }), 16);

  const s0 = sampleAt(0, 0);
  const sl = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W * 2, 1.4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  sl.rotation.x = -Math.PI / 2; sl.rotation.z = -s0.h; sl.position.set(s0.x, 0.07, s0.z); trackG.add(sl);
  const arch = new THREE.Group(), am = new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0x330000 });
  [-1, 1].forEach(s => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.6), am); p.position.set(s * (ROAD_W + 2), 4, 0); arch.add(p); });
  const bm = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W * 2 + 4.6, 1.2, 0.8), am); bm.position.y = 8; arch.add(bm);
  arch.position.set(s0.x, 0, s0.z); arch.rotation.y = s0.h; trackG.add(arch);

  const dum = new THREE.Object3D();
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 0.8, SP * 3.3), new THREE.MeshStandardMaterial({ color: 0x8a8d92, roughness: 0.5, metalness: 0.5 }), 2 * Math.ceil(N / 3));
  let k = 0;
  for (let i = 0; i < N; i += 3) for (const s of [-1, 1]) {
    dum.position.set(pos[i].x + tan[i].z * (ROAD_W + 2) * s, 0.4, pos[i].z - tan[i].x * (ROAD_W + 2) * s);
    dum.rotation.set(0, Math.atan2(tan[i].x, tan[i].z), 0); dum.updateMatrix(); rails.setMatrixAt(k++, dum.matrix);
  }
  trackG.add(rails);
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.13, 6.5, 6), new THREE.MeshStandardMaterial({ color: 0x555a60 }), 2 * Math.ceil(N / 10));
  const glowM = new THREE.SpriteMaterial({ map: glowT, color: th.lamp, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.85 });
  k = 0;
  for (let i = 0; i < N; i += 10) for (const s of [-1, 1]) {
    const x = pos[i].x + tan[i].z * (ROAD_W + 3.6) * s, z = pos[i].z - tan[i].x * (ROAD_W + 3.6) * s;
    dum.position.set(x, 3.25, z); dum.rotation.set(0, 0, 0); dum.updateMatrix(); poles.setMatrixAt(k++, dum.matrix);
    const sp = new THREE.Sprite(glowM); sp.position.set(x - tan[i].z * s * 0.9, 6.5, z + tan[i].x * s * 0.9); sp.scale.set(9, 9, 1); trackG.add(sp);
  }
  trackG.add(poles);

  const bmats = th.bcol.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, envMapIntensity: 0.3, emissive: 0xffffff, emissiveMap: winT, emissiveIntensity: th.lit }));
  const maxB = save.set.gfx === 'low' ? 60 : 110;
  const nearRoad = (x, z, d) => { for (let i = 0; i < N; i += 4) { const dx = x - pos[i].x, dz = z - pos[i].z; if (dx * dx + dz * dz < d * d) return true; } return false; };
  for (let tries = 0, placed = 0; tries < 1200 && placed < maxB; tries++) {
    const x = -380 + rnd() * 760, z = -300 + rnd() * 700;
    if (nearRoad(x, z, 28)) continue;
    const w = 12 + rnd() * 16, h = th.bh[0] + rnd() * (th.bh[1] - th.bh[0]), d = 12 + rnd() * 16;
    const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv;
    for (let q = 0; q < uv.count; q++) uv.setXY(q, uv.getX(q) * (w + d) / 16, uv.getY(q) * h / 8);
    const b = new THREE.Mesh(geo, bmats[Math.floor(rnd() * bmats.length)]);
    b.position.set(x, h / 2, z); b.rotation.y = rnd() * 3; trackG.add(b); placed++;
    if (themeIdx === 1 && h > 90) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.9, 14, 6), new THREE.MeshStandardMaterial({ color: 0x888888 })); sp.position.set(x, h + 7, z); trackG.add(sp);
      const tip = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: 0xff3030, blending: THREE.AdditiveBlending, transparent: true })); tip.scale.set(8, 8, 1); tip.position.set(x, h + 14, z); trackG.add(tip);
    }
  }

  // атмосферные детали по локациям
  const sideAt = (i, d, s) => ({ x: pos[i].x + tan[i].z * d * s, z: pos[i].z - tan[i].x * d * s, h: Math.atan2(tan[i].x, tan[i].z) });
  if (themeIdx === 0) {
    const bar = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.45, 0.45, 1, 8), new THREE.MeshStandardMaterial({ color: 0x4a6a4a, roughness: 0.7 }), 40);
    for (let n = 0; n < 40; n++) { const p = sideAt(Math.floor(rnd() * N), ROAD_W + 4 + rnd() * 4, rnd() < 0.5 ? -1 : 1); dum.position.set(p.x, 0.5, p.z); dum.rotation.set(0, 0, 0); dum.updateMatrix(); bar.setMatrixAt(n, dum.matrix); }
    trackG.add(bar);
    for (let n = 0; n < 7; n++) {
      const car = makeCarModel(CARS[Math.floor(rnd() * 4)], Math.floor(rnd() * 0xffffff)); const p = sideAt(Math.floor(rnd() * N), ROAD_W + 6.5, rnd() < 0.5 ? -1 : 1);
      car.position.set(p.x, 0, p.z); car.rotation.y = p.h; trackG.add(car);
    }
  } else if (themeIdx === 1) {
    const cols = [0xff2d95, 0x2dd6ff, 0xffd02d, 0x7dff2d, 0xff6a1a];
    for (let n = 0; n < 16; n++) {
      const i = Math.floor(rnd() * N), s = rnd() < 0.5 ? -1 : 1, p = sideAt(i, ROAD_W + 16, s), c = cols[Math.floor(rnd() * cols.length)];
      const bb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 10), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: c, emissiveIntensity: 1.2 }));
      bb.position.set(p.x, 9, p.z); bb.rotation.y = p.h; trackG.add(bb);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8, 6), new THREE.MeshStandardMaterial({ color: 0x333333 })); pole.position.set(p.x, 4, p.z); trackG.add(pole);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: c, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.6, depthWrite: false })); gl.scale.set(18, 12, 1); gl.position.set(p.x - p.h * 0, 9, p.z); trackG.add(gl);
    }
  } else {
    const tr = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 6, 6), new THREE.MeshStandardMaterial({ color: 0x6b4a2a }), 60);
    const cr = new THREE.InstancedMesh(new THREE.SphereGeometry(2.4, 8, 6), new THREE.MeshStandardMaterial({ color: 0x2f8a3a, roughness: 0.8 }), 60);
    for (let n = 0; n < 60; n++) {
      const p = sideAt(Math.floor(rnd() * N), ROAD_W + 6 + rnd() * 14, rnd() < 0.5 ? -1 : 1);
      dum.rotation.set(0, 0, 0); dum.scale.set(1, 1, 1); dum.position.set(p.x, 3, p.z); dum.updateMatrix(); tr.setMatrixAt(n, dum.matrix);
      dum.position.set(p.x, 6.2, p.z); dum.scale.set(1, 0.45, 1); dum.updateMatrix(); cr.setMatrixAt(n, dum.matrix);
    }
    dum.scale.set(1, 1, 1); trackG.add(tr, cr);
  }

  // предметы: монеты, бонусы, ловушки (редко), трамплины
  items = [];
  const put = (type, idx, lat) => {
    const s = sampleAt(idx, lat), mesh = itemMesh(type, s.h); mesh.position.set(s.x, 0, s.z);
    trackG.add(mesh); items.push({ type, idx, lat, x: s.x, z: s.z, h: s.h, mesh, on: true });
  };
  for (let i = 0; i < 3; i++) put('ramp', 70 + i * 130 + rnd() * 30, (rnd() - 0.5) * 4);
  for (let idx = 30; idx < N - 40; idx += 10 + rnd() * 10) {
    if (items.some(it => it.type === 'ramp' && Math.abs(it.idx - idx) < 12)) continue;
    const r = rnd(), lat = (rnd() - 0.5) * 11;
    put(r < 0.5 ? 'coin' : r < 0.66 ? 'nitro' : r < 0.76 ? 'repair' : r < 0.82 ? 'oil' : r < 0.88 ? 'cone' : 'coin', idx, lat);
  }
}
function resetItems() { items.forEach(it => { it.on = true; it.mesh.visible = true; }); }

// ================= участники =================
const player = { name: 'Вы', mesh: null, h: 0, speed: 0, vx: 0, vz: 0, y: 0, vy: 0, air: false, idx: 0, lap: 0, p: 0, lat: 0, steerS: 0, slip: 0, spin: 1, dmg: 0, nLock: false, boosting: false, finished: false, rampT: 0, rampY: 0 };
let ais = [], remotes = {}, state = 'menu', nitro = 100, finishOrder = [], camH = 0, bumpT = 0, menuT = 0, raceId = 0, raceCoins = 0, curLaps = 3, wallT = 0, cfg = null, stuckT = 0, fixCool = 0, lastLap = 0, charMesh = null;
const all = () => [player, ...ais, ...Object.values(remotes)];

function showCar(id) {
  if (player.mesh) scene.remove(player.mesh);
  player.mesh = makeCarModel(carDef(id)); scene.add(player.mesh); player.mid = id;
  seatDriver(player.mesh, save.char.g, save.char.col, save.char.skin);
}
function previewPos() {
  const s = sampleAt(12, 0); player.mesh.position.set(s.x, 0, s.z); player.mesh.rotation.set(0, s.h, 0); player.mesh.userData.flame.visible = false;
}
function clearRemotes() { Object.values(remotes).forEach(r => scene.remove(r.mesh)); remotes = {}; }
function buildAIs(c) {
  ais.forEach(a => scene.remove(a.mesh)); ais = [];
  const L = c.L, boss = c.boss, pool = c.names ? c.names.slice() : NAMES.slice().sort(() => Math.random() - 0.5);
  for (let i = 0; i < c.count; i++) {
    const isB = !!boss && i === 0;
    const def = CARS[clamp(Math.floor(c.top / 7) - 3 + Math.floor(Math.random() * 3), 0, CARS.length - 1)];
    const mesh = makeCarModel(isB ? CARS[CARS.length - 1] : def, isB ? (boss === 'boss' ? 0x7a0f9a : 0x9a0f0f) : (Math.random() < 0.6 ? undefined : Math.floor(Math.random() * 0xffffff)));
    seatDriver(mesh, Math.random() < 0.5 ? 'boy' : 'girl', Math.floor(Math.random() * 6), Math.floor(Math.random() * 3));
    scene.add(mesh);
    ais.push({ name: isB ? bossName(L) : pool[i], mesh, p: 0, speed: 0, lat: 0, base: 0, isAI: true,
      skill: isB ? (boss === 'boss' ? 1.08 : 1.04) : rr(c.sk[0], c.sk[1]), aware: isB ? 1 : c.aware, boss: isB, finished: false, y: 0, airT: 0, rampCool: 0, rampT: 0, slipT: 0,
      nT: 3 + Math.random() * 6, nOn: 0, seen: new Map(), nitroOK: c.nit });
  }
}
// slot: 0..5 (ряд = slot/2). Офлайн: игрок на своём слоте, ИИ по порядку. Онлайн: слоты назначает сервер.
function placeGrid(mySlot) {
  finishOrder = []; curLaps = cfg.laps;
  const entries = [];
  if (cfg.mode === 'online') { entries.push([mySlot, player]); Object.values(remotes).forEach(r => entries.push([r.slot, r])); }
  else { let oi = 0; for (let k = 0; k <= ais.length; k++) entries.push([k, k === mySlot ? player : ais[oi++]]); }
  entries.forEach(([k, c]) => {
    const row = Math.floor(k / 2), lat = (k % 2 ? 4 : -4);
    c.p = -4 - row * 7; c.finished = false; c.speed = 0;
    const s = sampleAt(c.p, lat);
    c.mesh.position.set(s.x, 0, s.z); c.mesh.rotation.set(0, s.h, 0);
    if (c === player) {
      Object.assign(player, { h: s.h, idx: modN(c.p) | 0, steerS: 0, vx: 0, vz: 0, y: 0, vy: 0, air: false, slip: 0, nLock: false, boosting: false, lat, rampT: 0, rampY: 0 });
      camH = s.h; lastLap = -1;
    } else if (c.isAI) { c.lat = lat; c.base = lat; c.rampT = 0; c.slipT = 0; c.seen = new Map(); }
    else { c.x = s.x; c.z = s.z; c.h = s.h; c.tx = s.x; c.tz = s.z; c.th = s.h; c.ty = 0; c.y = 0; }
  });
}

// ================= ввод =================
const held = new Set();
const KEYMAP = { ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brake', KeyS: 'brake', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'nitro', ShiftLeft: 'drift', ShiftRight: 'drift', KeyX: 'drift' };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'KeyR') { fixPlayer(); return; }
  const k = KEYMAP[e.code]; if (k) { held.add(k); e.preventDefault(); }
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) held.delete(k); });
document.querySelectorAll('.tb').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { held.add(k); b.classList.add('on'); e.preventDefault(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, e => { held.delete(k); b.classList.remove('on'); e.preventDefault(); }));
});
$('fixBtn').addEventListener('pointerdown', e => { fixPlayer(); e.preventDefault(); });
const isTouch = matchMedia('(hover:none)').matches || navigator.maxTouchPoints > 0;
let audioReady = false;
addEventListener('pointerdown', () => { if (!audioReady) { audioReady = true; Snd.init(); Snd.setCfg(save.set.snd, save.set.mus); Snd.music(inRace() ? 'race' : 'menu'); } });
const inRace = () => state === 'race' || state === 'count' || state === 'done';
function toast(t) { const e = $('toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, 1200); }

// ================= экраны =================
const SCREENS = ['menu', 'garage', 'char', 'train', 'tour', 'online', 'settings', 'help', 'result'];
const IDLE = new Set(['menu', 'garage', 'char', 'train', 'tour', 'online', 'settings', 'help']);
function show(id) { SCREENS.forEach(s => $(s).hidden = s !== id); }
function openScreen(id) { state = id; show(id); Snd.click(); if (id === 'garage') { gSel = carIdx(save.cur); renderGarage(); } if (id === 'char') renderChar(); if (id === 'train') renderTrain(); if (id === 'tour') renderTour(); if (id === 'online') renderOnline(); if (id === 'settings') refreshSettings(); }
function leaveChar() { if (charMesh) { scene.remove(charMesh); charMesh = null; } if (player.mesh) { player.mesh.visible = true; seatDriver(player.mesh, save.char.g, save.char.col, save.char.skin); } }
function refreshMenu() {
  const L = save.level, th = THEMES[themeFor(L)];
  $('who').textContent = 'Гонщик: ' + save.name;
  $('lvlInfo').textContent = `Уровень ${L} · ${th.name} · ${lapsFor(L)} кр.` + (isBoss(L) ? ' · БОСС: ' + bossName(L) : isMini(L) ? ' · МИНИ-БОСС: ' + bossName(L) : '');
  $('coins').textContent = save.coins;
}
function toMenu() {
  raceId++; held.clear(); stuckT = 0;
  if (Net.isOpen()) { Net.send({ t: 'leave' }); Net.close(); }
  clearRemotes(); leaveChar();
  ['hud', 'count', 'fixBtn'].forEach(i => $(i).hidden = true); $('touch').hidden = true; $('fx').style.opacity = 0;
  ais.forEach(a => scene.remove(a.mesh)); ais = [];
  if (builtL !== save.level) { buildTrack(save.level); builtL = save.level; }
  showCar(save.cur); previewPos(); refreshMenu(); state = 'menu'; show('menu'); Snd.music('menu'); Snd.idle();
}
document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => { Snd.click(); toMenu(); }));
$('garageBtn').onclick = () => openScreen('garage');
$('charBtn').onclick = () => openScreen('char');
$('trainBtn').onclick = () => openScreen('train');
$('tourBtn').onclick = () => openScreen('tour');
$('onlineBtn').onclick = () => openScreen('online');
$('setBtn').onclick = () => openScreen('settings');
$('helpBtn').onclick = () => openScreen('help');
$('adminBtn').onclick = () => {
  const u = (save.set.server || '').trim().replace(/^ws(s?):\/\//i, 'http$1://');
  if (!/^https?:\/\//i.test(u)) { toast('Укажите адрес сервера в Настройках'); return; }
  window.open(u.replace(/\/+$/, '') + '/admin', '_blank');
};

// ---- гараж ----
let gSel = carIdx(save.cur);
const upCost = (id, i) => Math.round((save.cars[id].up[i] + 1) * (150 + carIdx(id) * 120));
const repCost = id => Math.ceil(save.cars[id].dmg * (4 + carIdx(id) * 4));
function renderGarage() {
  const d = CARS[gSel], own = save.cars[d.id];
  if (player.mid !== d.id) { showCar(d.id); previewPos(); }
  $('gName').textContent = d.name; $('gCoins').textContent = save.coins;
  $('gInfo').textContent = own ? (save.cur === d.id ? 'Выбрана' : 'В гараже') + ' · износ ' + Math.round(own.dmg) + '%' : 'Цена: ' + d.price + ' монет';
  $('gStats').innerHTML = STATS.map(([k, name], i) => {
    const up = own ? own.up[i] : 0; let btn = '';
    if (own) btn = up >= 5 ? '<button class="btn" disabled>МАКС</button>' : `<button class="btn" data-i="${i}" ${save.coins < upCost(d.id, i) ? 'disabled' : ''}>+ ${upCost(d.id, i)}</button>`;
    return `<div class="srow"><span>${name}</span><div class="bar"><i style="width:${d.s[i] / 15 * 100}%"></i><i style="width:${up * 0.6 / 15 * 100}%"></i></div>${btn}</div>`;
  }).join('');
  const main = $('gMain');
  if (!own) { main.textContent = 'Купить'; main.disabled = save.coins < d.price; }
  else if (save.cur !== d.id) { main.textContent = 'Выбрать'; main.disabled = false; }
  else { main.textContent = 'Выбрана'; main.disabled = true; }
  const rp = $('gRepair'); rp.hidden = !(own && own.dmg > 0.5);
  if (!rp.hidden) { rp.textContent = 'Починить · ' + repCost(d.id); rp.disabled = save.coins < repCost(d.id); }
}
$('gStats').onclick = e => {
  const b = e.target.closest('button[data-i]'); if (!b) return;
  const id = CARS[gSel].id, i = +b.dataset.i, c = upCost(id, i);
  if (save.coins >= c && save.cars[id].up[i] < 5) { save.coins -= c; save.cars[id].up[i]++; store(); Snd.pickup(); renderGarage(); }
};
$('gMain').onclick = () => {
  const d = CARS[gSel];
  if (!save.cars[d.id]) { if (save.coins < d.price) return; save.coins -= d.price; save.cars[d.id] = { up: [0, 0, 0, 0, 0, 0], dmg: 0 }; save.cur = d.id; Snd.coin(); }
  else { save.cur = d.id; Snd.click(); }
  store(); renderGarage();
};
$('gRepair').onclick = () => { const id = CARS[gSel].id, c = repCost(id); if (save.coins >= c) { save.coins -= c; save.cars[id].dmg = 0; store(); Snd.pickup(); renderGarage(); } };
$('gPrev').onclick = () => { gSel = (gSel + CARS.length - 1) % CARS.length; Snd.click(); renderGarage(); };
$('gNext').onclick = () => { gSel = (gSel + 1) % CARS.length; Snd.click(); renderGarage(); };

// ---- персонаж ----
function renderChar() {
  if (charMesh) scene.remove(charMesh);
  player.mesh.visible = false;
  charMesh = makeCharacter(save.char.g, save.char.col, save.char.skin, false);
  charMesh.position.copy(player.mesh.position); scene.add(charMesh);
  $('chBoy').classList.toggle('sel', save.char.g === 'boy'); $('chGirl').classList.toggle('sel', save.char.g === 'girl');
  const sw = (arr, key) => arr.map((c, i) => `<button class="sw ${save.char[key] === i ? 'sel' : ''}" data-k="${key}" data-i="${i}" style="background:${hex(c)}"></button>`).join('');
  $('chCols').innerHTML = sw(OUTFITS, 'col'); $('chSkin').innerHTML = sw(SKINS, 'skin');
}
$('chBoy').onclick = () => { save.char.g = 'boy'; store(); renderChar(); };
$('chGirl').onclick = () => { save.char.g = 'girl'; store(); renderChar(); };
$('char').addEventListener('click', e => { const b = e.target.closest('.sw'); if (b) { save.char[b.dataset.k] = +b.dataset.i; store(); renderChar(); } });
$('chDone').onclick = () => { leaveChar(); toMenu(); };

// ---- тренировка ----
let trDiff = 0, trTheme = 0;
function renderTrain() {
  $('trDiffs').innerHTML = DIFFS.map((d, i) => { const lock = save.level < d.unlock; return `<button class="btn ${trDiff === i ? 'sel' : ''}" data-d="${i}" ${lock ? 'disabled' : ''}>${d.n}${lock ? ' 🔒 ур. ' + d.unlock : ''}</button>`; }).join('');
  $('trThemes').innerHTML = THEMES.map((t, i) => `<button class="btn ${trTheme === i ? 'sel' : ''}" data-t="${i}">${t.name}</button>`).join('');
}
$('train').addEventListener('click', e => {
  const d = e.target.closest('[data-d]'), t = e.target.closest('[data-t]');
  if (d && !d.disabled) { trDiff = +d.dataset.d; renderTrain(); } if (t) { trTheme = +t.dataset.t; renderTrain(); }
});
$('trStart').onclick = () => { const D = DIFFS[trDiff], L = [1, 11, 21][trTheme] + Math.floor(Math.random() * 4); startRace({ mode: 'train', L, laps: 3, top: D.top, sk: D.sk, aware: D.aware, nit: trDiff >= 2, count: 5, rubber: trDiff < 4, boss: '' }); };

// ---- турниры ----
function renderTour() {
  $('tourList').innerHTML = TOURS.map(t => {
    const lock = save.level < t.unlock, act = save.tour && save.tour.id === t.id;
    const st = lock ? `🔒 откроется на уровне ${t.unlock}` : act ? `Гонка ${save.tour.race + 1}/${t.Ls.length}` : `Призы: ${t.prize.join(' / ')}`;
    return `<div class="card"><b>${t.name}</b><div class="muted">${t.desc}</div><div class="muted">${st}</div><button class="btn" data-id="${t.id}" ${lock ? 'disabled' : ''}>${act ? 'Продолжить' : (save.tour ? 'Начать (сбросит текущий)' : 'Начать')}</button></div>`;
  }).join('');
}
$('tourList').onclick = e => { const b = e.target.closest('button[data-id]'); if (b && !b.disabled) startTour(b.dataset.id); };
function startTour(id) {
  const def = TOURS.find(t => t.id === id);
  if (!save.tour || save.tour.id !== id) save.tour = { id, race: 0, pts: {}, names: NAMES.slice().sort(() => Math.random() - 0.5).slice(0, 5) };
  store(); const r = save.tour.race;
  startRace({ mode: 'tour', L: def.Ls[r], laps: 3, top: def.top + r * def.inc, sk: [0.95, 1.03], aware: 0.85, nit: true, count: 5, rubber: true, boss: '', names: save.tour.names });
}

// ---- настройки ----
const GFX = { low: 'Низкая', med: 'Средняя', high: 'Высокая' };
function refreshSettings() {
  $('nameIn').value = save.name; $('srvIn').value = save.set.server || '';
  $('sndBtn').textContent = save.set.snd ? 'Вкл' : 'Выкл'; $('musBtn').textContent = save.set.mus ? 'Вкл' : 'Выкл';
  $('gfxBtn').textContent = GFX[save.set.gfx]; $('themeBtn').textContent = save.set.theme === 'light' ? 'Светлая' : 'Тёмная';
  document.body.classList.toggle('light', save.set.theme === 'light'); Snd.setCfg(save.set.snd, save.set.mus);
}
$('setBack').onclick = () => { save.name = ($('nameIn').value.trim() || 'Гонщик').slice(0, 14); save.set.server = $('srvIn').value.trim(); store(); toMenu(); };
$('sndBtn').onclick = () => { save.set.snd = save.set.snd ? 0 : 1; store(); refreshSettings(); };
$('musBtn').onclick = () => { save.set.mus = save.set.mus ? 0 : 1; store(); refreshSettings(); };
$('gfxBtn').onclick = () => { const k = ['low', 'med', 'high']; save.set.gfx = k[(k.indexOf(save.set.gfx) + 1) % 3]; store(); refreshSettings(); applyGfx(); builtL = -1; };
$('themeBtn').onclick = () => { save.set.theme = save.set.theme === 'light' ? 'dark' : 'light'; store(); refreshSettings(); };
$('resetBtn').onclick = () => { if (confirm('Удалить весь прогресс?')) { const s = save.set, n = save.name; save = defSave(); save.set = s; save.name = n; store(); builtL = -1; toMenu(); } };

// ================= онлайн =================
let myId = 0, onlinePlace = 0, sendT = 0, connecting = false;
function setOn(t) { $('onStatus').textContent = t; }
function renderOnline() { wakeServer(); setOn(save.set.server ? 'Нажмите «Найти гонку»' : 'Укажите адрес сервера в Настройках (wss://…onrender.com)'); $('onFind').disabled = false; }
const httpBase = u => u.trim().replace(/^ws(s?):\/\//i, 'http$1://').replace(/\/+$/, '');
function wakeServer() { // бесплатный хостинг засыпает: «будим» его заранее обычным запросом
  const u = (save.set.server || '').trim();
  if (/^wss?:\/\//i.test(u)) { try { fetch(httpBase(u) + '/health', { mode: 'no-cors', cache: 'no-store' }).catch(() => {}); } catch (e) {} }
}
let cancelWait = false;
let connectAbort = false;
$('onFind').onclick = async () => {
  const url = (save.set.server || '').trim();
  if (!/^wss?:\/\//i.test(url)) { setOn('Укажите адрес сервера в Настройках (wss://…)'); return; }
  if (connecting) return; connecting = true; connectAbort = false; $('onFind').disabled = true;
  const t0 = Date.now(); let ok = false;
  const tick = setInterval(() => setOn(`Сервер просыпается… ${Math.round((Date.now() - t0) / 1000)} с (бесплатный хостинг, до минуты)`), 1000);
  setOn('Подключение к серверу…');
  try {
    Net.close();
    while (!ok && !connectAbort && Date.now() - t0 < 90000) {
      Net.wake(url);
      try { await Net.connect(url, 8000); ok = true; } catch (e) { await new Promise(r => setTimeout(r, 1500)); }
    }
    if (ok && !connectAbort) {
      Net.send({ t: 'hello', name: save.name, carId: save.cur, gender: save.char.g, outfit: save.char.col, skin: save.char.skin });
      Net.send({ t: 'queue' }); setOn('Поиск соперников… (нужно минимум 2 игрока)');
    } else if (!connectAbort) setOn('Не удалось подключиться к серверу. Проверьте адрес в Настройках.');
  } finally { clearInterval(tick); connecting = false; if (!ok || connectAbort) $('onFind').disabled = false; }
};
$('onCancel').onclick = () => { cancelWait = true; Net.send({ t: 'cancel' }); Net.close(); renderOnline(); };
Net.on('welcome', m => { myId = m.id; });
Net.on('queue', m => setOn(`В очереди: ${m.n} · онлайн: ${m.online}. Ждём соперников…`));
Net.on('msg', m => toast(m.text));
Net.on('kick', m => { Net.close(); toast(m.reason || 'Отключено'); if (inRace() || state === 'online') toMenu(); });
Net.on('close', () => { if (state === 'race' || state === 'count') { toast('Соединение потеряно'); toMenu(); } });
Net.on('left', m => { const r = remotes[m.id]; if (r) { scene.remove(r.mesh); delete remotes[m.id]; } });
Net.on('place', m => { onlinePlace = m.place; });
Net.on('onlineList', m => { const el=$('onlinePlayers'); if(!el) return; el.innerHTML=(m.players||[]).map(p=>`<div class="card"><b>${String(p.name).replace(/[&<>"']/g,'')}</b><div class="muted">${p.status}</div></div>`).join('') || '<p class="sub">Пока никого нет</p>'; });
Net.on('snap', m => {
  for (const [id, x, z, h, s, p, y, f] of m.p) { const r = remotes[id]; if (r) { r.tx = x; r.tz = z; r.th = h; r.ty = y; r.speed = s; r.p = p; r.finished = !!f; } }
});
Net.on('room', m => {
  Snd.init(); const L = m.L;
  cfg = { mode: 'online', L, laps: m.laps, count: 0, boss: '' };
  if (builtL !== L) { buildTrack(L); builtL = L; }
  clearRemotes(); ais.forEach(a => scene.remove(a.mesh)); ais = [];
  m.players.forEach(p => {
    if (p.id === myId) return;
    const mesh = makeCarModel(carDef(p.carId)); seatDriver(mesh, p.gender, p.outfit, p.skin); scene.add(mesh);
    remotes[p.id] = { isRemote: true, id: p.id, name: p.name, slot: p.slot, mesh, x: 0, z: 0, h: 0, y: 0, tx: 0, tz: 0, th: 0, ty: 0, p: 0, speed: 0, lat: 0, finished: false };
  });
  onlinePlace = 0; beginRace(m.you, m.startIn);
});

// ================= гонка =================
function startRace(c) {
  Snd.init(); cfg = c; Snd.setTheme(themeFor(c.L));
  if (builtL !== c.L) { buildTrack(c.L); builtL = c.L; }
  clearRemotes(); buildAIs(c); onlinePlace = 0;
  beginRace(c.count, 3000);
}
function beginRace(mySlot, startIn) {
  leaveChar(); showCar(save.cur); phys = physFor(save.cur); player.dmg = save.cars[save.cur].dmg;
  if (cfg.mode !== 'online') mySlot = ais.length;     // игрок на последнем месте решётки
  placeGrid(mySlot); resetItems();
  nitro = phys.nCap; raceCoins = 0; raceStartedAt = performance.now(); player.finished = false; stuckT = 0; fixCool = 0; held.clear();
  state = 'count'; show(null); $('hud').hidden = false; $('touch').hidden = !isTouch; $('fixBtn').hidden = true;
  const L = cfg.L, tag = $('bossTag');
  tag.hidden = !cfg.boss; tag.textContent = (cfg.boss === 'boss' ? 'БОСС: ' : 'МИНИ-БОСС: ') + bossName(L);
  Snd.music('race');
  const id = ++raceId, c = $('count'); c.hidden = false; c.textContent = '';
  const base = Math.max(0, startIn - 3000);
  [['3', 0], ['2', 1000], ['1', 2000], ['GO!', 3000]].forEach(([t, ms]) => setTimeout(() => {
    if (id !== raceId) return;
    c.textContent = t; Snd.countdown(t === 'GO!');
    if (t === 'GO!') { state = 'race'; setTimeout(() => { if (id === raceId) c.hidden = true; }, 700); }
  }, base + ms));
}
function startCareer() {
  const L = save.level;
  startRace({ mode: 'career', L, laps: lapsFor(L), top: 44 + Math.min(L, 45) * 1.05, sk: [0.92, 1.0], aware: 0.75 + Math.min(L, 40) * 0.006, nit: L >= 5, count: 5, rubber: true, boss: isBoss(L) ? 'boss' : isMini(L) ? 'mini' : '' });
}
$('startBtn').onclick = startCareer;
$('quitBtn').onclick = toMenu;
$('toMenu').onclick = toMenu;

function addDmg(v) { player.dmg = Math.min(100, player.dmg + v); }
const angDiff = (a, b) => ((a - b + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

function fixPlayer() {
  if (state !== 'race' || fixCool > 0) return;
  fixCool = 1.5; const m = player.mesh.position, [bi] = nearest(m, player.idx), s = sampleAt(bi + 2, 0);
  m.set(s.x, 0, s.z); Object.assign(player, { h: s.h, speed: 0, vx: 0, vz: 0, y: 0, vy: 0, air: false, slip: 0, rampT: 0, steerS: 0 });
  camH = s.h; stuckT = 0; toast('Машина выровнена'); Snd.pickup();
}

function updatePlayer(dt) {
  const racing = state === 'race', P = phys;
  const gas = racing && held.has('gas'), brk = racing && held.has('brake'), drift = racing && held.has('drift');
  let steer = racing ? (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0) : 0;

  if (player.nLock && nitro >= P.nCap * 0.25) player.nLock = false;
  const boost = racing && held.has('nitro') && !player.nLock && nitro > 0;
  if (boost) { nitro = Math.max(0, nitro - 38 * dt); if (nitro <= 0) player.nLock = true; if (!player.boosting) Snd.nitro(); }
  else nitro = Math.min(P.nCap, nitro + 6 * dt);
  player.boosting = boost;

  const m = player.mesh.position;
  const [bi, dist] = nearest(m, player.idx);
  const off = dist > ROAD_W + 0.5 && !player.air;
  player.rampT = Math.max(0, player.rampT - dt);
  const max = P.max * (boost ? P.nPow : 1) * (off ? 0.55 : 1) * (player.rampT > 0 ? 1.4 : 1);

  if (!player.air) {
    if (gas || boost) player.speed += P.acc * (boost ? 1.9 : 1) * (1 - clamp(player.speed / max, 0, 1)) * dt;
    if (brk) player.speed -= (player.speed > 0 ? P.brk : 14) * dt;
    if (drift) { player.speed -= Math.max(7, Math.abs(player.speed) * 0.20) * dt; player.skid = Math.min(1, (player.skid || 0) + 2.5 * dt); } else player.skid = Math.max(0, (player.skid || 0) - 3 * dt);
    if (drift && Math.abs(player.steerS) > 0.15 && Math.abs(player.speed) > 18) { player.h -= player.steerS * 0.42 * dt; player.slip = Math.max(0, player.slip - dt); }
    if (!gas && !brk && !boost) player.speed -= player.speed * 0.35 * dt;
    if (player.speed > max) player.speed -= Math.max(25, (player.speed - max) * 2) * dt;
    if (off) player.speed -= player.speed * 1.1 * dt;
  }
  player.speed = Math.max(player.speed, -14);

  if (player.slip > 0) { player.slip -= dt; player.h += player.spin * 7 * dt; player.speed -= player.speed * 0.9 * dt; steer = 0; }
  player.steerS += (steer - player.steerS) * Math.min(1, 8 * dt);
  const sp = Math.abs(player.speed);
  if (!player.air) player.h -= player.steerS * P.hnd * 1.25 * clamp(sp / 18, 0, 1) / (1 + sp / 55) * dt * (player.speed >= 0 ? 1 : -1);

  const fx = Math.sin(player.h) * player.speed, fz = Math.cos(player.h) * player.speed;
  const g = player.air ? 0.3 : player.slip > 0 ? 0.7 : P.grip * (off ? 0.6 : 1), k = Math.min(1, g * dt);
  player.vx += (fx - player.vx) * k; player.vz += (fz - player.vz) * k;
  let skid = 0;
  if (!player.air) { skid = Math.abs(player.vx * Math.cos(player.h) - player.vz * Math.sin(player.h)); player.speed -= skid * 0.35 * dt; }
  player.skid = player.slip > 0 ? 0.1 : skid / 25;
  m.x += player.vx * dt; m.z += player.vz * dt;

  if (player.air) {
    player.y += player.vy * dt; player.vy -= 24 * dt;
    if (player.y <= 0) { player.y = 0; player.vy = 0; player.air = false; player.speed *= 0.95; Snd.land(); }
  }
  m.y = player.y;

  wallT -= dt;
  if (dist > WALL) {
    const c = pos[bi], dx = m.x - c.x, dz = m.z - c.z, d = Math.hypot(dx, dz) || 1;
    m.x = c.x + dx / d * WALL; m.z = c.z + dz / d * WALL; player.speed *= 0.82; player.vx *= 0.5; player.vz *= 0.5;
    if (wallT <= 0 && racing) { wallT = 0.4; Snd.bump(); addDmg(2); }
  }

  player.mesh.rotation.y = player.h;
  player.mesh.rotation.z = -player.steerS * Math.min(sp / 60, 1) * 0.05;
  player.mesh.rotation.x = player.air ? -clamp(player.vy / 40, -0.4, 0.4) : 0;
  const ud = player.mesh.userData;
  ud.wheels.forEach(w => w.rotation.x += player.speed * dt / 0.4);
  ud.tailMat.color.setHex(brk ? 0xff5050 : 0xaa1010);
  ud.flame.visible = boost; if (boost) ud.flame.scale.set(1, 1, 0.7 + Math.random() * 0.6);

  // прогресс накапливается разностью индексов: устойчиво к стартовой линии и объездам
  player.p += sdiff(bi, player.idx); player.idx = bi;
  const lp = Math.floor(player.p / N);
  if (lp > lastLap) { lastLap = lp; resetItems(); if (lp >= 1 && lp < curLaps) { toast('Круг ' + (lp + 1)); Snd.lap(); } }
  player.lat = (m.x - pos[bi].x) * tan[bi].z - (m.z - pos[bi].z) * tan[bi].x;
}

function updateAI(a, dt) {
  const racing = state === 'race' || state === 'done', ip = modN(a.p), i = ip | 0;
  const ang = Math.acos(clamp(tan[i].x * tan[(i + 14) % N].x + tan[i].z * tan[(i + 14) % N].z, -1, 1));
  const curv = 1 - Math.min(0.4, ang * 1.2);
  const gap = a.p - player.p;
  const rubber = a.boss || !cfg.rubber ? 1 : 1 - clamp(gap * 0.0006, -0.06, 0.1);
  a.nT -= dt; if (a.nT <= 0) { a.nOn = a.nitroOK ? 1.4 : 0; a.nT = 8 + Math.random() * 7; }
  const nit = a.nOn > 0 ? 1.12 : 1; a.nOn -= dt; a.rampT = Math.max(0, a.rampT - dt); a.slipT = Math.max(0, a.slipT - dt);
  let target = racing ? cfg.top * a.skill * curv * rubber * nit * (a.rampT > 0 ? 1.4 : 1) * (a.slipT > 0 ? 0.5 : 1) : 0;

  // объезд ловушек — только если ИИ их «заметил» (зависит от сложности); иначе может врезаться
  let tl = a.base;
  for (const it of items) if (it.on && (it.type === 'oil' || it.type === 'cone')) {
    const d = sdiff(it.idx, ip);
    if (d > 2 && d < 22 && Math.abs(it.lat - a.lat) < 3.2) {
      if (!a.seen.has(it)) a.seen.set(it, Math.random() < a.aware);
      if (a.seen.get(it)) tl = it.lat > 0 ? it.lat - 4.4 : it.lat + 4.4;
    }
    if (racing && Math.abs(d) < 1.1 && Math.abs(it.lat - a.lat) < 2.1 && a.slipT <= 0) {
      if (it.type === 'oil') { a.slipT = 1.2; a.lat += (Math.random() < 0.5 ? 1 : -1) * 2; }
      else { it.on = false; it.mesh.visible = false; a.slipT = 0.5; a.speed *= 0.5; }
      a.seen.delete(it);
    }
  }
  for (const o of all()) if (o !== a && o.p !== undefined) {
    const d = sdiff(o.p, a.p);
    if (d > 0 && d < 14 && Math.abs((o.lat || 0) - a.lat) < 2.8) {
      tl = a.lat > (o.lat || 0) ? (o.lat || 0) + 3.6 : (o.lat || 0) - 3.6;
      if (d < 7 && Math.abs((o.lat || 0) - a.lat) < 1.8) target = Math.min(target, o.speed + 2);
    }
  }
  if (a.slipT > 0) tl += Math.sin(a.slipT * 14) * 1.5;
  tl = clamp(tl, -6.2, 6.2);
  a.lat += clamp(tl - a.lat, -5 * dt, 5 * dt);
  a.speed += (target - a.speed) * Math.min(1, 1.6 * dt);
  a.p += a.speed * dt / SP;

  a.rampCool -= dt; if (a.airT > 0) a.airT -= dt;
  else if (a.rampCool <= 0 && racing) for (const it of items) if (it.type === 'ramp' && Math.abs(sdiff(it.idx, ip)) < 1.5 && Math.abs(it.lat - a.lat) < 4) { a.airT = 0.9; a.rampCool = 3; a.rampT = 2.5; }
  a.y = a.airT > 0 ? Math.sin((1 - a.airT / 0.9) * Math.PI) * 2.2 : 0;

  const s = sampleAt(a.p, a.lat);
  a.mesh.position.set(s.x, a.y, s.z); a.mesh.rotation.set(0, s.h + (a.slipT > 0 ? Math.sin(a.slipT * 10) * 0.5 : 0), 0);
  const u = a.mesh.userData; u.wheels.forEach(w => w.rotation.x += a.speed * dt / 0.4); u.flame.visible = (a.nOn > 0 || a.rampT > 0) && racing;
}

function updateRemotes(dt) {
  for (const r of Object.values(remotes)) {
    const k = Math.min(1, 12 * dt);
    r.x += (r.tx - r.x) * k; r.z += (r.tz - r.z) * k; r.y += (r.ty - r.y) * k; r.h += angDiff(r.th, r.h) * k;
    r.mesh.position.set(r.x, r.y, r.z); r.mesh.rotation.y = r.h; r.mesh.userData.wheels.forEach(w => w.rotation.x += r.speed * dt / 0.4);
  }
}

function collide() {
  const pm = player.mesh.position;
  for (const a of [...ais, ...Object.values(remotes)]) {
    const am = a.mesh.position, dx = pm.x - am.x, dz = pm.z - am.z, d = Math.hypot(dx, dz);
    if (d < 3.6 && d > 0.01 && Math.abs(pm.y - am.y) < 1.5) {
      const push = 3.6 - d; pm.x += dx / d * push * 0.7; pm.z += dz / d * push * 0.7;
      if (a.isAI) a.lat += (player.lat < a.lat ? 1 : -1) * 0.16;
      if (performance.now() - bumpT > 300) { Snd.bump(); bumpT = performance.now(); addDmg(1.5); }
      player.speed *= 0.94; if (a.isAI) a.speed *= 0.97;
    }
  }
}

function itemsUpdate(dt) {
  const m = player.mesh.position; let ry = 0;
  const coinV = cfg.mode === 'train' ? 0 : 25;
  for (const it of items) {
    if (it.type === 'ramp') {
      const dx = m.x - it.x, dz = m.z - it.z, sn = Math.sin(it.h), cs = Math.cos(it.h), lz = dx * sn + dz * cs, lx = dx * cs - dz * sn;
      if (!player.air && Math.abs(lx) < 3.5 && lz > -3 && lz < 3) {
        ry = Math.max(ry, 0.9 * (lz + 3) / 6);
        if (lz > 2.2 && player.speed > 10) { player.air = true; player.vy = 5 + player.speed * 0.1; player.speed *= 1.4; player.rampT = 2.5; Snd.jump(); toast('Турбо-прыжок +40%'); }
      }
      continue;
    }
    if (!it.on) continue;
    const dx = m.x - it.x, dz = m.z - it.z, d2 = dx * dx + dz * dz;
    switch (it.type) {
      case 'coin': if (d2 < 5) { it.on = false; it.mesh.visible = false; raceCoins += coinV; Snd.coin(); } break;
      case 'nitro': if (d2 < 5) { it.on = false; it.mesh.visible = false; nitro = Math.min(phys.nCap, nitro + phys.nCap * 0.4); Snd.pickup(); toast('Нитро +'); } break;
      case 'repair': if (d2 < 5) { it.on = false; it.mesh.visible = false; player.dmg = Math.max(0, player.dmg - 15); Snd.pickup(); toast('Починка'); } break;
      case 'oil': if (d2 < 6 && !player.air && player.slip <= 0) { player.slip = 1.2; player.spin = Math.random() < 0.5 ? 1 : -1; toast('Масло!'); Snd.oil(); } break;
      case 'cone': if (d2 < 4 && !player.air) { it.on = false; it.mesh.visible = false; player.speed *= 0.45; addDmg(8); Snd.crash(); toast('Препятствие!'); } break;
    }
  }
  if (!player.air) player.y += (ry - player.y) * Math.min(1, 15 * dt);
}

function fullOrder() { const fin = finishOrder.slice(); return [...fin, ...all().filter(c => !fin.includes(c)).sort((a, b) => b.p - a.p)]; }
function finishCheck() {
  for (const c of all()) {
    if (c.finished || c.p < curLaps * N) continue;
    c.finished = true; finishOrder.push(c);
    if (c === player) { if (cfg.mode === 'online') Net.send({ t: 'finish' }); finishRace(); }
  }
}
function finishRace() {
  state = 'done'; $('touch').hidden = true; $('fx').style.opacity = 0; $('fixBtn').hidden = true;
  const c = $('count'); c.hidden = false; c.textContent = 'ФИНИШ!'; setTimeout(() => { if (state === 'done') c.hidden = true; }, 1300);
  const order = fullOrder(); let place = order.indexOf(player) + 1;
  save.cars[save.cur].dmg = Math.min(100, player.dmg);
  let reward = 0, title, sub = '', table = '', btn = 'Ещё раз', act = startCareer;
  if (cfg.mode === 'career') {
    const L = cfg.L, base = (80 + L * 15) * (isBoss(L) ? 2 : isMini(L) ? 1.5 : 1);
    reward = Math.round(base * [1, 0.55, 0.3, 0.15, 0.08, 0.05][place - 1]); const adv = place <= 3;
    if (adv && save.level === L) save.level++;
    sub = adv ? `Уровень ${L} пройден` : 'Чтобы пройти уровень, финишируйте в тройке'; btn = adv ? 'Дальше' : 'Ещё раз'; act = startCareer;
  } else if (cfg.mode === 'train') {
    sub = 'Тренировка: награды нет, только практика'; act = () => $('trStart').onclick();
  } else if (cfg.mode === 'online') {
    if (onlinePlace) place = onlinePlace; reward = [150, 90, 60, 40, 25, 15][place - 1] || 10;
    sub = 'Онлайн-гонка'; btn = 'К онлайну'; act = () => { toMenu(); openScreen('online'); };
  } else if (cfg.mode === 'tour') {
    const t = save.tour, def = TOURS.find(x => x.id === t.id);
    order.forEach((e, i) => { const k = e === player ? '__you' : e.name; t.pts[k] = (t.pts[k] || 0) + (PTS[i] || 0); });
    t.race++;
    const st = Object.entries(t.pts).sort((a, b) => b[1] - a[1]);
    table = st.map(([n, p], i) => `<div class="trow ${n === '__you' ? 'me' : ''}"><span>${i + 1}. ${n === '__you' ? save.name : n}</span><b>${p}</b></div>`).join('');
    if (t.race >= def.Ls.length) {
      const rank = st.findIndex(s => s[0] === '__you'); reward = def.prize[rank] || 0; save.tour = null;
      sub = `Турнир завершён · итог: ${rank + 1}-е место`; btn = 'К турнирам'; act = () => { toMenu(); openScreen('tour'); };
    } else { sub = `Гонка ${t.race}/${def.Ls.length} завершена · очки`; btn = 'Следующая гонка'; act = () => startTour(def.id); }
  }
  const elapsed = Math.max(0, (performance.now() - raceStartedAt) / 1000);
  const bankedRaceCoins = place === 1 ? raceCoins : Math.floor(raceCoins * 0.2);
  if (place !== 1 && raceCoins > 0) sub += ` · за проигрыш сохранено 20% собранных монет (${bankedRaceCoins}/${raceCoins})`;
  sub += ` · Время: ${Math.floor(elapsed/60)}:${String(Math.floor(elapsed%60)).padStart(2,'0')}.${String(Math.floor((elapsed%1)*100)).padStart(2,'0')}`;
  save.coins += reward + bankedRaceCoins; store();
  title = place === 1 ? 'Победа!' : place + '-е место';
  if (place <= 3) Snd.fanfare(); else Snd.lose();
  $('resTitle').textContent = title; $('resSub').textContent = sub; $('resTable').innerHTML = table;
  $('resCoins').textContent = reward + bankedRaceCoins; $('againBtn').textContent = btn; $('againBtn').onclick = act;
  setTimeout(() => { if (state === 'done') { $('hud').hidden = true; show('result'); } }, 1400);
}

function updateHUD() {
  const rank = all().sort((a, b) => b.p - a.p).indexOf(player) + 1;
  $('pos').textContent = rank + '/' + all().length;
  $('lap').textContent = clamp(Math.floor(player.p / N) + 1, 1, curLaps) + '/' + curLaps;
  $('spd').textContent = Math.round(Math.abs(player.speed) * 3.6); $('rc').textContent = raceCoins;
  const n = $('nitro'); n.style.width = (nitro / phys.nCap * 100) + '%'; n.classList.toggle('lock', player.nLock);
  $('fx').style.opacity = player.boosting ? 1 : 0;
  $('fixBtn').hidden = !(state === 'race' && stuckT > 1);
}

function updateCamera(dt) {
  if (IDLE.has(state)) {
    menuT += dt * 0.3; const ch = state === 'char' && charMesh, m = ch ? charMesh.position : player.mesh.position, r = ch ? 4.2 : 8;
    cam.position.set(m.x + Math.sin(menuT) * r, ch ? 1.5 : 2.8, m.z + Math.cos(menuT) * r);
    cam.lookAt(m.x, ch ? 1 : 0.9, m.z); cam.fov = 55; cam.updateProjectionMatrix(); return;
  }
  const m = player.mesh.position;
  camH += angDiff(player.h, camH) * Math.min(1, 4 * dt);
  const sh = player.boosting ? 0.06 : 0;
  cam.position.set(m.x - Math.sin(camH) * 9 + (Math.random() - 0.5) * sh * 4, 4.6 + player.y * 0.6 + (Math.random() - 0.5) * sh * 4, m.z - Math.cos(camH) * 9);
  cam.lookAt(m.x + Math.sin(camH) * 6, 1.4 + player.y * 0.5, m.z + Math.cos(camH) * 6);
  const fov = 68 + clamp(Math.abs(player.speed) / 70, 0, 1) * 14 + (player.boosting ? 8 : 0);
  cam.fov += (fov - cam.fov) * Math.min(1, 5 * dt); cam.updateProjectionMatrix();
}

let last = performance.now(), tAcc = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.05); last = now; tAcc += dt; fixCool -= dt;
  if (inRace()) {
    updatePlayer(dt);
    ais.forEach(a => updateAI(a, dt));
    updateRemotes(dt);
    if (state === 'race') {
      collide(); itemsUpdate(dt); finishCheck();
      if (Math.abs(player.speed) < 4 && !player.air) stuckT += dt; else stuckT = 0;
      if (cfg.mode === 'online') { sendT += dt; if (sendT > 0.08) { sendT = 0; const m = player.mesh.position; Net.send({ t: 's', x: +m.x.toFixed(2), z: +m.z.toFixed(2), h: +player.h.toFixed(3), s: +player.speed.toFixed(1), p: +player.p.toFixed(1), y: +player.y.toFixed(2) }); } }
    }
    updateHUD();
  }
  for (const it of items) if (it.on && it.mesh.userData.spin) it.mesh.userData.body.rotation.y = tAcc * 2.5;
  if (charMesh) charMesh.rotation.y = tAcc * 0.4;
  if (inRace()) Snd.update({ speed01: clamp(Math.abs(player.speed) / 80, 0, 1), boost: player.boosting, slip: player.skid || 0, racing: true }); else Snd.idle();
  Snd.ambTick(dt, true);
  const m = player.mesh.position;
  sun.position.set(m.x + 60, 100, m.z + 40); sun.target.position.copy(m);
  spot.position.set(m.x, 1.3, m.z); spot.target.position.set(m.x + Math.sin(player.h) * 25, 0, m.z + Math.cos(player.h) * 25);
  updateCamera(dt);
  if (starsG) starsG.position.copy(cam.position);
  updateRain(dt);
  renderer.render(scene, cam);
}

// ================= запуск =================
applyGfx(); resize(); refreshSettings(); wakeServer();
buildTrack(save.level); builtL = save.level;
showCar(save.cur); previewPos(); refreshMenu(); show('menu');
requestAnimationFrame(loop);
})();
