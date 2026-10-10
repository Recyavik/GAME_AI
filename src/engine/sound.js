// Звуки, синтезированные WebAudio (никаких файлов — работает офлайн).
let ac = null;
let master = null;
let enabled = true;
let scale = 1; // громкость текущего звука (тише для фоновых)

function audio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.35;
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function tone(freq, dur, { type = 'sine', vol = 0.5, at = 0, slide = 0, attack = 0.006 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol * scale, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, { vol = 0.3, at = 0, freq = 1200, q = 1 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const len = Math.ceil(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.value = vol * scale;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

const SOUNDS = {
  // Сканирование лица/пропуска: мягкая «развёртка» вверх-вниз.
  scan: () => {
    tone(700, 0.45, { slide: 2.2, vol: 0.12, attack: 0.05 });
    tone(1500, 0.45, { slide: 0.45, vol: 0.1, at: 0.45, attack: 0.05 });
    tone(1046, 0.12, { type: 'triangle', vol: 0.14, at: 0.95 });
  },
  // Створки шлюза: пневматическое «пшш» и мягкий стук.
  door: () => {
    noise(0.55, { vol: 0.22, freq: 700, q: 0.5 });
    tone(110, 0.18, { vol: 0.22, at: 0.5, slide: 0.7 });
  },
  // «Голос» ИИ: три коротких мягких электронных ноты.
  ai: () => {
    const base = 880 + Math.random() * 220;
    [1, 1.25, 1.5].forEach((m, i) => tone(base * (i === 1 && Math.random() < 0.5 ? 1.12 : m), 0.08, { type: 'sine', vol: 0.12, at: i * 0.07 }));
  },
  // Сигнал робота-доставщика.
  chime: () => { tone(1318, 0.18, { vol: 0.14 }); tone(1046, 0.25, { vol: 0.12, at: 0.15 }); },
  click: () => tone(660, 0.07, { type: 'triangle', vol: 0.3 }),
  good: () => {
    tone(523, 0.14, { type: 'triangle' });
    tone(659, 0.14, { type: 'triangle', at: 0.09 });
    tone(784, 0.26, { type: 'triangle', at: 0.18 });
  },
  bad: () => {
    tone(240, 0.18, { type: 'square', vol: 0.12, slide: 0.7 });
    tone(190, 0.26, { type: 'square', vol: 0.1, at: 0.12, slide: 0.7 });
  },
  star: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.28, { vol: 0.22, at: i * 0.06 })),
  whoosh: () => noise(0.35, { vol: 0.3, freq: 900, q: 0.7 }),
  step: () => noise(0.05, { vol: 0.05, freq: 380, q: 2 }),
  blip: () => tone(880, 0.03, { type: 'square', vol: 0.025 }),
  open: () => tone(440, 0.14, { slide: 1.6, vol: 0.25 }),
  fanfare: () =>
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.32, { type: 'triangle', vol: 0.28, at: i * 0.13 })),
  pop: () => tone(300, 0.08, { slide: 2.5, vol: 0.25 }),
  // Щит — «звон металла».
  shield: () => {
    [880, 1320, 1760, 2640].forEach((f, i) => tone(f, 0.9 - i * 0.15, { type: 'triangle', vol: 0.16, at: i * 0.01 }));
    tone(660, 0.5, { type: 'sine', vol: 0.18, at: 0.12 });
  },
  paper: () => { noise(0.12, { vol: 0.25, freq: 3000, q: 0.6 }); noise(0.1, { vol: 0.18, freq: 2200, q: 0.6, at: 0.09 }); },
  ding: () => tone(1318, 0.5, { vol: 0.25 }),
  fanfareShort: () => [784, 988, 1175].forEach((f, i) => tone(f, 0.28, { type: 'triangle', vol: 0.25, at: i * 0.1 })),
  // Мелодия входящего звонка (один такт).
  ring: () => [988, 784, 988, 784, 988, 1175].forEach((f, i) => tone(f, 0.13, { type: 'square', vol: 0.07, at: i * 0.14 })),
  applause: () => { for (let i = 0; i < 26; i++) noise(0.05, { vol: 0.12 + Math.random() * 0.1, freq: 1500 + Math.random() * 2500, q: 0.8, at: i * 0.045 + Math.random() * 0.03 }); },
  shutter: () => { noise(0.05, { vol: 0.35, freq: 4000 }); noise(0.07, { vol: 0.25, freq: 1800, at: 0.07 }); },
  beep: () => tone(1046, 0.12, { type: 'square', vol: 0.1 }),
};

