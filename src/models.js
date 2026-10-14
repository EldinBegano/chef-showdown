import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const gradient = (steps) => {
  const t = new THREE.DataTexture(new Uint8Array(steps), steps.length, 1, THREE.RedFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
};
const toneMap = gradient([120, 195, 255]);
const charToneMap = gradient([105, 160, 212, 255]);

const matCache = new Map();
export function mat(color, extra = {}) {
  const key = color + '|' + JSON.stringify(extra);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toneMap, ...extra });
  matCache.set(key, m);
  return m;
}

const glowCache = new Map();
export function glow(color, opacity = 1) {
  const key = color + '|' + opacity;
  if (glowCache.has(key)) return glowCache.get(key);
  const m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
  glowCache.set(key, m);
  return m;
}

const silhouetteMat = new THREE.MeshBasicMaterial({ color: 0x1b0d10 });

export function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, typeof material === 'object' ? material : mat(material));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const geoCache = new Map();
function cached(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}
export const rbox = (w, h, d, r = 0.04) =>
  cached(`rb${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.01, h / 2.01, d / 2.01)));
export const cyl = (rt, rb, h, seg = 20) => cached(`cy${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
export const sph = (r, ws = 20, hs = 14) => cached(`sp${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
export const dome = (r) => cached(`dm${r}`, () => new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2));
export const torus = (r, t, seg = 24, arc = Math.PI * 2) => cached(`to${r},${t},${seg},${arc}`, () => new THREE.TorusGeometry(r, t, 10, seg, arc));
export const cone = (r, h, seg = 16) => cached(`co${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg));

export const put = (parent, child) => (parent.add(child), child);

export function group(...children) {
  const g = new THREE.Group();
  children.forEach((c) => c && g.add(c));
  return g;
}

export function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

export function texMat(tex, extra = {}) {
  return new THREE.MeshToonMaterial({ map: tex, gradientMap: toneMap, ...extra });
}

const capsule = (r, len) => cached(`cap${r},${len}`, () => new THREE.CapsuleGeometry(r, len, 4, 12));

// Tapered capsule hanging down from its top joint: radius r0 at y=0, r1 at y=-len.
const limb = (r0, r1, len) =>
  cached(`limb${r0},${r1},${len}`, () => {
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.sin(a) * r1, -len - Math.cos(a) * r1));
    }
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.cos(a) * r0, Math.sin(a) * r0));
    }
    return new THREE.LatheGeometry(pts, 16);
  });

function smoothProfile(P, n = 33) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const f = (k / (n - 1)) * (P.length - 1);
    const i = Math.min(P.length - 2, Math.floor(f));
    const t = f - i;
    const [p0, p1, p2, p3] = [P[Math.max(0, i - 1)], P[i], P[i + 1], P[Math.min(P.length - 1, i + 2)]];
    out.push(0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t));
  }
  return out;
}

const TORSO = smoothProfile([0.215, 0.232, 0.238, 0.236, 0.24, 0.25, 0.262, 0.27, 0.268, 0.255, 0.225, 0.17, 0.09, 0.02]);
const BULK = smoothProfile([0.22, 0.235, 0.24, 0.245, 0.27, 0.31, 0.35, 0.38, 0.39, 0.375, 0.33, 0.25, 0.12, 0.02]);
const TORSO_Y = 0.57;
const TORSO_H = 0.64;
const torsoGeo = (profile, key) =>
  cached(key, () => new THREE.LatheGeometry(profile.map((r, i) => new THREE.Vector2(r, TORSO_Y + (TORSO_H * i) / (profile.length - 1))), 40, Math.PI));

// Torso radius at texture height v (0 = waist, 1 = neck).
function profAt(P, v) {
  const f = THREE.MathUtils.clamp(v, 0, 1) * (P.length - 1);
  const i = Math.min(P.length - 2, Math.floor(f));
  return P[i] + (P[i + 1] - P[i]) * (f - i);
}

function weave(c, w, h) {
  c.save();
  c.lineWidth = 1.5;
  c.globalAlpha = 0.05;
  c.strokeStyle = '#000';
  for (let x = -h; x < w; x += 6) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x + h, h);
    c.stroke();
  }
  c.globalAlpha = 0.04;
  c.strokeStyle = '#fff';
  for (let x = 3; x < w + h; x += 6) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x - h, h);
    c.stroke();
  }
  c.restore();
}

const outfitCache = new Map();
function outfitMaterial(key, draw, fabric = true) {
  if (outfitCache.has(key)) return outfitCache.get(key);
  const tex = canvasTexture(512, 256, (c, w, h) => {
    draw(c, w, h);
    if (fabric) weave(c, w, h);
  });
  const m = texMat(tex);
  outfitCache.set(key, m);
  return m;
}

const OUTFITS = {
  plain: (color) => (c, w, h) => {
    c.fillStyle = color;
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,0.12)';
    c.fillRect(0, 0, w, 22);
  },
  striped: (color, stripe) => (c, w, h) => {
    c.fillStyle = color;
    c.fillRect(0, 0, w, h);
    c.fillStyle = stripe;
    for (let y = 40; y < h; y += 44) c.fillRect(0, y, w, 16);
    c.fillStyle = 'rgba(0,0,0,0.12)';
    c.fillRect(0, 0, w, 22);
  },
  chef: (coat, buttons, apron) => (c, w, h) => {
    c.fillStyle = coat;
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,0.08)';
    c.fillRect(0, 0, w, 26);
    c.strokeStyle = 'rgba(0,0,0,0.12)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(w / 2 + 34, 26);
    c.lineTo(w / 2 + 34, h);
    c.stroke();
    if (apron) {
      c.fillStyle = apron;
      c.fillRect(0, 150, w, 14);
      c.beginPath();
      c.roundRect(w / 2 - 118, 150, 236, h - 150, 10);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.25)';
      c.fillRect(w / 2 - 118, h - 14, 236, 4);
    }
    c.fillStyle = buttons;
    for (const y of apron ? [60, 105] : [60, 105, 150, 195]) for (const x of [w / 2 - 24, w / 2 + 24]) {
      c.beginPath();
      c.arc(x, y, 8, 0, Math.PI * 2);
      c.fill();
    }
  },
  jacket: (jacket, left, right) => (c, w, h) => {
    c.fillStyle = jacket;
    c.fillRect(0, 0, w, h);
    c.fillStyle = left;
    c.fillRect(w / 2 - 56, 18, 56, h);
    c.fillStyle = right;
    c.fillRect(w / 2, 18, 56, h);
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.fillRect(w / 2 - 62, 18, 8, h);
    c.fillRect(w / 2 + 54, 18, 8, h);
    for (const x of [w / 2 - 150, w / 2 + 100]) c.fillRect(x, 170, 50, 36);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(0, 0, w, 16);
  },
  vest: (vest, shirt, accent) => (c, w, h) => {
    c.fillStyle = vest;
    c.fillRect(0, 0, w, h);
    c.fillStyle = shirt;
    c.beginPath();
    c.moveTo(w / 2 - 60, 0);
    c.lineTo(w / 2 + 60, 0);
    c.lineTo(w / 2 + 14, h);
    c.lineTo(w / 2 - 14, h);
    c.fill();
    c.fillStyle = accent;
    c.fillRect(w / 2 - 4, 30, 8, h);
  },
  stringer: (skin, tank, emblem) => (c, w, h) => {
    c.fillStyle = skin;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(90,40,10,0.35)';
    c.lineWidth = 4;
    for (const dir of [-1, 1]) {
      c.beginPath();
      c.moveTo(w / 2, 40);
      c.quadraticCurveTo(w / 2 + dir * 70, 95, w / 2 + dir * 110, 60);
      c.stroke();
    }
    c.fillStyle = tank;
    const tankAt = (cx, half) => {
      c.beginPath();
      c.moveTo(cx - 34, 0);
      c.lineTo(cx - 14, 0);
      c.quadraticCurveTo(cx - 10, 70, cx - half * 0.45, 95);
      c.lineTo(cx + half * 0.45, 95);
      c.quadraticCurveTo(cx + 10, 70, cx + 14, 0);
      c.lineTo(cx + 34, 0);
      c.lineTo(cx + half, 120);
      c.lineTo(cx + half, h);
      c.lineTo(cx - half, h);
      c.lineTo(cx - half, 120);
      c.closePath();
      c.fill();
    };
    tankAt(w / 2, 104);
    tankAt(0, 104);
    tankAt(w, 104);
    c.fillStyle = emblem;
    c.beginPath();
    c.arc(w / 2, 170, 34, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = tank;
    c.fillRect(w / 2 - 22, 166, 44, 8);
    c.fillRect(w / 2 - 26, 154, 8, 32);
    c.fillRect(w / 2 + 18, 154, 8, 32);
  },
  italian: (coat, gold, line) => (c, w, h) => {
    c.fillStyle = coat;
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,0.07)';
    c.fillRect(0, 0, w, 24);
    c.fillStyle = gold;
    for (const y of [50, 88]) for (const x of [w / 2 - 22, w / 2 + 22]) {
      c.beginPath();
      c.arc(x, y, 6, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#ffffff';
    c.fillRect(0, 132, w, 50);
    c.strokeStyle = line;
    c.lineWidth = 3;
    for (const y of [132, 146, 160, 174, 182]) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(w / 2 - 130, 182);
    c.lineTo(w / 2 - 136, h);
    c.moveTo(w / 2 + 130, 182);
    c.lineTo(w / 2 + 136, h);
    c.stroke();
  },
  tunic: (color, belt) => (c, w, h) => {
    c.fillStyle = color;
    c.fillRect(0, 0, w, h);
    c.fillStyle = belt;
    c.fillRect(0, 168, w, 22);
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.beginPath();
    c.moveTo(w / 2 - 40, 0);
    c.lineTo(w / 2, 60);
    c.lineTo(w / 2 + 40, 0);
    c.fill();
  },
};

function humanoid({ skin, outfit, outfitKey, pants, shoes = '#2b2b33', sole, sleeves, forearms = sleeves, scale = 1, bulk = false, slim = false, bareLegs = false, thighs = skin, calves = skin, fabric = true }) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const B = bulk
    ? { shoulderX: 0.4, shoulderY: 1.08, delt: 0.14, upper: 0.105, fore: 0.088, hand: 0.085, leg: 0.105, hipX: 0.13, pelvis: 0.5, neck: 0.12 }
    : slim
      ? { shoulderX: 0.225, shoulderY: 1.07, delt: 0.056, upper: 0.05, fore: 0.047, hand: 0.056, leg: 0.07, hipX: 0.095, pelvis: 0.34, neck: 0.058 }
      : { shoulderX: 0.27, shoulderY: 1.07, delt: 0.075, upper: 0.066, fore: 0.058, hand: 0.068, leg: 0.085, hipX: 0.11, pelvis: 0.44, neck: 0.075 };

  const profile = bulk ? BULK : TORSO;
  const torso = new THREE.Mesh(torsoGeo(profile, bulk ? 'torsoBulk' : 'torso'), outfitMaterial(outfitKey, outfit, fabric));
  torso.scale.z = bulk ? 0.62 : slim ? 0.62 : 0.7;
  if (slim) torso.scale.x = 0.82;
  torso.castShadow = true;
  torso.receiveShadow = true;
  body.add(torso);
  body.add(mesh(rbox(B.pelvis, 0.16, 0.34, 0.07), pants, 0, 0.6, 0));
  body.add(mesh(cyl(B.neck, B.neck * 1.25, 0.12, 16), skin, 0, 1.24, 0));

  const soleColor = sole || (new THREE.Color(shoes).getHSL({}, THREE.SRGBColorSpace).l > 0.5 ? '#45434a' : '#efe9de');
  const leg = (x) => {
    const hip = new THREE.Group();
    hip.position.set(x, 0.6, 0);
    if (bareLegs) {
      hip.add(mesh(capsule(0.14, 0.04), pants, 0, -0.05, 0));
      const thin = bulk ? 1 : 0.72;
      hip.add(mesh(capsule(0.125 * thin, 0.14), thighs, 0, -0.17, 0.01));
      hip.add(mesh(capsule(0.092 * thin, 0.12), calves, 0, -0.38, -0.01));
    } else hip.add(mesh(limb(B.leg * 1.12, B.leg * 0.86, 0.4), pants, 0, -0.03, 0));
    const wide = bulk ? 0.03 : 0;
    hip.add(mesh(rbox(0.15 + wide, 0.09, 0.25, 0.045), shoes, 0, -0.535, 0.045));
    hip.add(mesh(rbox(0.165 + wide, 0.03, 0.275, 0.014), soleColor, 0, -0.585, 0.045));
    body.add(hip);
    return hip;
  };
  const arm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.rotation.order = 'YXZ';
    shoulder.position.set(side * B.shoulderX, B.shoulderY, 0);
    shoulder.add(mesh(sph(B.delt, 16, 12), sleeves, 0, 0, 0));
    shoulder.add(mesh(limb(B.upper * 1.12, B.upper * 0.92, 0.25), sleeves, 0, -0.01, 0));
    if (bulk) {
      const bicep = mesh(sph(B.upper * 1.05, 12, 10), sleeves, 0, -0.14, 0.05);
      bicep.scale.set(1, 1.3, 1);
      shoulder.add(bicep);
    }
    if (forearms === skin && sleeves !== skin) put(shoulder, mesh(torus(B.upper, B.upper * 0.4, 18), sleeves, 0, -0.21, 0)).rotation.x = Math.PI / 2;
    const elbow = new THREE.Group();
    elbow.rotation.order = 'YXZ';
    elbow.position.y = -0.26;
    elbow.add(mesh(limb(B.fore * 1.08, B.fore * 0.82, 0.19), forearms, 0, 0, 0));
    // mitten: flattened palm with the thumb pointing forward
    const hand = new THREE.Group();
    hand.position.y = -0.245;
    const palm = mesh(sph(B.hand, 14, 12), skin);
    palm.scale.set(0.8, 1.12, 0.98);
    hand.add(palm);
    const thumb = mesh(capsule(B.hand * 0.34, B.hand * 0.55), skin, -side * B.hand * 0.3, B.hand * 0.05, B.hand * 0.6);
    thumb.rotation.set(-0.75, 0, side * 0.35);
    hand.add(thumb);
    elbow.add(hand);
    if (forearms !== skin) elbow.add(mesh(cyl(B.fore * 0.98, B.fore * 1.02, 0.045, 16), forearms, 0, -0.165, 0));
    shoulder.add(elbow);
    body.add(shoulder);
    return { shoulder, elbow };
  };

  const legL = leg(-B.hipX);
  const legR = leg(B.hipX);
  const L = arm(-1);
  const R = arm(1);

  const head = new THREE.Group();
  head.position.y = 1.42;
  head.add(mesh(sph(0.27, 32, 24), skin));
  body.add(head);

  root.scale.setScalar(scale);
  return { root, rig: { body, head, torso, torsoP: profile, legL, legR, armL: L.shoulder, armR: R.shoulder, elbowL: L.elbow, elbowR: R.elbow, phase: Math.random() * 6, bulk, B } };
}

/* ---------- outfit details ---------- */

const Z_AXIS = new THREE.Vector3(0, 0, 1);

// Point and outward normal on the torso surface at outfit-texture pixel (cx, cy).
function onTorso(rig, cx, cy, lift = 0.004) {
  const v = 1 - cy / 256;
  const r = profAt(rig.torsoP, v) + lift;
  const phi = Math.PI + (cx / 512) * Math.PI * 2;
  const s = rig.torso.scale;
  return {
    p: new THREE.Vector3(r * Math.sin(phi) * s.x, TORSO_Y + TORSO_H * v, r * Math.cos(phi) * s.z),
    n: new THREE.Vector3(Math.sin(phi) / s.x, 0, Math.cos(phi) / s.z).normalize(),
  };
}

