import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const toneMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array([120, 195, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

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

const TORSO_PROFILE = [0.215, 0.232, 0.238, 0.236, 0.24, 0.25, 0.262, 0.27, 0.268, 0.255, 0.225, 0.17, 0.09, 0.02];
const BULK_PROFILE = [0.22, 0.235, 0.24, 0.245, 0.27, 0.31, 0.35, 0.38, 0.39, 0.375, 0.33, 0.25, 0.12, 0.02];
const torsoGeo = (profile, key) =>
  cached(key, () => {
    const n = profile.length;
    const pts = profile.map((r, i) => new THREE.Vector2(r, 0.57 + (0.64 * i) / (n - 1)));
    return new THREE.LatheGeometry(pts, 28, Math.PI);
  });

const outfitCache = new Map();
function outfitMaterial(key, draw) {
  if (outfitCache.has(key)) return outfitCache.get(key);
  const tex = canvasTexture(512, 256, draw);
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

function humanoid({ skin, outfit, outfitKey, pants, shoes = '#2b2b33', sleeves, forearms = sleeves, scale = 1, bulk = false, slim = false, bareLegs = false, thighs = skin, calves = skin }) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const B = bulk
    ? { shoulderX: 0.4, shoulderY: 1.08, delt: 0.14, upper: 0.105, fore: 0.088, hand: 0.085, leg: 0.105, hipX: 0.13, pelvis: 0.5, neck: 0.12 }
    : slim
      ? { shoulderX: 0.225, shoulderY: 1.07, delt: 0.056, upper: 0.05, fore: 0.047, hand: 0.056, leg: 0.07, hipX: 0.095, pelvis: 0.34, neck: 0.058 }
      : { shoulderX: 0.27, shoulderY: 1.07, delt: 0.075, upper: 0.066, fore: 0.058, hand: 0.068, leg: 0.085, hipX: 0.11, pelvis: 0.44, neck: 0.075 };

  const torso = new THREE.Mesh(bulk ? torsoGeo(BULK_PROFILE, 'torsoBulk') : torsoGeo(TORSO_PROFILE, 'torso'), outfitMaterial(outfitKey, outfit));
  torso.scale.z = bulk ? 0.62 : slim ? 0.62 : 0.7;
  if (slim) torso.scale.x = 0.82;
  torso.castShadow = true;
  torso.receiveShadow = true;
  body.add(torso);
  body.add(mesh(rbox(B.pelvis, 0.16, 0.34, 0.07), pants, 0, 0.6, 0));
  body.add(mesh(cyl(B.neck, B.neck * 1.25, 0.12, 12), skin, 0, 1.24, 0));

  const leg = (x) => {
    const hip = new THREE.Group();
    hip.position.set(x, 0.6, 0);
    if (bareLegs) {
      hip.add(mesh(capsule(0.14, 0.04), pants, 0, -0.05, 0));
      const thin = bulk ? 1 : 0.72;
      hip.add(mesh(capsule(0.125 * thin, 0.14), thighs, 0, -0.17, 0.01));
      hip.add(mesh(capsule(0.092 * thin, 0.12), calves, 0, -0.38, -0.01));
    } else hip.add(mesh(capsule(B.leg, 0.3), pants, 0, -0.24, 0));
    hip.add(mesh(rbox(0.17 + (bulk ? 0.03 : 0), 0.1, 0.27, 0.045), shoes, 0, -0.55, 0.04));
    body.add(hip);
    return hip;
  };
  const arm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.rotation.order = 'YXZ';
    shoulder.position.set(side * B.shoulderX, B.shoulderY, 0);
    shoulder.add(mesh(sph(B.delt, 14, 10), sleeves, 0, 0, 0));
    shoulder.add(mesh(capsule(B.upper, 0.16), sleeves, 0, -0.13, 0));
    if (bulk) {
      const bicep = mesh(sph(B.upper * 1.05, 12, 10), sleeves, 0, -0.14, 0.05);
      bicep.scale.set(1, 1.3, 1);
      shoulder.add(bicep);
    }
    const elbow = new THREE.Group();
    elbow.rotation.order = 'YXZ';
    elbow.position.y = -0.26;
    elbow.add(mesh(capsule(B.fore, 0.13), forearms, 0, -0.1, 0));
    elbow.add(mesh(sph(B.hand, 12, 10), skin, 0, -0.24, 0));
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
  head.add(mesh(sph(0.27), skin));
  body.add(head);

  root.scale.setScalar(scale);
  return { root, rig: { body, head, torso, legL, legR, armL: L.shoulder, armR: R.shoulder, elbowL: L.elbow, elbowR: R.elbow, phase: Math.random() * 6, bulk, B } };
}

function eyes(head, { color = '#1a1a1a', y = 0.03, z = 0.245, gap = 0.09, r = 0.036 } = {}) {
  head.add(mesh(sph(r, 10, 8), color, -gap, y, z));
  head.add(mesh(sph(r, 10, 8), color, gap, y, z));
}

function spots(parent, r, squash, y0, color, list) {
  for (const [theta, phi, s] of list) {
    const x = r * Math.sin(phi) * Math.cos(theta);
    const z = r * Math.sin(phi) * Math.sin(theta);
    const y = r * Math.cos(phi) * squash;
    const m = mesh(sph(s, 10, 8), color, x, y0 + y, z);
    m.scale.z = 0.45;
    m.lookAt(x * 2, y0 + y * 2, z * 2);
    parent.add(m);
  }
}

function mushroomCap(head, capColor, spotColor) {
  const cap = mesh(dome(0.46), capColor, 0, 0.1, 0);
  cap.scale.y = 0.62;
  head.add(cap);
  head.add(mesh(cyl(0.44, 0.44, 0.05, 24), '#f4ecdf', 0, 0.1, 0));
  spots(head, 0.45, 0.62, 0.1, spotColor, [
    [0.3, 0.55, 0.075], [1.6, 0.45, 0.07], [2.8, 0.7, 0.08], [4.2, 0.5, 0.065], [5.3, 0.8, 0.07], [1.0, 1.1, 0.06], [2.2, 1.15, 0.06], [0, 0.05, 0.08],
  ]);
}

function raccoonHead(head, fur = '#8e8e98') {
  head.children[0].material = mat(fur);
  for (const x of [-0.095, 0.095]) {
    const patch = mesh(sph(0.1, 12, 10), '#2a2a32', x, 0.035, 0.2);
    patch.scale.set(1.1, 0.75, 0.6);
    head.add(patch);
  }
  eyes(head, { color: '#f5f5f5', z: 0.262, r: 0.03 });
  head.add(mesh(sph(0.012, 6, 6), '#111', -0.095, 0.035, 0.29));
  head.add(mesh(sph(0.012, 6, 6), '#111', 0.095, 0.035, 0.29));
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
  for (let i = 0; i < 5; i++) tail.add(mesh(cyl(0.09 - i * 0.008, 0.1 - i * 0.008, 0.11, 12), i % 2 ? '#2a2a32' : fur, 0, -0.06 - i * 0.11, 0));
  body.add(tail);
}

function bucketHat(head, color) {
  head.add(mesh(cyl(0.38, 0.38, 0.03, 24), color, 0, 0.16, 0));
  head.add(mesh(cyl(0.21, 0.27, 0.2, 24), color, 0, 0.27, 0));
}

function mustache(head) {
  for (const x of [-0.065, 0.065]) {
    const m = mesh(sph(0.07, 10, 8), '#4a2c1c', x, -0.07, 0.235);
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

function faceDecal(radius, draw) {
  const tex = canvasTexture(512, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    draw(c, w, h);
  });
  const geo = new THREE.SphereGeometry(radius, 32, 16, Math.PI / 2 - 0.62, 1.24, 1.12, 1.0);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
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
      eyes(h.rig.head);
      mustache(h.rig.head);
      mushroomCap(h.rig.head, '#d83a2c', '#fff7ee');
      return h;
    },
  },
  {
    id: 'rocco', name: 'Rocco', level: 1, tier: 'free',
    build() {
      const h = humanoid({ skin: '#8e8e98', outfitKey: 'rocco', outfit: OUTFITS.jacket('#4e7e3f', '#e5559a', '#3fb3a8'), sleeves: '#4e7e3f', pants: '#222228', shoes: '#ececec' });
      raccoonHead(h.rig.head);
      raccoonTail(h.rig.body);
      bucketHat(h.rig.head, '#ef7a1a');
      return h;
    },
  },
  {
    id: 'violet', name: 'Violet', level: 2, tier: 'free',
    build() {
      const h = humanoid({ skin: '#9b6fc4', outfitKey: 'violet', outfit: OUTFITS.chef('#f6f1e6', '#c8b89a', '#f07d1e'), sleeves: '#f6f1e6', pants: '#7d4fa8', shoes: '#4b2a1a' });
      put(h.rig.body, mesh(torus(0.12, 0.045, 20), '#f07d1e', 0, 1.2, 0.02)).rotation.x = Math.PI / 2;
      eyes(h.rig.head, { y: 0.0 });
      mushroomCap(h.rig.head, '#b58ade', '#efe1fb');
      return h;
    },
  },
  {
    id: 'sprinkles', name: 'Sprinkles', level: 3, tier: 'free',
    build() {
      const h = humanoid({ skin: '#f3c9a6', outfitKey: 'sprinkles', outfit: OUTFITS.chef('#f4efe3', '#e5559a'), sleeves: '#f4efe3', pants: '#ef7a2a', shoes: '#1e1e1e' });
      const head = h.rig.head;
      const hair = mesh(sph(0.295), '#e0682a', 0, 0.02, -0.035);
      head.add(hair);
      const bangs = mesh(sph(0.2, 14, 10), '#e0682a', 0, 0.15, 0.13);
      bangs.scale.set(1.3, 0.5, 0.7);
      head.add(bangs);
      eyes(head, { y: 0.0 });
      head.add(mesh(sph(0.03, 8, 6), '#f08aa0', -0.15, -0.06, 0.21));
      head.add(mesh(sph(0.03, 8, 6), '#f08aa0', 0.15, -0.06, 0.21));
      head.add(mesh(cyl(0.22, 0.17, 0.16, 20), '#c76a8c', 0, 0.3, 0));
      const f1 = mesh(sph(0.25, 18, 12), '#f7b6d2', 0, 0.42, 0);
      f1.scale.y = 0.55;
      head.add(f1);
      const f2 = mesh(sph(0.17, 16, 10), '#f9c6dd', 0, 0.53, 0);
      f2.scale.y = 0.6;
      head.add(f2);
      const f3 = mesh(sph(0.1, 12, 8), '#fbd5e6', 0, 0.62, 0);
      head.add(f3);
      head.add(mesh(sph(0.055, 10, 8), '#d4182d', 0, 0.74, 0));
      const sprinkleColors = ['#4fc3f7', '#ffd54f', '#81c784', '#ffffff'];
      for (let i = 0; i < 10; i++) {
        const a = i * 2.4;
        const s = mesh(rbox(0.05, 0.015, 0.015, 0.006), sprinkleColors[i % 4], Math.cos(a) * 0.17, 0.48 + (i % 3) * 0.02, Math.sin(a) * 0.17);
        s.rotation.y = a;
        head.add(s);
      }
      return h;
    },
  },
  {
    id: 'pump', name: 'Mr. Second Place', level: 1, tier: 'gold',
    build() {
      const tan = '#b57440';
      const blue = '#2350d8';
      const h = humanoid({ skin: tan, outfitKey: 'pump2', outfit: OUTFITS.stringer(tan, blue, '#ffffff'), sleeves: tan, pants: blue, shoes: '#f2f2f2', bulk: true, bareLegs: true });
      const { head, body, elbowL, elbowR, B } = h.rig;
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
      for (const x of [-0.085, 0.085]) {
        const white = mesh(sph(0.036, 10, 8), '#f6efe4', x, 0.025, 0.232);
        white.scale.set(1.25, 0.62, 0.6);
        head.add(white);
        head.add(mesh(sph(0.019, 8, 6), '#2a1608', x, 0.025, 0.25));
        const brow = mesh(rbox(0.1, 0.026, 0.035, 0.01), '#1e140e', x, 0.075, 0.24);
        brow.rotation.z = x < 0 ? -0.18 : 0.18;
        head.add(brow);
      }
      const nose = mesh(sph(0.038, 10, 8), '#a5663a', 0, -0.035, 0.265);
      nose.scale.set(1.15, 0.85, 0.9);
      head.add(nose);
      head.add(mesh(rbox(0.13, 0.04, 0.02, 0.012), '#6e3a1e', 0, -0.115, 0.248));
      head.add(mesh(rbox(0.11, 0.022, 0.022, 0.008), '#fdf8ee', 0, -0.113, 0.252));
      for (const elbow of [elbowL, elbowR]) elbow.add(mesh(cyl(B.fore * 1.18, B.fore * 1.18, 0.07, 14), '#ffffff', 0, -0.17, 0));
      h.rig.idle = 'flex';
      return h;
    },
  },
  {
    id: 'bianco', name: 'Tonio', level: 1, tier: 'gold',
    build() {
      const skin = '#f2c9a2';
      const h = humanoid({ skin, outfitKey: 'bianco', outfit: OUTFITS.italian('#f4f2ee', '#d4af37', '#cfcac0'), sleeves: '#f4f2ee', forearms: skin, pants: '#f4f2ee', shoes: '#3a2a20', scale: 1.04 });
      const head = h.rig.head;
      head.children[0].scale.set(0.92, 1.06, 0.95);
      const hair = mesh(dome(0.28), '#b98a4e', 0, 0.05, -0.04);
      hair.rotation.x = -0.35;
      head.add(hair);
      for (const x of [-0.2, 0.2]) {
        const side = mesh(sph(0.1, 10, 8), '#b98a4e', x, 0.06, 0.02);
        side.scale.set(0.5, 1.1, 1.1);
        head.add(side);
      }
      const toque = new THREE.Group();
      toque.position.y = 0.2;
      toque.add(mesh(cyl(0.23, 0.215, 0.13, 24), '#ece8df', 0, 0.06, 0));
      toque.add(mesh(cyl(0.21, 0.225, 0.42, 24), '#fbfaf6', 0, 0.33, 0));
      const puff = mesh(sph(0.22, 18, 10), '#fbfaf6', 0, 0.53, 0);
      puff.scale.y = 0.35;
      toque.add(puff);
      toque.add(mesh(rbox(0.08, 0.08, 0.03, 0.01), '#d4af37', 0, 0.06, 0.225));
      toque.add(mesh(rbox(0.02, 0.06, 0.035, 0.005), '#b8901f', 0, 0.06, 0.232));
      head.add(toque);
      for (const x of [-0.085, 0.085]) {
        head.add(mesh(sph(0.04, 10, 8), '#ffffff', x, 0.02, 0.235));
        head.add(mesh(sph(0.024, 8, 6), '#4a7fa0', x, 0.02, 0.27));
        const brow = mesh(rbox(0.1, 0.022, 0.03, 0.01), '#8a6236', x, 0.085, 0.245);
        brow.rotation.z = x < 0 ? 0.12 : -0.12;
        head.add(brow);
      }
      head.add(mesh(sph(0.03, 8, 6), '#e0a882', 0, -0.03, 0.27));
      const smile = mesh(torus(0.05, 0.01, 10, Math.PI * 0.8), '#7a3a2a', 0.01, -0.1, 0.24);
      smile.rotation.z = Math.PI * 1.1;
      head.add(smile);
      put(h.rig.body, mesh(torus(0.11, 0.035, 18), '#c81e2a', 0, 1.22, 0.02)).rotation.x = Math.PI / 2;
      const knot = mesh(cone(0.07, 0.16, 3), '#c81e2a', 0, 1.1, 0.17);
      knot.rotation.set(Math.PI + 0.3, 0, 0);
      h.rig.body.add(knot);
      const knife = new THREE.Group();
      knife.add(mesh(rbox(0.035, 0.12, 0.035, 0.012), '#2a2024', 0, 0, 0));
      knife.add(mesh(rbox(0.065, 0.36, 0.014, 0.005), '#9fb2c0', 0.012, 0.24, 0));
      knife.position.set(0, -0.26, 0.03);
      knife.rotation.x = Math.PI / 2;
      h.rig.elbowR.add(knife);
      h.rig.prop = knife;
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
        arm.add(mesh(cyl(0.062, 0.062, 0.025, 14), teal, 0, -0.15, 0));
      }
      for (const elbow of [elbowL, elbowR]) {
        elbow.children[0].visible = false;
        elbow.add(mesh(cyl(0.06, 0.1, 0.25, 16), black, 0, -0.13, 0));
        elbow.add(mesh(cyl(0.102, 0.102, 0.03, 16), teal, 0, -0.255, 0));
        elbow.children[1].position.y = -0.3;
      }
      for (const leg of [legL, legR]) {
        leg.add(mesh(capsule(0.066, 0.1), black, 0, -0.25, 0.005));
        leg.add(mesh(cyl(0.07, 0.07, 0.03, 14), teal, 0, -0.19, 0.005));
        leg.add(mesh(rbox(0.15, 0.025, 0.26, 0.01), teal, 0, -0.6, 0.04));
      }

      head.children[0].material = mat(skin, { emissive: skin, emissiveIntensity: 0.22 });
      head.scale.setScalar(1.04);
      const cap = mesh(dome(0.296), teal, 0, 0.03, -0.015);
      cap.scale.set(1, 1.05, 1.06);
      cap.rotation.x = -0.08;
      head.add(cap);
      head.add(mesh(sph(0.285, 18, 12), teal, 0, -0.02, -0.065));
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

      head.add(
        faceDecal(0.273, (c) => {
          c.save();
          c.translate(256, 0);
          c.scale(1.61, 1);
          c.translate(-256, 0);
          c.lineCap = 'round';
          c.lineJoin = 'round';
          for (const cx of [186, 326]) {
            const out = cx < 256 ? -1 : 1;
            const cy = 130;
            c.fillStyle = 'rgba(246,140,160,0.45)';
            c.beginPath();
            c.ellipse(cx + out * 12, 196, 20, 11, 0, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = '#ffffff';
            c.beginPath();
            c.ellipse(cx, cy, 33, 42, 0, 0, Math.PI * 2);
            c.fill();
            const g = c.createLinearGradient(0, cy - 36, 0, cy + 38);
            g.addColorStop(0, '#16606a');
            g.addColorStop(0.5, '#2fb2ba');
            g.addColorStop(1, '#8de8e4');
            c.fillStyle = g;
            c.beginPath();
            c.ellipse(cx, cy + 4, 27, 37, 0, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = '#0f3a42';
            c.beginPath();
            c.ellipse(cx, cy + 2, 12, 19, 0, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = '#ffffff';
            c.beginPath();
            c.ellipse(cx + 10, cy - 14, 9, 11, 0, 0, Math.PI * 2);
            c.fill();
            c.beginPath();
            c.arc(cx - 10, cy + 20, 5, 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = '#22252b';
            c.lineWidth = 9;
            c.beginPath();
            c.ellipse(cx, cy + 2, 34, 43, 0, Math.PI * 1.08, Math.PI * 1.92);
            c.stroke();
            c.lineWidth = 5;
            c.beginPath();
            c.moveTo(cx + out * 32, cy - 16);
            c.lineTo(cx + out * 44, cy - 26);
            c.stroke();
          }
          c.fillStyle = 'rgba(205,120,110,0.55)';
          c.beginPath();
          c.ellipse(256, 170, 4, 3, 0, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = '#b8344a';
          c.beginPath();
          c.moveTo(236, 186);
          c.quadraticCurveTo(256, 192, 276, 186);
          c.quadraticCurveTo(272, 210, 256, 210);
          c.quadraticCurveTo(240, 210, 236, 186);
          c.fill();
          c.fillStyle = '#f2849a';
          c.beginPath();
          c.ellipse(256, 203, 10, 5, 0, 0, Math.PI * 2);
          c.fill();
          c.restore();
        }),
      );
      for (const side of [-1, 1]) {
        put(head, mesh(cyl(0.065, 0.065, 0.05, 16), black, side * 0.29, -0.02, 0.0)).rotation.z = Math.PI / 2;
        put(head, mesh(cyl(0.035, 0.035, 0.055, 12), teal, side * 0.296, -0.02, 0.0)).rotation.z = Math.PI / 2;
      }
      h.rig.idle = 'pose';
      return h;
    },
  },
  {
    id: 'bandit', name: 'Bandit', level: 5, tier: 'gold',
    build() {
      const h = humanoid({ skin: '#7c7c86', outfitKey: 'bandit', outfit: OUTFITS.vest('#1e1e22', '#f2f2f2', '#e8c23a'), sleeves: '#f2f2f2', pants: '#3d2c22', shoes: '#ececec' });
      raccoonHead(h.rig.head, '#7c7c86');
      raccoonTail(h.rig.body, '#7c7c86');
      const chain = mesh(torus(0.12, 0.018, 20), '#f2c230', 0, 1.13, 0.06);
      chain.rotation.x = 1.25;
      h.rig.body.add(chain);
      h.rig.head.add(mesh(rbox(0.4, 0.07, 0.05, 0.02), '#111', 0, 0.04, 0.27));
      const peel = new THREE.Group();
      peel.position.y = 0.27;
      for (let i = 0; i < 4; i++) {
        const p = mesh(rbox(0.07, 0.22, 0.03, 0.03), '#f4d03f', 0, 0.06, 0);
        p.position.set(Math.cos(i * 1.57) * 0.06, 0.02, Math.sin(i * 1.57) * 0.06);
        p.rotation.set(Math.sin(i * 1.57) * 0.9, 0, -Math.cos(i * 1.57) * 0.9);
        peel.add(p);
      }
      peel.add(mesh(cyl(0.05, 0.06, 0.12, 10), '#f4d03f', 0, 0.06, 0));
      peel.add(mesh(cyl(0.015, 0.02, 0.06, 6), '#5b3a24', 0, 0.15, 0));
      h.rig.head.add(peel);
      return h;
    },
  },
  {
    id: 'maki', name: 'Maki-san', level: 7, tier: 'gold',
    build() {
      const h = humanoid({ skin: '#f6f3ea', outfitKey: 'maki', outfit: OUTFITS.tunic('#2e7d4f', '#e2402f'), sleeves: '#2e7d4f', pants: '#1f3d2b', shoes: '#e2402f' });
      const head = h.rig.head;
      head.children[0].visible = false;
      head.add(mesh(cyl(0.3, 0.3, 0.44, 28), '#1f3326', 0, 0.02, 0));
      head.add(mesh(cyl(0.27, 0.27, 0.45, 28), '#f8f6ef', 0, 0.02, 0));
      head.add(mesh(cyl(0.12, 0.12, 0.46, 18), '#f07a4a', 0, 0.02, 0));
      head.add(mesh(cyl(0.05, 0.05, 0.47, 10), '#7bc47f', 0.07, 0.02, 0.03));
      head.add(mesh(sph(0.06, 10, 8), '#ffffff', -0.1, 0.06, 0.28));
      head.add(mesh(sph(0.06, 10, 8), '#ffffff', 0.1, 0.06, 0.28));
      head.add(mesh(sph(0.03, 8, 6), '#111', -0.1, 0.06, 0.33));
      head.add(mesh(sph(0.03, 8, 6), '#111', 0.1, 0.06, 0.33));
      return h;
    },
  },
];

export function buildCharacter(id, { silhouette = false } = {}) {
  const def = CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
  const h = def.build();
  if (silhouette) h.root.traverse((o) => o.isMesh && (o.material = silhouetteMat));
  return h;
}

const SKINS = ['#f3c9a6', '#e6b48c', '#c98d62', '#8d5a3b', '#5e3a26', '#f7d9c4'];
const SHIRTS = ['#3fb3a8', '#e5559a', '#f39a2b', '#5a8de0', '#8bc34a', '#f4d03f', '#ef5350', '#9575cd', '#26c6da'];
const HAIR = ['#2b1d16', '#e0682a', '#f4d03f', '#5b3a24', '#1e1e1e', '#3fb3a8', '#e5559a', '#9a9a9a'];

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
  eyes(head, { y: 0.01 });
  const style = Math.floor(rng() * 4);
  const hc = pick(HAIR);
  if (style === 0) {
    const cap = mesh(dome(0.29), hc, 0, 0.02, -0.02);
    head.add(cap);
  } else if (style === 1) {
    head.add(mesh(sph(0.3), hc, 0, 0.03, -0.06));
    const bangs = mesh(sph(0.2, 12, 8), hc, 0, 0.16, 0.12);
    bangs.scale.set(1.3, 0.45, 0.7);
    head.add(bangs);
  } else if (style === 2) {
    const cap = mesh(dome(0.29), hc, 0, 0.02, -0.02);
    head.add(cap);
    const bun = mesh(sph(0.12), hc, 0, 0.3, -0.1);
    head.add(bun);
  } else {
    const c = pick(SHIRTS);
    head.add(mesh(dome(0.29), c, 0, 0.06, 0));
    const brim = mesh(rbox(0.3, 0.03, 0.22, 0.01), c, 0, 0.08, 0.24);
    head.add(brim);
  }
  const mouth = mesh(torus(0.05, 0.012, 10, Math.PI), '#4a1c1c', 0, -0.09, 0.24);
  mouth.rotation.z = Math.PI;
  head.add(mouth);
  h.rig.mouth = mouth;
  return h;
}

const lerp = THREE.MathUtils.lerp;

function aimArm(arm, elbow, x, y, z, ex, ey, k, ez = 0) {
  arm.rotation.x = lerp(arm.rotation.x, x, k);
  arm.rotation.y = lerp(arm.rotation.y, y, k);
  arm.rotation.z = lerp(arm.rotation.z, z, k);
  elbow.rotation.x = lerp(elbow.rotation.x, ex, k);
  elbow.rotation.y = lerp(elbow.rotation.y, ey, k);
  elbow.rotation.z = lerp(elbow.rotation.z, ez, k);
}

export function animateRig(rig, dt, moveAmt, carrying, t) {
  const target = Math.min(1, moveAmt);
  rig.phase += dt * (6 + 6 * target);
  const swing = Math.sin(rig.phase) * 0.7 * target;
  rig.legL.rotation.x = swing;
  rig.legR.rotation.x = -swing;
  rig.body.position.y = Math.abs(Math.sin(rig.phase)) * 0.05 * target + Math.sin(t * 2) * 0.006;
  const k = Math.min(1, dt * 14);
  const out = rig.bulk ? 0.2 : 0;
  if (rig.prop) rig.prop.visible = !carrying;
  if (carrying) {
    const inward = rig.bulk ? 0.35 : 0;
    aimArm(rig.armL, rig.elbowL, -0.45, 0, -0.16 - out, -1.2, inward, k);
    aimArm(rig.armR, rig.elbowR, -0.45, 0, 0.16 + out, -1.2, -inward, k);
  } else {
    aimArm(rig.armL, rig.elbowL, -swing * 0.8, 0, -0.1 - out, -0.25 - target * 0.35, 0, k);
    aimArm(rig.armR, rig.elbowR, swing * 0.8, 0, 0.1 + out, -0.25 - target * 0.35, 0, k);
  }
  rig.head.rotation.z = Math.sin(t * 1.3 + rig.phase * 0.1) * 0.03 * (1 - target);
  if (rig.tails)
    rig.tails.forEach((tl, i) => {
      tl.rotation.x = lerp(tl.rotation.x, 0.12 + target * 0.5 + Math.abs(Math.sin(rig.phase)) * 0.08 * target, k);
      tl.rotation.z = lerp(tl.rotation.z, (i ? 1 : -1) * (0.06 + Math.sin(rig.phase * 0.5 + i) * 0.05 * target), k);
    });
}

export function poseIdle(rig, t) {
  rig.body.position.y = Math.sin(t * 2) * 0.01;
  if (rig.tails) rig.tails.forEach((tl, i) => {
    tl.rotation.x = 0.1 + Math.sin(t * 1.6 + i) * 0.03;
    tl.rotation.z = (i ? 1 : -1) * (0.06 + Math.sin(t * 1.3 + i * 2) * 0.03);
  });
  if (rig.idle === 'pose') {
    aimArm(rig.armL, rig.elbowL, 0, 0, -0.5, 0, 0, 1, 1.9);
    aimArm(rig.armR, rig.elbowR, -0.55, 0, 2.45, 0, 0, 1, 1.25 + Math.sin(t * 1.5) * 0.06);
  } else if (rig.idle === 'wave') {
    aimArm(rig.armL, rig.elbowL, 0, 0, -0.55, 0, 0, 1, 1.9);
    aimArm(rig.armR, rig.elbowR, 0, 0, 2.45, 0, 0, 1, 0.35 + Math.sin(t * 6) * 0.4);
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
