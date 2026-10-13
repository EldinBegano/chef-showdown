import * as THREE from 'three';
import { mat, mesh, rbox, cyl, sph, dome, torus, cone, put, canvasTexture, texMat, buildTray, buildDish } from './models.js';

function steamPuffs(count = 6, color = 0xffffff) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const p = new THREE.Mesh(sph(0.07, 8, 6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false }));
    p.userData.off = i / count;
    g.add(p);
  }
  g.visible = false;
  g.userData.tick = (t) => {
    g.children.forEach((p) => {
      const k = (t * 0.6 + p.userData.off) % 1;
      p.position.set(Math.sin(k * 9 + p.userData.off * 20) * 0.08, k * 0.7, Math.cos(k * 7) * 0.05);
      p.scale.setScalar(0.6 + k * 1.2);
      p.material.opacity = 0.55 * (1 - k);
    });
  };
  return g;
}

function statusLight(parent, x, y, z) {
  const l = new THREE.Mesh(sph(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: 0x555555 }));
  l.position.set(x, y, z);
  parent.add(l);
  return l;
}

const LIGHT = { idle: 0x555555, cooking: 0xff5a3c, ready: 0x4cff6a };

function bluePlate(w = 0.72, d = 0.62, base = '#2d6fb5', top = '#4f93d8') {
  const g = new THREE.Group();
  g.add(mesh(rbox(w, 0.05, d, 0.03), base, 0, 0.025, 0));
  g.add(mesh(rbox(w - 0.1, 0.02, d - 0.1, 0.01), top, 0, 0.05, 0));
  return g;
}

function knife(x, z, angle = -0.5) {
  const k = new THREE.Group();
  k.add(mesh(rbox(0.07, 0.34, 0.015, 0.006), '#e2e8ec', 0, 0.2, 0));
  k.add(mesh(rbox(0.05, 0.13, 0.04, 0.015), '#2f2a36', 0, -0.04, 0));
  k.position.set(x, 0.1, z);
  k.rotation.set(0, angle, 0.35);
  return k;
}

function chopAnim(knifeGroup, base) {
  return (s, t, active) => {
    knifeGroup.position.y = active ? base + Math.abs(Math.sin(t * 22)) * 0.12 : base;
    knifeGroup.rotation.z = active ? 0.9 : 0.35;
  };
}

function redTray() {
  const g = new THREE.Group();
  g.add(mesh(rbox(0.62, 0.05, 0.46, 0.04), '#d23a32', 0, 0.025, 0));
  g.add(mesh(rbox(0.52, 0.02, 0.36, 0.02), '#fbf7ef', 0, 0.05, 0));
  return g;
}