function stick(rig, m, cx, cy, lift) {
  const { p, n } = onTorso(rig, cx, cy, lift);
  m.position.copy(p);
  m.quaternion.setFromUnitVectors(Z_AXIS, n);
  rig.body.add(m);
  return m;
}

function buttons(rig, color, ys, dx = 24, r = 0.021) {
  for (const y of ys)
    for (const x of [-dx, dx]) {
      const b = stick(rig, mesh(sph(r, 10, 8), color), 256 + x, y);
      b.scale.z = 0.4;
    }
}

function collar(rig, color, flare = 0) {
  const n = rig.B.neck;
  const c = mesh(cyl(n * (1.4 + flare), n * 1.62, 0.075 + flare * 0.03, 24), color, 0, 1.2 + flare * 0.015, 0.005);
  c.scale.z = 0.86;
  rig.body.add(c);
}

// Hangs straight down from the belly instead of following the waist in, so it clears the hips.
function apron(rig, color) {
  const P = rig.torsoP;
  const top = 1 - 150 / 256;
  const rTop = profAt(P, top) + 0.009;
  const pts = [new THREE.Vector2(rTop + 0.045, 0.5)];
  for (let i = 0; i <= 8; i++) {
    const v = (top * i) / 8;
    pts.push(new THREE.Vector2(Math.max(profAt(P, v) + 0.009, rTop + 0.035 * (1 - i / 8)), TORSO_Y + TORSO_H * v));
  }
  const geo = new THREE.LatheGeometry(pts, 20, -1.35, 2.7);
  const pos = geo.attributes.position;
  const yTop = TORSO_Y + TORSO_H * top;
  for (let i = 0; i < pos.count; i++) {
    const f = THREE.MathUtils.clamp((pos.getY(i) - 0.5) / (yTop - 0.5), 0, 1);
    pos.setX(i, pos.getX(i) * rig.torso.scale.x);
    pos.setZ(i, pos.getZ(i) * (rig.torso.scale.z + 0.11 * (1 - f)));
  }
  geo.computeVertexNormals();
  rig.body.add(mesh(geo, mat(color, { side: THREE.DoubleSide })));
}

function belt(rig, color, buckle, cy0, cy1) {
  const v = 1 - (cy0 + cy1) / 512;
  const h = ((cy1 - cy0) / 256) * TORSO_H;
  const r = profAt(rig.torsoP, v) + 0.008;
  const b = mesh(cyl(r, r, h, 32), color, 0, TORSO_Y + TORSO_H * v, 0);
  b.scale.set(rig.torso.scale.x, 1, rig.torso.scale.z);
  rig.body.add(b);
  stick(rig, mesh(rbox(0.07, h + 0.012, 0.025, 0.008), buckle), 256, (cy0 + cy1) / 2, 0.016);
}

/* ---------- faces ---------- */

const TAU = Math.PI * 2;
const INK = '#2a1a1f';
const FACE_ROWS = ['idle', 'blink', 'happy', 'angry'];

function paintEye(c, cx, cy, side, expr, o) {
  const { ew, eh } = o;
  const inner = -side;
  c.strokeStyle = INK;
  if (expr === 'blink' || expr === 'happy') {
    const up = expr === 'happy' ? -1 : 1;
    const y = cy + eh * 0.2;
    c.lineWidth = o.lid || 7;
    c.beginPath();
    c.moveTo(cx - ew, y);
    c.quadraticCurveTo(cx, y + up * eh * 0.9, cx + ew, y);
    c.stroke();
    if (o.lash) {
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(cx + side * ew * 0.95, y);
      c.lineTo(cx + side * ew * 1.3, y - 8);
      c.stroke();
    }
    return;
  }
  if (o.style === 'anime') {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.ellipse(cx, cy, ew, eh, 0, 0, TAU);
    c.fill();
    const g = c.createLinearGradient(0, cy - eh * 0.86, 0, cy + eh * 0.9);
    g.addColorStop(0, o.iris[0]);
    g.addColorStop(0.5, o.iris[1]);
    g.addColorStop(1, o.iris[2]);
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(cx, cy + 4, ew * 0.82, eh * 0.88, 0, 0, TAU);
    c.fill();
    c.fillStyle = o.pupil;
    c.beginPath();
    c.ellipse(cx, cy + 2, ew * 0.36, eh * 0.45, 0, 0, TAU);
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.ellipse(cx + ew * 0.3, cy - eh * 0.33, ew * 0.27, eh * 0.26, 0, 0, TAU);
    c.fill();
    c.beginPath();
    c.arc(cx - ew * 0.3, cy + eh * 0.48, ew * 0.15, 0, TAU);
    c.fill();
    c.lineWidth = o.lid || 9;
    c.beginPath();
    c.ellipse(cx, cy + 2, ew + 1, eh + 1, 0, Math.PI * 1.08, Math.PI * 1.92);
    c.stroke();
  } else {
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(cx, cy, ew, eh, 0, 0, TAU);
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.ellipse(cx + ew * 0.28, cy - eh * 0.36, ew * 0.38, eh * 0.27, 0, 0, TAU);
    c.fill();
    c.beginPath();
    c.arc(cx - ew * 0.3, cy + eh * 0.45, ew * 0.17, 0, TAU);
    c.fill();
  }
  if (o.sleepy && expr !== 'angry') {
    // half-lidded: erase the top of the eye and draw a heavy lid across it
    const cut = cy - eh + 2 * eh * o.sleepy;
    const hw = ew * Math.sqrt(Math.max(0, 1 - ((cut - cy) / eh) ** 2));
    c.save();
    c.globalCompositeOperation = 'destination-out';
    c.fillRect(cx - ew * 1.5, cy - eh * 2, ew * 3, cut - (cy - eh * 2));
    c.restore();
    c.lineWidth = o.lid || 7;
    c.beginPath();
    c.moveTo(cx - hw - 2, cut + 4);
    c.quadraticCurveTo(cx, cut - 4, cx + hw + 2, cut + 4);
    c.stroke();
    if (o.lash) {
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(cx + side * (hw + 1), cut + 3);
      c.lineTo(cx + side * (hw + 13), cut - 7);
      c.stroke();
    }
  } else if (o.lash) {
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(cx + side * ew * 0.97, cy - eh * 0.38);
    c.lineTo(cx + side * ew * 1.33, cy - eh * 0.62);
    c.stroke();
  }
  if (expr === 'angry') {
    // slice the top of the eye off along a slanted lid
    const ax = cx - inner * ew * 1.4;
    const ay = cy - eh * 0.9;
    const bx = cx + inner * ew * 1.4;
    const by = cy - eh * 0.05;
    c.save();
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    c.moveTo(ax, ay);
    c.lineTo(bx, by);
    c.lineTo(bx, cy - eh * 2);
    c.lineTo(ax, cy - eh * 2);
    c.closePath();
    c.fill();
    c.restore();
    const at = (x) => ay + ((x - ax) * (by - ay)) / (bx - ax);
    const x0 = cx - inner * ew * 1.05;
    const x1 = cx + inner * ew * 1.05;
    c.lineWidth = o.lid || 7;
    c.beginPath();
    c.moveTo(x0, at(x0));
    c.lineTo(x1, at(x1));
    c.stroke();
  }
}

function paintMouth(c, x, y, kind, o) {
  const mw = o.mouthW || 16;
  c.strokeStyle = o.lip || '#6b2a2a';
  c.lineWidth = 5;
  if (kind === 'smile') {
    c.beginPath();
    c.moveTo(x - mw, y - 3);
    c.quadraticCurveTo(x, y + 10, x + mw, y - 3);
    c.stroke();
  } else if (kind === 'smirk') {
    c.beginPath();
    c.moveTo(x - mw * 0.8, y + 2);
    c.quadraticCurveTo(x + mw * 0.2, y + 8, x + mw, y - 6);
    c.stroke();
  } else if (kind === 'grin') {
    // wide smile showing the top row of teeth
    const path = () => {
      c.beginPath();
      c.moveTo(x - mw, y - 4);
      c.quadraticCurveTo(x, y + 2, x + mw, y - 4);
      c.quadraticCurveTo(x + mw * 0.8, y + 18, x, y + 19);
      c.quadraticCurveTo(x - mw * 0.8, y + 18, x - mw, y - 4);
    };
    c.fillStyle = o.mouthIn || '#5a1a1a';
    path();
    c.fill();
    c.save();
    c.clip();
    c.fillStyle = '#fbf7ee';
    c.fillRect(x - mw, y - 8, mw * 2, 14);
    c.strokeStyle = 'rgba(0,0,0,0.15)';
    c.lineWidth = 1.5;
    for (let k = -3; k <= 3; k++) {
      c.beginPath();
      c.moveTo(x + k * mw * 0.24, y - 4);
      c.lineTo(x + k * mw * 0.24, y + 5);
      c.stroke();
    }
    c.restore();
    c.lineWidth = 3;
    path();
    c.stroke();
  } else if (kind === 'flat') {
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(x - mw * 0.55, y);
    c.quadraticCurveTo(x, y + 2, x + mw * 0.55, y);
    c.stroke();
  } else if (kind === 'frown') {
    c.beginPath();
    c.moveTo(x - mw * 0.9, y + 7);
    c.quadraticCurveTo(x, y - 6, x + mw * 0.9, y + 7);
    c.stroke();
  } else if (kind === 'open') {
    const w = mw * 1.25;
    c.fillStyle = o.mouthIn || '#8a2a36';
    c.beginPath();
    c.moveTo(x - w, y - 5);
    c.quadraticCurveTo(x, y + 1, x + w, y - 5);
    c.quadraticCurveTo(x + w * 0.9, y + 20, x, y + 21);
    c.quadraticCurveTo(x - w * 0.9, y + 20, x - w, y - 5);
    c.fill();
    c.save();
    c.clip();
    c.fillStyle = '#f2849a';
    c.beginPath();
    c.ellipse(x, y + 18, w * 0.5, 7, 0, 0, TAU);
    c.fill();
    c.restore();
  }
}

// Draws one expression row. The decal patch is 1.61x wider in arc than in height,
// so the canvas is pre-stretched horizontally to keep circles round on the head.
function paintFace(c, expr, o) {
  c.translate(256, 0);
  c.scale(1.61, 1);
  c.translate(-256, 0);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const happy = expr === 'happy';
  const bl = typeof o.blush === 'string' ? { c: o.blush, dx: o.ew * 0.5, y: o.eyeY + o.eh + 16, rx: o.ew * 0.95, ry: o.ew * 0.5 } : o.blush;
  for (const side of [-1, 1]) {
    const cx = 256 + side * o.gap;
    if (bl) {
      c.fillStyle = bl.c;
      c.globalAlpha = happy ? 1 : 0.75;
      c.beginPath();
      c.ellipse(cx + side * bl.dx, bl.y, bl.rx, bl.ry, 0, 0, TAU);
      c.fill();
      c.globalAlpha = 1;
    }
    if (o.freckles) {
      c.fillStyle = o.freckles;
      for (const [dx, dy] of [[-9, 0], [6, -5], [5, 8]]) {
        c.beginPath();
        c.arc(cx + side * o.ew * 0.5 + dx, o.eyeY + o.eh + 14 + dy, 2.6, 0, TAU);
        c.fill();
      }
    }
    paintEye(c, cx, o.eyeY, side, expr, o);
    if (o.shadow) {
      // eyeshadow goes behind what's already painted
      c.save();
      c.globalCompositeOperation = 'destination-over';
      c.fillStyle = o.shadow;
      c.beginPath();
      c.ellipse(cx, o.eyeY - o.eh * 0.45, o.ew * 1.25, o.eh * 0.7, 0, 0, TAU);
      c.fill();
      c.restore();
    }
    if (o.brow) {
      const inner = -side;
      const by = o.browY + (happy ? -6 : 0);
      c.strokeStyle = o.brow;
      c.lineWidth = o.browW || 8;
      c.beginPath();
      if (expr === 'angry') {
        c.moveTo(cx - inner * o.ew * 1.15, by - 4);
        c.lineTo(cx + inner * o.ew * 1.15, by + 12);
      } else {
        c.moveTo(cx - o.ew * 1.1, by + 5);
        c.quadraticCurveTo(cx, by - 7, cx + o.ew * 1.1, by + 5);
      }
      c.stroke();
    }
  }
  if (o.nose) {
    c.fillStyle = o.nose;
    c.beginPath();
    c.ellipse(256, o.noseY || 170, 4, 3, 0, 0, TAU);
    c.fill();
  }
  paintMouth(c, 256, o.mouthY, expr === 'angry' ? 'frown' : happy ? o.happyMouth || 'open' : o.mouth || 'smile', o);
}

const faceSheets = new Map();
const faceGeo = (r) => cached(`face${r}`, () => new THREE.SphereGeometry(r, 32, 16, Math.PI / 2 - 0.62, 1.24, 1.12, 1.0));

