import * as THREE from 'three';
import { mat, glow, mesh, rbox, cyl, sph, dome, torus, cone, put, canvasTexture, texMat, buildDish } from './models.js';

export const KITCHEN = {
  minX: -2.65,
  maxX: 2.65,
  minZ: -1.95,
  maxZ: 2.35,
  pitX: 3.0,
  pitBack: -2.3,
  pitFront: 2.7,
  deckY: 0.5,
  deckX: 5.4,
  deckFront: 3.45,
  stationX: 3.65,
  frontZ: 3.08,
  counterFront: -2.75,
  counterBack: -3.45,
  counterY: 1.1,
  counterZ: -3.1,
  customerZ: -4.0,
};

const K = KITCHEN;
const rnd = (() => {
  let s = 1234567;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
})();

function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + amt, 0, 1));
  return `#${c.getHexString()}`;
}

function planksTex(base, seam, rows = 6) {
  return canvasTexture(512, 512, (c, w, h) => {
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -((r * 173) % 260);
      while (x < w) {
        const len = 220 + ((r * 97 + x) % 140);
        c.fillStyle = shade(base, (rnd() - 0.5) * 0.06);
        c.fillRect(x, r * rh, len, rh);
        c.strokeStyle = 'rgba(0,0,0,0.05)';
        c.lineWidth = 2;
        for (let g = 0; g < 3; g++) {
          const gy = r * rh + 10 + rnd() * (rh - 20);
          c.beginPath();
          c.moveTo(x + 10, gy);
          c.bezierCurveTo(x + len * 0.3, gy + 4, x + len * 0.6, gy - 4, x + len - 10, gy);
          c.stroke();
        }
        c.fillStyle = seam;
        c.fillRect(x + len - 3, r * rh, 3, rh);
        x += len;
      }
      c.fillStyle = seam;
      c.fillRect(0, r * rh, w, 3);
    }
  });
}

function flagstoneTex(grout, palette) {
  return canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = grout;
    c.fillRect(0, 0, w, h);
    const n = 6;
    const s = w / n;
    const used = new Set();
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        if (used.has(`${x},${y}`)) continue;
        const wide = x < n - 1 && !used.has(`${x + 1},${y}`) && rnd() < 0.35;
        const tall = !wide && y < n - 1 && rnd() < 0.25;
        const cw = wide ? 2 : 1;
        const chh = tall ? 2 : 1;
        for (let i = 0; i < cw; i++) for (let j = 0; j < chh; j++) used.add(`${x + i},${y + j}`);
        const col = palette[Math.floor(rnd() * palette.length)];
        const px = x * s + 5;
        const py = y * s + 5;
        const pw = cw * s - 10;
        const ph = chh * s - 10;
        c.fillStyle = col;
        c.beginPath();
        c.roundRect(px, py, pw, ph, 8);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.06)';
        c.fillRect(px + 6, py + 6, pw - 12, 6);
      }
  });
}

function checkerTex(a, b, n = 4) {
  return canvasTexture(256, 256, (c, w) => {
    const s = w / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        c.fillStyle = (x + y) % 2 ? a : b;
        c.fillRect(x * s, y * s, s, s);
      }
  });
}

function tatamiTex() {
  return canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = '#d9cb9c';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(110,90,50,0.16)';
    c.lineWidth = 2;
    for (let y = 0; y < h; y += 7) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    c.fillStyle = '#2c3a30';
    c.fillRect(0, 0, w, 12);
    c.fillRect(0, 0, 12, h);
    c.fillRect(w / 2 - 6, h / 2, 12, h / 2);
    c.fillRect(0, h / 2 - 6, w / 2, 12);
  });
}

function tiled(tex, sx, sy) {
  const t = tex.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(sx, sy);
  t.needsUpdate = true;
  return t;
}

function block(scene, x0, x1, z0, z1, y0, y1, top, side) {
  const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  const topMat = top.isTexture ? texMat(tiled(top, (x1 - x0) / 1.6, (z1 - z0) / 1.6)) : mat(top);
  const sideMat = mat(side);
  const m = new THREE.Mesh(geo, [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

function plane(scene, w, d, x, z, y, tex, scale) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), tex.isTexture ? texMat(tiled(tex, w / scale, d / scale)) : mat(tex));
  p.rotation.x = -Math.PI / 2;
  p.position.set(x, y, z);
  p.receiveShadow = true;
  scene.add(p);
  return p;
}

function lights(scene, { bg, sky, ground, hemi = 1.0, key = '#fff2e0', keyInt = 1.5, warm = '#ffcf8a', warmInt = 26 }) {
  scene.background = new THREE.Color(bg);
  scene.fog = new THREE.Fog(bg, 22, 40);
  scene.add(new THREE.HemisphereLight(sky, ground, hemi));
  const dir = new THREE.DirectionalLight(key, keyInt);
  dir.position.set(-3, 12, 6);
  dir.target.position.set(0, 0, -0.5);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  Object.assign(dir.shadow.camera, { left: -10, right: 10, top: 9, bottom: -9, near: 1, far: 34 });
  dir.shadow.bias = -0.0006;
  dir.shadow.normalBias = 0.02;
  scene.add(dir, dir.target);
  const p = new THREE.PointLight(warm, warmInt, 12, 1.6);
  p.position.set(0, 3.6, 0.3);
  scene.add(p);
}

function kitchenBase(scene, t) {
  plane(scene, 2 * K.pitX, K.pitFront - K.pitBack, 0, (K.pitFront + K.pitBack) / 2, 0.002, t.pit, t.pitScale || 1.6);
  block(scene, -K.deckX, -K.pitX, K.counterFront, K.deckFront, 0, K.deckY, t.deck, t.deckSide);
  block(scene, K.pitX, K.deckX, K.counterFront, K.deckFront, 0, K.deckY, t.deck, t.deckSide);
  block(scene, -K.pitX, K.pitX, K.pitFront, K.deckFront, 0, K.deckY, t.deck, t.deckSide);
  block(scene, -K.pitX, K.pitX, K.counterFront, K.pitBack, 0, K.deckY + 0.12, t.shelf || t.deck, t.deckSide);
  block(scene, -K.deckX, K.deckX, K.deckFront, K.deckFront + 0.42, 0, K.deckY / 2, t.deck, t.deckSide);
  const rim = mat(t.rim);
  const trim = (w, d, x, z, y = K.deckY + 0.025) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), rim);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
  };
  trim(0.1, K.pitFront - K.pitBack + 0.1, -K.pitX, (K.pitFront + K.pitBack) / 2);
  trim(0.1, K.pitFront - K.pitBack + 0.1, K.pitX, (K.pitFront + K.pitBack) / 2);
  trim(2 * K.pitX + 0.1, 0.1, 0, K.pitFront);
  trim(2 * K.pitX + 0.1, 0.1, 0, K.pitBack, K.deckY + 0.145);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(2 * K.pitX - 0.1, 0.05, 0.02), glow(t.glow || '#ffd58a'));
  strip.position.set(0, K.deckY + 0.07, K.pitBack + 0.012);
  scene.add(strip);

  block(scene, -3.7, 3.7, K.counterBack, K.counterFront, 0, K.counterY - 0.1, t.counterSide, t.counterSide);
  scene.add(mesh(rbox(7.6, 0.12, K.counterFront - K.counterBack + 0.14, 0.04), t.counter, 0, K.counterY - 0.05, K.counterZ));
  plane(scene, 60, 44, 0, 0, -0.001, t.outer, t.outerScale || 2.4);
  if (t.street) plane(scene, 7.4, 4.0, 0, K.counterBack - 2.0, 0.003, t.street, t.streetScale || 1);
}