const B = {
  kettle() {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.3, 0.32, 0.12, 20), '#2f2a36', 0, 0.06, 0));
    put(g, mesh(torus(0.2, 0.03, 18), '#ff7a3c', 0, 0.13, 0)).rotation.x = Math.PI / 2;
    const k = new THREE.Group();
    k.position.set(0, 0.13, 0);
    const body = mesh(sph(0.26, 20, 14), '#3cc1d2', 0, 0.2, 0);
    body.scale.y = 0.82;
    k.add(body);
    k.add(mesh(cyl(0.1, 0.13, 0.08, 16), '#2a97a8', 0, 0.4, 0));
    k.add(mesh(sph(0.045, 10, 8), '#2a97a8', 0, 0.46, 0));
    const spout = mesh(cyl(0.035, 0.06, 0.26, 10), '#3cc1d2', 0.26, 0.26, 0);
    spout.rotation.z = -0.9;
    k.add(spout);
    put(k, mesh(torus(0.18, 0.025, 14, Math.PI), '#2f2a36', 0, 0.36, 0)).rotation.y = Math.PI / 2;
    g.add(k);
    const cupG = new THREE.Group();
    cupG.add(mesh(cyl(0.11, 0.08, 0.12, 16), '#3cc1d2', 0, 0.06, 0));
    cupG.add(mesh(cyl(0.095, 0.095, 0.01, 16), '#8fd16a', 0, 0.115, 0));
    cupG.position.set(0.05, 0, 0.42);
    g.add(cupG);
    const steam = steamPuffs();
    steam.position.set(0.38, 0.5, 0);
    g.add(steam);
    const light = statusLight(g, -0.3, 0.08, 0.2);
    return {
      group: g,
      setState(s, t) {
        steam.visible = s !== 'idle';
        steam.userData.tick(t);
        k.position.y = 0.13 + (s === 'cooking' ? Math.abs(Math.sin(t * 25)) * 0.02 : 0);
        light.material.color.setHex(LIGHT[s]);
      },
    };
  },
  salmon() {
    const g = bluePlate();
    const fish = new THREE.Group();
    fish.add(mesh(rbox(0.5, 0.12, 0.3, 0.06), '#f47a45', 0, 0, 0));
    for (let i = 0; i < 6; i++) {
      const s = mesh(rbox(0.018, 0.008, 0.3, 0.004), '#ffe0cc', -0.22 + i * 0.085, 0.062, 0);
      s.rotation.y = 0.5;
      fish.add(s);
    }
    fish.position.set(-0.05, 0.12, -0.02);
    fish.rotation.y = 0.15;
    g.add(fish);
    const k = knife(0.3, 0.2);
    g.add(k);
    return { group: g, setState: chopAnim(k, 0.1) };
  },
  tamago() {
    const g = bluePlate();
    for (let i = 0; i < 2; i++) g.add(mesh(rbox(0.36, 0.1, 0.22, 0.03), '#f6d36a', -0.08, 0.11 + i * 0.1, -0.05 + i * 0.03));
    for (let i = 0; i < 3; i++) {
      const sl = mesh(rbox(0.1, 0.09, 0.2, 0.02), '#f2c64a', 0.15 + i * 0.03, 0.1, 0.12);
      sl.rotation.z = -0.5;
      g.add(sl);
    }
    const k = knife(0.3, -0.2, 0.5);
    g.add(k);
    return { group: g, setState: chopAnim(k, 0.1) };
  },
  nori() {
    const g = bluePlate();
    for (let i = 0; i < 6; i++) {
      const s = mesh(rbox(0.5, 0.014, 0.4, 0.004), i % 2 ? '#1a2e22' : '#22392b', 0, 0.07 + i * 0.016, 0);
      s.rotation.y = (i - 2.5) * 0.08;
      g.add(s);
    }
    return { group: g };
  },
  trays() {
    const g = new THREE.Group();
    for (const x of [-0.36, 0.36]) {
      for (let i = 0; i < 3; i++) {
        const t = redTray();
        t.position.set(x, i * 0.05, 0);
        t.rotation.y = Math.PI / 2;
        g.add(t);
      }
    }
    return { group: g };
  },
  rice() {
    const g = new THREE.Group();
    const body = mesh(sph(0.42, 24, 14), '#2c3c5e', 0, 0.36, 0);
    body.scale.y = 0.78;
    g.add(body);
    g.add(mesh(cyl(0.38, 0.4, 0.18, 24), '#2c3c5e', 0, 0.52, 0));
    put(g, mesh(torus(0.38, 0.045, 24), '#22304c', 0, 0.61, 0)).rotation.x = Math.PI / 2;
    g.add(mesh(cyl(0.35, 0.35, 0.02, 24), '#141a2a', 0, 0.56, 0));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      g.add(mesh(cyl(0.04, 0.03, 0.14, 8), '#22304c', Math.cos(a) * 0.28, 0.06, Math.sin(a) * 0.28));
    }
    const rice = mesh(cyl(0.355, 0.355, 0.04, 24), '#fbfaf5', 0, 0.58, 0);
    g.add(rice);
    const steam = steamPuffs();
    steam.position.set(0, 0.62, 0);
    g.add(steam);
    const light = statusLight(g, 0.0, 0.34, 0.42);
    return {
      group: g,
      setState(s, t, active, servings, prog) {
        rice.visible = s !== 'idle';
        rice.position.y = s === 'ready' ? 0.57 + 0.03 * ((servings || 0) / 3) : 0.5 + 0.07 * (prog || 0);
        steam.visible = s === 'cooking';
        steam.userData.tick(t);
        light.material.color.setHex(LIGHT[s]);
      },
    };
  },
  trash() {
    const g = new THREE.Group();
    g.add(mesh(rbox(0.76, 0.46, 0.6, 0.06), '#1f8f8a', 0, 0.23, 0));
    g.add(mesh(rbox(0.62, 0.02, 0.46, 0.01), '#0f3634', 0, 0.47, 0));
    for (const [w, d, x, z] of [[0.84, 0.1, 0, 0.29], [0.84, 0.1, 0, -0.29], [0.1, 0.68, 0.37, 0], [0.1, 0.68, -0.37, 0]]) g.add(mesh(rbox(w, 0.07, d, 0.03), '#2fb3ad', x, 0.49, z));
    const tex = canvasTexture(128, 128, (c) => {
      c.fillStyle = '#2fb3ad';
      c.fillRect(0, 0, 128, 128);
      c.strokeStyle = '#ffffff';
      c.lineWidth = 11;
      c.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        c.save();
        c.translate(64, 68);
        c.rotate((i * Math.PI * 2) / 3);
        c.beginPath();
        c.moveTo(-18, 26);
        c.lineTo(18, 26);
        c.lineTo(8, 15);
        c.stroke();
        c.restore();
      }
    });
    const plaque = new THREE.Mesh(rbox(0.36, 0.3, 0.06, 0.04), [mat('#2fb3ad'), mat('#2fb3ad'), mat('#2fb3ad'), mat('#2fb3ad'), texMat(tex), mat('#2fb3ad')]);
    plaque.position.set(0, 0.2, 0.33);
    g.add(plaque);
    return { group: g, setState(s, t, active) { g.scale.y = active ? 1 + Math.sin(t * 30) * 0.03 : 1; } };
  },
  belt() {
    const g = new THREE.Group();
    const len = 6.0;
    const tex = canvasTexture(64, 64, (c) => {
      c.fillStyle = '#2a2e38';
      c.fillRect(0, 0, 64, 64);
      c.fillStyle = '#3a404e';
      c.fillRect(0, 0, 10, 64);
      c.fillRect(32, 0, 10, 64);
    }, [len * 2, 1]);
    const top = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.46), [mat('#2a2e38'), mat('#2a2e38'), texMat(tex), mat('#2a2e38'), mat('#2a2e38'), mat('#2a2e38')]);
    top.position.y = 0.12;
    top.receiveShadow = true;
    g.add(top);
    for (const z of [-0.26, 0.26]) g.add(mesh(rbox(len + 0.2, 0.14, 0.06, 0.02), '#c0c7cf', 0, 0.11, z));
    for (const x of [-len / 2, len / 2]) put(g, mesh(cyl(0.1, 0.1, 0.5, 14), '#9aa4ad', x, 0.1, 0)).rotation.x = Math.PI / 2;
    for (let x = -2.6; x <= 2.6; x += 1.3) g.add(mesh(rbox(0.08, 0.1, 0.4, 0.02), '#5a6270', x, 0.03, 0));
    return {
      group: g,
      setState(s, t) {
        tex.offset.x = -t * 0.45;
      },
    };
  },
  miso() {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.3, 0.32, 0.12, 20), '#2f2a36', 0, 0.06, 0));
    put(g, mesh(torus(0.2, 0.03, 18), '#ff7a3c', 0, 0.13, 0)).rotation.x = Math.PI / 2;
    g.add(mesh(cyl(0.3, 0.26, 0.32, 24), '#3a3a42', 0, 0.3, 0));
    put(g, mesh(torus(0.3, 0.03, 24), '#26262c', 0, 0.46, 0)).rotation.x = Math.PI / 2;
    for (const x of [-0.33, 0.33]) g.add(mesh(rbox(0.08, 0.04, 0.1, 0.02), '#26262c', x, 0.42, 0));
    const soup = mesh(cyl(0.28, 0.28, 0.02, 24), '#c9853a', 0, 0.44, 0);
    g.add(soup);
    const ladle = new THREE.Group();
    ladle.add(mesh(cyl(0.012, 0.012, 0.5, 6), '#8d6e63', 0, 0.25, 0));
    ladle.add(mesh(dome(0.06), '#8d6e63', 0, 0, 0));
    ladle.position.set(0.12, 0.42, 0.05);
    ladle.rotation.z = -0.5;
    g.add(ladle);
    const steam = steamPuffs();
    steam.position.set(0, 0.5, 0);
    g.add(steam);
    const light = statusLight(g, -0.25, 0.08, 0.26);
    return {
      group: g,
      setState(s, t) {
        soup.visible = s !== 'idle';
        steam.visible = s === 'cooking';
        steam.userData.tick(t);
        ladle.rotation.y = s === 'cooking' ? t * 3 : 0;
        light.material.color.setHex(LIGHT[s]);
      },
    };
  },
  buns() {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.36, 0.3, 0.16, 20), '#b07a3a', 0, 0.08, 0));
    put(g, mesh(torus(0.36, 0.03, 20), '#8a5a28', 0, 0.16, 0)).rotation.x = Math.PI / 2;
    for (const [x, z, y] of [[-0.12, -0.1, 0.2], [0.12, -0.08, 0.2], [0, 0.13, 0.2], [0, -0.02, 0.29]]) {
      const b = mesh(dome(0.14), '#f0a14a', x, y, z);
      b.scale.y = 0.7;
      g.add(b);
    }
    return { group: g };
  },
  grill() {
    const g = new THREE.Group();
    g.add(mesh(rbox(0.86, 0.18, 0.62, 0.04), '#3a3d48', 0, 0.09, 0));
    g.add(mesh(rbox(0.8, 0.03, 0.56, 0.02), '#1e2028', 0, 0.19, 0));
    g.add(mesh(rbox(0.86, 0.12, 0.05, 0.02), '#c0c7cf', 0, 0.24, -0.29));
    const patties = [];
    for (const [x, z] of [[-0.22, -0.1], [0.0, 0.1], [0.22, -0.1]]) {
      const p = mesh(cyl(0.11, 0.11, 0.04, 16), '#8a4a26', x, 0.225, z);
      patties.push(p);
      g.add(p);
    }
    const spat = new THREE.Group();
    spat.add(mesh(rbox(0.14, 0.01, 0.12, 0.004), '#d7dde2', 0, 0, 0));
    spat.add(mesh(rbox(0.03, 0.02, 0.24, 0.01), '#2f2a36', 0, 0.02, 0.17));
    spat.position.set(0.3, 0.24, 0.24);
    g.add(spat);
    const steam = steamPuffs(6, 0xdddddd);
    steam.position.set(0, 0.28, 0);
    g.add(steam);
    const light = statusLight(g, -0.36, 0.1, 0.32);
    return {
      group: g,
      setState(s, t, active, servings, prog) {
        patties.forEach((p, i) => {
          p.visible = s === 'cooking' || (s === 'ready' && i < servings);
          p.material = mat(s === 'ready' ? '#5a2e16' : prog > 0.5 ? '#7a3e1e' : '#c46a5a');
        });
        steam.visible = s === 'cooking';
        steam.userData.tick(t);
        spat.position.y = s === 'cooking' ? 0.24 + Math.abs(Math.sin(t * 6)) * 0.06 : 0.24;
        light.material.color.setHex(LIGHT[s]);
      },
    };
  },
  cheese() {
    const g = bluePlate(0.62, 0.52, '#e8e2d6', '#ffffff');
    for (let i = 0; i < 5; i++) {
      const s = mesh(rbox(0.3, 0.018, 0.3, 0.006), '#f6c434', -0.02 + i * 0.01, 0.07 + i * 0.02, 0);
      s.rotation.y = i * 0.15;
      g.add(s);
    }
    return { group: g };
  },
  lettuce() {
    const g = new THREE.Group();
    g.add(mesh(rbox(0.7, 0.06, 0.55, 0.02), '#e7c08a', 0, 0.03, 0));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const leaf = mesh(sph(0.12, 10, 8), i % 2 ? '#7cc142' : '#93d65a', -0.08 + Math.cos(a) * 0.06, 0.15, Math.sin(a) * 0.06);
      leaf.scale.set(1, 0.8, 1);
      g.add(leaf);
    }
    g.add(mesh(sph(0.1, 10, 8), '#b5e08a', -0.08, 0.2, 0));
    const k = knife(0.26, 0.18);
    g.add(k);
    return { group: g, setState: chopAnim(k, 0.08) };
  },
  fryer() {
    const g = new THREE.Group();
    g.add(mesh(rbox(0.7, 0.42, 0.56, 0.04), '#b8c0c8', 0, 0.21, 0));
    g.add(mesh(rbox(0.56, 0.02, 0.42, 0.02), '#e8a83a', 0, 0.42, 0));
    const basket = new THREE.Group();
    basket.add(mesh(rbox(0.3, 0.14, 0.26, 0.02), '#5a6270', 0, 0, 0));
    basket.add(mesh(rbox(0.04, 0.04, 0.3, 0.01), '#2f2a36', 0, 0.06, 0.26));
    const fries = new THREE.Group();
    for (let i = 0; i < 10; i++) fries.add(mesh(rbox(0.02, 0.1, 0.02, 0.006), '#f6c434', -0.1 + (i % 5) * 0.05, 0.08, -0.06 + Math.floor(i / 5) * 0.1));
    basket.add(fries);
    basket.position.set(0, 0.5, 0);
    g.add(basket);
    const bubbles = steamPuffs(5, 0xfff1c0);
    bubbles.position.set(0, 0.42, 0);
    g.add(bubbles);
    const light = statusLight(g, 0.27, 0.32, 0.29);
    return {
      group: g,
      setState(s, t, active, servings) {
        basket.position.y = s === 'cooking' ? 0.38 : 0.55;
        fries.visible = s !== 'idle';
        fries.scale.y = s === 'ready' ? 0.5 + 0.5 * ((servings || 0) / 3) : 1;
        bubbles.visible = s === 'cooking';
        bubbles.userData.tick(t * 2);
        light.material.color.setHex(LIGHT[s]);
      },
    };
  },
  lemonade() {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.24, 0.26, 0.1, 18), '#c0c7cf', 0, 0.05, 0));
    const jar = new THREE.Mesh(cyl(0.26, 0.24, 0.62, 20), new THREE.MeshToonMaterial({ color: '#ff8fb8', transparent: true, opacity: 0.78 }));
    jar.position.y = 0.42;
    g.add(jar);
    for (let i = 0; i < 4; i++) put(g, mesh(cyl(0.08, 0.08, 0.015, 12), '#f4d03f', -0.06 + (i % 2) * 0.1, 0.3 + i * 0.12, 0.06)).rotation.x = 1.2;
    g.add(mesh(cyl(0.25, 0.25, 0.05, 18), '#e5559a', 0, 0.75, 0));
    g.add(mesh(rbox(0.07, 0.07, 0.14, 0.02), '#c0c7cf', 0, 0.18, 0.26));
    const glass = buildDish('lemonade');
    glass.position.set(0.36, 0, 0.16);
    glass.scale.setScalar(1.5);
    g.add(glass);
    return { group: g };
  },
  keg() {
    const g = new THREE.Group();
    const barrel = mesh(cyl(0.27, 0.27, 0.56, 18), '#8a4b25', 0, 0.34, 0);
    barrel.rotation.z = Math.PI / 2;
    g.add(barrel);
    for (const x of [-0.19, 0.19]) put(g, mesh(torus(0.275, 0.022, 20), '#3a3a3a', x, 0.34, 0)).rotation.y = Math.PI / 2;
    g.add(mesh(rbox(0.56, 0.1, 0.34, 0.02), '#5a3218', 0, 0.05, 0));
    put(g, mesh(cyl(0.028, 0.028, 0.16, 8), '#d4af37', 0, 0.34, 0.3)).rotation.x = Math.PI / 2;
    g.add(mesh(cyl(0.022, 0.022, 0.18, 8), '#d4af37', 0, 0.45, 0.37));
    const mug = buildDish('rootbeer');
    mug.position.set(0.32, 0, 0.24);
    mug.scale.setScalar(1.5);
    g.add(mug);
    return { group: g };
  },
  soda() {
    const g = new THREE.Group();
    g.add(mesh(rbox(0.64, 0.7, 0.48, 0.07), '#2e9e4f', 0, 0.35, -0.04));
    g.add(mesh(rbox(0.54, 0.22, 0.05, 0.03), '#f7f4ee', 0, 0.56, 0.21));
    for (const x of [-0.16, 0, 0.16]) g.add(mesh(cyl(0.028, 0.034, 0.09, 8), '#c0c7cf', x, 0.4, 0.23));
    g.add(mesh(rbox(0.64, 0.05, 0.22, 0.01), '#c0c7cf', 0, 0.07, 0.28));
    const c = buildDish('cola');
    c.position.set(0.4, 0, 0.2);
    c.scale.setScalar(1.4);
    g.add(c);
    return { group: g };
  },
  shake() {
    const g = new THREE.Group();
    g.add(mesh(rbox(0.42, 0.14, 0.38, 0.05), '#e2402f', 0, 0.07, 0));
    g.add(mesh(rbox(0.14, 0.7, 0.14, 0.05), '#e2402f', 0, 0.42, -0.12));
    g.add(mesh(rbox(0.34, 0.16, 0.34, 0.06), '#f2e8dc', 0, 0.8, -0.03));
    const spin = new THREE.Group();
    spin.position.set(0, 0.26, 0.04);
    spin.add(mesh(cyl(0.11, 0.08, 0.28, 16), '#c0c7cf', 0, 0, 0));
    spin.add(mesh(cyl(0.014, 0.014, 0.4, 6), '#9aa4ad', 0, 0.27, 0));
    g.add(spin);
    const top = mesh(sph(0.11, 12, 8), '#f48fb1', 0, 0.42, 0.04);
    top.scale.y = 0.5;
    g.add(top);
    const glass = buildDish('milkshake');
    glass.position.set(0.34, 0, 0.18);
    glass.scale.setScalar(1.4);
    g.add(glass);
    const light = statusLight(g, 0.14, 0.09, 0.19);
    return {
      group: g,
      setState(s, t) {
        spin.rotation.y = s === 'cooking' ? t * 30 : 0;
        spin.position.x = s === 'cooking' ? Math.sin(t * 50) * 0.012 : 0;
        top.visible = s === 'ready';
        light.material.color.setHex(LIGHT[s]);
      },
    };
  },
  cakestand() {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.12, 0.18, 0.05, 18), '#c0c7cf', 0, 0.025, 0));
    g.add(mesh(cyl(0.035, 0.035, 0.2, 10), '#c0c7cf', 0, 0.14, 0));
    g.add(mesh(cyl(0.34, 0.34, 0.03, 24), '#e8eef2', 0, 0.25, 0));
    const tiers = [
      [0.28, 0.16, '#f3d6a6', '#f7a6c8'],
      [0.2, 0.13, '#8a4b25', '#f6e7d0'],
      [0.12, 0.1, '#f3d6a6', '#9fd3f0'],
    ];
    let y = 0.265;
    for (const [r, h, body, icing] of tiers) {
      g.add(mesh(cyl(r, r, h, 24), body, 0, y + h / 2, 0));
      g.add(mesh(cyl(r + 0.01, r + 0.01, 0.03, 24), icing, 0, y + h, 0));
      y += h + 0.02;
    }
    g.add(mesh(sph(0.04, 8, 6), '#d4182d', 0, y + 0.03, 0));
    return { group: g };
  },
  coffee() {
    const g = new THREE.Group();
    g.add(mesh(rbox(0.56, 0.1, 0.44, 0.03), '#f2e8dc', 0, 0.05, 0));
    g.add(mesh(rbox(0.56, 0.68, 0.2, 0.06), '#f2e8dc', 0, 0.42, -0.13));
    g.add(mesh(rbox(0.56, 0.14, 0.4, 0.05), '#c9a27a', 0, 0.76, -0.03));
    g.add(mesh(rbox(0.12, 0.06, 0.1, 0.02), '#5a3218', 0, 0.64, 0.09));
    const pot = new THREE.Group();
    pot.position.set(0, 0.1, 0.07);
    const glassM = new THREE.Mesh(sph(0.15, 16, 12), new THREE.MeshToonMaterial({ color: '#bfe3f0', transparent: true, opacity: 0.55 }));
    glassM.position.y = 0.15;
    glassM.scale.y = 0.9;
    pot.add(glassM);
    const brew = mesh(sph(0.13, 16, 12), '#4a2812', 0, 0.13, 0);
    brew.scale.y = 0.6;
    pot.add(brew);
    pot.add(mesh(cyl(0.09, 0.1, 0.06, 14), '#1e1e1e', 0, 0.3, 0));
    g.add(pot);
    const mug = buildDish('coffee');
    mug.position.set(-0.4, 0, 0.12);
    mug.scale.setScalar(1.3);
    g.add(mug);
    const steam = steamPuffs();
    steam.position.set(0, 0.48, 0.09);
    g.add(steam);
    const light = statusLight(g, 0.2, 0.56, 0.0);
    return {
      group: g,
      setState(s, t, active, servings) {
        steam.visible = s === 'cooking';
        steam.userData.tick(t);
        brew.visible = s !== 'idle';
        brew.scale.y = s === 'ready' ? 0.25 + 0.45 * ((servings || 0) / 3) : 0.2;
        light.material.color.setHex(LIGHT[s]);
      },
    };
  },
  slot() {
    const g = new THREE.Group();
    g.add(mesh(rbox(0.86, 0.06, 0.66, 0.04), '#d23a32', 0, 0.03, 0));
    g.add(mesh(rbox(0.74, 0.02, 0.54, 0.02), '#fbf7ef', 0, 0.065, 0));
    return { group: g };
  },
  traypad() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const t = redTray();
      t.position.y = i * 0.05;
      g.add(t);
    }
    return { group: g };
  },
};