// Transparent decal hugging the front of the head; one canvas row per expression, picked via UV offset.
function faceDecal(radius, key, draw) {
  let sheet = faceSheets.get(key);
  if (!sheet) {
    const rowH = 256;
    sheet = canvasTexture(512, rowH * FACE_ROWS.length, (c, w) => {
      FACE_ROWS.forEach((expr, r) => {
        c.save();
        c.beginPath();
        c.rect(0, r * rowH, w, rowH);
        c.clip();
        c.translate(0, r * rowH);
        draw(c, expr);
        c.restore();
      });
    });
    faceSheets.set(key, sheet);
  }
  const tex = sheet.clone();
  tex.repeat.set(1, 1 / FACE_ROWS.length);
  const m = new THREE.Mesh(faceGeo(radius), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.userData.noOutline = true;
  let row = -1;
  const set = (expr) => {
    const r = Math.max(0, FACE_ROWS.indexOf(expr));
    if (r === row) return;
    row = r;
    tex.offset.y = 1 - (r + 1) / FACE_ROWS.length;
  };
  set('idle');
  return { mesh: m, set };
}

function face(rig, key, opts, radius = 0.273) {
  const f = faceDecal(radius, key, (c, expr) => paintFace(c, expr, opts));
  rig.head.add(f.mesh);
  rig.face = f;
  return f;
}

function blinkers(rig, list) {
  for (const m of list) m.userData.sy = m.scale.y;
  rig.blinkers = (rig.blinkers || []).concat(list);
}

const bare = (m) => ((m.userData.noOutline = true), m);

/* ---------- headwear & features ---------- */

function wobble(rig, obj, amt = 1, wag = false) {
  (rig.wobble ||= []).push({ obj, amt, wag, bx: obj.rotation.x, bz: obj.rotation.z, px: { x: 0, v: 0 }, pz: { x: 0, v: 0 } });
  return obj;
}

function spots(parent, r, squash, y0, color, list) {
  for (const [theta, phi, s] of list) {
    const x = r * Math.sin(phi) * Math.cos(theta);
    const z = r * Math.sin(phi) * Math.sin(theta);
    const y = r * Math.cos(phi) * squash;
    const m = mesh(sph(s, 10, 8), color, x, y0 + y, z);
    m.scale.z = 0.45;
    m.quaternion.setFromUnitVectors(Z_AXIS, new THREE.Vector3(x, y, z).normalize());
    parent.add(m);
  }
}

function mushroomCap(head, capColor, spotColor) {
  const g = new THREE.Group();
  g.position.y = 0.1;
  const cap = mesh(dome(0.46), capColor);
  cap.scale.y = 0.62;
  g.add(cap);
  g.add(mesh(cyl(0.44, 0.44, 0.05, 32), '#f4ecdf'));
  spots(g, 0.45, 0.62, 0, spotColor, [
    [0.3, 0.55, 0.075], [1.6, 0.45, 0.07], [2.8, 0.7, 0.08], [4.2, 0.5, 0.065], [5.3, 0.8, 0.07], [1.0, 1.1, 0.06], [2.2, 1.15, 0.06], [0, 0.05, 0.08],
  ]);
  head.add(g);
  return g;
}

function raccoonHead(rig, fur = '#8e8e98') {
  const head = rig.head;
  head.children[0].material = mat(fur);
  for (const x of [-0.095, 0.095]) {
    const patch = mesh(sph(0.1, 12, 10), '#2a2a32', x, 0.035, 0.2);
    patch.scale.set(1.1, 0.75, 0.6);
    head.add(patch);
  }
  const blink = [];
  for (const x of [-0.095, 0.095]) {
    blink.push(put(head, mesh(sph(0.03, 12, 10), '#f5f5f5', x, 0.035, 0.262)));
    blink.push(put(head, mesh(sph(0.012, 8, 6), '#111', x, 0.035, 0.29)));
    blink.push(put(head, mesh(sph(0.005, 6, 4), '#ffffff', x + 0.005, 0.041, 0.3)));
  }
  blinkers(rig, blink);
  const muzzle = mesh(sph(0.12, 14, 10), '#eeeae4', 0, -0.08, 0.2);
  muzzle.scale.set(1, 0.7, 1);
  head.add(muzzle);
  head.add(mesh(sph(0.04, 10, 8), '#1a1a1a', 0, -0.05, 0.32));
  for (const x of [-0.18, 0.18]) {
    const ear = mesh(cone(0.08, 0.14, 10), fur, x, 0.24, -0.02);
    ear.rotation.z = -x * 1.4;
    head.add(ear);
  }
}

function raccoonTail(body, fur = '#8e8e98') {
  const tail = new THREE.Group();
  tail.position.set(0, 0.64, -0.16);
  tail.rotation.x = 1.15;
  for (let i = 0; i < 5; i++) tail.add(mesh(cyl(0.09 - i * 0.008, 0.1 - i * 0.008, 0.11, 16), i % 2 ? '#2a2a32' : fur, 0, -0.06 - i * 0.11, 0));
  tail.add(mesh(sph(0.058, 14, 10), fur, 0, -0.55, 0));
  body.add(tail);
  return tail;
}

const bucketGeo = cached('bucketHat', () =>
  new THREE.LatheGeometry(
    [[0.2, 0.0], [0.375, -0.06], [0.383, -0.044], [0.245, 0.02], [0.236, 0.1], [0.218, 0.15], [0.15, 0.178], [0.0, 0.186]].map(([r, y]) => new THREE.Vector2(r, y)),
    32,
  ),
);

function bucketHat(head, color, band) {
  const g = new THREE.Group();
  g.position.y = 0.14;
  g.add(mesh(bucketGeo, color));
  g.add(mesh(cyl(0.243, 0.248, 0.04, 32), band, 0, 0.05, 0));
  head.add(g);
  return g;
}

function mustache(head) {
  for (const x of [-0.065, 0.065]) {
    const m = mesh(sph(0.07, 12, 10), '#4a2c1c', x, -0.07, 0.235);
    m.scale.set(1.2, 0.45, 0.6);
    m.rotation.z = x > 0 ? -0.3 : 0.3;
    head.add(m);
  }
}

function taperedTube(points, radius, flatten = 0.45, segs = 48, radial = 12) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const geo = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = curve.getPointAt(t);
    const r = radius(t);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(c);
      v.multiplyScalar(r);
      v.z *= flatten;
      pos.setXYZ(idx, c.x + v.x, c.y + v.y, c.z + v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

const petalGeo = cached('petal', () => {
  const g = new THREE.SphereGeometry(0.06, 14, 12);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y >= 0) continue;
    const k = 1 + (y / 0.06) * 0.9;
    pos.setX(i, pos.getX(i) * k);
    pos.setZ(i, pos.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
});

/* ---------- builders shared by skins and their level-up variants ---------- */

// Vocal-synth idol body (Miku, Teto): bare shoulders, tie, detached sleeves, pleated skirt, stockings and boots.
function idolBase({ key, skin, shirt, skirt, accent, accentDark, tie = accent, black, badge }) {
  const h = humanoid({
    skin,
    slim: true,
    fabric: false,
    outfitKey: key,
    outfit: (c, w, hgt) => {
      c.fillStyle = shirt;
      c.fillRect(0, 0, w, hgt);
      c.fillStyle = skin;
      for (const x of [w * 0.25, w * 0.75]) {
        c.beginPath();
        c.ellipse(x, 0, 70, 62, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = skirt;
      c.fillRect(w / 2 - 62, 0, 124, 26);
      c.fillStyle = accent;
      c.fillRect(w / 2 - 62, 24, 124, 5);
      c.fillStyle = tie;
      c.beginPath();
      c.moveTo(w / 2 - 13, 26);
      c.lineTo(w / 2 + 13, 26);
      c.lineTo(w / 2 + 17, hgt - 18);
      c.lineTo(w / 2, hgt);
      c.lineTo(w / 2 - 17, hgt - 18);
      c.fill();
      c.fillStyle = accentDark;
      c.fillRect(w / 2 - 15, 24, 30, 18);
      if (badge) {
        c.fillStyle = badge;
        c.fillRect(w / 2 - 100, 78, 46, 10);
      }
      c.strokeStyle = 'rgba(0,0,0,0.08)';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(w / 2 + 30, 40);
      c.lineTo(w / 2 + 30, hgt);
      c.stroke();
    },
    sleeves: skin,
    forearms: black,
    pants: skirt,
    shoes: black,
    sole: accent,
    bareLegs: true,
    calves: black,
  });
  const { head, body, armL, armR, elbowL, elbowR, legL, legR } = h.rig;

  const pleats = canvasTexture(256, 64, (c, w, hh) => {
    c.fillStyle = skirt;
    c.fillRect(0, 0, w, hh);
    for (let x = 0; x < w; x += 16) {
      c.fillStyle = 'rgba(0,0,0,0.28)';
      c.fillRect(x, 0, 4, hh);
      c.fillStyle = 'rgba(255,255,255,0.06)';
      c.fillRect(x + 4, 0, 3, hh);
    }
    c.fillStyle = accent;
    c.fillRect(0, hh - 7, w, 7);
  });
  const skirtMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.32, 0.25, 32, 1, true), texMat(pleats, { side: THREE.DoubleSide }));
  skirtMesh.position.y = 0.55;
  skirtMesh.castShadow = true;
  body.add(skirtMesh);

  for (const arm of [armL, armR]) {
    arm.add(mesh(capsule(0.058, 0.06), black, 0, -0.2, 0));
    arm.add(mesh(cyl(0.062, 0.062, 0.025, 16), accent, 0, -0.15, 0));
  }
  for (const elbow of [elbowL, elbowR]) {
    elbow.children[0].visible = false;
    elbow.add(mesh(cyl(0.06, 0.1, 0.25, 20), black, 0, -0.13, 0));
    elbow.add(mesh(cyl(0.102, 0.102, 0.03, 20), accent, 0, -0.255, 0));
    elbow.children[1].position.y = -0.3;
  }
  for (const leg of [legL, legR]) {
    leg.add(mesh(capsule(0.066, 0.1), black, 0, -0.25, 0.005));
    leg.add(mesh(cyl(0.07, 0.07, 0.03, 16), accent, 0, -0.19, 0.005));
  }

  head.children[0].material = mat(skin, { emissive: skin, emissiveIntensity: 0.22 });
  head.scale.setScalar(1.04);
  return h;
}

// Idol hair mass: crown, back, fringe, bangs and the two locks that frame the face.
function idolHair(head, hair) {
  const cap = mesh(dome(0.296), hair, 0, 0.03, -0.015);
  cap.scale.set(1, 1.05, 1.06);
  cap.rotation.x = -0.08;
  head.add(cap);
  head.add(mesh(sph(0.285, 24, 16), hair, 0, -0.02, -0.065));
  const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.305, 32, 12, Math.PI / 2 - 1.15, 2.3, 0, 1.12), mat(hair));
  fringe.castShadow = true;
  head.add(fringe);
  [[-0.225, -0.04, 0.05], [-0.15, 0.04, 0.05], [-0.075, 0.06, 0.048], [0, 0.0, 0.022], [0.075, 0.06, 0.048], [0.15, 0.04, 0.05], [0.225, -0.03, 0.05]].forEach(([x, bottom, hw]) => {
    const yc = (0.125 + bottom) / 2;
    const hh = (0.125 - bottom) / 2;
    const z = Math.sqrt(Math.max(0, 0.305 * 0.305 - x * x - yc * yc)) - 0.008;
    const clump = mesh(petalGeo, hair, x, yc, z);
    clump.lookAt(x * 3, yc, z * 3);
    clump.scale.set(hw / 0.06, hh / 0.06, 0.3);
    clump.rotateZ(x * 0.8);
    head.add(clump);
  });
  for (const x of [-0.235, 0.235]) {
    const lock = mesh(capsule(0.05, 0.32), hair, x, -0.16, 0.06);
    lock.scale.z = 0.55;
    lock.rotation.z = x > 0 ? 0.08 : -0.08;
    head.add(lock);
  }
}

function buildMiku() {
  const skin = '#fbe4d8';
  const teal = '#3cc6cc';
  const black = '#26272d';
  const h = idolBase({ key: 'miku2', skin, shirt: '#c9cdd3', skirt: '#3d4248', accent: teal, accentDark: '#2a9aa2', black, badge: '#d9b44a' });
  const { head } = h.rig;
  idolHair(head, teal);

  const tails = [];
  for (const side of [-1, 1]) {
    const tail = new THREE.Group();
    tail.position.set(side * 0.24, 0.13, -0.07);
    const pod = new THREE.Group();
    pod.add(mesh(rbox(0.06, 0.15, 0.11, 0.02), black, 0, 0, 0));
    pod.add(mesh(rbox(0.012, 0.15, 0.03, 0.004), '#e0408f', side * 0.03, 0, 0.025));
    pod.add(mesh(rbox(0.012, 0.15, 0.015, 0.004), '#e0408f', side * 0.03, 0, -0.025));
    pod.position.set(side * 0.035, 0.03, 0.01);
    pod.rotation.z = side * -0.35;
    tail.add(pod);
    const geo = taperedTube(
      [
        [0, 0, 0],
        [side * 0.16, -0.12, -0.05],
        [side * 0.24, -0.45, -0.08],
        [side * 0.22, -0.85, -0.06],
        [side * 0.16, -1.18, -0.02],
      ],
      (t) => 0.05 + Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) * 0.085 - Math.max(0, t - 0.6) * 0.3,
      0.42,
    );
    const ribbon = new THREE.Mesh(geo, mat(teal));
    ribbon.castShadow = true;
    tail.add(ribbon);
    head.add(tail);
    tails.push(tail);
  }
  h.rig.tails = tails;

  face(h.rig, 'miku', {
    style: 'anime', eyeY: 130, gap: 70, ew: 33, eh: 42, lid: 9, lash: true,
    iris: ['#16606a', '#2fb2ba', '#8de8e4'], pupil: '#0f3a42',
    blush: { c: 'rgba(246,140,160,0.45)', dx: 12, y: 196, rx: 20, ry: 11 },
    nose: 'rgba(205,120,110,0.55)', mouth: 'open', mouthY: 189, mouthW: 16, mouthIn: '#b8344a', lip: '#9a2a3e',
  });
  for (const side of [-1, 1]) {
    put(head, mesh(cyl(0.065, 0.065, 0.05, 20), black, side * 0.29, -0.02, 0.0)).rotation.z = Math.PI / 2;
    put(head, mesh(cyl(0.035, 0.035, 0.055, 14), teal, side * 0.296, -0.02, 0.0)).rotation.z = Math.PI / 2;
  }
  h.rig.idle = 'pose';
  return h;
}

function buildTeto() {
  const skin = '#fbe4d8';
  const red = '#d8304e';
  const redDark = '#a51e3a';
  const black = '#232328';
  const h = idolBase({ key: 'teto', skin, shirt: '#4b4c57', skirt: '#26272d', accent: red, accentDark: redDark, black });
  const { rig } = h;
  const { head, elbowR } = rig;
  idolHair(head, red);

  // twin drills: tilted rings stacked and turned a little each step read as a spiral curl
  const tails = [];
  for (const side of [-1, 1]) {
    const tail = new THREE.Group();
    tail.position.set(side * 0.25, 0.07, -0.05);
    tail.add(mesh(sph(0.075, 14, 10), red, side * 0.015, 0.02, 0));
    const drill = new THREE.Group();
    drill.position.set(side * 0.05, -0.07, 0);
    for (let i = 0; i < 6; i++) {
      const turn = new THREE.Group();
      turn.position.y = -i * 0.068;
      turn.rotation.y = side * i * 1.1;
      const ring = mesh(torus(0.078 - i * 0.009, 0.033 - i * 0.003, 16), red);
      ring.rotation.x = Math.PI / 2 + 0.3;
      turn.add(ring);
      drill.add(turn);
    }
    const core = mesh(cone(0.06, 0.44, 14), red, 0, -0.2, 0);
    core.rotation.x = Math.PI;
    drill.add(core);
    tail.add(drill);
    head.add(tail);
    tails.push(tail);
  }
  rig.tails = tails;
  rig.tailLag = 0.3;

  const ahoge = new THREE.Group();
  ahoge.position.set(0, 0.28, 0.04);
  ahoge.add(mesh(taperedTube([[0, 0, 0], [0.02, 0.07, 0.03], [0, 0.13, 0.07], [-0.045, 0.14, 0.085]], (t) => 0.02 * (1 - t * 0.7), 0.6, 24, 8), red));
  head.add(ahoge);
  wobble(rig, ahoge, 2);

  face(rig, 'teto', {
    style: 'anime', eyeY: 130, gap: 70, ew: 32, eh: 40, lid: 9, lash: true,
    iris: ['#5a0d1a', '#c42a3e', '#f2899a'], pupil: '#3a0610',
    blush: { c: 'rgba(246,130,150,0.45)', dx: 12, y: 196, rx: 20, ry: 11 },
    nose: 'rgba(205,120,110,0.55)', mouth: 'open', mouthY: 189, mouthW: 14, mouthIn: '#b8344a', lip: '#9a2a3e',
  });

  // her trademark baguette, carried like a sword
  const bread = new THREE.Group();
  const loaf = mesh(capsule(0.045, 0.34), '#d89a4a');
  loaf.scale.z = 0.85;
  bread.add(loaf);
  for (let i = 0; i < 4; i++) {
    const cut = bare(mesh(sph(0.03, 10, 6), '#f3d39a', 0, -0.13 + i * 0.085, 0.034));
    cut.scale.set(0.9, 0.35, 0.3);
    cut.rotation.z = 0.5;
    bread.add(cut);
  }
  bread.position.set(0, -0.45, 0.04);
  bread.rotation.x = 0.25;
  elbowR.add(bread);
  rig.prop = bread;
  rig.idle = 'bread';
  return h;
}

// Frieren and her goth variant share everything but the palette.
const FRIEREN = {
  key: 'frieren', skin: '#f7e6da', hair: '#dcdbee', coat: '#f4f2ec', trim: '#c9a85a', trimLine: 'rgba(90,60,20,0.45)',
  stripe: '#26262c', belt: '#26262c', buckle: '#c9ccd4', tights: '#26262c', boots: '#5a3b28', sole: '#3a271b',
  gem: '#cf1d33', shaft: '#6b2622', glow: '#5a0010', ribbon: '#b81e2c',
  face: { lip: '#9a5a52' },
};
const GOTH_FRIEREN = {
  key: 'gothfrieren', skin: '#f4e6e6', hair: '#dcdbee', coat: '#1f1d26', trim: '#b9bcc8', trimLine: 'rgba(0,0,0,0.5)',
  stripe: '#6e3b8c', belt: '#0f0e13', buckle: '#b9bcc8', tights: '#15141a', boots: '#16151a', sole: '#3a2a4a',
  gem: '#8a3fd0', shaft: '#1d1b22', glow: '#3a0a6a', ribbon: '#2a2630', lace: '#d9d6e2', bows: '#15141a',
  face: { lip: '#5a2a5e', shadow: 'rgba(120,60,150,0.5)', lid: 10 },
};

