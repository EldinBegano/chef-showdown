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

function humanoid({ skin, shirt, pants, shoes = '#2b2b33', sleeves, scale = 1 }) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const limb = (x, y, r, len, color, endGeo, endColor, endY) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    pivot.add(mesh(cyl(r, r * 0.9, len, 12), color, 0, -len / 2, 0));
    if (endGeo) pivot.add(mesh(endGeo, endColor, 0, endY, 0.04));
    body.add(pivot);
    return pivot;
  };

  const legL = limb(-0.12, 0.6, 0.09, 0.5, pants, rbox(0.17, 0.11, 0.27, 0.05), shoes, -0.53);
  const legR = limb(0.12, 0.6, 0.09, 0.5, pants, rbox(0.17, 0.11, 0.27, 0.05), shoes, -0.53);
  const torso = mesh(rbox(0.52, 0.56, 0.34, 0.14), shirt, 0, 0.88, 0);
  body.add(torso);
  const armL = limb(-0.32, 1.08, 0.068, 0.42, sleeves || shirt, sph(0.075), skin, -0.44);
  const armR = limb(0.32, 1.08, 0.068, 0.42, sleeves || shirt, sph(0.075), skin, -0.44);
  armL.children[1].position.z = 0;
  armR.children[1].position.z = 0;

  const head = new THREE.Group();
  head.position.y = 1.4;
  head.add(mesh(sph(0.27), skin));
  body.add(head);

  root.scale.setScalar(scale);
  return { root, rig: { body, head, torso, legL, legR, armL, armR, phase: Math.random() * 6 } };
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

function chefCoat(body, color = '#f4efe3', buttons = '#c8b89a') {
  for (const [x, y] of [[-0.08, 0.98], [0.08, 0.98], [-0.08, 0.8], [0.08, 0.8]]) body.add(mesh(sph(0.025, 8, 6), buttons, x, y, 0.17));
  body.add(mesh(rbox(0.4, 0.36, 0.04, 0.02), color, 0, 0.62, 0.15));
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
  tail.position.set(0, 0.62, -0.18);
  tail.rotation.x = -0.9;
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

export const CHARACTERS = [
  {
    id: 'morel', name: 'Chef Morel', level: 1, tier: 'free',
    build() {
      const h = humanoid({ skin: '#e6b48c', shirt: '#f4efe3', pants: '#557d3a', shoes: '#5b3a24' });
      chefCoat(h.rig.body);
      eyes(h.rig.head);
      mustache(h.rig.head);
      mushroomCap(h.rig.head, '#d83a2c', '#fff7ee');
      return h;
    },
  },
  {
    id: 'rocco', name: 'Rocco', level: 1, tier: 'free',
    build() {
      const h = humanoid({ skin: '#8e8e98', shirt: '#4e7e3f', pants: '#222228', shoes: '#ececec' });
      h.rig.body.add(mesh(rbox(0.3, 0.5, 0.06, 0.03), '#e5559a', -0.08, 0.86, 0.15));
      h.rig.body.add(mesh(rbox(0.22, 0.5, 0.06, 0.03), '#3fb3a8', 0.12, 0.86, 0.15));
      raccoonHead(h.rig.head);
      raccoonTail(h.rig.body);
      bucketHat(h.rig.head, '#ef7a1a');
      return h;
    },
  },
  {
    id: 'violet', name: 'Violet', level: 2, tier: 'free',
    build() {
      const h = humanoid({ skin: '#9b6fc4', shirt: '#f6f1e6', pants: '#7d4fa8', shoes: '#4b2a1a' });
      h.rig.body.add(mesh(rbox(0.46, 0.36, 0.05, 0.02), '#f07d1e', 0, 0.68, 0.16));
      put(h.rig.body, mesh(torus(0.17, 0.05, 20), '#f07d1e', 0, 1.15, 0)).rotation.x = Math.PI / 2;
      eyes(h.rig.head, { y: 0.0 });
      mushroomCap(h.rig.head, '#b58ade', '#efe1fb');
      return h;
    },
  },
  {
    id: 'sprinkles', name: 'Sprinkles', level: 3, tier: 'free',
    build() {
      const h = humanoid({ skin: '#f3c9a6', shirt: '#f4efe3', pants: '#ef7a2a', shoes: '#1e1e1e', sleeves: '#f4efe3' });
      chefCoat(h.rig.body);
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
    id: 'bandit', name: 'Bandit', level: 5, tier: 'gold',
    build() {
      const h = humanoid({ skin: '#7c7c86', shirt: '#1e1e22', pants: '#3d2c22', shoes: '#ececec', sleeves: '#f2f2f2' });
      raccoonHead(h.rig.head, '#7c7c86');
      raccoonTail(h.rig.body, '#7c7c86');
      h.rig.body.add(mesh(rbox(0.1, 0.5, 0.06, 0.03), '#e8c23a', 0, 0.86, 0.16));
      const chain = mesh(torus(0.14, 0.02, 20), '#f2c230', 0, 1.08, 0.08);
      chain.rotation.x = 1.2;
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
      const h = humanoid({ skin: '#f6f3ea', shirt: '#2e7d4f', pants: '#1f3d2b', shoes: '#e2402f' });
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
      put(h.rig.body, mesh(torus(0.17, 0.04, 20), '#e2402f', 0, 1.15, 0)).rotation.x = Math.PI / 2;
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
  const h = humanoid({ skin: pick(SKINS), shirt: pick(SHIRTS), pants: pick(['#2d3a5a', '#3a3a3a', '#6d4c41', '#455a64']), shoes: pick(['#222', '#eee', '#c0392b']), scale: 1.0 + rng() * 0.12 });
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

export function animateRig(rig, dt, moveAmt, carrying, t) {
  const target = Math.min(1, moveAmt);
  rig.phase += dt * (6 + 6 * target);
  const swing = Math.sin(rig.phase) * 0.7 * target;
  rig.legL.rotation.x = swing;
  rig.legR.rotation.x = -swing;
  rig.body.position.y = Math.abs(Math.sin(rig.phase)) * 0.05 * target + Math.sin(t * 2) * 0.006;
  if (carrying) {
    rig.armL.rotation.x = THREE.MathUtils.lerp(rig.armL.rotation.x, -1.35, 0.3);
    rig.armR.rotation.x = THREE.MathUtils.lerp(rig.armR.rotation.x, -1.35, 0.3);
    rig.armL.rotation.z = THREE.MathUtils.lerp(rig.armL.rotation.z, -0.15, 0.3);
    rig.armR.rotation.z = THREE.MathUtils.lerp(rig.armR.rotation.z, 0.15, 0.3);
  } else {
    rig.armL.rotation.x = THREE.MathUtils.lerp(rig.armL.rotation.x, -swing * 0.8, 0.3);
    rig.armR.rotation.x = THREE.MathUtils.lerp(rig.armR.rotation.x, swing * 0.8, 0.3);
    rig.armL.rotation.z = THREE.MathUtils.lerp(rig.armL.rotation.z, 0.08, 0.3);
    rig.armR.rotation.z = THREE.MathUtils.lerp(rig.armR.rotation.z, -0.08, 0.3);
  }
  rig.head.rotation.z = Math.sin(t * 1.3 + rig.phase * 0.1) * 0.03 * (1 - target);
}

export function poseIdle(rig, t) {
  rig.body.position.y = Math.sin(t * 2) * 0.01;
  rig.armL.rotation.set(-0.9, 0, 0.85);
  rig.armR.rotation.set(-0.95, 0, -0.85);
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
