// Звук: двигатель, ветер, визг шин, ambience по локациям, музыка и эффекты. Всё синтезируется, внешних файлов нет.
const Snd = (() => {
  let ctx, master, sfx, mus, amb, eng, eng2, engF, engG, turboO, turboG, wind, sq, am, nbuf, timer = null, step = 0, mode = 'off', theme = 0, evT = 6, tAcc = 0;
  const cfg = { snd: 1, mus: 1 };

  const noiseBuf = sec => { const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
  function loopNoise(type, freq, q) {
    const s = ctx.createBufferSource(); s.buffer = nbuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); s.start(); return { f, g };
  }
  function apply() {
    if (!ctx) return;
    master.gain.value = 0.85; sfx.gain.value = cfg.snd ? 1 : 0; amb.gain.value = cfg.snd ? 1 : 0; mus.gain.value = cfg.mus ? 0.5 : 0;
  }
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; return; }
    master = ctx.createGain(); master.connect(ctx.destination);
    sfx = ctx.createGain(); mus = ctx.createGain(); amb = ctx.createGain(); [sfx, mus, amb].forEach(n => n.connect(master));
    nbuf = noiseBuf(2);
    eng = ctx.createOscillator(); eng.type = 'sawtooth'; eng2 = ctx.createOscillator(); eng2.type = 'square';
    engF = ctx.createBiquadFilter(); engF.type = 'lowpass'; engF.frequency.value = 500;
    engG = ctx.createGain(); engG.gain.value = 0;
    eng.connect(engF); eng2.connect(engF); engF.connect(engG); engG.connect(sfx); eng.start(); eng2.start();
    turboO = ctx.createOscillator(); turboO.type = 'sine'; turboG = ctx.createGain(); turboG.gain.value = 0; turboO.connect(turboG); turboG.connect(sfx); turboO.start();
    wind = loopNoise('bandpass', 700, 0.6); wind.g.connect(sfx);
    sq = loopNoise('bandpass', 1900, 4); sq.g.connect(sfx);
    am = loopNoise('lowpass', 400); am.g.connect(amb);
    apply(); setTheme(theme);
    const m0 = mode; mode = 'off'; music(m0);
  }
  function setCfg(snd, music) { cfg.snd = snd ? 1 : 0; cfg.mus = music ? 1 : 0; apply(); }
  const T = () => ctx.currentTime;
  const smooth = (p, v, k) => p.setTargetAtTime(v, T(), k || 0.06);

  // двигатель и шум, вызывается каждый кадр
  function update(o) { // {speed01, boost, slip, racing}
    if (!ctx) return;
    const s = o.speed01, r = o.racing;
    smooth(eng.frequency, 38 + s * 120 + (o.boost ? 20 : 0));
    smooth(eng2.frequency, 19 + s * 60);
    smooth(engF.frequency, 260 + s * 1000 + (o.boost ? 500 : 0));
    smooth(engG.gain, r ? 0.05 + s * 0.02 + (o.boost ? 0.03 : 0) : 0.0);
    smooth(turboO.frequency, 1400 + s * 900); smooth(turboG.gain, r && o.boost ? 0.02 : 0, 0.1);
    smooth(wind.g.gain, r ? s * 0.16 : 0); smooth(wind.f.frequency, 500 + s * 1600);
    smooth(sq.g.gain, r ? Math.min(0.12, o.slip) : 0, 0.04);
  }
  function idle() { if (ctx) { smooth(engG.gain, 0, 0.1); smooth(wind.g.gain, 0, 0.1); smooth(sq.g.gain, 0, 0.1); smooth(turboG.gain, 0, 0.1); } }

  // ---- эффекты ----
  function beep(f, d, type, v) {
    if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain(), t = T();
    o.type = type || 'square'; o.frequency.value = f; g.gain.setValueAtTime(v || 0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(sfx); o.start(t); o.stop(t + d + 0.02);
  }
  function sweep(f1, f2, d, type, v, dest) {
    if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain(), t = T();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(v || 0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(g); g.connect(dest || sfx); o.start(t); o.stop(t + d + 0.02);
  }
  function noise(v, lp, d) {
    if (!ctx) return; const s = ctx.createBufferSource(); s.buffer = nbuf; const f = ctx.createBiquadFilter(), g = ctx.createGain(), t = T();
    f.type = 'lowpass'; f.frequency.value = lp; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.connect(f); f.connect(g); g.connect(sfx); s.start(t, Math.random()); s.stop(t + d);
  }
  const bump = v => { noise(v || 0.25, 1800, 0.18); sweep(120, 45, 0.15, 'sine', 0.3); };
  const crash = () => { noise(0.45, 3000, 0.4); sweep(160, 40, 0.3, 'sawtooth', 0.2); };
  const coin = () => { beep(1318, 0.07, 'sine', 0.07); setTimeout(() => beep(1760, 0.14, 'sine', 0.07), 70); };
  const pickup = () => { sweep(400, 1200, 0.25, 'triangle', 0.07); };
  const oil = () => { sweep(900, 150, 0.5, 'sawtooth', 0.05); noise(0.12, 900, 0.5); };
  const jump = () => { sweep(200, 700, 0.35, 'triangle', 0.08); noise(0.1, 4000, 0.3); };
  const land = () => { bump(0.2); };
  const nitro = () => { noise(0.18, 5000, 0.5); sweep(300, 900, 0.5, 'sawtooth', 0.04); };
  const click = () => beep(700, 0.04, 'square', 0.04);
  const countdown = go => beep(go ? 1046 : 523, go ? 0.5 : 0.2, 'square', 0.09);
  const fanfare = () => [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => beep(f, 0.3, 'square', 0.07), i * 120));
  const lose = () => [392, 349, 311, 262].forEach((f, i) => setTimeout(() => beep(f, 0.3, 'triangle', 0.08), i * 160));
  const lap = () => { beep(880, 0.1, 'sine', 0.08); setTimeout(() => beep(1175, 0.2, 'sine', 0.08), 100); };

  // ---- ambience ----
  function setTheme(t) {
    theme = t; if (!ctx) return;
    const cfgT = [[300, 0.07], [450, 0.09], [900, 0.05]][t] || [300, 0.07];
    smooth(am.f.frequency, cfgT[0], 0.2);
  }
  function events() {
    if (theme === 0) { if (Math.random() < 0.5) { sweep(650, 900, 1.5, 'sine', 0.012, amb); setTimeout(() => sweep(900, 650, 1.5, 'sine', 0.012, amb), 1500); } else sweep(300, 150, 0.4, 'square', 0.008, amb); }
    else if (theme === 1) { beep(420, 0.35, 'square', 0.015); setTimeout(() => beep(520, 0.3, 'square', 0.015), 40); }
    else { sweep(2000, 1300, 0.25, 'sine', 0.02, amb); setTimeout(() => sweep(1900, 1200, 0.25, 'sine', 0.02, amb), 320); }
  }
  function ambTick(dt, on) {
    if (!ctx) return; tAcc += dt;
    smooth(am.g.gain, on ? (theme === 2 ? 0.06 + 0.04 * Math.sin(tAcc * 0.5) : theme === 1 ? 0.09 : 0.07) : 0, 0.3);
    evT -= dt; if (evT <= 0) { evT = 8 + Math.random() * 14; if (on) events(); }
  }

  // ---- музыка ----
  const BASS = [55, 0, 55, 0, 65.4, 0, 55, 0, 73.4, 0, 73.4, 0, 82.4, 0, 65.4, 0];
  const ARP = [220, 262, 330, 440, 330, 262, 220, 262, 247, 294, 370, 494, 370, 294, 247, 294];
  function note(f, t, d, type, v) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + d); o.connect(g); g.connect(mus); o.start(t); o.stop(t + d + 0.02);
  }
  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(g); g.connect(mus); o.start(t); o.stop(t + 0.22);
  }
  function hat(t) {
    const s = ctx.createBufferSource(); s.buffer = nbuf; const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    s.connect(f); f.connect(g); g.connect(mus); s.start(t, Math.random()); s.stop(t + 0.05);
  }
  function mtick() {
    if (!ctx || mode === 'off' || !cfg.mus) return;
    const t = T() + 0.05, s = step % 16, race = mode === 'race';
    if (race ? s % 4 === 0 : s % 8 === 0) kick(t);
    if (race && s % 2 === 0) hat(t);
    if (BASS[s]) note(BASS[s], t, race ? 0.16 : 0.3, 'sawtooth', race ? 0.16 : 0.1);
    if (race || s % 2 === 0) note(ARP[s], t, 0.12, 'square', race ? 0.03 : 0.015);
    step++;
  }
  function music(m) {
    if (m === mode) return; mode = m; clearInterval(timer); timer = null;
    if (m === 'off' || !ctx) return;
    timer = setInterval(mtick, 60000 / (m === 'race' ? 138 : 92) / 4);
  }

  return { init, setCfg, update, idle, beep, bump, crash, coin, pickup, oil, jump, land, nitro, click, countdown, fanfare, lose, lap, setTheme, ambTick, music };
})();
