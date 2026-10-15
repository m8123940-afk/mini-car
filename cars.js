// Данные машин, процедурные 3D-модели машин и персонажей (оригинальные, без чужих брендов).
// Добавить машину: допишите объект в CARS. Порядок статов: speed, accel, brake, handle, grip, nitro.
const STATS = [['speed', 'Скорость'], ['accel', 'Ускорение'], ['brake', 'Торможение'], ['handle', 'Управление'], ['grip', 'Сцепление'], ['nitro', 'Нитро']];

// Силуэт сбоку (z вперёд): l длина, w ширина, belt линия капота/дверей, roof крыша, nose/tail высота носа/кормы,
// wb/wt низ/верх лобового, rt/rb верх/низ заднего стекла, R радиус колеса, sp тип антикрыла (0 нет)
const SHAPES = {
  retro:  { l: 4.8, w: 1.95, belt: 0.98, roof: 1.45, nose: 0.72, tail: 0.94, wb: 0.75, wt: 0.25, rt: -0.95, rb: -1.65, R: 0.38, sp: 0 },
  muscle: { l: 4.8, w: 2.0,  belt: 0.95, roof: 1.38, nose: 0.66, tail: 0.98, wb: 0.5,  wt: 0.0,  rt: -0.7,  rb: -1.9,  R: 0.39, sp: 1 },
  sedan:  { l: 4.6, w: 1.9,  belt: 0.95, roof: 1.43, nose: 0.76, tail: 0.92, wb: 0.9,  wt: 0.35, rt: -0.9,  rb: -1.5,  R: 0.37, sp: 0 },
  coupe:  { l: 4.3, w: 1.9,  belt: 0.88, roof: 1.30, nose: 0.64, tail: 0.88, wb: 0.6,  wt: 0.05, rt: -0.7,  rb: -1.4,  R: 0.37, sp: 0 },
  wedge:  { l: 4.4, w: 1.95, belt: 0.78, roof: 1.20, nose: 0.46, tail: 0.86, wb: 0.9,  wt: 0.1,  rt: -0.9,  rb: -1.7,  R: 0.37, sp: 1 },
  super:  { l: 4.5, w: 2.02, belt: 0.72, roof: 1.13, nose: 0.42, tail: 0.82, wb: 1.0,  wt: 0.25, rt: -0.7,  rb: -1.7,  R: 0.38, sp: 2 },
  hyper:  { l: 4.7, w: 2.12, belt: 0.66, roof: 1.05, nose: 0.36, tail: 0.78, wb: 1.2,  wt: 0.35, rt: -0.8,  rb: -1.9,  R: 0.39, sp: 3 }
};

const CARS = [
  { id: 'rust',    name: 'Ржавый Волк 72', price: 0,      col: 0xc9a227, shape: 'retro',  s: [3, 3, 3, 3, 3, 3] },
  { id: 'bulldog', name: 'Бульдог 74',     price: 700,    col: 0x8a3b2b, shape: 'muscle', s: [4, 5, 3, 3, 3, 4] },
  { id: 'topol',   name: 'Тополь Т4',      price: 1600,   col: 0x3b6ea5, shape: 'sedan',  s: [5, 4, 4, 4, 4, 4] },
  { id: 'kolibri', name: 'Колибри GT',     price: 3200,   col: 0x3aa56a, shape: 'coupe',  s: [5, 5, 5, 6, 5, 4] },
  { id: 'skat',    name: 'Скат Р1',        price: 5600,   col: 0xd8d8d0, shape: 'wedge',  s: [6, 6, 5, 6, 5, 5] },
  { id: 'yastreb', name: 'Ястреб ЛС',      price: 9000,   col: 0xe0562a, shape: 'coupe',  s: [7, 6, 6, 7, 6, 5] },
  { id: 'mamba',   name: 'Мамба V8',       price: 14000,  col: 0x1d1d22, shape: 'muscle', s: [8, 7, 6, 6, 6, 6] },
  { id: 'phantom', name: 'Фантом Z',       price: 21000,  col: 0x6a3fd0, shape: 'wedge',  s: [8, 8, 7, 7, 7, 7] },
  { id: 'corsar',  name: 'Корсар S',       price: 30000,  col: 0xd6b13a, shape: 'super',  s: [9, 8, 8, 8, 7, 7] },
  { id: 'eclipse', name: 'Эклипс 900',     price: 42000,  col: 0x2fb7c9, shape: 'super',  s: [9, 9, 8, 9, 8, 8] },
  { id: 'viper',   name: 'Вайпер Эво',     price: 58000,  col: 0xc42b2b, shape: 'super',  s: [10, 9, 9, 9, 9, 8] },
  { id: 'nova',    name: 'Нова Хайпер',    price: 80000,  col: 0xf2f2f2, shape: 'hyper',  s: [10, 10, 9, 9, 9, 9] },
  { id: 'titan',   name: 'Титан X',        price: 110000, col: 0xff8a1a, shape: 'hyper',  s: [11, 10, 10, 10, 9, 10] },
  { id: 'aurora',  name: 'Аврора ∞',       price: 150000, col: 0xe030a0, shape: 'hyper',  s: [12, 11, 10, 11, 10, 11] }
];

