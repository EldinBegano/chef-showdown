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
    id: 'bianco', name: 'Tonio', level: 1, tier: 'gold',
    build() {
      const skin = '#f2c9a2';
      const h = humanoid({ skin, outfitKey: 'bianco', outfit: OUTFITS.italian('#f4f2ee', '#d4af37', '#cfcac0'), sleeves: '#f4f2ee', forearms: skin, pants: '#f4f2ee', shoes: '#3a2a20', scale: 1.04 });
      const { rig } = h;
      const head = rig.head;
      buttons(rig, '#d4af37', [50, 88], 22, 0.017);
      head.children[0].scale.set(0.92, 1.06, 0.95);
      const hair = mesh(dome(0.28), '#b98a4e', 0, 0.05, -0.04);
      hair.rotation.x = -0.35;
      head.add(hair);
      for (const x of [-0.2, 0.2]) {
        const side = mesh(sph(0.1, 12, 10), '#b98a4e', x, 0.06, 0.02);
        side.scale.set(0.5, 1.1, 1.1);
        head.add(side);
      }
      const toque = new THREE.Group();
      toque.position.y = 0.2;
      toque.add(mesh(cyl(0.23, 0.215, 0.13, 28), '#ece8df', 0, 0.06, 0));
      toque.add(mesh(cyl(0.21, 0.225, 0.42, 28), '#fbfaf6', 0, 0.33, 0));
      const puff = mesh(sph(0.22, 20, 12), '#fbfaf6', 0, 0.53, 0);
      puff.scale.y = 0.35;
      toque.add(puff);
      toque.add(mesh(rbox(0.08, 0.08, 0.03, 0.01), '#d4af37', 0, 0.06, 0.225));
      toque.add(mesh(rbox(0.02, 0.06, 0.035, 0.005), '#b8901f', 0, 0.06, 0.232));
      head.add(toque);
      wobble(rig, toque, 0.8);
      const blink = [];
      for (const x of [-0.085, 0.085]) {
        blink.push(put(head, mesh(sph(0.04, 12, 10), '#ffffff', x, 0.02, 0.235)));
        blink.push(put(head, mesh(sph(0.024, 10, 8), '#4a7fa0', x, 0.02, 0.27)));
        blink.push(put(head, mesh(sph(0.007, 6, 4), '#ffffff', x + 0.008, 0.028, 0.292)));
        const brow = bare(mesh(rbox(0.1, 0.022, 0.03, 0.01), '#8a6236', x, 0.085, 0.245));
        brow.rotation.z = x < 0 ? 0.12 : -0.12;
        head.add(brow);
      }
      blinkers(rig, blink);
      head.add(bare(mesh(sph(0.03, 8, 6), '#e0a882', 0, -0.03, 0.27)));
      const smile = bare(mesh(torus(0.05, 0.01, 10, Math.PI * 0.8), '#7a3a2a', 0.01, -0.1, 0.24));
      smile.rotation.z = Math.PI * 1.1;
      head.add(smile);
      put(rig.body, mesh(torus(0.11, 0.035, 18), '#c81e2a', 0, 1.22, 0.02)).rotation.x = Math.PI / 2;
      const knot = mesh(cone(0.07, 0.16, 3), '#c81e2a', 0, 1.1, 0.17);
      knot.rotation.set(Math.PI + 0.3, 0, 0);
      rig.body.add(knot);
      const knife = new THREE.Group();
      knife.add(mesh(rbox(0.035, 0.12, 0.035, 0.012), '#2a2024', 0, 0, 0));
      knife.add(mesh(rbox(0.065, 0.36, 0.014, 0.005), '#9fb2c0', 0.012, 0.24, 0));
      knife.position.set(0, -0.26, 0.03);
      knife.rotation.x = Math.PI / 2;
      rig.elbowR.add(knife);
      rig.prop = knife;
      return h;
    },
  },
  {
    id: 'miku', name: 'Miku', level: 1, tier: 'gold',
    build() {
      const skin = '#fbe4d8';
      const teal = '#3cc6cc';
      const tealDark = '#2a9aa2';
      const black = '#26272d';
      const skirtGray = '#3d4248';
      const h = humanoid({
        skin,
        slim: true,
        fabric: false,
        outfitKey: 'miku2',
        outfit: (c, w, hgt) => {
          c.fillStyle = '#c9cdd3';
          c.fillRect(0, 0, w, hgt);
          c.fillStyle = skin;
          for (const x of [w * 0.25, w * 0.75]) {
            c.beginPath();
            c.ellipse(x, 0, 70, 62, 0, 0, Math.PI * 2);
            c.fill();
          }
          c.fillStyle = skirtGray;
          c.fillRect(w / 2 - 62, 0, 124, 26);
          c.fillStyle = teal;
          c.fillRect(w / 2 - 62, 24, 124, 5);
          c.beginPath();
          c.moveTo(w / 2 - 13, 26);
          c.lineTo(w / 2 + 13, 26);
          c.lineTo(w / 2 + 17, hgt - 18);
          c.lineTo(w / 2, hgt);
          c.lineTo(w / 2 - 17, hgt - 18);
          c.fill();
          c.fillStyle = tealDark;
          c.fillRect(w / 2 - 15, 24, 30, 18);
          c.fillStyle = '#d9b44a';
          c.fillRect(w / 2 - 100, 78, 46, 10);
          c.strokeStyle = 'rgba(0,0,0,0.08)';
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(w / 2 + 30, 40);
          c.lineTo(w / 2 + 30, hgt);
          c.stroke();
        },
        sleeves: skin,
        forearms: black,
        pants: skirtGray,
        shoes: black,
        sole: teal,
        bareLegs: true,
        calves: black,
      });
      const { head, body, armL, armR, elbowL, elbowR, legL, legR } = h.rig;

      const pleats = canvasTexture(256, 64, (c, w, hh) => {
        c.fillStyle = skirtGray;
        c.fillRect(0, 0, w, hh);
        for (let x = 0; x < w; x += 16) {
          c.fillStyle = 'rgba(0,0,0,0.28)';
          c.fillRect(x, 0, 4, hh);
          c.fillStyle = 'rgba(255,255,255,0.06)';
          c.fillRect(x + 4, 0, 3, hh);
        }
        c.fillStyle = teal;
        c.fillRect(0, hh - 7, w, 7);
      });
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.32, 0.25, 32, 1, true), texMat(pleats, { side: THREE.DoubleSide }));
      skirt.position.y = 0.55;
      skirt.castShadow = true;
      body.add(skirt);

      for (const arm of [armL, armR]) {
        arm.add(mesh(capsule(0.058, 0.06), black, 0, -0.2, 0));
        arm.add(mesh(cyl(0.062, 0.062, 0.025, 16), teal, 0, -0.15, 0));
      }
      for (const elbow of [elbowL, elbowR]) {
        elbow.children[0].visible = false;
        elbow.add(mesh(cyl(0.06, 0.1, 0.25, 20), black, 0, -0.13, 0));
        elbow.add(mesh(cyl(0.102, 0.102, 0.03, 20), teal, 0, -0.255, 0));
        elbow.children[1].position.y = -0.3;
      }
      for (const leg of [legL, legR]) {
        leg.add(mesh(capsule(0.066, 0.1), black, 0, -0.25, 0.005));
        leg.add(mesh(cyl(0.07, 0.07, 0.03, 16), teal, 0, -0.19, 0.005));
      }

      head.children[0].material = mat(skin, { emissive: skin, emissiveIntensity: 0.22 });
      head.scale.setScalar(1.04);
      const cap = mesh(dome(0.296), teal, 0, 0.03, -0.015);
      cap.scale.set(1, 1.05, 1.06);
      cap.rotation.x = -0.08;
      head.add(cap);
      head.add(mesh(sph(0.285, 24, 16), teal, 0, -0.02, -0.065));
      const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.305, 32, 12, Math.PI / 2 - 1.15, 2.3, 0, 1.12), mat(teal));
      fringe.castShadow = true;
      head.add(fringe);
      [[-0.225, -0.04, 0.05], [-0.15, 0.04, 0.05], [-0.075, 0.06, 0.048], [0, 0.0, 0.022], [0.075, 0.06, 0.048], [0.15, 0.04, 0.05], [0.225, -0.03, 0.05]].forEach(([x, bottom, hw]) => {
        const yc = (0.125 + bottom) / 2;
        const hh = (0.125 - bottom) / 2;
        const z = Math.sqrt(Math.max(0, 0.305 * 0.305 - x * x - yc * yc)) - 0.008;
        const clump = mesh(petalGeo, teal, x, yc, z);
        clump.lookAt(x * 3, yc, z * 3);
        clump.scale.set(hw / 0.06, hh / 0.06, 0.3);
        clump.rotateZ(x * 0.8);
        head.add(clump);
      });
      for (const x of [-0.235, 0.235]) {
        const lock = mesh(capsule(0.05, 0.32), teal, x, -0.16, 0.06);
        lock.scale.z = 0.55;
        lock.rotation.z = x > 0 ? 0.08 : -0.08;
        head.add(lock);
      }

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
    },
  },
  {
    id: 'frieren', name: 'Frieren', level: 1, tier: 'gold',
    build() {
      const skin = '#f7e6da';
      const hair = '#dcdbee';
      const white = '#f4f2ec';
      const gold = '#c9a85a';
      const ink = '#26262c';
      const brown = '#5a3b28';
      const ruby = '#cf1d33';
      const h = humanoid({
        skin,
        slim: true,
        scale: 0.95,
        outfitKey: 'frieren',
        outfit: (c, w, hgt) => {
          c.fillStyle = white;
          c.fillRect(0, 0, w, hgt);
          // striped shirt, only seen through the capelet's front opening
          c.fillStyle = ink;
          for (let y = 34; y < 190; y += 26) c.fillRect(w / 2 - 48, y, 96, 13);
          c.fillRect(0, 196, w, 20);
        },
        sleeves: white,
        pants: white,
        shoes: brown,
        sole: '#3a271b',
        bareLegs: true,
        thighs: ink,
        calves: ink,
      });
      const { rig } = h;
      const { head, body, elbowL, elbowR, legL, legR, B } = rig;
      belt(rig, ink, '#c9ccd4', 196, 216);

      const hem = canvasTexture(256, 64, (c, w, hh) => {
        c.fillStyle = white;
        c.fillRect(0, 0, w, hh);
        c.fillStyle = 'rgba(0,0,0,0.05)';
        for (let x = 0; x < w; x += 32) c.fillRect(x, 0, 6, hh);
        c.fillStyle = gold;
        c.fillRect(0, hh - 12, w, 10);
        c.fillStyle = 'rgba(90,60,20,0.5)';
        c.fillRect(0, hh - 14, w, 2);
      });
      const dress = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.36, 32, 1, true), texMat(hem, { side: THREE.DoubleSide }));
      dress.position.y = 0.49;
      dress.castShadow = true;
      body.add(dress);

      const capeTex = canvasTexture(512, 128, (c, w, hh) => {
        c.fillStyle = white;
        c.fillRect(0, 0, w, hh);
        weave(c, w, hh);
        c.fillStyle = gold;
        c.fillRect(0, hh - 20, w, 16);
        c.fillRect(0, 0, 14, hh);
        c.fillRect(w - 14, 0, 14, hh);
        c.fillStyle = 'rgba(90,60,20,0.45)';
        c.fillRect(0, hh - 22, w, 2);
        c.fillRect(14, 0, 2, hh - 20);
        c.fillRect(w - 16, 0, 2, hh - 20);
        for (const x of [w * 0.25, w * 0.75]) {
          c.fillStyle = gold;
          c.beginPath();
          c.ellipse(x, 66, 11, 18, 0, 0, TAU);
          c.fill();
          c.fillStyle = ruby;
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
      body.add(mesh(rbox(0.06, 0.07, 0.025, 0.01), gold, 0, 1.12, 0.172));
      body.add(mesh(sph(0.019, 10, 8), ruby, 0, 1.12, 0.187));

      for (const elbow of [elbowL, elbowR]) {
        elbow.add(mesh(cyl(B.fore * 1.15, B.fore * 1.5, 0.13, 18), white, 0, -0.13, 0));
        elbow.add(mesh(cyl(B.fore * 1.56, B.fore * 1.56, 0.04, 18), gold, 0, -0.2, 0));
      }
      for (const leg of [legL, legR]) leg.add(mesh(cyl(0.072, 0.068, 0.17, 16), brown, 0, -0.43, 0));

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
        drop.add(mesh(sph(0.014, 8, 6), gold));
        drop.add(mesh(cyl(0.004, 0.004, 0.03, 4), gold, 0, -0.02, 0));
        const gem = mesh(sph(0.019, 10, 8), ruby, 0, -0.055, 0);
        gem.scale.set(0.75, 2, 0.75);
        drop.add(gem);
        head.add(drop);
        wobble(rig, drop, 2.5);
      }

      face(rig, 'frieren', {
        style: 'anime', eyeY: 132, gap: 66, ew: 27, eh: 33, lid: 8, lash: true, sleepy: 0.28,
        iris: ['#1e5a50', '#4c9c88', '#a8dcc6'], pupil: '#123832',
        brow: 'rgba(150,140,175,0.8)', browY: 84, browW: 4,
        blush: { c: 'rgba(240,150,150,0.3)', dx: 8, y: 186, rx: 18, ry: 8 },
        nose: 'rgba(200,140,130,0.55)', noseY: 168,
        mouth: 'flat', happyMouth: 'smile', mouthY: 196, mouthW: 12, lip: '#9a5a52',
      });

      // staff: maroon shaft, gold crescent holding a red gem, red ribbon under the head
      const staff = new THREE.Group();
      staff.add(mesh(cyl(0.02, 0.022, 1.35, 10), '#6b2622', 0, 0.2, 0));
      staff.add(mesh(cyl(0.024, 0.02, 0.04, 10), gold, 0, -0.48, 0));
      staff.add(mesh(cyl(0.03, 0.025, 0.06, 12), gold, 0, 0.88, 0));
      put(staff, mesh(torus(0.1, 0.02, 28, Math.PI * 1.5), gold, 0, 1.0, 0)).rotation.z = Math.PI / 2;
      staff.add(mesh(torus(0.05, 0.008, 18), gold, 0, 1.0, 0));
      staff.add(mesh(sph(0.046, 14, 10), mat(ruby, { emissive: '#5a0010', emissiveIntensity: 0.6 }), 0, 1.0, 0));
      staff.add(mesh(cyl(0.026, 0.026, 0.04, 10), '#b81e2c', 0, 0.8, 0));
      for (const s of [-1, 1]) put(staff, mesh(rbox(0.035, 0.24, 0.006, 0.003), '#b81e2c', s * 0.02, 0.68, 0.022)).rotation.z = s * 0.25;
      staff.position.set(0, -0.245, 0);
      staff.rotation.set(0.9, 0, -0.1);
      elbowR.add(staff);
      rig.prop = staff;
      rig.idle = 'staff';
      return h;
    },
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

  rig.phase += dt * (6 + 6 * target);
  const swing = Math.sin(rig.phase) * 0.7 * target;
  rig.legL.rotation.x = swing;
  rig.legR.rotation.x = -swing;
  const bounce = Math.abs(Math.sin(rig.phase));
  rig.body.position.y = bounce * 0.05 * target + Math.sin(t * 2) * 0.006;
  // squash on foot plant, stretch at the top of the step, slow breathing at rest
  const sy = 1 + target * (bounce * 0.035 - (1 - bounce) ** 4 * 0.06) + Math.sin(t * 2) * 0.006 * (1 - target);
  rig.body.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
  const k = Math.min(1, dt * 14);
  rig.body.rotation.x = lerp(rig.body.rotation.x, target * (carrying ? 0.05 : 0.12), k * 0.5);

  const out = rig.bulk ? 0.2 : 0;
  if (rig.prop) rig.prop.visible = !carrying;
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
    aimArm(rig.armL, rig.elbowL, ax, 0, -0.1 - out, -0.25 - target * 0.3 - Math.max(0, -ax) * 0.5, 0, k);
    aimArm(rig.armR, rig.elbowR, bx, 0, 0.1 + out, -0.25 - target * 0.3 - Math.max(0, -bx) * 0.5, 0, k);
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
  rig.body.position.y = Math.sin(t * 2) * 0.01;
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

function maki(center) {
  const g = group(plate());
  for (const x of [-0.045, 0.045]) {
    g.add(mesh(cyl(0.045, 0.045, 0.06, 16), '#1d3324', x, 0.055, 0));
    g.add(mesh(cyl(0.037, 0.037, 0.062, 16), '#fbfaf5', x, 0.055, 0));
    g.add(mesh(cyl(0.016, 0.016, 0.064, 10), (TOPPINGS[center] || TOPPINGS.salmon).color, x, 0.055, 0));
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
    const d = mesh(sph(0.035, 10, 8), '#fffaf2', 0.06, 0.04, 0.05);
    d.scale.y = 0.8;
    g.add(d);
    g.add(mesh(cone(0.012, 0.03, 8), '#fffaf2', 0.06, 0.075, 0.05));
  }
  return g;
}

const DISH_BUILDERS = {
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