function buildFrieren(p) {
  const { skin, hair, coat, trim, gem } = p;
  const h = humanoid({
    skin,
    slim: true,
    scale: 0.95,
    outfitKey: p.key,
    outfit: (c, w, hgt) => {
      c.fillStyle = coat;
      c.fillRect(0, 0, w, hgt);
      // striped shirt, only seen through the capelet's front opening
      c.fillStyle = p.stripe;
      for (let y = 34; y < 190; y += 26) c.fillRect(w / 2 - 48, y, 96, 13);
      c.fillStyle = p.belt;
      c.fillRect(0, 196, w, 20);
    },
    sleeves: coat,
    pants: coat,
    shoes: p.boots,
    sole: p.sole,
    bareLegs: true,
    thighs: p.tights,
    calves: p.tights,
  });
  const { rig } = h;
  const { head, body, elbowL, elbowR, legL, legR, B } = rig;
  belt(rig, p.belt, p.buckle, 196, 216);

  const hem = canvasTexture(256, 64, (c, w, hh) => {
    c.fillStyle = coat;
    c.fillRect(0, 0, w, hh);
    c.fillStyle = 'rgba(0,0,0,0.05)';
    for (let x = 0; x < w; x += 32) c.fillRect(x, 0, 6, hh);
    c.fillStyle = trim;
    c.fillRect(0, hh - 12, w, 10);
    c.fillStyle = p.trimLine;
    c.fillRect(0, hh - 14, w, 2);
    if (p.lace) {
      c.fillStyle = p.lace;
      for (let x = 0; x < w; x += 16) {
        c.beginPath();
        c.arc(x + 8, hh - 2, 7, Math.PI, 0);
        c.fill();
      }
    }
  });
  const dress = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.36, 32, 1, true), texMat(hem, { side: THREE.DoubleSide }));
  dress.position.y = 0.49;
  dress.castShadow = true;
  body.add(dress);

  const capeTex = canvasTexture(512, 128, (c, w, hh) => {
    c.fillStyle = coat;
    c.fillRect(0, 0, w, hh);
    weave(c, w, hh);
    c.fillStyle = trim;
    c.fillRect(0, hh - 20, w, 16);
    c.fillRect(0, 0, 14, hh);
    c.fillRect(w - 14, 0, 14, hh);
    c.fillStyle = p.trimLine;
    c.fillRect(0, hh - 22, w, 2);
    c.fillRect(14, 0, 2, hh - 20);
    c.fillRect(w - 16, 0, 2, hh - 20);
    for (const x of [w * 0.25, w * 0.75]) {
      c.fillStyle = trim;
      c.beginPath();
      c.ellipse(x, 66, 11, 18, 0, 0, TAU);
      c.fill();
      c.fillStyle = gem;
      c.beginPath();
      c.ellipse(x, 66, 6, 10, 0, 0, TAU);
      c.fill();
    }
  });
  // capelet: open lathe shell around the shoulders, gap at the front for the striped shirt
  const capePts = [[0.34, 0.86], [0.33, 0.92], [0.315, 1.0], [0.295, 1.07], [0.25, 1.12], [0.17, 1.17], [0.085, 1.22]].map(([r, y]) => new THREE.Vector2(r, y));
  const cape = new THREE.Mesh(new THREE.LatheGeometry(capePts, 40, 0.38, Math.PI * 2 - 0.76), texMat(capeTex, { side: THREE.DoubleSide }));
  cape.scale.z = 0.7;
  cape.castShadow = true;
  body.add(cape);
  body.add(mesh(rbox(0.06, 0.07, 0.025, 0.01), trim, 0, 1.12, 0.172));
  body.add(mesh(sph(0.019, 10, 8), gem, 0, 1.12, 0.187));

  for (const elbow of [elbowL, elbowR]) {
    elbow.add(mesh(cyl(B.fore * 1.15, B.fore * 1.5, 0.13, 18), coat, 0, -0.13, 0));
    elbow.add(mesh(cyl(B.fore * 1.56, B.fore * 1.56, 0.04, 18), trim, 0, -0.2, 0));
  }
  for (const leg of [legL, legR]) leg.add(mesh(cyl(0.072, 0.068, 0.17, 16), p.boots, 0, -0.43, 0));

  head.children[0].material = mat(skin, { emissive: skin, emissiveIntensity: 0.15 });
  const cap = mesh(dome(0.296), hair, 0, 0.03, -0.015);
  cap.scale.set(1, 1.04, 1.05);
  cap.rotation.x = -0.1;
  head.add(cap);
  head.add(mesh(sph(0.285, 24, 16), hair, 0, -0.03, -0.07));
  const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.305, 32, 12, Math.PI / 2 - 1.15, 2.3, 0, 1.12), mat(hair));
  fringe.castShadow = true;
  head.add(bare(fringe));
  // bangs parted in the middle, longer toward the temples
  [[-0.24, -0.11, 0.04], [-0.18, -0.05, 0.042], [-0.12, 0.01, 0.04], [-0.06, 0.05, 0.032], [0.06, 0.05, 0.032], [0.12, 0.01, 0.04], [0.18, -0.05, 0.042], [0.24, -0.11, 0.04]].forEach(([x, bottom, hw]) => {
    const yc = (0.16 + bottom) / 2;
    const hh = (0.16 - bottom) / 2;
    const z = Math.sqrt(Math.max(0, 0.305 * 0.305 - x * x - yc * yc)) - 0.008;
    const clump = mesh(petalGeo, hair, x, yc, z);
    clump.lookAt(x * 3, yc, z * 3);
    clump.scale.set(hw / 0.06, hh / 0.06, 0.3);
    clump.rotateZ(x * 1.4);
    head.add(clump);
  });
  for (const side of [-1, 1]) {
    const lock = taperedTube(
      [[side * 0.2, 0.1, 0.12], [side * 0.235, -0.05, 0.13], [side * 0.245, -0.3, 0.17], [side * 0.235, -0.58, 0.2]],
      (t) => 0.035 + Math.sin(Math.min(1, t * 2) * Math.PI * 0.5) * 0.018 - Math.max(0, t - 0.7) * 0.08,
      0.5,
    );
    head.add(mesh(lock, hair));
  }

  const tails = [];
  for (const side of [-1, 1]) {
    const tail = new THREE.Group();
    tail.position.set(side * 0.17, 0.23, -0.1);
    tail.add(mesh(sph(0.065, 14, 10), hair, side * 0.025, 0.02, 0));
    const geo = taperedTube(
      [[0, 0.02, 0], [side * 0.09, 0.0, -0.06], [side * 0.15, -0.3, -0.1], [side * 0.15, -0.75, -0.1], [side * 0.11, -1.05, -0.06]],
      (t) => 0.035 + Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.5) * 0.05 - Math.max(0, t - 0.55) * 0.12,
      0.55,
    );
    const ribbon = new THREE.Mesh(geo, mat(hair));
    ribbon.castShadow = true;
    tail.add(ribbon);
    if (p.bows) {
      // gothic bow tying each tail
      const bow = new THREE.Group();
      bow.position.set(side * 0.03, 0.03, 0.03);
      for (const s of [-1, 1]) {
        const loop = mesh(cone(0.045, 0.11, 10), p.bows, s * 0.055, 0, 0);
        loop.rotation.z = (s * Math.PI) / 2;
        loop.scale.z = 0.45;
        bow.add(loop);
      }
      bow.add(mesh(sph(0.022, 10, 8), gem));
      tail.add(bow);
    }
    head.add(tail);
    tails.push(tail);
  }
  rig.tails = tails;
  rig.tailLag = 0.22;

  for (const side of [-1, 1]) {
    // long elf ears pointing out and slightly up/back
    const ear = new THREE.Group();
    ear.position.set(side * 0.245, 0.0, -0.02);
    ear.rotation.set(0, side * 0.35, -side * (Math.PI / 2 - 0.3));
    const lobe = mesh(cone(0.05, 0.26, 14), skin, 0, 0.12, 0);
    lobe.scale.z = 0.4;
    ear.add(lobe);
    const inner = mesh(cone(0.028, 0.16, 12), '#eec0ad', 0, 0.09, 0.012);
    inner.scale.z = 0.3;
    ear.add(bare(inner));
    head.add(ear);
    const drop = new THREE.Group();
    drop.position.set(side * 0.285, -0.065, 0.015);
    drop.add(mesh(sph(0.014, 8, 6), trim));
    drop.add(mesh(cyl(0.004, 0.004, 0.03, 4), trim, 0, -0.02, 0));
    const tear = mesh(sph(0.019, 10, 8), gem, 0, -0.055, 0);
    tear.scale.set(0.75, 2, 0.75);
    drop.add(tear);
    head.add(drop);
    wobble(rig, drop, 2.5);
  }

  face(rig, p.key, {
    style: 'anime', eyeY: 132, gap: 66, ew: 27, eh: 33, lid: 8, lash: true, sleepy: 0.28,
    iris: ['#1e5a50', '#4c9c88', '#a8dcc6'], pupil: '#123832',
    brow: 'rgba(150,140,175,0.8)', browY: 84, browW: 4,
    blush: { c: 'rgba(240,150,150,0.3)', dx: 8, y: 186, rx: 18, ry: 8 },
    nose: 'rgba(200,140,130,0.55)', noseY: 168,
    mouth: 'flat', happyMouth: 'smile', mouthY: 196, mouthW: 12,
    ...p.face,
  });

  // staff: shaft, crescent holding a gem, ribbon under the head
  const staff = new THREE.Group();
  staff.add(mesh(cyl(0.02, 0.022, 1.35, 10), p.shaft, 0, 0.2, 0));
  staff.add(mesh(cyl(0.024, 0.02, 0.04, 10), trim, 0, -0.48, 0));
  staff.add(mesh(cyl(0.03, 0.025, 0.06, 12), trim, 0, 0.88, 0));
  put(staff, mesh(torus(0.1, 0.02, 28, Math.PI * 1.5), trim, 0, 1.0, 0)).rotation.z = Math.PI / 2;
  staff.add(mesh(torus(0.05, 0.008, 18), trim, 0, 1.0, 0));
  staff.add(mesh(sph(0.046, 14, 10), mat(gem, { emissive: p.glow, emissiveIntensity: 0.6 }), 0, 1.0, 0));
  staff.add(mesh(cyl(0.026, 0.026, 0.04, 10), p.ribbon, 0, 0.8, 0));
  for (const s of [-1, 1]) put(staff, mesh(rbox(0.035, 0.24, 0.006, 0.003), p.ribbon, s * 0.02, 0.68, 0.022)).rotation.z = s * 0.25;
  staff.position.set(0, -0.245, 0);
  staff.rotation.set(0.9, 0, -0.1);
  elbowR.add(staff);
  rig.prop = staff;
  rig.idle = 'staff';
  return h;
}

// Mr. Olympia: shirtless 70s champion in posing trunks.
function buildOlympia() {
  const skin = '#d49a66';
  const hairC = '#5a3820';
  const trunks = '#1f2850';
  const h = humanoid({
    skin,
    outfitKey: 'olympia',
    fabric: false,
    outfit: (c, w, hgt) => {
      c.fillStyle = skin;
      c.fillRect(0, 0, w, hgt);
      c.strokeStyle = 'rgba(110,55,20,0.4)';
      c.lineWidth = 4;
      c.lineCap = 'round';
      // pec line, six-pack, serratus and the back's spine and shoulder blades
      for (const dir of [-1, 1]) {
        c.beginPath();
        c.moveTo(w / 2, 98);
        c.quadraticCurveTo(w / 2 + dir * 60, 116, w / 2 + dir * 92, 76);
        c.stroke();
        for (const y of [120, 146, 172]) {
          c.beginPath();
          c.moveTo(w / 2 + dir * 92, y);
          c.lineTo(w / 2 + dir * 106, y + 12);
          c.stroke();
        }
        c.beginPath();
        c.moveTo(dir < 0 ? 18 : w - 18, 40);
        c.quadraticCurveTo(dir < 0 ? 70 : w - 70, 70, dir < 0 ? 40 : w - 40, 120);
        c.stroke();
      }
      c.beginPath();
      c.moveTo(w / 2, 112);
      c.lineTo(w / 2, 236);
      for (const y of [140, 172, 204]) {
        c.moveTo(w / 2 - 34, y);
        c.quadraticCurveTo(w / 2, y + 6, w / 2 + 34, y);
      }
      c.moveTo(2, 40);
      c.lineTo(2, hgt);
      c.moveTo(w - 2, 40);
      c.lineTo(w - 2, hgt);
      c.stroke();
    },
    sleeves: skin,
    pants: trunks,
    shoes: '#f2f2f2',
    bulk: true,
    bareLegs: true,
  });
  const { rig } = h;
  const { head, body, armL, armR, legL, legR, B } = rig;

  for (const side of [-1, 1]) {
    const pec = mesh(sph(0.15, 22, 16), skin, side * 0.135, 1.0, 0.19);
    pec.scale.set(1.05, 0.72, 0.5);
    pec.rotation.set(0, side * 0.3, -side * 0.12);
    body.add(pec);
  }
  for (const arm of [armL, armR]) {
    const tri = mesh(sph(B.upper, 14, 10), skin, 0, -0.13, -0.05);
    tri.scale.set(1, 1.45, 0.95);
    arm.add(tri);
  }
  for (const [leg, outer] of [[legL, -1], [legR, 1]]) {
    const sweep = mesh(sph(0.09, 14, 10), skin, outer * 0.055, -0.17, 0.02);
    sweep.scale.set(0.8, 1.5, 0.9);
    leg.add(sweep);
    leg.add(mesh(sph(0.065, 12, 10), skin, -outer * 0.05, -0.27, 0.05));
    const calf = mesh(sph(0.07, 12, 10), skin, 0, -0.34, -0.045);
    calf.scale.set(0.95, 1.3, 0.9);
    leg.add(calf);
  }

  head.scale.setScalar(0.84);
  head.position.y = 1.38;
  // broad jaw and chin
  head.add(mesh(rbox(0.32, 0.16, 0.26, 0.08), skin, 0, -0.14, 0.04));
  const chin = mesh(sph(0.07, 14, 10), skin, 0, -0.2, 0.16);
  chin.scale.set(1.3, 0.8, 0.7);
  head.add(chin);
  for (const x of [-0.262, 0.262]) {
    const ear = mesh(sph(0.055, 10, 8), skin, x, 0.0, -0.01);
    ear.scale.set(0.55, 1, 0.8);
    head.add(ear);
  }
  // 70s side part: crown pushed back to show the forehead, one swept lock, short sides
  const hairCap = mesh(dome(0.288), hairC, 0, 0.07, -0.05);
  hairCap.rotation.x = -0.5;
  hairCap.scale.x = 0.97;
  head.add(hairCap);
  const swoop = mesh(sph(0.15, 18, 12), hairC, 0.04, 0.215, 0.07);
  swoop.scale.set(1.55, 0.42, 1.0);
  swoop.rotation.set(-0.35, 0, -0.28);
  head.add(swoop);
  for (const x of [-0.25, 0.25]) head.add(mesh(rbox(0.035, 0.09, 0.07, 0.015), hairC, x, 0.01, 0.03));
  const nose = bare(mesh(sph(0.034, 12, 10), skin, 0, -0.02, 0.27));
  nose.scale.set(1.1, 0.9, 0.7);
  head.add(nose);
  face(rig, 'olympia', {
    style: 'anime', eyeY: 96, gap: 86, ew: 27, eh: 22, lid: 9, sleepy: 0.15,
    iris: ['#22323e', '#4f6f86', '#9fb8c8'], pupil: '#141c22',
    brow: '#4a2e18', browY: 58, browW: 15,
    mouth: 'grin', happyMouth: 'grin', mouthY: 204, mouthW: 70, lip: '#6a3020', mouthIn: '#7a2626',
  });
  rig.idle = 'flex';
  return h;
}