// ---------- Постоянный фоновый гул (робот-уборщик, тележки) ----------
// kind: 'brush' — щётки и тихий мотор; 'motor' — электромотор тележки. Громкость задаётся снаружи (по расстоянию).
function makeLoop(kind) {
  const a = audio();
  if (!a) return { set() {}, stop() {} };
  const out = a.createGain();
  out.gain.value = 0;
  out.connect(master);
  const nodes = [];
  // Шум (щётки / шины).
  const len = a.sampleRate * 2;
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf; src.loop = true;
  const f = a.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = kind === 'brush' ? 900 : 500;
  const ng = a.createGain(); ng.gain.value = kind === 'brush' ? 0.5 : 0.25;
  src.connect(f).connect(ng).connect(out);
  // Мотор.
  const o = a.createOscillator();
  o.type = kind === 'brush' ? 'triangle' : 'sawtooth';
  o.frequency.value = kind === 'brush' ? 95 : 160;
  const of = a.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = kind === 'brush' ? 400 : 700;
  const og = a.createGain(); og.gain.value = kind === 'brush' ? 0.35 : 0.3;
  o.connect(of).connect(og).connect(out);
  // Лёгкое «плавание» оборотов.
  const lfo = a.createOscillator(); lfo.frequency.value = kind === 'brush' ? 3 : 0.7;
  const lg = a.createGain(); lg.gain.value = kind === 'brush' ? 6 : 10;
  lfo.connect(lg).connect(o.frequency);
  for (const n of [src, o, lfo]) { n.start(); nodes.push(n); }
  let cur = 0;
  return {
    // v — 0..1; итог не громче 0.06 (фон не должен мешать).
    set(v) {
      const target = enabled ? Math.max(0, Math.min(1, v)) * 0.06 : 0;
      if (Math.abs(target - cur) < 0.002) return;
      cur = target;
      out.gain.setTargetAtTime(target, a.currentTime, 0.15);
    },
    stop() { nodes.forEach((n) => { try { n.stop(); } catch { /* уже остановлен */ } }); out.disconnect(); },
  };
}

// ---------- Записанные голоса ----------
const clipCache = new Map();
async function decode(url) {
  if (!clipCache.has(url)) {
    clipCache.set(url, fetch(url).then((r) => r.arrayBuffer()).then((b) => new Promise((res, rej) => audio().decodeAudioData(b, res, rej))));
  }
  return clipCache.get(url);
}
let currentClip = null;
let clipGen = 0; // растёт при каждой остановке: запись, которая ещё декодировалась, уже не начнётся
// Проиграть запись. bed — запись фона (шум столовой, перемены): фон начинается первым,
// голос звучит внутри него через lead секунд, фон затихает через tail секунд после фразы.
// Возвращает Promise<boolean> (конец записи; false — запись не загрузилась).
async function playClip(url, { bed = null, bedVol = 0.5, lead = 1.0, tail = 0.8, vol = 1 } = {}) {
  const a = audio();
  if (!a || !url) return false;
  stopClip();
  const gen = clipGen;
  let buf, bedBuf = null;
  try {
    buf = await decode(url);
    if (bed) bedBuf = await decode(bed);
  } catch { return false; }
  if (gen !== clipGen) return true; // пока декодировали, звук остановили (окно закрыто) — молча выходим
  const on = enabled ? 1 : 0;
  const t0 = a.currentTime + 0.05;
  const src = a.createBufferSource();
  src.buffer = buf;
  const g = a.createGain();
  g.gain.value = on * vol * 2.4; // голос громче интерфейса (master 0.35)
  src.connect(g).connect(master);
  const extra = [];
  let start = t0, end = t0 + buf.duration;
  if (bedBuf) {
    start = t0 + lead;
    end = start + buf.duration + tail;
    const ns = a.createBufferSource();
    ns.buffer = bedBuf;
    ns.loop = bedBuf.duration < end - t0; // короткий фон — по кругу
    const ng = a.createGain();
    const level = on * bedVol * 2.4;
    ng.gain.setValueAtTime(0, t0);
    ng.gain.linearRampToValueAtTime(level, t0 + 0.3);
    ng.gain.setValueAtTime(level, end - 0.4);
    ng.gain.linearRampToValueAtTime(0, end);
    ns.connect(ng).connect(master);
    ns.start(t0);
    ns.stop(end + 0.05);
    extra.push(ns);
  }
  src.start(start);
  currentClip = { src, extra };
  const last = extra[0] || src;
  return new Promise((res) => {
    last.onended = () => { if (currentClip?.src === src) currentClip = null; res(true); };
  });
}
function stopClip() {
  clipGen++;
  if (!currentClip) return;
  const c = currentClip; currentClip = null;
  for (const n of [c.src, ...c.extra]) { try { n.stop(); } catch { /* */ } }
}

export const sound = {
  get on() { return enabled; },
  toggle() { enabled = !enabled; if (!enabled) stopClip(); return enabled; },
  unlock() { audio(); },
  // vol — множитель громкости (фоновые звуки мира — 0.3–0.5).
  play(name, vol = 1) {
    if (!enabled) return;
    scale = vol;
    try { SOUNDS[name]?.(); } catch { /* звук не критичен */ }
    scale = 1;
  },
  loop: makeLoop,
  clip: playClip,
  stopClip,
};
