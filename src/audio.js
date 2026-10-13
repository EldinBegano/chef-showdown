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
  },
  unlock() {
    if (enabled) ensure();
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
  count: () => tone(520, 0.15, { type: 'square', vol: 0.15 }),
  go: () => {
    tone(780, 0.12, { type: 'square', vol: 0.15 });
    tone(1040, 0.3, { type: 'square', vol: 0.15, delay: 0.1 });
  },
  unlockDish: () => [660, 880, 1100].forEach((f, i) => tone(f, 0.15, { type: 'triangle', vol: 0.3, delay: i * 0.09 })),
  end: () => [784, 659, 523, 392].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.3, delay: i * 0.15 })),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.3, delay: i * 0.12 })),
};