// Chess knight: no legs, it hops. Built on the humanoid rig for its arms, everything else hidden.
function buildKnight() {
  const ivory = '#efe6d2';
  const shade = '#d6c8aa';
  const dark = '#2a2622';
  const h = humanoid({ skin: ivory, outfitKey: 'knight', outfit: OUTFITS.plain(ivory), sleeves: ivory, pants: ivory, shoes: ivory, fabric: false });
  const { rig } = h;
  const { body, head, torso, legL, legR } = rig;
  torso.visible = false;
  body.children[1].visible = false;
  body.children[2].visible = false;
  legL.visible = legR.visible = false;
  head.children[0].visible = false;

  const profile = [[0, 0], [0.34, 0], [0.36, 0.035], [0.35, 0.07], [0.3, 0.09], [0.31, 0.13], [0.26, 0.16], [0.21, 0.2], [0.19, 0.27], [0.2, 0.31], [0.17, 0.34], [0.165, 0.5], [0.18, 0.7], [0.22, 0.9], [0.23, 1.02], [0.2, 1.12], [0.12, 1.2], [0, 1.22]];
  body.add(mesh(cached('knightBody', () => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 36)), ivory));
  put(body, mesh(torus(0.2, 0.025, 28), shade, 0, 0.31, 0)).rotation.x = Math.PI / 2;

  const neck = mesh(sph(0.17, 18, 14), ivory, 0, -0.12, -0.02);
  neck.scale.set(1, 1.45, 1.1);
  neck.rotation.x = 0.25;
  head.add(neck);
  const skull = mesh(sph(0.18, 20, 14), ivory, 0, 0.1, 0.05);
  skull.scale.set(0.95, 0.95, 1.15);
  head.add(skull);
  const snout = mesh(rbox(0.2, 0.17, 0.26, 0.07), ivory, 0, 0.0, 0.2);
  snout.rotation.x = 0.45;
  head.add(snout);
  const muzzle = mesh(sph(0.1, 16, 12), ivory, 0, -0.08, 0.31);
  muzzle.scale.set(1, 0.85, 0.8);
  head.add(muzzle);
  for (const x of [-0.04, 0.04]) head.add(bare(mesh(sph(0.016, 8, 6), dark, x, -0.07, 0.385)));
  for (const x of [-0.07, 0.07]) {
    const ear = mesh(cone(0.05, 0.14, 10), ivory, x, 0.29, -0.02);
    ear.rotation.set(-0.2, 0, -x * 3.5);
    head.add(ear);
  }
  for (let i = 0; i < 6; i++) {
    const tuft = mesh(sph(0.06, 10, 8), shade, 0, 0.24 - i * 0.09, -0.15 - i * 0.012);
    tuft.scale.set(0.5, 1, 1.2);
    head.add(tuft);
  }
  const blink = [];
  for (const x of [-0.09, 0.09]) {
    blink.push(put(head, mesh(sph(0.045, 14, 10), '#ffffff', x, 0.13, 0.19)));
    blink.push(put(head, mesh(sph(0.024, 10, 8), dark, x, 0.13, 0.226)));
    blink.push(put(head, mesh(sph(0.008, 6, 4), '#ffffff', x + 0.008, 0.142, 0.246)));
  }
  blinkers(rig, blink);
  rig.hop = true;
  return h;
}

// Claude Code robot: cream shell, terminal on the chest, the Claude spark on its head.
function buildClaudeBot() {
  const cream = '#f0eee6';
  const clay = '#d97757';
  const dark = '#2b2a27';
  const metal = '#c9c4b6';
  const h = humanoid({ skin: dark, outfitKey: 'claudebot', outfit: OUTFITS.plain(cream), sleeves: metal, forearms: metal, pants: dark, shoes: clay, sole: dark, fabric: false });
  const { rig } = h;
  const { body, head, torso } = rig;
  torso.visible = false;
  body.add(mesh(rbox(0.52, 0.58, 0.38, 0.09), cream, 0, 0.92, 0));
  body.add(mesh(rbox(0.535, 0.06, 0.39, 0.025), clay, 0, 0.68, 0));
  body.add(mesh(rbox(0.3, 0.2, 0.03, 0.02), dark, 0, 0.98, 0.18));
  const term = canvasTexture(128, 80, (c, w, hh) => {
    c.fillStyle = '#1f1e1d';
    c.fillRect(0, 0, w, hh);
    c.fillStyle = clay;
    c.font = 'bold 46px monospace';
    c.textBaseline = 'middle';
    c.fillText('>', 18, hh / 2 + 2);
    c.fillRect(58, hh / 2 + 12, 30, 7);
  });
  body.add(bare(mesh(new THREE.PlaneGeometry(0.26, 0.16), texMat(term, { emissive: '#ffffff', emissiveIntensity: 0.15 }), 0, 0.98, 0.197)));

  head.children[0].visible = false;
  head.add(mesh(rbox(0.5, 0.4, 0.44, 0.1), cream, 0, 0.02, 0));
  head.add(mesh(rbox(0.4, 0.24, 0.03, 0.03), dark, 0, 0.0, 0.215));
  const glowMat = mat(clay, { emissive: clay, emissiveIntensity: 0.6 });
  const blink = [];
  for (const x of [-0.08, 0.08]) blink.push(put(head, bare(mesh(rbox(0.055, 0.1, 0.02, 0.02), glowMat, x, 0.01, 0.232))));
  blinkers(rig, blink);
  for (const x of [-0.26, 0.26]) put(head, mesh(cyl(0.06, 0.06, 0.05, 16), clay, x, 0, 0)).rotation.z = Math.PI / 2;
  head.add(mesh(cyl(0.015, 0.02, 0.1, 8), dark, 0, 0.26, 0));
  // the Claude spark: rounded rays of slightly different lengths
  const spark = new THREE.Group();
  spark.position.set(0, 0.36, 0.02);
  [0.12, 0.1, 0.115, 0.095, 0.12, 0.105, 0.11, 0.098, 0.118, 0.1, 0.108].forEach((len, i, all) => {
    const a = (i / all.length) * TAU + 0.15;
    const ray = mesh(rbox(len, 0.03, 0.03, 0.013), clay, Math.cos(a) * len * 0.5, Math.sin(a) * len * 0.5, 0);
    ray.rotation.z = a;
    spark.add(ray);
  });
  head.add(spark);
  wobble(rig, spark, 1.2);
  rig.idle = 'wave';
  return h;
}

// Mr Franklyn: dark suit, and a teal badge with a graduation cap where his head should be.
function buildFranklyn() {
  const suit = '#1c1d23';
  const teal = '#183f48';
  const h = humanoid({
    skin: '#e9c6a5',
    outfitKey: 'franklyn',
    outfit: (c, w, hgt) => {
      c.fillStyle = suit;
      c.fillRect(0, 0, w, hgt);
      c.fillStyle = '#f4f4f2';
      c.beginPath();
      c.moveTo(w / 2 - 46, 0);
      c.lineTo(w / 2 + 46, 0);
      c.lineTo(w / 2, 150);
      c.closePath();
      c.fill();
      c.fillStyle = '#0e0e12';
      c.beginPath();
      c.moveTo(w / 2 - 9, 14);
      c.lineTo(w / 2 + 9, 14);
      c.lineTo(w / 2 + 6, 30);
      c.lineTo(w / 2 + 11, 140);
      c.lineTo(w / 2, 152);
      c.lineTo(w / 2 - 11, 140);
      c.lineTo(w / 2 - 6, 30);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.12)';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(w / 2 - 46, 0);
      c.lineTo(w / 2 - 6, 160);
      c.moveTo(w / 2 + 46, 0);
      c.lineTo(w / 2 + 6, 160);
      c.moveTo(w / 2 + 60, 92);
      c.lineTo(w / 2 + 100, 92);
      c.stroke();
      c.fillStyle = '#34353d';
      for (const y of [176, 214]) {
        c.beginPath();
        c.arc(w / 2, y, 6, 0, TAU);
        c.fill();
      }
    },
    sleeves: suit,
    pants: suit,
    shoes: '#121216',
    sole: '#2a2a30',
  });
  const { rig } = h;
  const { body, head } = rig;
  body.children[2].material = mat(teal);

  head.children[0].visible = false;
  const badge = new THREE.Group();
  badge.position.y = 0.02;
  badge.rotation.x = -0.2;
  const disc = mesh(cyl(0.3, 0.3, 0.07, 48), teal);
  disc.rotation.x = Math.PI / 2;
  badge.add(disc);
  for (const z of [-0.036, 0.036]) badge.add(mesh(torus(0.29, 0.017, 48), '#7db7b0', 0, 0, z));
  const icon = canvasTexture(256, 256, (c) => {
    c.fillStyle = teal;
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#eef0ee';
    c.beginPath();
    c.moveTo(48, 106);
    c.lineTo(136, 62);
    c.lineTo(214, 104);
    c.lineTo(128, 148);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(80, 132);
    c.lineTo(80, 162);
    c.lineTo(128, 190);
    c.lineTo(176, 162);
    c.lineTo(176, 132);
    c.lineTo(128, 158);
    c.closePath();
    c.fill();
    c.fillRect(190, 108, 12, 64);
  });
  badge.add(bare(mesh(new THREE.CircleGeometry(0.278, 48), texMat(icon), 0, 0, 0.0365)));
  head.add(badge);
  return h;
}

