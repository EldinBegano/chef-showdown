let ctx = null;
let master = null;
let enabled = true;

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', vol = 0.5, slide = 0, delay = 0 } = {}) {
  if (!enabled) return;
  const c = ensure();
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur, { vol = 0.3, freq = 2000, delay = 0 } = {}) {
  if (!enabled) return;
  const c = ensure();
  const t0 = c.currentTime + delay;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  get enabled() {
    return enabled;
  },
  set enabled(v) {
    enabled = v;
    if (v) startMusic();
    else stopMusic();
  },
  unlock() {
    if (!enabled) return;
    ensure();
    if (bgm.name && !bgm.timer) startMusic();
  },
  click: () => tone(660, 0.07, { type: 'triangle', vol: 0.3 }),
  pickup: () => tone(520, 0.1, { type: 'triangle', slide: 300, vol: 0.4 }),
  add: () => {
    tone(700, 0.08, { type: 'square', vol: 0.12 });
    tone(1050, 0.1, { type: 'triangle', vol: 0.3, delay: 0.05 });
  },
  chop: () => noise(0.05, { vol: 0.35, freq: 3500 }),
  pour: () => noise(0.12, { vol: 0.12, freq: 900 }),
  start: () => {
    tone(300, 0.12, { type: 'triangle', vol: 0.3 });
    tone(450, 0.12, { type: 'triangle', vol: 0.3, delay: 0.08 });
  },
  ready: () => {
    tone(880, 0.12, { type: 'sine', vol: 0.35 });
    tone(1320, 0.18, { type: 'sine', vol: 0.3, delay: 0.1 });
  },
  cash: () => {
    tone(1200, 0.08, { type: 'square', vol: 0.12 });
    tone(1600, 0.25, { type: 'triangle', vol: 0.35, delay: 0.07 });
    noise(0.08, { vol: 0.15, freq: 6000, delay: 0.02 });
  },
  partial: () => tone(900, 0.1, { type: 'triangle', vol: 0.3 }),
  wrong: () => tone(180, 0.25, { type: 'sawtooth', vol: 0.18, slide: -60 }),
  trash: () => noise(0.18, { vol: 0.3, freq: 600 }),
  angry: () => {
    tone(260, 0.2, { type: 'sawtooth', vol: 0.15, slide: -80 });
    tone(200, 0.3, { type: 'sawtooth', vol: 0.15, slide: -80, delay: 0.18 });
  },
  arrive: () => tone(740, 0.08, { type: 'sine', vol: 0.2, slide: 200 }),
  rush: () => {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, { type: 'square', vol: 0.1, delay: i * 0.06 }));
    noise(0.35, { vol: 0.12, freq: 1200, delay: 0.05 });
  },
  count: () => tone(520, 0.15, { type: 'square', vol: 0.15 }),
  go: () => {
    tone(780, 0.12, { type: 'square', vol: 0.15 });
    tone(1040, 0.3, { type: 'square', vol: 0.15, delay: 0.1 });
  },
  unlockDish: () => [660, 880, 1100].forEach((f, i) => tone(f, 0.15, { type: 'triangle', vol: 0.3, delay: i * 0.09 })),
  end: () => [784, 659, 523, 392].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.3, delay: i * 0.15 })),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.3, delay: i * 0.12 })),
};

/* ---------- background music ---------- */