const SKINS = [0xf1c8a0, 0xd9a577, 0x8d5a3b];
const OUTFITS = [0xe04a3a, 0x2f7fd8, 0x3ab56a, 0xf5c542, 0x8a4fd0, 0x2a2a2a];

// ---------- общие материалы ----------
const _M = {
  glass: new THREE.MeshPhysicalMaterial({ color: 0x0b1620, roughness: 0.04, metalness: 0.9, transparent: true, opacity: 0.72, clearcoat: 1 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x0f1115, roughness: 0.5, metalness: 0.4 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.85 }),
  rim: new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.25, metalness: 0.95 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.15, metalness: 1 }),
  head: new THREE.MeshBasicMaterial({ color: 0xfff3c8 })
};
const _glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d');
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c);
})();

// профиль сбоку -> выдавливание по ширине (z модели = вперёд)
function _sideGeo(shape, width, bs, bt) {
  bs = bs === undefined ? 0.07 : bs; bt = bt === undefined ? 0.09 : bt;
  const depth = Math.max(0.05, width - 2 * bt);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bs, bevelThickness: bt, bevelSegments: 3, curveSegments: 10 });
  g.rotateY(-Math.PI / 2); g.translate(depth / 2, 0, 0); return g;
}
function _poly(pts) { const s = new THREE.Shape(); pts.forEach(([a, b], i) => i ? s.lineTo(a, b) : s.moveTo(a, b)); s.closePath(); return s; }