export const CHARACTERS = [
  {
    id: 'morel', name: 'Chef Morel', level: 1, tier: 'free',
    build() {
      const h = humanoid({ skin: '#e6b48c', outfitKey: 'morel', outfit: OUTFITS.chef('#f4efe3', '#c8b89a'), sleeves: '#f4efe3', pants: '#557d3a', shoes: '#5b3a24' });
      const { rig } = h;
      collar(rig, '#f4efe3');
      buttons(rig, '#c8b89a', [60, 105, 150, 195]);
      face(rig, 'morel', { eyeY: 100, gap: 82, ew: 18, eh: 27, brow: '#4a2c1c', browY: 58, browW: 10, mouthY: 224, mouthW: 12, blush: 'rgba(232,110,90,0.32)' });
      mustache(rig.head);
      wobble(rig, mushroomCap(rig.head, '#d83a2c', '#fff7ee'));
      return h;
    },
  },
  {
    id: 'rocco', name: 'Rocco', level: 1, tier: 'free',
    build() {
      const h = humanoid({ skin: '#8e8e98', outfitKey: 'rocco', outfit: OUTFITS.jacket('#4e7e3f', '#e5559a', '#3fb3a8'), sleeves: '#4e7e3f', pants: '#222228', shoes: '#ececec' });
      const { rig } = h;
      collar(rig, '#4e7e3f', 0.55);
      for (const x of [131, 381]) stick(rig, mesh(rbox(0.08, 0.026, 0.018, 0.008), '#3d6631'), x, 172, 0.006);
      raccoonHead(rig);
      wobble(rig, raccoonTail(rig.body), 1.6, true);
      wobble(rig, bucketHat(rig.head, '#ef7a1a', '#3fb3a8'));
      return h;
    },
  },
  {
    id: 'violet', name: 'Violet', level: 2, tier: 'free',
    build() {
      const h = humanoid({ skin: '#9b6fc4', outfitKey: 'violet', outfit: OUTFITS.chef('#f6f1e6', '#c8b89a', '#f07d1e'), sleeves: '#f6f1e6', pants: '#7d4fa8', shoes: '#4b2a1a' });
      const { rig } = h;
      put(rig.body, mesh(torus(0.12, 0.045, 20), '#f07d1e', 0, 1.2, 0.02)).rotation.x = Math.PI / 2;
      buttons(rig, '#c8b89a', [60, 105]);
      apron(rig, '#f07d1e');
      face(rig, 'violet', { eyeY: 108, gap: 80, ew: 18, eh: 27, lash: true, brow: '#4d2f6e', browY: 68, mouthY: 194, blush: 'rgba(255,130,170,0.45)' });
      wobble(rig, mushroomCap(rig.head, '#b58ade', '#efe1fb'));
      return h;
    },
  },
  {
    id: 'sprinkles', name: 'Sprinkles', level: 3, tier: 'free',
    build() {
      const h = humanoid({ skin: '#f3c9a6', outfitKey: 'sprinkles', outfit: OUTFITS.chef('#f4efe3', '#e5559a'), sleeves: '#f4efe3', pants: '#ef7a2a', shoes: '#1e1e1e' });
      const { rig } = h;
      const head = rig.head;
      collar(rig, '#f4efe3');
      buttons(rig, '#e5559a', [60, 105, 150, 195]);
      const hair = mesh(sph(0.295, 24, 18), '#e0682a', 0, 0.02, -0.035);
      head.add(hair);
      const bangs = mesh(sph(0.2, 16, 12), '#e0682a', 0, 0.15, 0.13);
      bangs.scale.set(1.3, 0.5, 0.7);
      head.add(bangs);
      face(rig, 'sprinkles', { eyeY: 108, gap: 82, ew: 18, eh: 27, lash: true, brow: '#b5501f', browY: 66, mouthY: 194, blush: 'rgba(240,120,140,0.55)', freckles: 'rgba(190,100,60,0.55)' });
      const hat = new THREE.Group();
      hat.position.y = 0.22;
      hat.add(mesh(cyl(0.22, 0.17, 0.16, 24), '#c76a8c', 0, 0.08, 0));
      const f1 = mesh(sph(0.25, 20, 14), '#f7b6d2', 0, 0.2, 0);
      f1.scale.y = 0.55;
      hat.add(f1);
      const f2 = mesh(sph(0.17, 18, 12), '#f9c6dd', 0, 0.31, 0);
      f2.scale.y = 0.6;
      hat.add(f2);
      hat.add(mesh(sph(0.1, 14, 10), '#fbd5e6', 0, 0.4, 0));
      hat.add(mesh(sph(0.055, 12, 10), '#d4182d', 0, 0.52, 0));
      const sprinkleColors = ['#4fc3f7', '#ffd54f', '#81c784', '#ffffff'];
      for (let i = 0; i < 10; i++) {
        const a = i * 2.4;
        const s = mesh(rbox(0.05, 0.015, 0.015, 0.006), sprinkleColors[i % 4], Math.cos(a) * 0.17, 0.26 + (i % 3) * 0.02, Math.sin(a) * 0.17);
        s.rotation.y = a;
        hat.add(s);
      }
      head.add(hat);
      wobble(rig, hat, 1.3);
      return h;
    },
  },
  {
    id: 'pump', name: 'Mr. Second Place', level: 1, tier: 'gold',
    build() {
      const tan = '#b57440';
      const blue = '#2350d8';
      const h = humanoid({ skin: tan, outfitKey: 'pump2', outfit: OUTFITS.stringer(tan, blue, '#ffffff'), sleeves: tan, pants: blue, shoes: '#f2f2f2', bulk: true, bareLegs: true, fabric: false });
      const { head, elbowL, elbowR, B } = h.rig;
      head.scale.setScalar(0.88);
      head.position.y = 1.4;
      head.children[0].scale.set(0.9, 1.1, 0.95);
      head.add(mesh(rbox(0.3, 0.15, 0.25, 0.07), tan, 0, -0.15, 0.04));
      for (const x of [-0.245, 0.245]) {
        const ear = mesh(sph(0.055, 10, 8), tan, x, 0.0, -0.01);
        ear.scale.set(0.55, 1, 0.8);
        head.add(ear);
      }
      const cap = mesh(dome(0.282), '#1e140e', 0, 0.03, -0.02);
      cap.scale.set(0.93, 1.06, 0.99);
      cap.rotation.x = -0.32;
      head.add(cap);
      for (let i = 0; i < 18; i++) {
        const a = i * 2.39996;
        const r = 0.03 + (i / 18) * 0.15;
        const curl = mesh(sph(0.04, 8, 6), '#2a1c12', Math.cos(a) * r, 0.315 - r * r * 2.2, Math.sin(a) * r - 0.01);
        curl.scale.y = 0.65;
        head.add(curl);
      }
      const blink = [];
      for (const x of [-0.085, 0.085]) {
        const white = mesh(sph(0.036, 12, 10), '#f6efe4', x, 0.025, 0.232);
        white.scale.set(1.25, 0.62, 0.6);
        blink.push(put(head, bare(white)));
        blink.push(put(head, mesh(sph(0.019, 10, 8), '#2a1608', x, 0.025, 0.25)));
        blink.push(put(head, mesh(sph(0.0055, 6, 4), '#ffffff', x + 0.006, 0.031, 0.268)));
        const brow = bare(mesh(rbox(0.1, 0.026, 0.035, 0.01), '#1e140e', x, 0.075, 0.24));
        brow.rotation.z = x < 0 ? -0.18 : 0.18;
        head.add(brow);
      }
      blinkers(h.rig, blink);
      const nose = bare(mesh(sph(0.038, 10, 8), '#a5663a', 0, -0.035, 0.265));
      nose.scale.set(1.15, 0.85, 0.9);
      head.add(nose);
      head.add(bare(mesh(rbox(0.13, 0.04, 0.02, 0.012), '#6e3a1e', 0, -0.115, 0.248)));
      head.add(bare(mesh(rbox(0.11, 0.022, 0.022, 0.008), '#fdf8ee', 0, -0.113, 0.252)));
      for (const elbow of [elbowL, elbowR]) elbow.add(mesh(cyl(B.fore * 1.18, B.fore * 1.18, 0.07, 16), '#ffffff', 0, -0.17, 0));
      h.rig.idle = 'flex';
      return h;
    },
  },
  {
    id: 'olympia', name: 'Mr. Olympia', level: 4, tier: 'gold', variantOf: 'pump',
    build: buildOlympia,
  },
  {
    id: 'bianco', name: 'Tonio', level: 1, tier: 'gold',
    build() {
      const skin = '#f2c9a2';
      const hair = '#c0915a';
      const white = '#f7f5f0';
      const gold = '#d4af37';
      const red = '#c81e2a';
      const h = humanoid({ skin, outfitKey: 'bianco', outfit: OUTFITS.italian(white, gold, '#cfcac0'), sleeves: white, forearms: skin, pants: white, shoes: '#3a2a20', scale: 1.04 });
      const { rig } = h;
      const { head, body } = rig;
      buttons(rig, gold, [50, 88], 22, 0.017);
      // gold T pin on the chest, apron under a wrapped cloth sash
      stick(rig, group(mesh(rbox(0.05, 0.013, 0.01, 0.004), gold, 0, 0.012, 0), mesh(rbox(0.013, 0.045, 0.01, 0.004), gold, 0, -0.008, 0)), 256 + 70, 66, 0.008);
      apron(rig, white);
      for (const [cy, lift] of [[140, 0.028], [157, 0.04], [174, 0.03]]) {
        const v = 1 - cy / 256;
        const r = profAt(rig.torsoP, v) + lift;
        const wrap = mesh(cyl(r, r * 1.02, 0.05, 32), '#fbfaf6', 0, TORSO_Y + TORSO_H * v, 0);
        wrap.scale.set(rig.torso.scale.x, 1, rig.torso.scale.z);
        body.add(wrap);
      }

      const hairCap = mesh(dome(0.28), hair, 0, 0.05, -0.04);
      hairCap.rotation.x = -0.35;
      head.add(hairCap);
      for (const x of [-0.2, 0.2]) {
        const side = mesh(sph(0.1, 12, 10), hair, x, 0.06, 0.02);
        side.scale.set(0.5, 1.1, 1.1);
        head.add(side);
      }
      const quiff = mesh(sph(0.12, 14, 10), hair, -0.07, 0.16, 0.15);
      quiff.scale.set(1.3, 0.45, 0.6);
      quiff.rotation.z = 0.25;
      head.add(quiff);
      head.add(bare(mesh(sph(0.032, 10, 8), '#e0a882', 0, -0.025, 0.272)));
      face(rig, 'tonio', {
        style: 'anime', eyeY: 98, gap: 78, ew: 22, eh: 22, lid: 8, sleepy: 0.3,
        iris: ['#1d3f5a', '#4a7fa0', '#a8c8dc'], pupil: '#10222e',
        brow: '#7a5530', browY: 62, browW: 9,
        mouth: 'smirk', happyMouth: 'smirk', mouthY: 205, mouthW: 22, lip: '#8a4a3a',
      });

      // tall flat-topped toque with the gold T badge
      const toque = new THREE.Group();
      toque.position.y = 0.2;
      toque.add(mesh(cyl(0.232, 0.222, 0.12, 32), '#ebe7de', 0, 0.06, 0));
      toque.add(mesh(cyl(0.245, 0.225, 0.5, 32), white, 0, 0.36, 0));
      put(toque, mesh(torus(0.24, 0.012, 32), '#ebe7de', 0, 0.61, 0)).rotation.x = Math.PI / 2;
      toque.add(mesh(rbox(0.085, 0.085, 0.02, 0.012), gold, 0, 0.07, 0.228));
      toque.add(bare(mesh(rbox(0.056, 0.014, 0.012, 0.004), '#8a6a14', 0, 0.092, 0.24)));
      toque.add(bare(mesh(rbox(0.014, 0.05, 0.012, 0.004), '#8a6a14', 0, 0.064, 0.24)));
      head.add(toque);
      wobble(rig, toque, 0.7);

      // knotted red neckerchief with the ends hanging off to one side
      put(body, mesh(torus(0.11, 0.035, 18), red, 0, 1.22, 0.02)).rotation.x = Math.PI / 2;
      body.add(mesh(sph(0.045, 12, 10), red, 0.03, 1.15, 0.15));
      const endA = mesh(rbox(0.07, 0.17, 0.015, 0.012), red, 0.07, 1.06, 0.17);
      endA.rotation.set(-0.2, 0, 0.4);
      body.add(endA);
      const endB = mesh(rbox(0.06, 0.14, 0.015, 0.012), '#a8161f', 0.0, 1.07, 0.168);
      endB.rotation.set(-0.2, 0, -0.1);
      body.add(endB);

      const knife = new THREE.Group();
      knife.add(mesh(rbox(0.035, 0.12, 0.035, 0.012), '#2a2024', 0, 0, 0));
      knife.add(mesh(rbox(0.065, 0.36, 0.014, 0.005), '#9fb2c0', 0.012, 0.24, 0));
      knife.position.set(0, -0.26, 0.03);
      knife.rotation.x = Math.PI / 2;
      rig.elbowR.add(knife);
      rig.prop = knife;
      rig.propRest = knife.rotation.clone();
      // blade up beside the chest while the arms are crossed
      rig.propPose = new THREE.Euler(2.935, 0.426, -1.188);
      rig.idle = 'crossed';
      return h;
    },
  },
  {
    id: 'miku', name: 'Miku', level: 1, tier: 'gold',
    build: buildMiku,
  },
  {
    id: 'teto', name: 'Kasane Teto', level: 3, tier: 'gold', variantOf: 'miku',
    build: buildTeto,
  },
  {
    id: 'frieren', name: 'Frieren', level: 1, tier: 'gold',
    build: () => buildFrieren(FRIEREN),
  },
  {
    id: 'gothfrieren', name: 'Goth Frieren', level: 5, tier: 'gold', variantOf: 'frieren',
    build: () => buildFrieren(GOTH_FRIEREN),
  },
  {
    id: 'bandit', name: 'Bandit', level: 5, tier: 'gold',
    build() {
      const h = humanoid({ skin: '#7c7c86', outfitKey: 'bandit', outfit: OUTFITS.vest('#1e1e22', '#f2f2f2', '#e8c23a'), sleeves: '#f2f2f2', pants: '#3d2c22', shoes: '#ececec' });
      const { rig } = h;
      raccoonHead(rig, '#7c7c86');
      wobble(rig, raccoonTail(rig.body, '#7c7c86'), 1.6, true);
      const chain = mesh(torus(0.12, 0.018, 24), '#f2c230', 0, 1.13, 0.06);
      chain.rotation.x = 1.25;
      rig.body.add(chain);
      rig.head.add(mesh(rbox(0.4, 0.07, 0.05, 0.02), '#111', 0, 0.04, 0.27));
      const peel = new THREE.Group();
      peel.position.y = 0.27;
      for (let i = 0; i < 4; i++) {
        const p = mesh(rbox(0.07, 0.22, 0.03, 0.03), '#f4d03f', 0, 0.06, 0);
        p.position.set(Math.cos(i * 1.57) * 0.06, 0.02, Math.sin(i * 1.57) * 0.06);
        p.rotation.set(Math.sin(i * 1.57) * 0.9, 0, -Math.cos(i * 1.57) * 0.9);
        peel.add(p);
      }
      peel.add(mesh(cyl(0.05, 0.06, 0.12, 12), '#f4d03f', 0, 0.06, 0));
      peel.add(mesh(cyl(0.015, 0.02, 0.06, 6), '#5b3a24', 0, 0.15, 0));
      rig.head.add(peel);
      wobble(rig, peel, 1.4);
      return h;
    },
  },
  {
    id: 'knight', name: 'Chess Knight', level: 6, tier: 'gold',
    build: buildKnight,
  },
  {
    id: 'maki', name: 'Maki-san', level: 7, tier: 'gold',
    build() {
      const h = humanoid({ skin: '#f6f3ea', outfitKey: 'maki', outfit: OUTFITS.tunic('#2e7d4f', '#e2402f'), sleeves: '#2e7d4f', pants: '#1f3d2b', shoes: '#e2402f' });
      const { rig } = h;
      const head = rig.head;
      belt(rig, '#e2402f', '#f2c230', 168, 190);
      head.children[0].visible = false;
      head.add(mesh(cyl(0.3, 0.3, 0.44, 32), '#1f3326', 0, 0.02, 0));
      head.add(mesh(cyl(0.27, 0.27, 0.45, 32), '#f8f6ef', 0, 0.02, 0));
      head.add(mesh(cyl(0.12, 0.12, 0.46, 20), '#f07a4a', 0, 0.02, 0));
      head.add(mesh(cyl(0.05, 0.05, 0.47, 12), '#7bc47f', 0.07, 0.02, 0.03));
      const blink = [];
      for (const x of [-0.1, 0.1]) {
        blink.push(put(head, mesh(sph(0.06, 14, 10), '#ffffff', x, 0.06, 0.28)));
        blink.push(put(head, mesh(sph(0.03, 10, 8), '#111', x, 0.06, 0.33)));
        blink.push(put(head, mesh(sph(0.009, 6, 4), '#ffffff', x + 0.01, 0.072, 0.358)));
      }
      blinkers(rig, blink);
      return h;
    },
  },
  {
    id: 'claudebot', name: 'Claude Bot', level: 8, tier: 'gold',
    build: buildClaudeBot,
  },
  {
    id: 'franklyn', name: 'Mr Franklyn', level: 9, tier: 'gold',
    build: buildFranklyn,
  },
];

/* ---------- finishing: rim-lit toon materials + ink outlines ---------- */

const charMats = new WeakMap();
function charMat(m) {
  if (!m.isMeshToonMaterial) return m;
  let c = charMats.get(m);
  if (c) return c;
  c = m.clone();
  c.gradientMap = charToneMap;
  c.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float rim = smoothstep(0.6, 0.68, 1.0 - saturate(dot(normal, normalize(vViewPosition)))) * saturate(0.25 + normal.y);
      outgoingLight = mix(outgoingLight, outgoingLight * 1.3 + vec3(0.05, 0.045, 0.04), rim);
      #include <opaque_fragment>`,
    );
  };
  c.customProgramCacheKey = () => 'char-rim';
  charMats.set(m, c);
  return c;
}

// Inverted hull: pushed out along smoothed normals, back faces only. Width grows with
// view depth so the line stays roughly the same on screen in the lobby and in game.
const OUTLINE_VS = `
attribute vec3 outlineNormal;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  mv.xyz += normalize(normalMatrix * outlineNormal) * (0.0055 + 0.0013 * -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const OUTLINE_FS = `
uniform vec3 color;
void main() {
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;
const outlineMats = new Map();
function outlineMat(src) {
  const color = new THREE.Color('#2b1c22');
  if (!src.map) {
    const hsl = src.color.getHSL({}, THREE.SRGBColorSpace);
    color.setHSL(hsl.h, Math.min(1, hsl.s * 1.15), Math.min(hsl.l, 0.75) * 0.3, THREE.SRGBColorSpace);
  }
  const key = color.getHexString();
  if (!outlineMats.has(key))
    outlineMats.set(key, new THREE.ShaderMaterial({ uniforms: { color: { value: color } }, vertexShader: OUTLINE_VS, fragmentShader: OUTLINE_FS, side: THREE.BackSide }));
  return outlineMats.get(key);
}

// Averages normals of coincident vertices so hard-edged shapes (cylinder caps, boxes) don't crack the hull.
function outlineNormals(geo) {
  if (geo.attributes.outlineNormal) return;
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const sums = new Map();
  const keys = [];
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
    keys.push(k);
    let s = sums.get(k);
    if (!s) sums.set(k, (s = new THREE.Vector3()));
    s.x += nor.getX(i);
    s.y += nor.getY(i);
    s.z += nor.getZ(i);
  }
  const out = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.copy(sums.get(keys[i]));
    if (v.lengthSq() < 1e-8) v.fromBufferAttribute(nor, i);
    v.normalize().toArray(out, i * 3);
  }
  geo.setAttribute('outlineNormal', new THREE.BufferAttribute(out, 3));
}

function addOutlines(root) {
  root.updateMatrixWorld(true);
  const list = [];
  root.traverse((o) => {
    if (o.isMesh && o.visible && !o.userData.noOutline && o.material.isMeshToonMaterial && !o.material.transparent) list.push(o);
  });
  const s = new THREE.Vector3();
  for (const m of list) {
    const g = m.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    m.getWorldScale(s);
    if (g.boundingSphere.radius * Math.max(s.x, s.y, s.z) < 0.035) continue;
    outlineNormals(g);
    const o = new THREE.Mesh(g, outlineMat(m.material));
    o.userData.outline = true;
    o.raycast = () => {};
    m.add(o);
  }
}

function finish(h) {
  h.root.traverse((o) => o.isMesh && (o.material = charMat(o.material)));
  addOutlines(h.root);
  return h;
}

export function buildCharacter(id, { silhouette = false } = {}) {
  const def = CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
  const h = finish(def.build());
  if (silhouette)
    h.root.traverse((o) => {
      if (!o.isMesh) return;
      if (o.userData.outline) o.visible = false;
      else o.material = silhouetteMat;
    });
  return h;
}