const MUSIC_VOL = 0.55;
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const HIRAJOSHI = [0, 2, 3, 7, 8];
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// Step-sequenced themes. Degrees index into `scale` (wrapping into higher octaves);
// bass/arp/stab degrees are relative to the bar's chord root from `prog`, lead degrees are absolute.
const TRACKS = {
  lobby: {
    bpm: 96, steps: 16, root: 60, scale: MAJOR, prog: [0, 5, 3, 4],
    bass: { at: [0, 8, 12], deg: [0, 0, 4], oct: -2, type: 'triangle', vol: 0.3, len: 4 },
    arp: { every: 2, pattern: [0, 2, 4, 7, 9, 7, 4, 2], oct: 0, type: 'triangle', vol: 0.06 },
    drums: { k: 'x.......x.......', h: '....o.......o...' },
    lead: {
      type: 'sine', vol: 0.12, oct: 1,
      bars: [
        [[0, 4, 3], [3, 2, 1], [4, 4, 2], [6, 7, 2], [8, 6, 4], [12, 4, 4]],
        [[0, 5, 4], [4, 4, 2], [6, 2, 2], [8, 0, 6], [14, 2, 2]],
        [[0, 3, 3], [3, 5, 1], [4, 7, 4], [8, 8, 2], [10, 7, 2], [12, 5, 4]],
        [[0, 6, 4], [4, 4, 2], [6, 1, 2], [8, 4, 8]],
      ],
    },
  },
  diner: {
    bpm: 124, steps: 16, root: 60, scale: MAJOR, prog: [0, 4, 5, 3],
    bass: { at: [0, 2, 4, 6, 8, 10, 12, 14], deg: [0, 7, 0, 7, 0, 7, 0, 7], oct: -2, type: 'square', vol: 0.12, cutoff: 900, len: 1.6 },
    stab: { at: [2, 6, 10, 14], oct: 0, type: 'square', vol: 0.03, cutoff: 2400, len: 1.2 },
    drums: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' },
    lead: {
      type: 'square', vol: 0.045, oct: 1, cutoff: 3000,
      bars: [
        [[0, 7, 2], [2, 7, 2], [4, 9, 2], [6, 7, 2], [8, 4, 4], [12, 2, 2], [14, 4, 2]],
        [[0, 6, 2], [2, 6, 2], [4, 8, 2], [6, 6, 2], [8, 4, 4], [12, 1, 4]],
        [[0, 5, 2], [2, 7, 2], [4, 9, 2], [6, 11, 2], [8, 9, 4], [12, 7, 4]],
        [[0, 8, 2], [2, 7, 2], [4, 5, 2], [6, 3, 2], [8, 4, 6], [14, 2, 2]],
      ],
    },
  },
  happy: {
    bpm: 116, steps: 16, root: 65, scale: MAJOR, prog: [0, 5, 1, 4],
    bass: { at: [0, 3, 6, 8, 11, 14], deg: [0, 0, 4, 0, 0, 4], oct: -2, type: 'triangle', vol: 0.3, len: 2 },
    stab: { at: [4, 12], oct: 0, type: 'triangle', vol: 0.05, len: 2 },
    drums: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    lead: {
      type: 'triangle', vol: 0.12, oct: 1,
      bars: [
        [[0, 4, 3], [3, 5, 1], [4, 4, 2], [6, 2, 2], [8, 0, 4], [12, 2, 4]],
        [[0, 5, 3], [3, 4, 1], [4, 5, 2], [6, 7, 2], [8, 9, 6], [14, 7, 2]],
        [[0, 8, 3], [3, 7, 1], [4, 5, 2], [6, 3, 2], [8, 1, 4], [12, 3, 4]],
        [[0, 4, 4], [4, 6, 2], [6, 8, 2], [8, 11, 4], [12, 9, 4]],
      ],
    },
  },
  sushi: {
    bpm: 108, steps: 16, root: 62, scale: HIRAJOSHI, prog: [0, 0, 3, 2],
    bass: { at: [0, 6, 8, 14], deg: [0, 3, 0, 3], oct: -2, type: 'triangle', vol: 0.28, len: 3 },
    arp: { every: 2, pattern: [0, 3, 5, 3, 6, 3, 5, 3], oct: 0, type: 'triangle', vol: 0.055 },
    drums: { t: 'x.........x.....', w: '....x.......x.x.', h: 'o.o.o.o.o.o.o.o.' },
    lead: {
      type: 'triangle', vol: 0.13, oct: 1,
      bars: [
        [[0, 5, 4], [4, 4, 2], [6, 3, 2], [8, 4, 8]],
        [[0, 5, 2], [2, 6, 2], [4, 7, 4], [8, 6, 4], [12, 5, 4]],
        [[0, 3, 4], [4, 4, 2], [6, 5, 2], [8, 4, 4], [12, 2, 4]],
        [[0, 3, 6], [6, 1, 2], [8, 0, 8]],
      ],
    },
  },
  wiener: {
    // waltz: three beats of four steps, oom-pah-pah
    bpm: 168, steps: 12, root: 58, scale: MAJOR, prog: [0, 4, 4, 0],
    bass: { at: [0], deg: [0], oct: -1, type: 'sawtooth', vol: 0.16, cutoff: 500, len: 3 },
    stab: { at: [4, 8], oct: 0, type: 'square', vol: 0.035, cutoff: 1800, len: 2 },
    drums: { k: 'x...........', h: '....o...o...' },
    lead: {
      type: 'square', vol: 0.04, oct: 1, cutoff: 2600, chorus: true,
      bars: [
        [[0, 4, 4], [4, 2, 4], [8, 4, 4]],
        [[0, 6, 4], [4, 4, 2], [6, 5, 2], [8, 6, 4]],
        [[0, 8, 4], [4, 6, 4], [8, 4, 4]],
        [[0, 7, 8], [8, 4, 4]],
      ],
    },
  },
};

const LEVEL_TRACKS = { sushi: 'sushi', street: 'sushi', burger: 'diner', happy: 'happy', austria: 'wiener' };