export function buildStation(model) {
  const s = (B[model] || B.nori)();
  if (!s.setState) s.setState = () => {};
  return s;
}

const BELT_COLORS = { salmon: '#f47a45', tuna: '#d6324a', ebi: '#f26a3a', cucumber: '#5dbb4a', tamago: '#f6cf3d' };

export function buildBeltItem(comp) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.17, 0.14, 0.04, 20), comp === 'cucumber' ? '#2f6fb0' : '#f7f4ee', 0, 0.02, 0));
  g.add(mesh(cyl(0.18, 0.18, 0.012, 20), comp === 'cucumber' ? '#4f93d8' : '#d23a32', 0, 0.042, 0));
  const c = BELT_COLORS[comp] || '#ffffff';
  if (comp === 'cucumber') {
    for (const x of [-0.06, 0.06]) put(g, mesh(cyl(0.035, 0.035, 0.22, 12), c, x, 0.09, 0)).rotation.x = Math.PI / 2;
  } else if (comp === 'ebi') {
    for (const x of [-0.05, 0.05]) {
      const b = mesh(torus(0.06, 0.03, 12, Math.PI * 1.3), '#ffffff', x, 0.09, 0);
      b.rotation.x = -Math.PI / 2;
      g.add(b);
      const st = mesh(torus(0.06, 0.032, 12, Math.PI * 1.3), c, x, 0.092, 0);
      st.rotation.x = -Math.PI / 2;
      st.scale.set(1, 1, 0.5);
      g.add(st);
    }
  } else {
    const f = mesh(rbox(0.26, 0.08, 0.17, 0.04), c, 0, 0.09, 0);
    g.add(f);
    for (let i = 0; i < 3; i++) {
      const s = mesh(rbox(0.012, 0.006, 0.17, 0.003), comp === 'tuna' ? '#f07a8a' : '#ffe0cc', -0.08 + i * 0.08, 0.133, 0);
      s.rotation.y = 0.5;
      g.add(s);
    }
  }
  return g;
}