function makeCarModel(def, colOverride) {
  const S = SHAPES[def.shape], g = new THREE.Group(), h = S.l / 2, y0 = 0.22;
  const body = new THREE.MeshPhysicalMaterial({ color: colOverride || def.col, roughness: 0.32, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.08 });
  const add = (geo, mat, x, y, z, sh) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = !!sh; g.add(m); return m; };

  // нижняя часть кузова
  const lo = new THREE.Shape();
  lo.moveTo(-h + 0.15, y0); lo.lineTo(h - 0.15, y0); lo.quadraticCurveTo(h, y0, h, y0 + 0.12); lo.lineTo(h, S.nose);
  lo.bezierCurveTo(h - 0.1, S.nose + (S.belt - S.nose) * 0.35, S.wb + (h - S.wb) * 0.6, S.belt - 0.04, S.wb, S.belt);
  lo.lineTo(S.rb, S.belt); lo.lineTo(-h + 0.35, S.tail); lo.quadraticCurveTo(-h, S.tail, -h, S.tail - 0.15);
  lo.lineTo(-h, y0 + 0.12); lo.quadraticCurveTo(-h, y0, -h + 0.15, y0);
  add(_sideGeo(lo, S.w), body, 0, 0, 0, true);

  // салон (зауженный) + стёкла + крыша
  const cw = S.w * 0.84, bl = S.belt - 0.02;
  const cab = new THREE.Shape();
  cab.moveTo(S.wb, bl); cab.lineTo(S.wt + 0.08, S.roof - 0.04); cab.quadraticCurveTo(S.wt, S.roof, S.wt - 0.1, S.roof);
  cab.lineTo(S.rt + 0.12, S.roof); cab.quadraticCurveTo(S.rt, S.roof, S.rt - 0.1, S.roof - 0.05); cab.lineTo(S.rb, bl); cab.closePath();
  add(_sideGeo(cab, cw, 0.03, 0.05), body, 0, 0, 0, true);
  const dz = S.wt - S.wb, rz = S.rt - S.rb, dh = S.roof - S.belt;
  // боковые стёкла
  add(_sideGeo(_poly([[S.wb - 0.22, S.belt + 0.04], [S.wt + 0.17, S.roof - 0.1], [S.rt - 0.04, S.roof - 0.1], [S.rb + 0.24, S.belt + 0.04]]), cw + 0.05, 0.0, 0.0), _M.glass, 0, 0, 0, false);
  // лобовое и заднее
  const fw = (a, bb, off, t) => _poly([[a[0] + off, a[1]], [bb[0] + off, bb[1]], [bb[0] + off + t, bb[1]], [a[0] + off + t, a[1]]]);
  add(_sideGeo(fw([S.wb + dz * 0.1 + 0.02, S.belt + dh * 0.1], [S.wb + dz * 0.92 + 0.02, S.belt + dh * 0.92], 0.02, -0.06), cw - 0.24, 0, 0.0), _M.glass, 0, 0, 0, false);
  add(_sideGeo(fw([S.rb + rz * 0.1 - 0.02, S.belt + dh * 0.1], [S.rb + rz * 0.9 - 0.02, S.belt + dh * 0.9], -0.02, 0.06), cw - 0.24, 0, 0.0), _M.glass, 0, 0, 0, false);
  // стойка B
  add(new THREE.BoxGeometry(cw + 0.06, dh - 0.12, 0.07), body, 0, S.belt + dh / 2 - 0.02, (S.wt + S.rt) / 2 - 0.05);

  // колёса, арки
  const wheels = [], R = S.R;
  const tireG = new THREE.CylinderGeometry(R, R, 0.32, 20), rimG = new THREE.CylinderGeometry(R * 0.66, R * 0.66, 0.34, 16), hubG = new THREE.CylinderGeometry(0.06, 0.06, 0.36, 8);
  const archG = new THREE.CylinderGeometry(R + 0.1, R + 0.1, 0.05, 20);
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => {
    const wz = sz * (h - 0.95), wx = sx * (S.w / 2 - 0.14);
    const arch = add(archG, _M.dark, sx * (S.w / 2 + 0.01), R, wz, false); arch.rotation.z = Math.PI / 2;
    const piv = new THREE.Group(); piv.position.set(wx, R, wz);
    const t = new THREE.Mesh(tireG, _M.tire); t.rotation.z = Math.PI / 2; t.castShadow = true; piv.add(t);
    const r = new THREE.Mesh(rimG, _M.rim); r.rotation.z = Math.PI / 2; piv.add(r);
    const hb = new THREE.Mesh(hubG, _M.dark); hb.rotation.z = Math.PI / 2; piv.add(hb);
    for (let k = 0; k < 5; k++) { // спицы
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.36, R * 1.1, 0.05), _M.dark); sp.rotation.x = k * Math.PI * 2 / 5; piv.add(sp);
    }
    g.add(piv); wheels.push(piv);
  });

  // свет
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xaa1010 });
  add(new THREE.BoxGeometry(S.w * 0.8, 0.1, 0.05), tailMat, 0, S.tail - 0.1, -h - 0.09, false);
  if (def.shape === 'retro') {
    [-0.62, 0.62].forEach(x => {
      const l = add(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 14), _M.head, x, S.nose + 0.02, h + 0.08, false); l.rotation.x = Math.PI / 2;
      const ring = add(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 14), _M.chrome, x, S.nose + 0.02, h + 0.06, false); ring.rotation.x = Math.PI / 2;
    });
    add(new THREE.BoxGeometry(S.w + 0.05, 0.14, 0.14), _M.chrome, 0, y0 + 0.24, h + 0.1, false);
    add(new THREE.BoxGeometry(S.w + 0.05, 0.14, 0.14), _M.chrome, 0, y0 + 0.24, -h - 0.1, false);
    add(new THREE.BoxGeometry(S.w * 0.5, 0.16, 0.05), _M.chrome, 0, S.nose - 0.12, h + 0.09, false);
  } else {
    [-1, 1].forEach(sx => add(new THREE.BoxGeometry(0.5, 0.07, 0.05), _M.head, sx * S.w * 0.3, S.nose - 0.02, h + 0.085, false));
    add(new THREE.BoxGeometry(S.w * 0.5, 0.1, 0.05), _M.dark, 0, S.nose - 0.14, h + 0.085, false);
    add(new THREE.BoxGeometry(S.w * 0.95, 0.04, 0.4), _M.dark, 0, y0 + 0.02, h - 0.1, false);   // сплиттер
    add(new THREE.BoxGeometry(S.w * 0.8, 0.12, 0.3), _M.dark, 0, y0 + 0.08, -h + 0.1, false);   // диффузор
  }
  [-0.45, 0.45].forEach(x => { const e = add(new THREE.CylinderGeometry(0.065, 0.065, 0.25, 10), _M.chrome, x, y0 + 0.12, -h - 0.06, false); e.rotation.x = Math.PI / 2; });
  // зеркала, ручки, пороги, воздухозаборники
  [-1, 1].forEach(sx => {
    add(new THREE.BoxGeometry(0.14, 0.1, 0.2), body, sx * (cw / 2 + 0.1), S.belt + 0.1, S.wb - 0.2, true);
    add(new THREE.BoxGeometry(0.03, 0.03, 0.22), _M.chrome, sx * (S.w / 2 + 0.07), S.belt - 0.12, (S.wb + S.rb) / 2 + 0.2, false);
    if (S.sp) add(new THREE.BoxGeometry(0.05, 0.1, S.l * 0.32), _M.dark, sx * (S.w / 2 + 0.05), y0 + 0.1, 0, false);
    if (S.sp >= 2) add(new THREE.BoxGeometry(0.06, 0.2, 0.55), _M.dark, sx * (S.w / 2 + 0.04), S.belt - 0.2, S.rb - 0.1, false);
  });
  // антикрыло
  if (S.sp) {
    const wy = S.tail + 0.2 + S.sp * 0.1, wz = -h + 0.4;
    add(new THREE.BoxGeometry(S.w * 0.92, 0.05, 0.5), S.sp >= 2 ? _M.dark : body, 0, wy, wz, true);
    [-1, 1].forEach(sx => add(new THREE.BoxGeometry(0.06, wy - S.tail + 0.04, 0.2), _M.dark, sx * S.w * 0.3, (wy + S.tail) / 2, wz, false));
  }
  // блики фар и стопов
  const hm = new THREE.SpriteMaterial({ map: _glowTex, color: 0xfff0c0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 });
  [-1, 1].forEach(sx => { const sp = new THREE.Sprite(hm); sp.scale.set(1.3, 1.3, 1); sp.position.set(sx * S.w * 0.3, S.nose, h + 0.3); g.add(sp); });
  const tm = new THREE.SpriteMaterial({ map: _glowTex, color: 0xff2020, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.6 });
  const ts = new THREE.Sprite(tm); ts.scale.set(2.6, 1, 1); ts.position.set(0, S.tail - 0.1, -h - 0.3); g.add(ts);

  // пламя нитро
  const flame = new THREE.Group();
  const fm = new THREE.MeshBasicMaterial({ color: 0xff8a20, transparent: true, opacity: 0.85 });
  const fm2 = new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.9 });
  [-0.45, 0.45].forEach(x => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 2.4, 8), fm); c.rotation.x = -Math.PI / 2; c.position.set(x, y0 + 0.12, -h - 1.3); flame.add(c);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.11, 1.4, 8), fm2); c2.rotation.x = -Math.PI / 2; c2.position.set(x, y0 + 0.12, -h - 0.8); flame.add(c2);
  });
  flame.visible = false; g.add(flame);

  g.userData = { wheels, tailMat, flame, len: S.l, S, driver: null };
  return g;
}