const SKINS = ['#f3c9a6', '#e6b48c', '#c98d62', '#8d5a3b', '#5e3a26', '#f7d9c4'];
const SHIRTS = ['#3fb3a8', '#e5559a', '#f39a2b', '#5a8de0', '#8bc34a', '#f4d03f', '#ef5350', '#9575cd', '#26c6da'];
const HAIR = ['#2b1d16', '#e0682a', '#f4d03f', '#5b3a24', '#1e1e1e', '#3fb3a8', '#e5559a', '#9a9a9a'];
const CUSTOMER_FACES = [
  { eyeY: 126, gap: 78, ew: 16, eh: 23, brow: '#3b2a22', browY: 84, mouthY: 198 },
  { eyeY: 126, gap: 78, ew: 17, eh: 24, lash: true, brow: '#3b2a22', browY: 84, mouthY: 198, blush: 'rgba(240,120,130,0.4)' },
  { eyeY: 126, gap: 80, ew: 14, eh: 19, brow: '#3b2a22', browY: 88, browW: 10, mouthY: 198, mouthW: 13 },
];

export function buildCustomer(rng = Math.random) {
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const shirt = pick(SHIRTS);
  const stripe = rng() < 0.35 ? pick(['#ffffff', '#1e1e24', '#f4d03f']) : null;
  const h = humanoid({
    skin: pick(SKINS),
    outfitKey: `c${shirt}${stripe}`,
    outfit: stripe ? OUTFITS.striped(shirt, stripe) : OUTFITS.plain(shirt),
    sleeves: shirt,
    pants: pick(['#2d3a5a', '#3a3a3a', '#6d4c41', '#455a64']),
    shoes: pick(['#222', '#eee', '#c0392b']),
    scale: 1.0 + rng() * 0.12,
  });
  const head = h.rig.head;
  const style = Math.floor(rng() * 4);
  const hc = pick(HAIR);
  if (style === 0) {
    const cap = mesh(dome(0.29), hc, 0, 0.02, -0.02);
    head.add(cap);
  } else if (style === 1) {
    head.add(mesh(sph(0.3, 24, 16), hc, 0, 0.03, -0.06));
    const bangs = mesh(sph(0.2, 14, 10), hc, 0, 0.16, 0.12);
    bangs.scale.set(1.3, 0.45, 0.7);
    head.add(bangs);
  } else if (style === 2) {
    const cap = mesh(dome(0.29), hc, 0, 0.02, -0.02);
    head.add(cap);
    const bun = mesh(sph(0.12, 16, 12), hc, 0, 0.3, -0.1);
    head.add(bun);
  } else {
    const c = pick(SHIRTS);
    head.add(mesh(dome(0.29), c, 0, 0.06, 0));
    const brim = mesh(rbox(0.3, 0.03, 0.22, 0.01), c, 0, 0.08, 0.24);
    head.add(brim);
  }
  put(h.rig.body, mesh(torus(h.rig.B.neck * 1.25, 0.018, 20), shirt, 0, 1.19, 0)).rotation.x = Math.PI / 2;
  const v = Math.floor(rng() * CUSTOMER_FACES.length);
  face(h.rig, `cust${v}`, CUSTOMER_FACES[v]);
  // look up at the kitchen so faces read from the high game camera
  h.rig.headPitch = -0.3;
  return finish(h);
}

/* ---------- animation ---------- */

const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function spring(s, goal, dt, k, d) {
  s.v += ((goal - s.x) * k - s.v * d) * dt;
  s.x += s.v * dt;
  return s.x;
}

function aimArm(arm, elbow, x, y, z, ex, ey, k, ez = 0) {
  arm.rotation.x = lerp(arm.rotation.x, x, k);
  arm.rotation.y = lerp(arm.rotation.y, y, k);
  arm.rotation.z = lerp(arm.rotation.z, z, k);
  elbow.rotation.x = lerp(elbow.rotation.x, ex, k);
  elbow.rotation.y = lerp(elbow.rotation.y, ey, k);
  elbow.rotation.z = lerp(elbow.rotation.z, ez, k);
}

function updateFace(rig, t) {
  if (!rig.face && !rig.blinkers) return;
  if (rig.blinkP === undefined) {
    rig.blinkP = 3 + (rig.phase % 1) * 2.2;
    // offset keeps t = 0 (portrait renders) clear of a blink
    rig.blinkS = ((rig.phase * 0.37) % 1) * (rig.blinkP - 0.5);
  }
  const P = rig.blinkP;
  const k = (((t + rig.blinkS) % P) + P) % P;
  const shut = k > P - 0.13 || (rig.phase > 4.5 && k > P - 0.45 && k < P - 0.32);
  const expr = rig.expr || 'idle';
  rig.face?.set(shut && expr !== 'happy' ? 'blink' : expr);
  if (rig.blinkers) for (const b of rig.blinkers) b.scale.y = b.userData.sy * (shut ? 0.12 : 1);
}

export function animateRig(rig, dt, moveAmt, carrying, t) {
  const target = Math.min(1, moveAmt);
  const step = Math.max(dt, 1e-3);
  const vy = rig.lastY === undefined ? 0 : (rig.body.position.y - rig.lastY) / step;
  rig.lastY = rig.body.position.y;
  const yaw = rig.body.parent ? rig.body.parent.rotation.y : 0;
  const turn = rig.yaw === undefined ? 0 : clamp(wrapAngle(yaw - rig.yaw) / step, -9, 9);
  rig.yaw = yaw;
  rig.turn = lerp(rig.turn || 0, turn, Math.min(1, dt * 8));

  let swing, sy;
  let flap = 0;
  if (rig.hop) {
    // no legs: travel in hops, big squash on landing, arms flap out in the air
    rig.phase += dt * (4.5 + 3.5 * target);
    const air = Math.abs(Math.sin(rig.phase));
    swing = 0;
    flap = air * target * 0.5;
    rig.body.position.y = air ** 0.7 * 0.24 * target + Math.max(0, Math.sin(t * 2.4)) ** 6 * 0.03 * (1 - target);
    sy = 1 + target * (air * 0.08 - (1 - air) ** 6 * 0.22);
  } else {
    rig.phase += dt * (6 + 6 * target);
    swing = Math.sin(rig.phase) * 0.7 * target;
    rig.legL.rotation.x = swing;
    rig.legR.rotation.x = -swing;
    const bounce = Math.abs(Math.sin(rig.phase));
    rig.body.position.y = bounce * 0.05 * target + Math.sin(t * 2) * 0.006;
    // squash on foot plant, stretch at the top of the step, slow breathing at rest
    sy = 1 + target * (bounce * 0.035 - (1 - bounce) ** 4 * 0.06) + Math.sin(t * 2) * 0.006 * (1 - target);
  }
  rig.body.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
  const k = Math.min(1, dt * 14);
  rig.body.rotation.x = lerp(rig.body.rotation.x, target * (carrying ? 0.05 : 0.12), k * 0.5);

  const out = rig.bulk ? 0.2 : 0;
  if (rig.prop) rig.prop.visible = !carrying;
  if (rig.propRest) rig.prop.rotation.copy(rig.propRest);
  rig.swingL ||= { x: 0, v: 0 };
  rig.swingR ||= { x: 0, v: 0 };
  if (carrying) {
    const inward = rig.bulk ? 0.35 : 0;
    aimArm(rig.armL, rig.elbowL, -0.45, 0, -0.16 - out, -1.2, inward, k);
    aimArm(rig.armR, rig.elbowR, -0.45, 0, 0.16 + out, -1.2, -inward, k);
    rig.swingL.x = rig.armL.rotation.x;
    rig.swingR.x = rig.armR.rotation.x;
    rig.swingL.v = rig.swingR.v = 0;
  } else {
    // springs give the swing a little overshoot when starting and stopping
    const ax = spring(rig.swingL, -swing * 0.8, dt, 150, 13);
    const bx = spring(rig.swingR, swing * 0.8, dt, 150, 13);
    aimArm(rig.armL, rig.elbowL, ax, 0, -0.1 - out - flap, -0.25 - target * 0.3 - Math.max(0, -ax) * 0.5, 0, k);
    aimArm(rig.armR, rig.elbowR, bx, 0, 0.1 + out + flap, -0.25 - target * 0.3 - Math.max(0, -bx) * 0.5, 0, k);
    rig.armL.rotation.x = ax;
    rig.armR.rotation.x = bx;
  }
  rig.head.rotation.y = lerp(rig.head.rotation.y, clamp(rig.turn * 0.07, -0.45, 0.45), k);
  rig.head.rotation.x = lerp(rig.head.rotation.x, carrying ? 0.12 : rig.headPitch || 0, k * 0.5);
  rig.head.rotation.z = Math.sin(t * 1.3 + rig.phase * 0.1) * 0.03 * (1 - target);
  if (rig.tails)
    rig.tails.forEach((tl, i) => {
      tl.rotation.x = lerp(tl.rotation.x, 0.12 + target * (rig.tailLag ?? 0.5) + Math.abs(Math.sin(rig.phase)) * 0.08 * target, k);
      tl.rotation.z = lerp(tl.rotation.z, (i ? 1 : -1) * (0.06 + Math.sin(rig.phase * 0.5 + i) * 0.05 * target) - rig.turn * 0.03, k);
    });
  if (rig.wobble)
    for (const w of rig.wobble) {
      const gx = (-target * 0.1 - vy * 0.15) * w.amt;
      const gz = -rig.turn * 0.03 * w.amt + (w.wag ? Math.sin(t * (2.5 + target * 5)) * 0.25 : 0);
      w.obj.rotation.x = w.bx + spring(w.px, gx, dt, 110, 7);
      w.obj.rotation.z = w.bz + spring(w.pz, gz, dt, 110, 7);
    }
  updateFace(rig, t);
}

export function poseIdle(rig, t) {
  rig.body.position.y = rig.hop ? Math.max(0, Math.sin(t * 2.4)) ** 4 * 0.12 : Math.sin(t * 2) * 0.01;
  const breath = 1 + Math.sin(t * 2) * 0.008;
  rig.body.scale.set(1 / Math.sqrt(breath), breath, 1 / Math.sqrt(breath));
  rig.body.rotation.x = 0;
  if (rig.tails) rig.tails.forEach((tl, i) => {
    tl.rotation.x = 0.1 + Math.sin(t * 1.6 + i) * 0.03;
    tl.rotation.z = (i ? 1 : -1) * (0.06 + Math.sin(t * 1.3 + i * 2) * 0.03);
  });
  if (rig.wobble)
    rig.wobble.forEach((w, i) => {
      w.obj.rotation.x = w.bx + Math.sin(t * 1.7 + i) * 0.025 * w.amt;
      w.obj.rotation.z = w.bz + Math.sin(t * 1.3 + i * 2) * 0.03 * w.amt + (w.wag ? Math.sin(t * 2.6) * 0.25 : 0);
    });
  if (rig.idle === 'pose') {
    aimArm(rig.armL, rig.elbowL, 0, 0, -0.5, 0, 0, 1, 1.9);
    aimArm(rig.armR, rig.elbowR, -0.55, 0, 2.45, 0, 0, 1, 1.25 + Math.sin(t * 1.5) * 0.06);
  } else if (rig.idle === 'wave') {
    aimArm(rig.armL, rig.elbowL, 0, 0, -0.55, 0, 0, 1, 1.9);
    aimArm(rig.armR, rig.elbowR, 0, 0, 2.45, 0, 0, 1, 0.35 + Math.sin(t * 6) * 0.4);
  } else if (rig.idle === 'crossed') {
    // solved against the rig: forearms level across the lower chest, right over left
    aimArm(rig.armL, rig.elbowL, -1.4, 0, 0.6, -0.8, 1.47, 1);
    aimArm(rig.armR, rig.elbowR, -1.2, 0, -0.6, -0.8, -1.47, 1);
  } else if (rig.idle === 'bread') {
    aimArm(rig.armL, rig.elbowL, 0, 0, -0.5, 0, 0, 1, 1.9);
    aimArm(rig.armR, rig.elbowR, -0.2, 0, 0.4, -2.2, 1.1, 1);
  } else if (rig.idle === 'staff') {
    aimArm(rig.armL, rig.elbowL, 0.05, 0, -0.1, -0.3, 0, 1);
    aimArm(rig.armR, rig.elbowR, -0.3, 0, 0.14, -0.5, 0, 1);
  } else if (rig.idle === 'flex') {
    const squeeze = 0.12 + Math.max(0, Math.sin(t * 2.2)) * 0.18;
    aimArm(rig.armL, rig.elbowL, -0.15, 0, -1.45, 0, 0, 1, -1.75 - squeeze);
    aimArm(rig.armR, rig.elbowR, -0.15, 0, 1.45, 0, 0, 1, 1.75 + squeeze);
  } else {
    aimArm(rig.armL, rig.elbowL, -0.55, 0, -0.2, -1.5, 1.45, 1);
    aimArm(rig.armR, rig.elbowR, -0.55, 0, 0.2, -1.32, -1.5, 1);
  }
  rig.legL.rotation.x = 0;
  rig.legR.rotation.x = 0;
  rig.head.rotation.set(Math.sin(t * 0.9) * 0.04, Math.sin(t * 0.6) * 0.15, 0);
  if (rig.propPose) rig.prop.rotation.copy(rig.propPose);
  updateFace(rig, t);
}

export function buildTray() {
  const g = new THREE.Group();
  g.add(mesh(rbox(0.62, 0.05, 0.4, 0.02), '#d9773a'));
  g.add(mesh(rbox(0.56, 0.02, 0.34, 0.01), '#e9a15f', 0, 0.025, 0));
  g.userData.slots = [new THREE.Vector3(-0.19, 0.04, 0), new THREE.Vector3(0.0, 0.04, 0), new THREE.Vector3(0.19, 0.04, 0)];
  return g;
}

export function plate() {
  return mesh(cyl(0.11, 0.09, 0.025, 18), '#f7f4ee', 0, 0.012, 0);
}

const TOPPINGS = {
  salmon: { color: '#f47a45', stripe: '#ffd5be' },
  tuna: { color: '#d6324a', stripe: '#f07a8a' },
  ebi: { color: '#ffffff', stripe: '#f26a3a' },
  tamago: { color: '#f6cf3d' },
  cucumber: { color: '#5dbb4a' },
};

function nigiri(top) {
  const g = group(plate());
  g.add(mesh(rbox(0.14, 0.06, 0.08, 0.03), '#fbfaf5', 0, 0.055, 0));
  const t = TOPPINGS[top] || TOPPINGS.salmon;
  if (top === 'tamago') {
    g.add(mesh(rbox(0.16, 0.05, 0.1, 0.015), t.color, 0, 0.105, 0));
    g.add(mesh(rbox(0.035, 0.08, 0.105, 0.005), '#1d3324', 0, 0.08, 0));
    return g;
  }
  g.add(mesh(rbox(0.17, 0.035, 0.1, 0.017), t.color, 0, 0.098, 0));
  for (const x of [-0.04, 0, 0.04]) {
    const l = mesh(rbox(top === 'ebi' ? 0.02 : 0.012, 0.004, 0.1, 0.002), t.stripe, x, 0.117, 0);
    l.rotation.y = top === 'ebi' ? 0 : 0.5;
    g.add(l);
  }
  if (top === 'ebi') {
    const tail = mesh(cone(0.03, 0.05, 6), '#f26a3a', 0.1, 0.1, 0);
    tail.rotation.z = Math.PI / 2;
    g.add(tail);
  }
  return g;
}

function riceBowl() {
  const g = group(plate());
  const r = mesh(sph(0.07, 12, 8), '#fbfaf5', 0, 0.04, 0);
  r.scale.set(1.2, 0.6, 1);
  g.add(r);
  return g;
}