function lantern(scale = 1, text = '') {
  const g = new THREE.Group();
  const tex = canvasTexture(256, 128, (c, w, h) => {
    c.fillStyle = '#fbf3e4';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#e2533f';
    for (const y of [24, 40, 88, 104]) c.fillRect(0, y, w, 7);
    if (text) {
      c.fillStyle = '#2a2a2a';
      c.font = 'bold 22px "Noto Sans CJK JP", "Noto Sans CJK TC", sans-serif';
      c.textAlign = 'center';
      [...text].forEach((ch, i) => c.fillText(ch, 64, 46 + i * 22));
    }
  });
  const body = new THREE.Mesh(sph(0.34, 20, 14), texMat(tex, { emissive: '#ffe9c0', emissiveIntensity: 0.55 }));
  body.scale.set(1, 0.92, 1);
  g.add(body);
  g.add(mesh(cyl(0.2, 0.22, 0.08, 16), '#232026', 0, 0.32, 0));
  g.add(mesh(cyl(0.22, 0.2, 0.08, 16), '#232026', 0, -0.32, 0));
  g.scale.setScalar(scale);
  return g;
}

function kanjiLantern(text, scale = 1) {
  const g = new THREE.Group();
  const tex = canvasTexture(256, 256, (c) => {
    c.fillStyle = '#d8322a';
    c.fillRect(0, 0, 256, 256);
    c.strokeStyle = '#a8241e';
    c.lineWidth = 5;
    for (let y = 14; y < 256; y += 26) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(256, y);
      c.stroke();
    }
    c.fillStyle = '#ffffff';
    c.fillRect(70, 40, 116, 176);
    c.fillStyle = '#1a1a1a';
    c.font = 'bold 80px "Noto Sans CJK JP", "Noto Sans CJK TC", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    [...text].forEach((ch, i) => c.fillText(ch, 128, 88 + i * 84));
  });
  const body = new THREE.Mesh(cyl(0.36, 0.36, 1.05, 24), texMat(tex, { emissive: '#d8322a', emissiveIntensity: 0.3 }));
  body.castShadow = true;
  g.add(body);
  g.add(mesh(cyl(0.3, 0.32, 0.09, 20), '#1a1a1a', 0, 0.57, 0));
  g.add(mesh(cyl(0.32, 0.3, 0.09, 20), '#1a1a1a', 0, -0.57, 0));
  g.scale.setScalar(scale);
  return g;
}

function lanternString(scene, a, b, sag, count, list, texts = []) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const k = i / 24;
    pts.push(new THREE.Vector3().lerpVectors(a, b, k).add(new THREE.Vector3(0, -Math.sin(k * Math.PI) * sag, 0)));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.014, 4), mat('#d8d4cc'));
  scene.add(tube);
  for (let i = 0; i < count; i++) {
    const k = (i + 0.5) / count;
    const p = curve.getPoint(k);
    const l = lantern(0.95, texts[i % texts.length] || '');
    l.position.set(p.x, p.y - 0.36, p.z);
    l.rotation.y = rnd() * 0.6 - 0.3;
    scene.add(l);
    list.push(l);
  }
}