// ---------- персонажи ----------
function makeCharacter(gender, outfit, skinIdx, bust) {
  const g = new THREE.Group(), M = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
  const skin = M(SKINS[skinIdx] || SKINS[0]), shirt = M(OUTFITS[outfit] || OUTFITS[0]), jeans = M(0x2a3550), shoe = M(0x1e1e1e);
  const hair = M(gender === 'girl' ? 0x6a3a1a : 0x2a1c12), dark = M(0x111111);
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  add(new THREE.CylinderGeometry(0.24, 0.2, 0.62, 12), shirt, 0, 1.1, 0);
  add(new THREE.SphereGeometry(0.245, 12, 8), shirt, 0, 1.4, 0).scale.set(1, 0.45, 0.7);
  [-1, 1].forEach(s => {
    const a = add(new THREE.CylinderGeometry(0.065, 0.06, 0.58, 8), shirt, s * 0.32, 1.1, 0); a.rotation.z = s * 0.1;
    add(new THREE.SphereGeometry(0.065, 8, 6), skin, s * 0.35, 0.8, 0);
  });
  add(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8), skin, 0, 1.5, 0);
  add(new THREE.SphereGeometry(0.17, 16, 12), skin, 0, 1.67, 0);
  [-1, 1].forEach(s => add(new THREE.SphereGeometry(0.022, 6, 6), dark, s * 0.065, 1.69, 0.155));
  const cap = add(new THREE.SphereGeometry(0.185, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 1.68, -0.01);
  if (gender === 'girl') {
    add(new THREE.BoxGeometry(0.33, 0.34, 0.08), hair, 0, 1.55, -0.14);
    add(new THREE.SphereGeometry(0.07, 8, 8), hair, 0.0, 1.78, -0.2);
    add(new THREE.CylinderGeometry(0.04, 0.02, 0.35, 8), hair, 0, 1.58, -0.24).rotation.x = 0.15;
    add(new THREE.TorusGeometry(0.18, 0.018, 6, 16), M(OUTFITS[(outfit + 2) % 6]), 0, 1.74, 0).rotation.x = Math.PI / 2 - 0.2;
  } else cap.rotation.x = -0.15;
  if (!bust) {
    if (gender === 'girl') add(new THREE.CylinderGeometry(0.2, 0.32, 0.28, 14), M(OUTFITS[(outfit + 3) % 6]), 0, 0.72, 0);
    [-1, 1].forEach(s => {
      add(new THREE.CylinderGeometry(0.085, 0.075, gender === 'girl' ? 0.55 : 0.72, 8), gender === 'girl' ? skin : jeans, s * 0.11, gender === 'girl' ? 0.38 : 0.4, 0);
      add(new THREE.BoxGeometry(0.14, 0.09, 0.26), shoe, s * 0.11, 0.045, 0.05);
    });
  }
  return g;
}
function makeDriver(gender, outfit, skinIdx) {
  const d = makeCharacter(gender, outfit, skinIdx, true); d.scale.setScalar(0.62); return d;
}
// посадить водителя в машину (виден через стёкла)
function seatDriver(car, gender, outfit, skinIdx) {
  const u = car.userData, S = u.S;
  if (u.driver) car.remove(u.driver);
  const d = makeDriver(gender, outfit, skinIdx);
  d.position.set(0.42, S.roof - 0.2 - 1.67 * 0.62, (S.wt + S.rt) / 2 - 0.12);
  car.add(d); u.driver = d;
}