let musicBus = null;
let noiseBuf = null;
const bgm = { name: null, timer: 0, step: 0, bar: 0, next: 0, tempo: 1 };

function voice(freq, t, dur, { type = 'triangle', vol = 0.2, attack = 0.005, cutoff = 0, detune = 0 } = {}) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (detune) o.detune.setValueAtTime(detune, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  if (cutoff) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    g.connect(f).connect(musicBus);
  } else g.connect(musicBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function drum(kind, t, vol) {
  if (kind === 'k' || kind === 't') {
    const taiko = kind === 't';
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(taiko ? 110 : 140, t);
    o.frequency.exponentialRampToValueAtTime(taiko ? 38 : 45, t + (taiko ? 0.3 : 0.14));
    g.gain.setValueAtTime((taiko ? 0.8 : 0.6) * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (taiko ? 0.45 : 0.2));
    o.connect(g).connect(musicBus);
    o.start(t);
    o.stop(t + 0.5);
    return;
  }
  if (kind === 'w') return voice(880, t, 0.06, { type: 'sine', vol: 0.14 * vol });
  const snare = kind === 's';
  const len = snare ? 0.14 : 0.035;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = snare ? 'bandpass' : 'highpass';
  f.frequency.value = snare ? 1800 : 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime((snare ? 0.32 : 0.1) * vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(g).connect(musicBus);
  src.start(t, Math.random() * 0.5, len + 0.02);
  if (snare) voice(190, t, 0.08, { type: 'triangle', vol: 0.1 * vol });
}

function playStep(tr, bar, step, t, sd) {
  const chord = tr.prog[bar % tr.prog.length];
  const n = tr.scale.length;
  const note = (deg, oct) => midi(tr.root + tr.scale[((deg % n) + n) % n] + 12 * (Math.floor(deg / n) + oct));
  const { bass, arp, stab, lead } = tr;
  if (bass) bass.at.forEach((s, i) => s === step && voice(note(chord + bass.deg[i], bass.oct), t, sd * bass.len, bass));
  if (arp && step % arp.every === 0) voice(note(chord + arp.pattern[(step / arp.every) % arp.pattern.length], arp.oct), t, sd * arp.every * 1.5, arp);
  if (stab?.at.includes(step)) for (const d of [0, 2, 4]) voice(note(chord + d, stab.oct), t, sd * stab.len, stab);
  for (const [kind, pat] of Object.entries(tr.drums || {})) if (pat[step] !== '.') drum(kind, t, pat[step] === 'x' ? 1 : 0.5);
  for (const [s, d, len] of lead?.bars[bar % lead.bars.length] || [])
    if (s === step) {
      const f = note(d, lead.oct);
      voice(f, t, sd * len * 0.95, { ...lead, attack: 0.01, detune: lead.chorus ? 7 : 0 });
      if (lead.chorus) voice(f, t, sd * len * 0.95, { ...lead, attack: 0.01, detune: -7 });
    }
}

// Lookahead scheduler: queue notes ~150ms ahead on the audio clock so timer jitter never shows.
function schedule() {
  const tr = TRACKS[bgm.name];
  if (!tr) return;
  const sd = 60 / (tr.bpm * bgm.tempo) / 4;
  if (bgm.next < ctx.currentTime - 0.1) bgm.next = ctx.currentTime + 0.05;
  while (bgm.next < ctx.currentTime + 0.15) {
    playStep(tr, bgm.bar, bgm.step, bgm.next, sd);
    bgm.next += sd;
    if (++bgm.step >= tr.steps) {
      bgm.step = 0;
      bgm.bar++;
    }
  }
}

function startMusic() {
  clearInterval(bgm.timer);
  bgm.timer = 0;
  if (!enabled || !bgm.name || !ctx) return;
  if (!musicBus) {
    musicBus = ctx.createGain();
    musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const now = ctx.currentTime;
  musicBus.gain.cancelScheduledValues(now);
  musicBus.gain.setValueAtTime(0.0001, now);
  musicBus.gain.exponentialRampToValueAtTime(MUSIC_VOL, now + 0.8);
  bgm.step = 0;
  bgm.bar = 0;
  bgm.next = now + 0.1;
  bgm.timer = setInterval(schedule, 25);
}

function stopMusic() {
  clearInterval(bgm.timer);
  bgm.timer = 0;
  if (musicBus) {
    const now = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setTargetAtTime(0.0001, now, 0.08);
  }
}

export const music = {
  play(name) {
    const id = TRACKS[name] ? name : LEVEL_TRACKS[name] || 'lobby';
    if (bgm.name === id && bgm.timer) return;
    bgm.name = id;
    bgm.tempo = 1;
    startMusic();
  },
  setTempo(mul) {
    bgm.tempo = mul;
  },
};