function onigiri() {
  const g = group(plate());
  const tri = mesh(cyl(0.085, 0.085, 0.06, 3), '#fbfaf5', 0, 0.09, 0);
  tri.rotation.x = Math.PI / 2;
  tri.rotation.y = Math.PI / 2;
  g.add(tri);
  g.add(mesh(rbox(0.07, 0.06, 0.065, 0.005), '#1d3324', 0, 0.06, 0));
  return g;
}

// Filling shape matches the order icons: square tamago/tuna, round striped salmon, seeded cucumber.
function maki(center) {
  const g = group(plate());
  const t = TOPPINGS[center] || TOPPINGS.salmon;
  for (const x of [-0.045, 0.045]) {
    g.add(mesh(cyl(0.045, 0.045, 0.06, 16), '#1d3324', x, 0.055, 0));
    g.add(mesh(cyl(0.037, 0.037, 0.062, 16), '#fbfaf5', x, 0.055, 0));
    if (center === 'tamago' || center === 'tuna') g.add(mesh(rbox(0.036, 0.064, 0.036, 0.004), t.color, x, 0.055, 0));
    else g.add(mesh(cyl(0.021, 0.021, 0.064, 12), t.color, x, 0.055, 0));
    if (center === 'salmon') g.add(mesh(rbox(0.006, 0.0655, 0.03, 0.002), t.stripe, x, 0.055, 0));
    if (center === 'cucumber') g.add(mesh(cyl(0.013, 0.013, 0.066, 10), '#bfe39a', x, 0.055, 0));
  }
  return g;
}

const BURGERS = { bun: '', burger: 'P', cheeseburger: 'PC', garden: 'PL', deluxe: 'PCL' };

function burger(flags) {
  const g = group(plate());
  let y = 0.03;
  const layer = (geo, color, h) => {
    const m = mesh(geo, color, 0, y + h / 2, 0);
    g.add(m);
    y += h;
    return m;
  };
  layer(cyl(0.075, 0.07, 0.035, 18), '#e59a45', 0.035);
  if (flags.includes('L')) layer(cyl(0.088, 0.088, 0.012, 9), '#7cc142', 0.012);
  if (flags.includes('P')) layer(cyl(0.08, 0.08, 0.035, 18), '#6b3a1e', 0.035);
  if (flags.includes('C')) {
    const c = layer(rbox(0.13, 0.012, 0.13, 0.004), '#f6c434', 0.012);
    c.rotation.y = Math.PI / 4;
  }
  if (flags) {
    const top = mesh(dome(0.078), '#f0a14a', 0, y, 0);
    top.scale.y = 0.75;
    g.add(top);
    for (const [x, z] of [[0.02, 0.03], [-0.03, 0.0], [0.03, -0.03]]) g.add(mesh(sph(0.008, 6, 4), '#fff4d6', x, y + 0.052, z));
  }
  return g;
}

export function cup(color, liquid, h = 0.13, r = 0.05) {
  const g = new THREE.Group();
  g.add(mesh(cyl(r, r * 0.8, h, 16), color, 0, h / 2, 0));
  g.add(mesh(cyl(r * 0.88, r * 0.88, 0.01, 16), liquid, 0, h - 0.006, 0));
  return g;
}

function cutlet(color) {
  const g = new THREE.Group();
  const pl = mesh(cyl(0.11, 0.09, 0.025, 20), '#f7f4ee', 0, 0.012, 0);
  pl.scale.x = 1.3;
  g.add(pl);
  const c = mesh(sph(0.1, 14, 8), color, -0.01, 0.035, 0);
  c.scale.set(1.25, 0.18, 0.85);
  g.add(c);
  return g;
}

function sacherSlice(cream) {
  const g = group(plate());
  const wedge = (r, h, y, color) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12, 1, false, 0, Math.PI / 3), mat(color));
    m.position.set(-0.04, y, -0.02);
    m.castShadow = true;
    g.add(m);
  };
  wedge(0.1, 0.035, 0.04, '#5a3220');
  wedge(0.1, 0.01, 0.063, '#f0a030');
  wedge(0.1, 0.035, 0.085, '#5a3220');
  wedge(0.102, 0.012, 0.108, '#2a140a');
  if (cream) {
    // big dollop so "mit Schlag" reads at a glance on the tray
    const d = mesh(sph(0.05, 14, 10), '#fffaf2', 0.055, 0.05, 0.045);
    d.scale.y = 0.85;
    g.add(d);
    g.add(mesh(sph(0.032, 12, 8), '#fffaf2', 0.055, 0.1, 0.045));
    g.add(mesh(cone(0.016, 0.04, 10), '#fffaf2', 0.055, 0.14, 0.045));
  }
  return g;
}

// Döner: a quarter of Turkish flatbread split open; whatever has gone in shows between the halves.
function donerBread(meat, salad) {
  const g = group(plate());
  const wedge = (y, h, color) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, h, 14, 1, false, -Math.PI / 4, Math.PI / 2), mat(color));
    m.position.set(0, y, -0.05);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  wedge(0.037, 0.025, '#e2a75a');
  const open = meat || salad;
  let y = 0.05;
  if (meat) {
    for (const [x, z] of [[-0.03, 0.03], [0.02, 0.04], [0.0, 0.0], [0.035, 0.0]]) {
      const shred = mesh(rbox(0.04, 0.014, 0.025, 0.005), '#8a4a26', x, 0.058, z);
      shred.rotation.y = x * 20;
      g.add(shred);
    }
    y += 0.014;
  }
  if (salad) {
    for (const [x, z, c] of [[-0.04, 0.04, '#7cc142'], [0.03, 0.05, '#7cc142'], [0.0, 0.03, '#e2402f'], [-0.015, 0.055, '#8a2a6a']]) g.add(mesh(sph(0.016, 8, 6), c, x, y + 0.01, z));
    put(g, mesh(sph(0.02, 8, 6), '#fbfaf2', 0.015, y + 0.022, 0.035)).scale.y = 0.4;
    y += 0.016;
  }
  const top = wedge(y + 0.012 + (open ? 0.01 : 0), 0.025, '#d99a4c');
  if (open) top.rotation.x = -0.18;
  for (const [x, z] of [[-0.02, 0.0], [0.02, 0.02], [0.0, 0.04], [0.03, -0.01]]) g.add(mesh(sph(0.005, 6, 4), '#f6ecd0', x, top.position.y + 0.014 + z * 0.15, z));
  return g;
}

// Dürüm: flat yufka on a plate while it's being filled, rolled up in paper once complete.
function durumWrap(stage) {
  const g = group(plate());
  if (stage < 2) {
    g.add(mesh(cyl(0.105, 0.105, 0.008, 24), '#ecd29c', 0, 0.03, 0));
    for (const a of [0.4, 1.9, 3.3, 4.8]) put(g, mesh(sph(0.014, 6, 4), '#c9935a', Math.cos(a) * 0.06, 0.034, Math.sin(a) * 0.06)).scale.y = 0.2;
    if (stage === 1) {
      g.add(mesh(rbox(0.16, 0.018, 0.045, 0.008), '#8a4a26', 0, 0.042, 0));
      for (const [x, c] of [[-0.05, '#7cc142'], [0.0, '#e2402f'], [0.05, '#7cc142']]) g.add(mesh(sph(0.013, 8, 6), c, x, 0.055, 0.008));
    }
    return g;
  }
  const roll = new THREE.Group();
  roll.add(mesh(cyl(0.035, 0.035, 0.2, 16), '#ecd29c'));
  roll.add(mesh(cyl(0.039, 0.039, 0.11, 16), '#f4f2ee', 0, -0.05, 0));
  roll.add(mesh(cyl(0.0395, 0.0395, 0.015, 16), '#c8202a', 0, -0.02, 0));
  roll.add(mesh(cyl(0.03, 0.03, 0.006, 12), '#8a4a26', 0, 0.1, 0));
  for (const [x, z, c] of [[0.012, 0.01, '#7cc142'], [-0.012, -0.008, '#e2402f'], [0.0, 0.015, '#fbfaf2']]) roll.add(mesh(sph(0.009, 6, 4), c, x, 0.1, z));
  roll.rotation.set(0, 0.5, Math.PI / 2 - 0.12);
  roll.position.y = 0.06;
  g.add(roll);
  return g;
}

const DISH_BUILDERS = {
  ekmek: () => donerBread(false, false),
  doner_wip: () => donerBread(true, false),
  doner: () => donerBread(true, true),
  yufka: () => durumWrap(0),
  durum_wip: () => durumWrap(1),
  durum: () => durumWrap(2),
  ayran() {
    const g = cup('#f4f6f8', '#ffffff', 0.13, 0.048);
    g.add(mesh(cyl(0.0495, 0.046, 0.03, 16), '#2d6fb5', 0, 0.06, 0));
    put(g, mesh(sph(0.046, 12, 8), '#fffef8', 0, 0.13, 0)).scale.y = 0.35;
    return g;
  },
  rice: riceBowl,
  salmon_nigiri: () => nigiri('salmon'),
  tamago_nigiri: () => nigiri('tamago'),
  onigiri,
  salmon_maki: () => maki('salmon'),
  tamago_maki: () => maki('tamago'),
  tuna_nigiri: () => nigiri('tuna'),
  ebi_nigiri: () => nigiri('ebi'),
  tuna_maki: () => maki('tuna'),
  cucumber_maki: () => maki('cucumber'),
  miso() {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.07, 0.05, 0.07, 16), '#2a1a14', 0, 0.035, 0));
    g.add(mesh(cyl(0.064, 0.064, 0.008, 16), '#c9853a', 0, 0.066, 0));
    for (const [x, z] of [[0.02, 0.01], [-0.02, -0.015]]) g.add(mesh(rbox(0.02, 0.01, 0.02, 0.004), '#fff8e8', x, 0.072, z));
    g.add(mesh(rbox(0.04, 0.004, 0.012, 0.002), '#4caf50', 0.0, 0.072, 0.025));
    return g;
  },
  fries() {
    const g = new THREE.Group();
    put(g, mesh(cyl(0.06, 0.045, 0.1, 4), '#e2402f', 0, 0.05, 0)).rotation.y = Math.PI / 4;
    for (let i = 0; i < 9; i++) {
      const f = mesh(rbox(0.014, 0.1, 0.014, 0.004), '#f6c434', -0.03 + (i % 3) * 0.03, 0.12 + (i % 2) * 0.012, -0.02 + Math.floor(i / 3) * 0.02);
      f.rotation.z = (i - 4) * 0.06;
      g.add(f);
    }
    return g;
  },
  ...Object.fromEntries(Object.entries(BURGERS).map(([id, flags]) => [id, () => burger(flags)])),
  tea() {
    const g = cup('#e8e2d0', '#8fbf5a', 0.08, 0.05);
    g.add(mesh(rbox(0.1, 0.012, 0.012, 0.005), '#3f7a3a', 0, 0.045, 0.048));
    return g;
  },
  cola() {
    const g = cup('#e2402f', '#3a1a10', 0.15, 0.05);
    g.add(mesh(cyl(0.051, 0.045, 0.04, 16), '#ffffff', 0, 0.08, 0));
    const s = mesh(cyl(0.007, 0.007, 0.12, 6), '#ffffff', 0.015, 0.19, 0);
    s.rotation.z = -0.25;
    g.add(s);
    return g;
  },
  lemonade() {
    const g = cup('#f48fb1', '#f8bbd0', 0.15, 0.045);
    put(g, mesh(cyl(0.035, 0.035, 0.008, 12), '#f4d03f', 0.04, 0.15, 0)).rotation.z = 1.3;
    return g;
  },
  rootbeer() {
    const g = cup('#7a3e1c', '#7a3e1c', 0.12, 0.05);
    put(g, mesh(sph(0.052, 12, 8), '#fff4dc', 0, 0.12, 0)).scale.y = 0.5;
    const handle = mesh(torus(0.035, 0.01, 10), '#c8e6f0', 0.058, 0.065, 0);
    g.add(handle);
    return g;
  },
  coffee() {
    const g = cup('#f7f4ee', '#5a3218', 0.08, 0.048);
    g.add(mesh(torus(0.025, 0.008, 10), '#f7f4ee', 0.055, 0.045, 0));
    g.add(mesh(cyl(0.075, 0.075, 0.01, 16), '#f7f4ee', 0, 0.005, 0));
    return g;
  },
  milkshake() {
    const g = cup('#fde3ec', '#f48fb1', 0.15, 0.045);
    put(g, mesh(sph(0.05, 12, 8), '#ffffff', 0, 0.16, 0)).scale.y = 0.7;
    g.add(mesh(sph(0.02, 8, 6), '#d4182d', 0, 0.2, 0));
    return g;
  },
  schnitzel_raw: () => cutlet('#e98f8a'),
  schnitzel_breaded: () => cutlet('#e7d2a2'),
  schnitzel() {
    const g = cutlet('#d6953a');
    const lemon = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 12, 1, false, 0, Math.PI), mat('#f6d33a'));
    lemon.rotation.x = Math.PI / 2;
    lemon.position.set(0.09, 0.05, 0.04);
    g.add(lemon);
    g.add(mesh(sph(0.018, 8, 6), '#4caf50', 0.09, 0.05, -0.04));
    return g;
  },
  beer() {
    const g = new THREE.Group();
    const glass = new THREE.Mesh(cyl(0.05, 0.045, 0.15, 16), new THREE.MeshToonMaterial({ color: '#f2b632', transparent: true, opacity: 0.9 }));
    glass.position.y = 0.075;
    g.add(glass);
    put(g, mesh(sph(0.052, 12, 8), '#fffaf0', 0, 0.15, 0)).scale.y = 0.55;
    g.add(mesh(torus(0.035, 0.01, 10), '#e8eef2', 0.058, 0.08, 0));
    return g;
  },
  sacher: () => sacherSlice(false),
  sacher_schlag: () => sacherSlice(true),
  schmarrn() {
    const g = group(plate());
    const pieces = [[0, 0], [0.04, 0.03], [-0.04, 0.02], [0.02, -0.04], [-0.03, -0.03], [0.0, 0.0]];
    pieces.forEach(([x, z], i) => {
      const p = mesh(rbox(0.05, 0.03, 0.04, 0.012), i % 2 ? '#e3a64a' : '#f0c46a', x, 0.035 + (i === 5 ? 0.03 : 0), z);
      p.rotation.set(i * 0.7, i * 1.3, i * 0.4);
      g.add(p);
    });
    g.add(mesh(sph(0.02, 8, 6), '#ffffff', 0.01, 0.075, 0));
    const compote = mesh(cyl(0.03, 0.025, 0.025, 12), '#f7f4ee', -0.07, 0.025, 0.05);
    g.add(compote);
    g.add(mesh(cyl(0.025, 0.025, 0.006, 12), '#6a2a5a', -0.07, 0.04, 0.05));
    return g;
  },
  cake() {
    const g = group(plate());
    const slice = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12, 1, false, 0, Math.PI / 3), mat('#f3d6a6'));
    slice.position.set(-0.04, 0.06, -0.02);
    slice.castShadow = true;
    g.add(slice);
    const icing = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.102, 0.02, 12, 1, false, 0, Math.PI / 3), mat('#f7a6c8'));
    icing.position.set(-0.04, 0.105, -0.02);
    g.add(icing);
    g.add(mesh(sph(0.018, 8, 6), '#d4182d', 0.0, 0.125, 0.02));
    return g;
  },
};

export function buildDish(id) {
  const b = DISH_BUILDERS[id] || riceBowl;
  const g = b();
  g.scale.setScalar(1.15);
  return g;
}

export function buildLobbyStage(scene) {
  const g = new THREE.Group();
  const disk = new THREE.Mesh(new THREE.CircleGeometry(0.9, 40), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }));
  disk.rotation.x = -Math.PI / 2;
  disk.position.y = 0.005;
  g.add(disk);
  scene.add(g);
  return g;
}