function signBoard(text, w, h, bg, fg, { emissive = 0.15, size = 70 } = {}) {
  const tex = canvasTexture(128, 384, (c) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, 128, 384);
    c.strokeStyle = fg;
    c.lineWidth = 6;
    c.strokeRect(8, 8, 112, 368);
    c.fillStyle = fg;
    c.font = `bold ${size}px "Noto Sans CJK JP", "Noto Sans CJK TC", sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const step = 300 / Math.max(1, text.length);
    [...text].forEach((ch, i) => c.fillText(ch, 64, 42 + step / 2 + i * step));
  });
  const side = mat('#222');
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), [side, side, side, side, texMat(tex, { emissive: '#ffffff', emissiveIntensity: emissive }), side]);
  m.castShadow = true;
  return m;
}

function poster(colors, w, h) {
  const tex = canvasTexture(128, 160, (c) => {
    c.fillStyle = colors[0];
    c.fillRect(0, 0, 128, 160);
    c.fillStyle = colors[1];
    c.fillRect(10, 10, 108, 50);
    c.fillStyle = colors[2];
    for (let i = 0; i < 4; i++) c.fillRect(14 + (i % 2) * 54, 72 + Math.floor(i / 2) * 40, 46, 30);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), texMat(tex, { emissive: '#ffffff', emissiveIntensity: 0.2 }));
}

function wallShelf(x, y, z, w, props, ry = 0) {
  const g = new THREE.Group();
  g.add(mesh(rbox(w, 0.08, 0.42, 0.02), '#8a4a2a', 0, 0, 0));
  for (const px of [-w / 2 + 0.2, w / 2 - 0.2]) g.add(mesh(rbox(0.06, 0.25, 0.3, 0.01), '#6b3820', px, -0.15, 0));
  props.forEach((p, i) => {
    const o = p();
    o.position.set(-w / 2 + 0.35 + (i * (w - 0.7)) / Math.max(1, props.length - 1), 0.04, 0);
    g.add(o);
  });
  g.position.set(x, y, z);
  g.rotation.y = ry;
  return g;
}

const bowl = (c) => () => {
  const g = new THREE.Group();
  const b = mesh(dome(0.13), c, 0, 0.1, 0);
  b.rotation.x = Math.PI;
  g.add(b);
  return g;
};
const cups = (c) => () => {
  const g = new THREE.Group();
  for (const [x, y] of [[-0.09, 0], [0.09, 0], [0, 0.12]]) g.add(mesh(cyl(0.08, 0.06, 0.12, 12), c, x, y + 0.06, 0));
  return g;
};
const plates = (c) => () => {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) g.add(mesh(cyl(0.18, 0.15, 0.03, 18), c, 0, 0.02 + i * 0.035, 0));
  return g;
};
const bottles = (c, n = 3) => () => {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.13;
    g.add(mesh(cyl(0.05, 0.06, 0.28, 10), c, x, 0.14, 0));
    g.add(mesh(cyl(0.02, 0.04, 0.12, 8), c, x, 0.34, 0));
  }
  return g;
};
const octopus = () => {
  const g = new THREE.Group();
  const head = mesh(sph(0.15, 14, 10), '#f07a4a', 0, 0.26, 0);
  head.scale.y = 1.25;
  g.add(head);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const leg = mesh(cyl(0.025, 0.035, 0.2, 8), '#f07a4a', Math.cos(a) * 0.09, 0.07, Math.sin(a) * 0.09);
    leg.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
    g.add(leg);
  }
  g.add(mesh(sph(0.025, 6, 6), '#111', -0.05, 0.28, 0.13));
  g.add(mesh(sph(0.025, 6, 6), '#111', 0.05, 0.28, 0.13));
  return g;
};
const sushiMascot = (top = '#f6cf3d', s = 1) => () => {
  const g = new THREE.Group();
  g.add(mesh(rbox(0.34, 0.24, 0.26, 0.1), '#fbfaf5', 0, 0.12, 0));
  g.add(mesh(rbox(0.36, 0.09, 0.28, 0.04), top, 0, 0.28, 0));
  g.add(mesh(rbox(0.09, 0.34, 0.29, 0.01), '#1d3324', 0, 0.19, 0));
  g.add(mesh(sph(0.022, 6, 6), '#111', -0.08, 0.14, 0.13));
  g.add(mesh(sph(0.022, 6, 6), '#111', 0.08, 0.14, 0.13));
  g.add(mesh(sph(0.02, 6, 6), '#f08aa0', -0.12, 0.1, 0.12));
  g.add(mesh(sph(0.02, 6, 6), '#f08aa0', 0.12, 0.1, 0.12));
  g.scale.setScalar(s);
  return g;
};

function lowTable(x, z, items = []) {
  const g = new THREE.Group();
  g.add(mesh(rbox(1.6, 0.14, 1.1, 0.04), '#5a2620', 0, 0.44, 0));
  g.add(mesh(rbox(1.4, 0.36, 0.9, 0.03), '#3e1a16', 0, 0.2, 0));
  for (const [dx, dz] of [[-0.45, -0.95], [0.45, -0.95], [-0.45, 0.95], [0.45, 0.95]]) {
    const c = mesh(rbox(0.62, 0.1, 0.5, 0.05), '#b83a36', dx, 0.05, dz);
    c.rotation.y = rnd() * 0.3 - 0.15;
    g.add(c);
  }
  items.forEach(([fn, ix, iz]) => {
    const o = fn();
    o.position.set(ix, 0.51, iz);
    g.add(o);
  });
  g.position.set(x, 0, z);
  return g;
}

function placeOnPass(scene, items) {
  const span = 2 * K.pitX - 0.6;
  items.forEach((fn, i) => {
    const o = fn();
    o.position.set(-span / 2 + (i * span) / (items.length - 1), K.deckY + 0.12, (K.pitBack + K.counterFront) / 2);
    o.scale.multiplyScalar(1.35);
    scene.add(o);
  });
}

function wallWithWainscot(scene, x0, x1, z, color, wood, h = 5) {
  const w = x1 - x0;
  scene.add(mesh(new THREE.BoxGeometry(w, h, 0.2), color, (x0 + x1) / 2, h / 2, z));
  for (let i = 0; i < 5; i++) scene.add(mesh(new THREE.BoxGeometry(w, 0.26, 0.08), shade(wood, i % 2 ? -0.04 : 0), (x0 + x1) / 2, 0.2 + i * 0.3, z + 0.13));
  scene.add(mesh(new THREE.BoxGeometry(w, 0.1, 0.14), shade(wood, -0.1), (x0 + x1) / 2, 1.7, z + 0.15));
}

export function buildSushiBar(scene) {
  lights(scene, { bg: '#2a2140', sky: '#c8b8ff', ground: '#3a2a50', hemi: 0.75, keyInt: 1.25, warm: '#ffcc80', warmInt: 55 });
  const flag = flagstoneTex('#557aa3', ['#34445c', '#3a4c66', '#2f3e55', '#41546f', '#38495f']);
  kitchenBase(scene, {
    pit: flag,
    pitScale: 2.4,
    deck: planksTex('#efd6a2', '#c9a46a'),
    shelf: planksTex('#f6e2b6', '#d2b07a', 3),
    deckSide: '#d9b77c',
    rim: '#d9773a',
    counter: '#ef6f30',
    counterSide: '#c9542a',
    outer: tatamiTex(),
    outerScale: 3.2,
    street: canvasTexture(256, 256, (c, w) => {
      c.fillStyle = '#1e2a3c';
      c.fillRect(0, 0, w, w);
      for (let i = 0; i < 16; i++) {
        c.fillStyle = ['#3f7f7a', '#2f6a6a', '#4f8f84'][i % 3];
        c.fillRect(rnd() * 220, rnd() * 220, 18 + rnd() * 20, 12 + rnd() * 10);
      }
    }),
    streetScale: 2,
    glow: '#ffd890',
  });

  const backWall = mesh(new THREE.PlaneGeometry(8, 5), '#1b2340', 0, 2.5, -6.2);
  scene.add(backWall);
  const nightGlow = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.6), glow('#3f7f8f', 0.35));
  nightGlow.position.set(0, 0.8, -6.1);
  scene.add(nightGlow);
  wallWithWainscot(scene, -14, -3.7, -3.6, '#4a4562', '#6b4a3a');
  wallWithWainscot(scene, 3.7, 14, -3.6, '#4a4562', '#6b4a3a');

  for (const x of [-3.72, 3.72]) {
    scene.add(mesh(rbox(0.32, 4.4, 0.32, 0.05), '#b8302a', x, 2.2, -3.5));
    scene.add(mesh(rbox(0.5, 0.3, 0.5, 0.05), '#8f241f', x, 0.15, -3.5));
  }
  scene.add(mesh(rbox(8.4, 0.34, 0.44, 0.05), '#5a3424', 0, 4.25, -3.5));
  scene.add(mesh(rbox(7.6, 0.16, 0.3, 0.04), '#b8302a', 0, 3.95, -3.5));
  for (const z of [-5.5, -4.6]) scene.add(mesh(rbox(8, 0.22, 0.3, 0.04), '#3a2418', 0, 4.4, z));

  const s1 = signBoard('おいしい', 0.46, 1.5, '#fbf6ec', '#1a1a1a', { size: 60 });
  s1.position.set(-3.35, 2.7, -3.25);
  scene.add(s1);
  const s1top = mesh(rbox(0.5, 0.18, 0.08, 0.02), '#d8322a', -3.35, 3.5, -3.25);
  scene.add(s1top);
  const p1 = poster(['#2fb3ad', '#f4f0e0', '#e5559a'], 0.7, 0.9);
  p1.position.set(-2.75, 2.3, -3.4);
  p1.rotation.y = 0.15;
  scene.add(p1);
  const p2 = poster(['#5ad16a', '#ffffff', '#2f6fb0'], 0.55, 0.7);
  p2.position.set(-2.55, 1.75, -3.38);
  p2.rotation.y = 0.1;
  scene.add(p2);
  const s2 = signBoard('美味しい', 0.42, 1.6, '#2fc6d6', '#ffffff', { emissive: 0.6, size: 56 });
  s2.position.set(3.3, 2.5, -3.25);
  scene.add(s2);
  const s3 = signBoard('食物', 0.5, 1.0, '#f6c434', '#d8322a', { emissive: 0.3, size: 84 });
  s3.position.set(3.75, 1.75, -3.0);
  s3.rotation.y = -0.4;
  scene.add(s3);

  const swing = [];
  lanternString(scene, new THREE.Vector3(-9, 5.6, -0.6), new THREE.Vector3(-1.2, 4.0, -3.4), 0.5, 5, swing, ['', '御馳', '', '走様']);
  lanternString(scene, new THREE.Vector3(-1.2, 4.0, -3.4), new THREE.Vector3(1.2, 4.0, -3.4), 0.15, 2, swing, ['御馳']);
  lanternString(scene, new THREE.Vector3(1.2, 4.0, -3.4), new THREE.Vector3(9, 5.6, -0.6), 0.5, 5, swing, ['', '走様', '']);
  for (const x of [-2.6, 2.6]) {
    const k = kanjiLantern('食物', 1.05);
    k.position.set(x, 4.55, -3.0);
    scene.add(k);
    swing.push(k);
  }

  scene.add(wallShelf(-6.0, 2.3, -3.35, 3.6, [plates('#4f93d8'), cups('#2f6fb0'), octopus, bowl('#2f6fb0'), sushiMascot()]));
  scene.add(wallShelf(-6.4, 3.4, -3.35, 2.6, [bottles('#3e8d4a', 2), plates('#f7f4ee'), bowl('#d23a32')]));
  scene.add(wallShelf(6.0, 2.3, -3.35, 3.6, [octopus, bowl('#d23a32'), cups('#2f6fb0'), bottles('#3e8d4a', 3)]));
  scene.add(wallShelf(6.4, 3.4, -3.35, 2.6, [plates('#4f93d8'), bottles('#3e8d4a', 2), cups('#e8e2d0')]));

  placeOnPass(scene, [sushiMascot('#f6cf3d', 0.7), bowl('#d23a32'), bowl('#d23a32'), plates('#f7f4ee'), bottles('#3e8d4a', 4), sushiMascot('#f47a45', 0.7), bowl('#2f6fb0')]);
  const mascot = sushiMascot('#f6cf3d', 1.3)();
  mascot.position.set(3.1, K.counterY, K.counterZ + 0.1);
  mascot.rotation.y = -0.4;
  scene.add(mascot);

  const nig = () => buildDish('salmon_maki');
  for (const [x, z] of [[-7.6, -0.4], [7.6, -0.4], [-7.9, 3.0], [7.9, 3.0]])
    scene.add(lowTable(x, z, [[bottles('#3e8d4a', 1), -0.5, -0.2], [cups('#2f6fb0'), 0.3, 0.2], [nig, 0.1, -0.2], [plates('#e8eef2'), 0.55, -0.25]]));

  return {
    tick(t) {
      swing.forEach((l, i) => (l.rotation.z = Math.sin(t * 0.8 + i) * 0.035));
    },
  };
}

export function buildSushiStreet(scene) {
  lights(scene, { bg: '#121a30', sky: '#9fb4ff', ground: '#2a2a40', hemi: 0.8, key: '#c8d4ff', keyInt: 1.2, warm: '#ffbf7a', warmInt: 40 });
  kitchenBase(scene, {
    pit: flagstoneTex('#4a4a52', ['#6a6a72', '#5e5e66', '#75757e', '#66666f']),
    pitScale: 2,
    deck: planksTex('#9a6a44', '#5a3a24'),
    shelf: planksTex('#a8784e', '#6a4428', 3),
    deckSide: '#6a4428',
    rim: '#c0392b',
    counter: '#7a5236',
    counterSide: '#4a3020',
    outer: canvasTexture(256, 256, (c, w) => {
      c.fillStyle = '#2b2f3a';
      c.fillRect(0, 0, w, w);
      c.fillStyle = 'rgba(255,255,255,0.03)';
      for (let i = 0; i < 300; i++) c.fillRect(rnd() * w, rnd() * w, 2, 2);
    }),
    outerScale: 4,
    street: canvasTexture(256, 256, (c, w) => {
      c.fillStyle = '#4a4e5a';
      c.fillRect(0, 0, w, w);
      c.strokeStyle = '#3a3e48';
      c.lineWidth = 4;
      for (let i = 0; i <= 4; i++) {
        c.beginPath();
        c.moveTo(0, i * 64);
        c.lineTo(w, i * 64);
        c.stroke();
        c.beginPath();
        c.moveTo(i * 64, 0);
        c.lineTo(i * 64, w);
        c.stroke();
      }
    }),
    streetScale: 1.5,
    glow: '#ffc27a',
  });

  for (const z of [-7.5, 5.2]) {
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(60, 0.18), glow('#d9d2a0', 0.5));
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(0, 0.005, z);
    scene.add(lane);
  }

  for (const x of [-3.72, 3.72]) scene.add(mesh(rbox(0.26, 3.6, 0.26, 0.04), '#3a2418', x, 1.8, -3.5));
  scene.add(mesh(rbox(8.2, 0.3, 0.5, 0.05), '#3a2418', 0, 3.6, -3.5));
  const roof = mesh(rbox(8.8, 0.14, 1.2, 0.04), '#2a1a12', 0, 4.05, -3.9);
  roof.rotation.x = -0.3;
  scene.add(roof);

  const norenTex = canvasTexture(512, 128, (c, w, h) => {
    c.fillStyle = '#1e3a6a';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#f4f0e0';
    c.font = 'bold 70px "Noto Sans CJK JP", "Noto Sans CJK TC", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    ['寿', '司', '屋', '台'].forEach((ch, i) => c.fillText(ch, 64 + i * 128, 70));
  });
  for (let i = 0; i < 4; i++) {
    const t = norenTex.clone();
    t.needsUpdate = true;
    t.repeat.set(0.25, 1);
    t.offset.set(i * 0.25, 0);
    const n = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.75), texMat(t, { side: THREE.DoubleSide }));
    n.position.set(-2.7 + i * 1.8, 3.15, -3.62);
    scene.add(n);
  }

  const building = (x, w, h, color) => {
    scene.add(mesh(new THREE.BoxGeometry(w, h, 2), color, x, h / 2, -9.2));
    for (let r = 0; r < Math.floor(h / 1.4); r++)
      for (let c = 0; c < Math.floor(w / 1.1); c++) {
        const lit = rnd() < 0.55;
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.7), lit ? glow(rnd() < 0.5 ? '#ffd98a' : '#9fe0ff', 0.9) : mat('#1a1e2a'));
        win.position.set(x - w / 2 + 0.6 + c * 1.1, 1.0 + r * 1.4, -8.18);
        scene.add(win);
      }
  };
  building(-8, 5, 7, '#2e2a3e');
  building(-3, 4.5, 9, '#3a2e3a');
  building(1.8, 4.6, 6.5, '#283044');
  building(7, 5.5, 8, '#33293f');

  const vending = (x, color) => {
    const g = new THREE.Group();
    g.add(mesh(rbox(0.9, 1.9, 0.7, 0.05), color, 0, 0.95, 0));
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.0), glow('#e8f6ff'));
    panel.position.set(0, 1.25, 0.36);
    g.add(panel);
    for (let i = 0; i < 8; i++) g.add(mesh(cyl(0.05, 0.05, 0.16, 8), ['#e2402f', '#2f6fb0', '#f4d03f', '#2e9e4f'][i % 4], -0.26 + (i % 4) * 0.17, 1.0 + Math.floor(i / 4) * 0.4, 0.4));
    g.position.set(x, 0, -6.6);
    return g;
  };
  scene.add(vending(-5.0, '#d23a32'), vending(-6.0, '#2f6fb0'), vending(5.4, '#f2f2f2'));

  const lamps = [];
  const lamp = (x, z) => {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.07, 0.09, 4.2, 10), '#3a3e48', 0, 2.1, 0));
    g.add(mesh(rbox(0.7, 0.08, 0.14, 0.02), '#3a3e48', 0.3, 4.15, 0));
    const bulb = new THREE.Mesh(sph(0.16, 12, 8), glow('#ffe2a8'));
    bulb.position.set(0.55, 4.0, 0);
    g.add(bulb);
    const pl = new THREE.PointLight('#ffcf8a', 10, 7, 1.6);
    pl.position.set(0.55, 3.8, 0);
    g.add(pl);
    g.position.set(x, 0, z);
    lamps.push(bulb);
    return g;
  };
  scene.add(lamp(-7.2, -4.6), lamp(7.2, -4.6));

  const pole = (x) => {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.12, 0.15, 7.5, 10), '#5a5048', 0, 3.75, 0));
    for (const y of [6.6, 7.0]) g.add(mesh(rbox(1.4, 0.08, 0.1, 0.02), '#5a5048', 0, y, 0));
    g.position.set(x, 0, -7.4);
    return g;
  };
  scene.add(pole(-10.5), pole(10.5));
  for (const y of [6.62, 7.02]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 21, 4), mat('#111'));
    w.rotation.z = Math.PI / 2;
    w.position.set(0, y - 0.25, -7.4);
    scene.add(w);
  }

  const neon = [];
  const vsign = (text, x, y, z, bg, fg, ry = 0) => {
    const s = signBoard(text, 0.5, 1.7, bg, fg, { emissive: 0.8, size: 54 });
    s.position.set(x, y, z);
    s.rotation.y = ry;
    scene.add(s);
    neon.push(s);
  };
  vsign('ラーメン', -4.6, 3.0, -5.6, '#e5317e', '#ffffff');
  vsign('居酒屋', -1.2, 4.2, -8.1, '#2fc6d6', '#ffffff');
  vsign('寿司', 4.4, 3.2, -5.6, '#f6c434', '#d8322a');
  vsign('焼鳥', 2.6, 4.6, -8.1, '#8a4fd6', '#ffffff');

  const swing = [];
  lanternString(scene, new THREE.Vector3(-9, 5.2, -0.8), new THREE.Vector3(-3.7, 3.5, -3.3), 0.35, 4, swing, ['', '祭']);
  lanternString(scene, new THREE.Vector3(3.7, 3.5, -3.3), new THREE.Vector3(9, 5.2, -0.8), 0.35, 4, swing, ['祭', '']);
  for (const x of [-4.3, 4.3]) {
    const k = kanjiLantern('寿司', 1.0);
    k.position.set(x, 3.0, -3.0);
    scene.add(k);
    swing.push(k);
  }

  const crate = (x, z) => {
    const g = new THREE.Group();
    g.add(mesh(rbox(0.8, 0.5, 0.6, 0.03), '#c0392b', 0, 0.25, 0));
    for (let i = 0; i < 6; i++) g.add(mesh(cyl(0.05, 0.05, 0.36, 8), '#3e8d4a', -0.25 + (i % 3) * 0.25, 0.6, -0.14 + Math.floor(i / 3) * 0.28));
    g.position.set(x, 0, z);
    g.rotation.y = rnd() - 0.5;
    return g;
  };
  scene.add(crate(-6.3, 1.0), crate(-6.6, 1.8), crate(6.4, 2.2));
  const stool = (x, z) => {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.24, 0.24, 0.08, 14), '#d23a32', 0, 0.62, 0));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const l = mesh(cyl(0.025, 0.025, 0.62, 6), '#9aa4ad', Math.cos(a) * 0.15, 0.3, Math.sin(a) * 0.15);
      l.rotation.set(Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15);
      g.add(l);
    }
    g.position.set(x, 0, z);
    return g;
  };
  scene.add(stool(-6.2, -1.8), stool(-7.0, -1.2), stool(6.4, -1.6), stool(7.2, -0.6));

  return {
    tick(t) {
      swing.forEach((l, i) => (l.rotation.z = Math.sin(t * 1.1 + i) * 0.05));
      neon.forEach((n, i) => (n.material[4].emissiveIntensity = 0.65 + Math.sin(t * 3 + i * 2) * 0.15 + (Math.sin(t * 23 + i) > 0.97 ? -0.4 : 0)));
    },
  };
}

export function buildBurgerDiner(scene) {
  lights(scene, { bg: '#2a1a2a', sky: '#fff0f0', ground: '#4a2a3a', hemi: 1.0, warm: '#fff0d0', warmInt: 26 });
  kitchenBase(scene, {
    pit: checkerTex('#d23a32', '#f4efe6', 2),
    pitScale: 1.2,
    deck: canvasTexture(128, 128, (c, w) => {
      c.fillStyle = '#e8f4ee';
      c.fillRect(0, 0, w, w);
      c.fillStyle = 'rgba(80,140,120,0.12)';
      for (let i = 0; i < 60; i++) c.fillRect(rnd() * w, rnd() * w, 6, 2);
    }),
    shelf: '#c0c7cf',
    deckSide: '#d23a32',
    rim: '#c0c7cf',
    counter: '#e8f4ee',
    counterSide: '#d23a32',
    outer: checkerTex('#1e1e24', '#f2f2f2', 2),
    outerScale: 1.4,
    street: checkerTex('#1e1e24', '#f2f2f2', 2),
    streetScale: 1.4,
    glow: '#fff4d0',
  });
  for (const z of [K.counterFront + 0.01, K.counterBack - 0.01]) scene.add(mesh(new THREE.BoxGeometry(7.4, 0.08, 0.02), '#c0c7cf', 0, 0.55, z));
  scene.add(mesh(new THREE.BoxGeometry(10.8, 0.06, 0.02), '#c0c7cf', 0, 0.3, K.deckFront + 0.43));

  scene.add(mesh(new THREE.BoxGeometry(30, 7, 0.3), '#7fd1c2', 0, 3.5, -7.2));
  scene.add(mesh(new THREE.BoxGeometry(30, 1.2, 0.34), '#d23a32', 0, 0.6, -7.18));
  scene.add(mesh(new THREE.BoxGeometry(30, 0.12, 0.36), '#c0c7cf', 0, 1.25, -7.16));
  scene.add(mesh(new THREE.BoxGeometry(30, 0.12, 0.36), '#c0c7cf', 0, 4.6, -7.16));

  const signTex = canvasTexture(512, 128, (c, w, h) => {
    c.fillStyle = '#1a1020';
    c.fillRect(0, 0, w, h);
    c.font = 'bold 86px "Lilita One", "Fredoka", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = '#ff4a6a';
    c.shadowBlur = 24;
    c.fillStyle = '#ff7a9a';
    c.fillText('BURGERS', w / 2, h / 2 + 4);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), texMat(signTex, { emissive: '#ffffff', emissiveIntensity: 0.8 }));
  sign.position.set(0, 5.6, -7.0);
  scene.add(sign);
  const menuTex = canvasTexture(256, 160, (c, w, h) => {
    c.fillStyle = '#26222a';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#f6c434';
    c.font = 'bold 24px "Fredoka", sans-serif';
    c.fillText('MENU', 12, 30);
    c.fillStyle = '#f4efe6';
    c.font = '18px "Fredoka", sans-serif';
    ['Burger .... 6', 'Cheese .... 7', 'Deluxe .... 9', 'Fries ..... 3', 'Soda ...... 3'].forEach((l, i) => c.fillText(l, 12, 58 + i * 22));
  });
  for (const x of [-2.4, 0, 2.4]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), texMat(menuTex, { emissive: '#ffffff', emissiveIntensity: 0.25 }));
    m.position.set(x, 3.6, -5.2);
    scene.add(m);
    scene.add(mesh(cyl(0.01, 0.01, 1.0, 4), '#222', x - 0.7, 4.65, -5.2), mesh(cyl(0.01, 0.01, 1.0, 4), '#222', x + 0.7, 4.65, -5.2));
  }
  scene.add(mesh(rbox(7.6, 0.08, 1.8, 0.02), '#f2f2f2', 0, 5.1, -4.3));

  const pend = [];
  for (const x of [-2.4, 0, 2.4]) {
    scene.add(mesh(cyl(0.01, 0.01, 1.2, 4), '#222', x, 4.5, -3.1));
    const shadeM = mesh(dome(0.3), '#d23a32', x, 3.75, -3.1);
    scene.add(shadeM);
    const b = new THREE.Mesh(sph(0.1, 10, 8), glow('#fff4d0'));
    b.position.set(x, 3.72, -3.1);
    scene.add(b);
    pend.push(shadeM);
  }

  for (const [x, c] of [[-1.6, '#e2402f'], [-1.4, '#f6c434'], [1.5, '#e2402f'], [1.7, '#f6c434']]) {
    scene.add(mesh(cyl(0.06, 0.07, 0.26, 10), c, x, K.counterY + 0.13, K.counterZ + 0.15));
    scene.add(mesh(cone(0.04, 0.1, 8), c, x, K.counterY + 0.31, K.counterZ + 0.15));
  }
  scene.add(mesh(cyl(0.12, 0.12, 0.05, 16), '#c0c7cf', 0.2, K.counterY + 0.03, K.counterZ + 0.1));

  const booth = (x, z, ry) => {
    const g = new THREE.Group();
    g.add(mesh(rbox(1.6, 0.06, 0.9, 0.03), '#f2f2f2', 0, 0.78, 0));
    g.add(mesh(rbox(1.62, 0.06, 0.92, 0.03), '#c0c7cf', 0, 0.75, 0));
    g.add(mesh(cyl(0.06, 0.06, 0.75, 10), '#c0c7cf', 0, 0.38, 0));
    for (const dz of [-0.85, 0.85]) {
      g.add(mesh(rbox(1.6, 0.45, 0.5, 0.08), '#d23a32', 0, 0.22, dz));
      g.add(mesh(rbox(1.6, 0.8, 0.18, 0.08), '#d23a32', 0, 0.75, dz + Math.sign(dz) * 0.22));
    }
    const f = buildDish('deluxe');
    f.scale.setScalar(2);
    f.position.set(-0.3, 0.82, 0);
    g.add(f);
    const fr = buildDish('fries');
    fr.scale.setScalar(2);
    fr.position.set(0.35, 0.82, 0.1);
    g.add(fr);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    return g;
  };
  scene.add(booth(-7.4, -1.0, Math.PI / 2), booth(-7.4, 2.4, Math.PI / 2), booth(7.4, -1.0, Math.PI / 2), booth(7.4, 2.4, Math.PI / 2));

  const juke = new THREE.Group();
  juke.add(mesh(rbox(1.0, 1.5, 0.6, 0.08), '#8a4b25', 0, 0.75, 0));
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 10, 24, Math.PI), glow('#ff9a3c'));
  arch.position.set(0, 1.5, 0.05);
  juke.add(arch);
  const archIn = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 10, 24, Math.PI), glow('#3ff3e6'));
  archIn.position.set(0, 1.5, 0.1);
  juke.add(archIn);
  juke.add(mesh(rbox(0.7, 0.4, 0.05, 0.02), '#f6c434', 0, 1.05, 0.31));
  juke.position.set(-5.4, 0, -5.6);
  scene.add(juke);
  const juke2 = juke.clone();
  juke2.position.x = 5.4;
  scene.add(juke2);

  return {
    tick(t) {
      arch.material.color.setHSL((t * 0.15) % 1, 1, 0.6);
      archIn.material.color.setHSL((t * 0.15 + 0.5) % 1, 1, 0.6);
      sign.material.emissiveIntensity = 0.75 + Math.sin(t * 4) * 0.1;
      pend.forEach((p, i) => (p.rotation.z = Math.sin(t * 1.2 + i) * 0.03));
    },
  };
}

export function buildHappyHour(scene) {
  lights(scene, { bg: '#1c1838', sky: '#c8b8ff', ground: '#3a2a5a', hemi: 0.95, warm: '#ffc98a', warmInt: 30 });
  kitchenBase(scene, {
    pit: checkerTex('#efe0bf', '#ddc89c', 2),
    pitScale: 1.3,
    deck: planksTex('#f4a457', '#c9742e'),
    shelf: planksTex('#f6b46a', '#c9742e', 3),
    deckSide: '#d07a34',
    rim: '#fbe3b8',
    counter: '#f4a457',
    counterSide: '#c0612a',
    outer: checkerTex('#3653a8', '#e6ecf5', 2),
    outerScale: 1.6,
    street: checkerTex('#2a3a7a', '#c8d0e8', 2),
    streetScale: 1.4,
    glow: '#ffb0e0',
  });

  scene.add(mesh(new THREE.PlaneGeometry(40, 10), '#2a2456', 0, 4, -7.5));
  const neonPink = glow('#ff5fd2');
  const neonTeal = glow('#3ff3e6');
  const tube = (geo, m, x, y, z, rz = 0) => {
    const t = new THREE.Mesh(geo, m);
    t.position.set(x, y, z);
    t.rotation.z = rz;
    scene.add(t);
    return t;
  };
  tube(new THREE.BoxGeometry(14, 0.06, 0.06), neonTeal, 0, 5.2, -7.3);
  tube(new THREE.BoxGeometry(14, 0.06, 0.06), neonPink, 0, 1.4, -7.3);
  const glassSign = () => {
    const g = new THREE.Group();
    const v1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.06), neonTeal);
    v1.position.set(-0.32, 0.28, 0);
    v1.rotation.z = -0.6;
    const v2 = v1.clone();
    v2.position.x = 0.32;
    v2.rotation.z = 0.6;
    const rim = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.06, 0.06), neonTeal);
    rim.position.y = 0.7;
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), neonTeal);
    stem.position.y = -0.55;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.06), neonTeal);
    base.position.y = -0.95;
    const olive = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 20), neonPink);
    olive.position.set(0.15, 0.45, 0);
    g.add(v1, v2, rim, stem, base, olive);
    return g;
  };
  for (const x of [-4.6, 4.6]) {
    const s = glassSign();
    s.position.set(x, 3.3, -7.3);
    scene.add(s);
  }
  scene.add(mesh(new THREE.PlaneGeometry(2.6, 3.4), '#120f28', 0, 1.7, -7.35));
  tube(new THREE.BoxGeometry(2.8, 0.06, 0.06), neonPink, 0, 3.45, -7.3);
  tube(new THREE.BoxGeometry(0.06, 3.4, 0.06), neonPink, -1.4, 1.75, -7.3);
  tube(new THREE.BoxGeometry(0.06, 3.4, 0.06), neonPink, 1.4, 1.75, -7.3);

  const speaker = (x, z) => {
    const g = new THREE.Group();
    g.add(mesh(rbox(0.9, 1.5, 0.7, 0.06), '#151520', 0, 0.75, 0));
    put(g, mesh(cyl(0.28, 0.28, 0.05, 20), '#2a2a3a', 0, 0.5, 0.36)).rotation.x = Math.PI / 2;
    put(g, mesh(cyl(0.14, 0.14, 0.05, 16), '#2a2a3a', 0, 1.15, 0.36)).rotation.x = Math.PI / 2;
    g.position.set(x, 0, z);
    return g;
  };
  scene.add(speaker(-4.6, -5.2), speaker(4.6, -5.2));

  const stool = (x, z) => {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.22, 0.25, 0.04, 16), '#c0c7cf', 0, 0.02, 0));
    g.add(mesh(cyl(0.04, 0.04, 0.7, 10), '#c0c7cf', 0, 0.38, 0));
    g.add(mesh(cyl(0.28, 0.26, 0.14, 18), '#8a3b1e', 0, 0.78, 0));
    g.position.set(x, 0, z);
    return g;
  };
  for (const [x, z] of [[-6.4, -1.4], [-6.6, 0.4], [6.4, -1.4], [6.6, 0.4], [-6.0, 2.6], [6.0, 2.6], [-4.2, -4.6], [4.2, -4.6]]) scene.add(stool(x, z));
  const table = (x, z) => {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.6, 0.6, 0.06, 6), '#1e1a32', 0, 1.05, 0));
    g.add(mesh(cyl(0.05, 0.05, 1.0, 8), '#c0c7cf', 0, 0.52, 0));
    g.add(mesh(cyl(0.3, 0.35, 0.05, 12), '#c0c7cf', 0, 0.02, 0));
    const shake = buildDish('milkshake');
    shake.scale.setScalar(2);
    shake.position.set(0.15, 1.08, 0);
    g.add(shake);
    g.position.set(x, 0, z);
    return g;
  };
  scene.add(table(-7.6, -0.6), table(7.6, -0.6));
  const palm = (x, z) => {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.32, 0.25, 0.55, 14), '#8d6e63', 0, 0.27, 0));
    g.add(mesh(cyl(0.05, 0.07, 1.2, 8), '#6d4c41', 0, 1.1, 0));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const leaf = mesh(cone(0.12, 0.9, 6), '#2e9e4f', Math.cos(a) * 0.35, 1.7, Math.sin(a) * 0.35);
      leaf.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    return g;
  };
  scene.add(palm(-6.3, 4.0), palm(6.3, 4.0), palm(-6.0, -4.6), palm(6.0, -4.6));
  const discoLights = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(sph(0.12, 10, 8), glow(['#ff5fd2', '#3ff3e6', '#f6c434', '#8a6bff', '#5aff8a'][i]));
    s.position.set(-4 + i * 2, 5.2, -4.4);
    scene.add(s);
    discoLights.push(s);
  }
  return {
    tick(t) {
      neonPink.color.setHSL(0.88, 1, 0.62 + Math.sin(t * 3) * 0.06);
      neonTeal.color.setHSL(0.48, 1, 0.6 + Math.sin(t * 2.2 + 1) * 0.06);
      discoLights.forEach((d, i) => (d.visible = Math.sin(t * 4 + i * 1.3) > -0.3));
    },
  };
}

function alpsTexture() {
  return canvasTexture(512, 320, (c, w, h) => {
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#6fb2e8');
    sky.addColorStop(0.6, '#d8eefa');
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);
    const peak = (x, y, half, base, color) => {
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(x - half, base);
      c.lineTo(x, y);
      c.lineTo(x + half, base);
      c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(x - half * 0.32, y + (base - y) * 0.32);
      c.lineTo(x, y);
      c.lineTo(x + half * 0.32, y + (base - y) * 0.32);
      c.lineTo(x + half * 0.12, y + (base - y) * 0.26);
      c.lineTo(x - half * 0.05, y + (base - y) * 0.36);
      c.fill();
    };
    peak(110, 70, 170, 260, '#8a9cb4');
    peak(330, 40, 210, 260, '#7a8ca6');
    peak(470, 95, 140, 260, '#91a3ba');
    c.fillStyle = '#6aa64a';
    c.beginPath();
    c.moveTo(0, 230);
    c.quadraticCurveTo(140, 190, 280, 225);
    c.quadraticCurveTo(410, 255, w, 215);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.fill();
    c.fillStyle = '#2f5a2e';
    for (let i = 0; i < 14; i++) {
      const x = 20 + i * 36 + (i % 3) * 6;
      const y = 240 + (i % 2) * 14;
      c.beginPath();
      c.moveTo(x - 9, y + 30);
      c.lineTo(x, y);
      c.lineTo(x + 9, y + 30);
      c.fill();
    }
  });
}

function bunting(scene, a, b, sag, count, list) {
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const k = i / 20;
    pts.push(new THREE.Vector3().lerpVectors(a, b, k).add(new THREE.Vector3(0, -Math.sin(k * Math.PI) * sag, 0)));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.012, 4), mat('#e8e2d0')));
  const tri = new THREE.Shape();
  tri.moveTo(-0.16, 0);
  tri.lineTo(0.16, 0);
  tri.lineTo(0, -0.34);
  const geo = new THREE.ShapeGeometry(tri);
  for (let i = 0; i < count; i++) {
    const p = curve.getPoint((i + 0.5) / count);
    const f = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: i % 2 ? '#ffffff' : '#c8102e', side: THREE.DoubleSide }));
    f.position.copy(p);
    scene.add(f);
    list.push(f);
  }
}

export function buildWirtshaus(scene) {
  lights(scene, { bg: '#2a1a10', sky: '#ffe6c4', ground: '#4a2e1a', hemi: 0.85, key: '#fff0d8', keyInt: 1.3, warm: '#ffbf6a', warmInt: 50 });
  const terracotta = canvasTexture(256, 256, (c, w) => {
    c.fillStyle = '#7a4a32';
    c.fillRect(0, 0, w, w);
    const n = 4;
    const s = w / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        c.fillStyle = ['#b5543a', '#c2603f', '#a94c34', '#bb5a3c'][(x * 3 + y * 5) % 4];
        c.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
      }
  });
  kitchenBase(scene, {
    pit: terracotta,
    pitScale: 1.2,
    deck: planksTex('#c89a62', '#8a5e34'),
    shelf: planksTex('#d8aa72', '#9a6e44', 3),
    deckSide: '#7a4e2c',
    rim: '#3e2a1c',
    counter: '#5a3a22',
    counterSide: '#3e2716',
    outer: planksTex('#8a5a34', '#5a3a1e'),
    outerScale: 3,
    street: planksTex('#7a4e2c', '#4a2e18'),
    streetScale: 2,
    glow: '#ffd890',
  });

  wallWithWainscot(scene, -16, 16, -6.2, '#efe4cf', '#6b4426', 6);
  for (const x of [-12, -8, 8, 12]) scene.add(mesh(rbox(0.3, 6, 0.3, 0.04), '#4a2e1a', x, 3, -6.05));
  const alps = alpsTexture();
  for (const x of [-4.2, 0, 4.2]) {
    const frame = new THREE.Group();
    frame.add(mesh(rbox(2.0, 1.7, 0.12, 0.04), '#4a2e1a', 0, 0, 0));
    const view = new THREE.Mesh(new THREE.PlaneGeometry(1.76, 1.46), texMat(alps, { emissive: '#ffffff', emissiveIntensity: 0.35 }));
    view.position.z = 0.065;
    frame.add(view);
    frame.add(mesh(rbox(0.06, 1.46, 0.06, 0.01), '#4a2e1a', 0, 0, 0.09));
    frame.add(mesh(rbox(1.76, 0.06, 0.06, 0.01), '#4a2e1a', 0, 0.1, 0.09));
    frame.add(mesh(rbox(2.1, 0.12, 0.3, 0.03), '#4a2e1a', 0, -0.9, 0.12));
    const box = mesh(rbox(1.7, 0.22, 0.24, 0.04), '#3e7a3a', 0, -0.72, 0.22);
    frame.add(box);
    for (let i = 0; i < 9; i++) {
      frame.add(mesh(sph(0.07, 8, 6), i % 3 ? '#d8263a' : '#e8506a', -0.72 + i * 0.18, -0.56 + (i % 2) * 0.04, 0.24));
      frame.add(mesh(sph(0.06, 8, 6), '#4a8a3a', -0.64 + i * 0.16, -0.63, 0.3));
    }
    frame.position.set(x, 2.5, -6.05);
    scene.add(frame);
  }

  const antlers = (x) => {
    const g = new THREE.Group();
    g.add(mesh(rbox(0.5, 0.6, 0.08, 0.06), '#6b4426', 0, 0, 0));
    g.add(mesh(sph(0.12, 10, 8), '#e8dcc0', 0, 0.02, 0.08));
    for (const side of [-1, 1]) {
      const beam = mesh(cyl(0.025, 0.035, 0.6, 6), '#e8dcc0', side * 0.18, 0.3, 0.1);
      beam.rotation.z = -side * 0.6;
      g.add(beam);
      for (const [y, len] of [[0.18, 0.2], [0.35, 0.18], [0.5, 0.14]]) {
        const tine = mesh(cyl(0.015, 0.022, len, 6), '#e8dcc0', side * (0.12 + y * 0.45), y + 0.1, 0.12);
        tine.rotation.z = side * 0.4;
        g.add(tine);
      }
    }
    g.position.set(x, 3.55, -6.0);
    return g;
  };
  scene.add(antlers(-2.1), antlers(2.1));

  for (const z of [-5.4, -3.6, -1.6]) scene.add(mesh(rbox(18, 0.28, 0.32, 0.04), '#3e2716', 0, 4.7, z));

  const signTex = canvasTexture(512, 128, (c, w, h) => {
    c.fillStyle = '#3e2716';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#c8102e';
    c.fillRect(0, 0, w, 14);
    c.fillRect(0, h - 14, w, 14);
    c.fillStyle = '#ffffff';
    c.fillRect(0, 14, w, 6);
    c.fillRect(0, h - 20, w, 6);
    c.font = 'bold 66px Georgia, "Times New Roman", serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#f2c14a';
    c.fillText('Wirtshaus', w / 2, h / 2 + 3);
  });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.8, 0.08), [mat('#3e2716'), mat('#3e2716'), mat('#3e2716'), mat('#3e2716'), texMat(signTex, { emissive: '#ffffff', emissiveIntensity: 0.15 }), mat('#3e2716')]);
  sign.position.set(0, 3.75, -3.55);
  scene.add(sign);
  for (const x of [-1.4, 1.4]) scene.add(mesh(cyl(0.012, 0.012, 0.6, 4), '#222', x, 4.4, -3.55));

  const flags = [];
  bunting(scene, new THREE.Vector3(-9, 4.4, -1.6), new THREE.Vector3(-1, 4.2, -3.6), 0.5, 9, flags);
  bunting(scene, new THREE.Vector3(1, 4.2, -3.6), new THREE.Vector3(9, 4.4, -1.6), 0.5, 9, flags);

  const lamps = [];
  for (const x of [-2.4, 0, 2.4]) {
    scene.add(mesh(cyl(0.01, 0.01, 0.9, 4), '#222', x, 4.25, -2.95));
    const shadeM = mesh(dome(0.28), '#2e6b4a', x, 3.7, -2.95);
    scene.add(shadeM);
    const bulb = new THREE.Mesh(sph(0.09, 10, 8), glow('#ffe2a8'));
    bulb.position.set(x, 3.68, -2.95);
    scene.add(bulb);
    lamps.push(shadeM);
  }

  const stove = new THREE.Group();
  const tiles = canvasTexture(128, 128, (c, w) => {
    c.fillStyle = '#e8dcc0';
    c.fillRect(0, 0, w, w);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        c.fillStyle = (x + y) % 2 ? '#2e6b4a' : '#3a7f58';
        c.fillRect(x * 32 + 2, y * 32 + 2, 28, 28);
      }
  });
  const tileMat = texMat(tiles);
  const tileBox = (w, h, d, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), tileMat);
    m.position.y = y;
    m.castShadow = true;
    stove.add(m);
  };
  tileBox(1.6, 1.2, 1.2, 0.6);
  tileBox(1.3, 1.0, 1.0, 1.7);
  stove.add(mesh(rbox(1.4, 0.12, 1.1, 0.03), '#e8dcc0', 0, 2.26, 0));
  stove.add(mesh(rbox(2.4, 0.12, 0.5, 0.03), '#8a5a34', 0, 0.45, 0.85));
  stove.position.set(-8.2, 0, -4.6);
  scene.add(stove);

  const cloth = checkerTex('#c8102e', '#ffffff', 8);
  const table = (x, z) => {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 1.1), [mat('#c8102e'), mat('#c8102e'), texMat(tiled(cloth, 1.2, 0.7)), mat('#8a5a34'), mat('#c8102e'), mat('#c8102e')]);
    top.position.y = 0.82;
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);
    for (const [dx, dz] of [[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]]) g.add(mesh(rbox(0.1, 0.8, 0.1, 0.02), '#6b4426', dx, 0.4, dz));
    for (const dz of [-0.85, 0.85]) g.add(mesh(rbox(1.9, 0.1, 0.35, 0.03), '#8a5a34', 0, 0.48, dz));
    for (const [id, dx, dz, sc] of [['schnitzel', -0.4, -0.15, 2], ['beer', 0.3, 0.1, 2], ['beer', -0.1, 0.25, 2], ['sacher', 0.6, -0.2, 2]]) {
      const d = buildDish(id);
      d.scale.setScalar(sc);
      d.position.set(dx, 0.86, dz);
      g.add(d);
    }
    g.position.set(x, 0, z);
    return g;
  };
  scene.add(table(-7.6, -0.6), table(7.6, -0.6), table(-7.9, 2.9), table(7.9, 2.9));

  const barrel = (x, y, z) => {
    const g = new THREE.Group();
    put(g, mesh(cyl(0.42, 0.42, 0.9, 16), '#8a4b25', 0, 0, 0)).rotation.z = Math.PI / 2;
    for (const dx of [-0.3, 0.3]) put(g, mesh(torus(0.425, 0.025, 18), '#2a2a2a', dx, 0, 0)).rotation.y = Math.PI / 2;
    put(g, mesh(cyl(0.12, 0.12, 0.02, 12), '#c8102e', 0.46, 0, 0)).rotation.z = Math.PI / 2;
    g.position.set(x, y, z);
    return g;
  };
  scene.add(barrel(7.4, 0.42, -4.8), barrel(8.3, 0.42, -4.8), barrel(7.85, 1.2, -4.8));

  return {
    tick(t) {
      flags.forEach((f, i) => (f.rotation.x = Math.sin(t * 1.8 + i) * 0.25));
      lamps.forEach((l, i) => (l.rotation.z = Math.sin(t * 1.1 + i) * 0.03));
    },
  };
}
