import * as THREE from 'three';
import { buildCharacter, buildCustomer, animateRig, buildTray, buildDish, glow } from './models.js';
import { buildStation, buildBeltItem } from './stations.js';
import { KITCHEN } from './maps.js';
import { LEVELS, COMP_NAMES } from './levels.js';
import { dishIcon, moodIcon } from './icons.js';
import { sfx } from './audio.js';
import { seededRng } from './net.js';

export const PLAYER_COLORS = ['#41f06c', '#3fd8f3', '#ffb03d', '#ff5fd2'];
export const TEAM_COLORS = [
  ['#ff5246', '#ffa23c'],
  ['#3fd8f3', '#5cf0b4'],
];
const REACH = 1.05;
const SPEED = 4.4;
const tmp = new THREE.Vector3();
const r2 = (v) => Math.round(v * 100) / 100;
const STATE_CODE = { idle: 'i', cooking: 'c', ready: 'r' };
const STATE_NAME = { i: 'idle', c: 'cooking', r: 'ready' };

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const angleLerp = (a, b, k) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
};

function el(cls, html = '', parent) {
  const d = document.createElement('div');
  d.className = cls;
  d.innerHTML = html;
  parent?.appendChild(d);
  return d;
}

export class Game {
  constructor({ mode, levelId, players, overlay, onEnd, onEvent, net = null }) {
    this.net = net;
    this.role = net?.role || 'local';
    this.myIdx = net?.myIdx ?? 0;
    this.events = [];
    this.uid = 0;
    this.pressSeq = 0;
    this.mode = mode;
    this.level = LEVELS[levelId];
    this.overlay = overlay;
    this.onEnd = onEnd;
    this.onEvent = onEvent || (() => {});
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 80);
    this.W = 1;
    this.H = 1;
    this.t = 0;
    this.phase = 'countdown';
    this.countdown = 3.6;
    this.elapsed = 0;
    this.money = 0;
    this.hearts = mode.lives || 0;
    this.timeLeft = mode.duration || 0;
    this.served = 0;
    this.lost = 0;
    this.unlockIdx = 1;
    this.menuIds = [...this.level.unlocks[0].dishes];
    this.floaters = [];
    this.overlay.innerHTML = '';
    this.countEl = el('countdown', '', this.overlay);

    this.setupScene();
    this.setupSeats();
    this.setupStations();
    this.crew = Math.max(1, players.length);
    const teamCount = [0, 0];
    this.players = players.map((p, i) => {
      const team = mode.id === 'versus' ? (p.team ?? i % 2) : 0;
      const color = mode.id === 'versus' ? TEAM_COLORS[team][teamCount[team]++ % 2] : PLAYER_COLORS[i % 4];
      return this.makePlayer({ ...p, team, color }, i, players.length);
    });
  }

  setupScene() {
    this.env = this.level.build(this.scene);
  }

  setupStations() {
    this.stations = this.level.stations.map((cfg) => {
      const model = buildStation(cfg.model);
      const g = model.group;
      let pos;
      let ip;
      if (cfg.side === 'left') {
        pos = new THREE.Vector3(-KITCHEN.stationX, KITCHEN.deckY, cfg.z);
        ip = { x: KITCHEN.minX, z: cfg.z };
        g.rotation.y = Math.PI / 2;
      } else if (cfg.side === 'right') {
        pos = new THREE.Vector3(KITCHEN.stationX, KITCHEN.deckY, cfg.z);
        ip = { x: KITCHEN.maxX, z: cfg.z };
        g.rotation.y = -Math.PI / 2;
      } else {
        pos = new THREE.Vector3(cfg.x, KITCHEN.deckY, KITCHEN.frontZ);
        ip = { x: cfg.x, z: KITCHEN.maxZ };
      }
      const baseScale = cfg.scale || (cfg.side === 'front' ? 1.1 : 1.4);
      g.position.copy(pos);
      this.scene.add(g);
      const st = { cfg, model, group: g, pos, ip, baseScale, state: 'idle', timer: 0, servings: 0, holder: null, held: null, badge: null, badgeKey: '' };
      if (cfg.kind === 'batch' || cfg.kind === 'hold') st.badge = el('badge hidden', '', this.overlay);
      if (cfg.kind === 'belt') {
        st.items = [];
        st.spawnT = 0.2;
        if (this.role !== 'guest') for (let x = -2.6; x < 2.8; x += cfg.speed * cfg.every * 1.6) this.spawnBeltItem(st, x);
      }
      return st;
    });
  }

  setupSeats() {
    this.seats = this.level.seats.map((x, i) => ({
      x,
      ip: { x, z: KITCHEN.minZ },
      customer: null,
      cooldown: 0.6 + i * rand(1.2, 2.2),
      plates: [],
      plateIds: [],
    }));
  }

  makePlayer(cfg, i, n) {
    const { root, rig } = buildCharacter(cfg.charId);
    const startX = n === 1 ? 0 : -1.2 + (2.4 * i) / (n - 1);
    root.position.set(startX, 0, 1.2);
    this.scene.add(root);
    const color = cfg.color || PLAYER_COLORS[i];
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 36), glow(color, 0.9));
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), glow(color));
    arrow.rotation.x = Math.PI;
    arrow.visible = false;
    this.scene.add(arrow);
    const tag = el('nametag', '', this.overlay);
    tag.textContent = cfg.name;
    tag.style.setProperty('--c', color);
    const label = el('target-label hidden', '', this.overlay);
    label.style.setProperty('--c', color);
    const p = {
      idx: i, name: cfg.name, charId: cfg.charId, color, team: cfg.team || 0, ctrl: cfg.controller, bot: null, isBot: !!cfg.bot,
      remote: !!cfg.remote, puppet: !!cfg.puppet, netId: cfg.netId, local: !cfg.remote && !cfg.puppet && !cfg.bot, lastQ: 0, gone: false, net: null, netIn: null,
      root, rig, ring, arrow, tag, label, labelKey: '',
      pos: root.position, vel: new THREE.Vector2(), facing: Math.PI,
      tray: null, trayModel: null, target: null, botTarget: null,
      holdT: 0, holdStation: null, holdLock: false, sfxT: 0,
      money: 0, served: 0, hints: new Map(),
    };
    return p;
  }

  resize(w, h) {
    this.W = w;
    this.H = h;
    const cam = this.camera;
    cam.aspect = w / h;
    const target = new THREE.Vector3(0, 1.0, -1.0);
    const dir = new THREE.Vector3(0, 0.74, 0.67).normalize();
    const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const wNeed = cam.aspect < 1 ? 10.8 : 14.2;
    const dist = Math.max(9.6 / (2 * t), wNeed / (2 * t * cam.aspect));
    cam.position.copy(target).addScaledVector(dir, dist);
    cam.lookAt(target);
    cam.far = dist + 40;
    cam.updateProjectionMatrix();
    if (this.scene.fog) {
      this.scene.fog.near = dist + 3;
      this.scene.fog.far = dist + 16;
    }
  }

  teamMoney(team) {
    return this.players.reduce((s, p) => s + (p.team === team ? p.money : 0), 0);
  }

  get totalMoney() {
    return this.mode.id === 'score' ? this.money : this.players.reduce((s, p) => s + p.money, 0);
  }

  update(dt) {
    if (this.role === 'guest') return this.updateGuest(dt);
    this.t += dt;
    this.env.tick(this.t);

    if (this.phase === 'countdown') {
      const before = Math.ceil(this.countdown - 0.6);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown - 0.6);
      if (after !== before) {
        if (after > 0) {
          this.play('count');
          this.showCount(String(after));
        } else {
          this.play('go');
          this.showCount('Serve!', 'go');
        }
      }
      if (this.countdown <= 0) this.phase = 'play';
    }
    const playing = this.phase === 'play';
    if (playing) {
      this.elapsed += dt;
      if (this.mode.duration) {
        this.timeLeft = Math.max(0, this.timeLeft - dt);
        if (this.timeLeft <= 0) this.finish();
      }
      this.checkUnlocks();
    }

    for (const p of this.players) this.updatePlayer(p, dt, playing);
    this.separate();
    for (const st of this.stations) this.updateStation(st, dt);
    this.updateCustomers(dt, playing);
    this.updateFloaters(dt);
    this.updateOverlay();
    if (this.countHideAt && this.t > this.countHideAt) {
      this.countHideAt = 0;
      this.countEl.classList.remove('show');
    }
  }

  showCount(text, cls = '') {
    this.countEl.textContent = text;
    this.countEl.className = `countdown show ${cls}`;
    void this.countEl.offsetWidth;
    this.countEl.classList.add('pop');
    this.countHideAt = this.t + (cls === 'go' ? 0.9 : 0.8);
    this.emit({ k: 'count', txt: text, cls });
  }

  emit(ev) {
    if (this.role === 'host') this.events.push(ev);
  }

  event(type, data) {
    this.onEvent(type, data);
    this.emit({ k: 'ev', type, data });
  }

  play(name, p = null) {
    if (!p || p.local) sfx[name]();
    this.emit({ k: 'sfx', n: name, p: p ? p.idx : -1 });
  }

  checkUnlocks() {
    const u = this.level.unlocks[this.unlockIdx];
    if (u && this.totalMoney >= u.at) {
      this.unlockIdx++;
      this.menuIds.push(...u.dishes);
      this.freshDishes = [...u.dishes];
      this.play('unlockDish');
      this.event('unlock', u.dishes.map((d) => ({ id: d, name: this.level.menu[d].name })));
    }
  }

  finish() {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.players.forEach((p) => p.holdStation && (p.holdStation.holder = null));
    const result = {
      mode: this.mode.id,
      level: this.level.id,
      money: this.totalMoney,
      served: this.served,
      lost: this.lost,
      elapsed: this.elapsed,
      players: this.players.map((p) => ({ name: p.name, money: p.money, served: p.served, charId: p.charId, color: p.color, isBot: p.isBot, team: p.team })),
    };
    this.showCount(this.mode.duration ? "Time's up!" : 'Closed!', 'go');
    this.emit({ k: 'end', r: result });
    setTimeout(() => !this.disposed && this.onEnd(result), 1600);
  }

  movePlayer(p, input, dt) {
    const speed = SPEED * (p.bot ? p.bot.speedMul : 1);
    const k = Math.min(1, dt * 14);
    p.vel.x += (input.x * speed - p.vel.x) * k;
    p.vel.y += (input.z * speed - p.vel.y) * k;
    p.pos.x = THREE.MathUtils.clamp(p.pos.x + p.vel.x * dt, KITCHEN.minX, KITCHEN.maxX);
    p.pos.z = THREE.MathUtils.clamp(p.pos.z + p.vel.y * dt, KITCHEN.minZ, KITCHEN.maxZ);
    if (Math.hypot(input.x, input.z) > 0.2) p.facing = angleLerp(p.facing, Math.atan2(input.x, input.z), Math.min(1, dt * 16));
    else if (Number.isFinite(p.faceTo)) p.facing = angleLerp(p.facing, p.faceTo, Math.min(1, dt * 16));
    p.root.rotation.y = p.facing;
  }

  remoteControl(p, dt) {
    const n = p.netIn;
    const input = { x: 0, z: 0, press: false, held: false };
    if (!n) return input;
    const k = Math.min(1, dt * 15);
    p.pos.x += (n.x - p.pos.x) * k;
    p.pos.z += (n.z - p.pos.z) * k;
    p.facing = angleLerp(p.facing, n.f, k);
    p.vel.set(Math.sin(n.f) * n.v, Math.cos(n.f) * n.v);
    p.root.rotation.y = p.facing;
    input.held = !!n.h;
    if (n.q > p.lastQ) {
      p.lastQ = n.q;
      input.press = true;
    }
    return input;
  }

  updatePlayer(p, dt, playing) {
    if (p.gone) return;
    let input;
    if (p.remote) input = this.remoteControl(p, dt);
    else {
      input = p.bot ? p.bot.think(dt) : p.ctrl.read();
      if (!playing) input = { x: 0, z: 0, press: false, held: false };
      this.movePlayer(p, input, dt);
    }
    if (!playing) input = { x: 0, z: 0, press: false, held: false };
    const moving = p.vel.length();

    p.target = this.findTarget(p);

    if (input.press && p.target) this.interact(p, p.target);

    const st = p.target?.type === 'station' && p.target.st.cfg.kind === 'hold' ? p.target.st : null;
    if (!input.held) p.holdLock = false;
    if (st && input.held && p.tray && !p.holdLock && (!st.holder || st.holder === p)) {
      if (p.holdStation && p.holdStation !== st) p.holdStation.holder = null;
      st.holder = p;
      p.holdStation = st;
      p.holdT += dt;
      p.sfxT -= dt;
      if (p.sfxT <= 0) {
        p.sfxT = 0.16;
        this.play(['salmon', 'tamago', 'lettuce', 'meat'].includes(st.cfg.model) ? 'chop' : 'pour', p);
      }
      if (p.holdT >= st.cfg.time) {
        this.addToTray(p, st.cfg.gives);
        p.holdT = 0;
        p.holdLock = true;
      }
    } else {
      if (st && input.held && p.tray && st.holder && st.holder !== p && input.press) this.hint(p, 'Busy!');
      if (p.holdStation) p.holdStation.holder = null;
      p.holdStation = null;
      p.holdT = 0;
    }

    this.animatePlayer(p, dt, moving);
  }

  animatePlayer(p, dt, moving) {
    animateRig(p.rig, dt, moving / SPEED, !!p.tray, this.t);
    p.ring.position.set(p.pos.x, 0.015, p.pos.z);
    p.ring.material.opacity = 0.75 + Math.sin(this.t * 5) * 0.15;
    if (p.target && p.local) {
      const a = this.anchorOf(p.target, p);
      p.arrow.visible = true;
      p.arrow.position.set(a.x, a.y + 0.25 + Math.abs(Math.sin(this.t * 5)) * 0.15, a.z);
      p.arrow.rotation.y = this.t * 2;
    } else p.arrow.visible = false;
  }

  anchorOf(target, p) {
    if (target.type === 'seat') return tmp.set(target.seat.x, KITCHEN.counterY + 0.45, KITCHEN.counterZ + 0.35);
    const st = target.st;
    if (st.cfg.kind === 'belt') {
      const item = p && this.beltItemNear(st, p.pos.x);
      return tmp.set(item ? item.x : THREE.MathUtils.clamp(p ? p.pos.x : 0, -2.8, 2.8), KITCHEN.deckY + 0.7, st.pos.z);
    }
    const top = KITCHEN.deckY + (st.cfg.side === 'front' ? 0.9 : 1.3);
    return tmp.set(st.pos.x, top, st.pos.z);
  }

  ipFor(st, x) {
    return st.cfg.kind === 'belt' ? { x: THREE.MathUtils.clamp(x, KITCHEN.minX, KITCHEN.maxX), z: KITCHEN.maxZ } : st.ip;
  }

  spawnBeltItem(st, x = -3.0) {
    const pool = st.cfg.pool.filter((c) => this.menuIds.some((id) => this.level.menu[id].steps.includes(c)));
    if (!pool.length) return;
    const needed = [];
    for (const seat of this.seats)
      for (const id of seat.customer?.state === 'waiting' ? seat.customer.remaining : [])
        for (const c of this.level.menu[id].steps) if (pool.includes(c)) needed.push(c);
    const comp = needed.length && Math.random() < 0.65 ? pick(needed) : pick(pool);
    this.addBeltItem(st, ++this.uid, comp, x);
  }

  addBeltItem(st, id, comp, x) {
    const mesh = buildBeltItem(comp);
    mesh.position.set(x, KITCHEN.deckY + 0.14, st.pos.z);
    this.scene.add(mesh);
    const it = { id, comp, x, tx: x, mesh };
    st.items.push(it);
    return it;
  }

  beltItemNear(st, x, comp) {
    let best = null;
    let bd = 0.8;
    for (const it of st.items) {
      const d = Math.abs(it.x - x);
      if (d < bd && (!comp || it.comp === comp)) {
        bd = d;
        best = it;
      }
    }
    return best;
  }

  removeBeltItem(st, item) {
    this.scene.remove(item.mesh);
    st.items.splice(st.items.indexOf(item), 1);
  }

  updateBelt(st, dt) {
    if (this.phase === 'over') return;
    st.spawnT -= dt;
    if (st.spawnT <= 0) {
      st.spawnT = st.cfg.every * (0.8 + Math.random() * 0.4);
      this.spawnBeltItem(st);
    }
    for (const it of [...st.items]) {
      it.x += st.cfg.speed * dt;
      it.mesh.position.x = it.x;
      it.mesh.rotation.y += dt * 0.6;
      if (it.x > 3.05) this.removeBeltItem(st, it);
    }
  }

  findTarget(p) {
    const probeX = p.pos.x + Math.sin(p.facing) * 0.45;
    const probeZ = p.pos.z + Math.cos(p.facing) * 0.45;
    if (p.botTarget) {
      const ip = p.botTarget.type === 'seat' ? p.botTarget.seat.ip : this.ipFor(p.botTarget.st, p.pos.x);
      if (Math.hypot(ip.x - p.pos.x, ip.z - p.pos.z) < REACH * 0.8) return p.botTarget;
    }
    let best = null;
    let bd = REACH;
    for (const st of this.stations) {
      const ip = this.ipFor(st, probeX);
      const d = Math.hypot(ip.x - probeX, ip.z - probeZ);
      if (d < bd) {
        bd = d;
        best = { type: 'station', st };
      }
    }
    for (const seat of this.seats) {
      if (seat.customer?.state !== 'waiting') continue;
      const d = Math.hypot(seat.ip.x - probeX, seat.ip.z - probeZ) * 0.9;
      if (d < bd) {
        bd = d;
        best = { type: 'seat', seat };
      }
    }
    return best;
  }

  interact(p, target) {
    if (target.type === 'seat') return this.deliver(p, target.seat);
    const st = target.st;
    const cfg = st.cfg;
    switch (cfg.kind) {
      case 'tray':
        if (!p.tray) {
          this.giveTray(p);
          this.play('pickup', p);
        } else if (!p.tray.items.length) {
          this.dropTray(p);
          this.play('click', p);
        } else this.hint(p, 'Serve or recycle first!');
        break;
      case 'instant':
        if (!p.tray) return this.hint(p, 'Grab a tray first!');
        this.addToTray(p, cfg.gives);
        break;
      case 'hold': {
        if (!p.tray) return this.hint(p, 'Grab a tray first!');
        const r = this.level.compose(p.tray.items, cfg.gives);
        if (r.error) {
          this.play('wrong', p);
          this.hint(p, r.error);
          p.holdLock = true;
        }
        break;
      }
      case 'batch':
        if (st.state === 'idle') {
          st.state = 'cooking';
          st.timer = 0;
          this.play('start');
        } else if (st.state === 'cooking') this.hint(p, 'Still cooking…');
        else if (!p.tray) this.hint(p, 'Grab a tray first!');
        else if (this.addToTray(p, cfg.gives)) {
          st.servings--;
          if (st.servings <= 0) st.state = 'idle';
        }
        break;
      case 'belt': {
        if (!p.tray) return this.hint(p, 'Grab a tray first!');
        const item = this.beltItemNear(st, p.pos.x);
        if (!item) return this.hint(p, 'Wait for the belt!');
        if (this.addToTray(p, item.comp)) this.removeBeltItem(st, item);
        break;
      }
      case 'trash':
        if (!p.tray) return this.hint(p, 'Nothing to recycle');
        this.dropTray(p);
        this.play('trash', p);
        break;
      case 'slot': {
        if (!p.tray && !st.held) return this.hint(p, 'Put a tray here to prep ahead');
        const mine = p.tray ? { tray: p.tray, model: p.trayModel } : null;
        const parked = st.held;
        if (mine) {
          p.rig.body.remove(mine.model);
          p.tray = null;
          p.trayModel = null;
        }
        if (parked) {
          this.scene.remove(parked.model);
          p.tray = parked.tray;
          p.trayModel = parked.model;
          p.trayModel.position.set(0, 0.93, 0.44);
          p.trayModel.rotation.set(0, 0, 0);
          p.trayModel.scale.setScalar(1);
          p.rig.body.add(p.trayModel);
          p.tray.rev++;
        }
        st.held = mine;
        if (mine) {
          mine.model.position.set(st.pos.x, st.pos.y + 0.09 * st.baseScale, st.pos.z);
          mine.model.rotation.set(0, st.group.rotation.y, 0);
          mine.model.scale.setScalar(1.25);
          this.scene.add(mine.model);
        }
        this.play(mine ? 'click' : 'pickup', p);
        break;
      }
    }
  }

  giveTray(p) {
    p.tray = { items: [], rev: 0 };
    p.trayModel = buildTray();
    p.trayModel.position.set(0, 0.93, 0.44);
    p.rig.body.add(p.trayModel);
  }

  dropTray(p) {
    p.rig.body.remove(p.trayModel);
    p.tray = null;
    p.trayModel = null;
  }

  addToTray(p, comp) {
    const r = this.level.compose(p.tray.items, comp);
    if (r.error) {
      this.play('wrong', p);
      this.hint(p, r.error);
      return false;
    }
    p.tray.items = r.items;
    p.tray.rev++;
    this.refreshTray(p);
    this.play('add', p);
    return true;
  }

  trayIds(tray) {
    return tray.ids || tray.items.map((it) => this.level.dishId(it));
  }

  fillTrayModel(tm, ids) {
    tm.children.filter((c) => c.userData.dish).forEach((c) => tm.remove(c));
    const order = [[], [1], [0, 2], [0, 1, 2]][ids.length];
    ids.forEach((id, i) => {
      const d = buildDish(id);
      d.userData.dish = true;
      d.position.copy(tm.userData.slots[order[i]]);
      d.scale.multiplyScalar(0.85);
      tm.add(d);
    });
  }

  refreshTray(p) {
    this.fillTrayModel(p.trayModel, this.trayIds(p.tray));
  }

  deliver(p, seat) {
    const c = seat.customer;
    if (!p.tray || !p.tray.items.length) return this.hint(p, p.tray ? 'Your tray is empty!' : 'Grab a tray first!');
    const remaining = [...c.remaining];
    const keep = [];
    const delivered = [];
    for (const item of p.tray.items) {
      const id = this.level.dishId(item);
      const k = remaining.indexOf(id);
      if (k >= 0) {
        remaining.splice(k, 1);
        delivered.push(id);
      } else keep.push(item);
    }
    if (!delivered.length) {
      this.play('wrong', p);
      c.shake = 0.5;
      return this.hint(p, "That's not my order!");
    }
    c.remaining = remaining;
    c.dirty = true;
    p.tray.items = keep;
    p.tray.rev++;
    if (keep.length) this.refreshTray(p);
    else this.dropTray(p);
    let earned = delivered.reduce((s, id) => s + this.level.menu[id].price, 0);
    delivered.forEach((id) => this.placeOnCounter(seat, id));
    if (!remaining.length) {
      const tip = Math.max(1, Math.round(c.total * 0.6 * (c.patience / c.maxPatience)));
      earned += tip;
      c.state = 'eating';
      c.eatT = 1.1;
      c.happy = true;
      this.served++;
      p.served++;
      this.play('cash');
      this.float(new THREE.Vector3(seat.x, 2.4, KITCHEN.customerZ), `+$${earned}`, 'cash');
    } else {
      this.play('partial');
      this.float(new THREE.Vector3(seat.x, 2.4, KITCHEN.customerZ), `+$${earned}`, 'cash small');
    }
    if (this.mode.id === 'score') this.money += earned;
    else p.money += earned;
    this.event('money', { player: p.idx, amount: earned });
  }

  placeOnCounter(seat, id) {
    if (!seat.counterTray) {
      seat.counterTray = buildTray();
      seat.counterTray.position.set(seat.x, KITCHEN.counterY + 0.02, KITCHEN.counterZ + 0.15);
      seat.counterTray.scale.setScalar(1.3);
      this.scene.add(seat.counterTray);
      seat.plates = [];
    }
    const d = buildDish(id);
    d.position.copy(seat.counterTray.userData.slots[[1, 0, 2][Math.min(seat.plates.length, 2)]]);
    d.scale.multiplyScalar(0.85);
    seat.counterTray.add(d);
    seat.plates.push(d);
    seat.plateIds.push(id);
  }

  clearPlates(seat) {
    if (seat.counterTray) this.scene.remove(seat.counterTray);
    seat.counterTray = null;
    seat.plates = [];
    seat.plateIds = [];
  }

  orderSize() {
    const e = this.elapsed;
    if (this.mode.id === 'score') {
      const p3 = e > 140 ? Math.min(0.22, (e - 140) / 500) : 0;
      const p2 = Math.min(0.55, 0.1 + e / 260);
      const r = Math.random();
      return r < p3 ? 3 : r < p3 + p2 ? 2 : 1;
    }
    const r = Math.random();
    return r < 0.08 ? 3 : r < 0.4 ? 2 : 1;
  }

  spawnCustomer(seat) {
    const n = this.orderSize();
    const order = [];
    for (let i = 0; i < n; i++) {
      if (this.freshDishes?.length && Math.random() < 0.7) order.push(this.freshDishes.shift());
      else order.push(pick(this.menuIds));
    }
    const total = order.reduce((s, id) => s + this.level.menu[id].price, 0);
    const side = seat.x <= 0 ? -1 : 1;
    const base = (this.mode.id === 'score' ? Math.max(24, 44 - this.elapsed * 0.07) : 38) * (1 - 0.05 * (this.crew - 1));
    const maxPatience = base + (n - 1) * 13;
    const c = this.makeCustomer(seat, ++this.uid, Math.floor(Math.random() * 2 ** 31), side * 9, KITCHEN.customerZ - 1.0);
    Object.assign(c, {
      order, remaining: [...order], total,
      state: 'arriving',
      path: [{ x: seat.x, z: KITCHEN.customerZ - 1.0 }, { x: seat.x, z: KITCHEN.customerZ }],
      patience: maxPatience, maxPatience,
    });
  }

  makeCustomer(seat, id, seed, x, z) {
    const { root, rig } = buildCustomer(seededRng(seed));
    root.position.set(x, 0, z);
    this.scene.add(root);
    const bubble = el('bubble hidden', '', this.overlay);
    seat.customer = { id, seed, root, rig, bubble, remaining: [], dirty: true, mood: 'happy', shake: 0, path: [], patience: 1, maxPatience: 1, state: 'arriving' };
    return seat.customer;
  }

  updateCustomers(dt, playing) {
    for (const seat of this.seats) {
      const c = seat.customer;
      if (!c) {
        if (playing) {
          seat.cooldown -= dt;
          if (seat.cooldown <= 0) this.spawnCustomer(seat);
        }
        continue;
      }
      let moving = 0;
      if (c.path.length) {
        const w = c.path[0];
        const dx = w.x - c.root.position.x;
        const dz = w.z - c.root.position.z;
        const d = Math.hypot(dx, dz);
        const step = 3.2 * dt;
        if (d <= step) {
          c.root.position.x = w.x;
          c.root.position.z = w.z;
          c.path.shift();
        } else {
          c.root.position.x += (dx / d) * step;
          c.root.position.z += (dz / d) * step;
          c.root.rotation.y = angleLerp(c.root.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 12));
          moving = 1;
        }
        if (!c.path.length) {
          if (c.state === 'arriving') {
            c.state = 'waiting';
            c.bubble.classList.remove('hidden');
            this.play('arrive');
          } else if (c.state === 'leaving') {
            this.scene.remove(c.root);
            c.bubble.remove();
            seat.customer = null;
            const base = (this.mode.id === 'score' ? Math.max(1.2, 5 - this.elapsed * 0.022) : 1.4) / (1 + 0.3 * (this.crew - 1));
            seat.cooldown = base + rand(0, 2.5);
            continue;
          }
        }
      } else c.root.rotation.y = angleLerp(c.root.rotation.y, 0, Math.min(1, dt * 8));

      if (c.state === 'waiting' && playing) {
        c.patience -= dt;
        const f = c.patience / c.maxPatience;
        const mood = f > 0.6 ? 'happy' : f > 0.35 ? 'ok' : f > 0.15 ? 'meh' : 'angry';
        if (mood !== c.mood) {
          c.mood = mood;
          c.dirty = true;
        }
        if (c.patience <= 0) this.customerLeaves(seat, false);
      } else if (c.state === 'eating') {
        c.eatT -= dt;
        if (c.eatT <= 0) this.customerLeaves(seat, true);
      }

      c.moving = moving;
      this.animateCustomer(c, seat, dt);
    }
  }

  animateCustomer(c, seat, dt) {
    animateRig(c.rig, dt, c.moving, false, this.t + seat.x);
    if (c.state === 'waiting' || c.state === 'eating') {
      const angry = c.mood === 'angry' || c.mood === 'meh';
      c.rig.mouth.rotation.z = angry && !c.happy ? 0 : Math.PI;
      c.rig.mouth.position.y = angry && !c.happy ? -0.12 : -0.09;
      c.shake = Math.max(0, c.shake - dt);
      c.rig.body.rotation.z = c.mood === 'angry' || c.shake > 0 ? Math.sin(this.t * 30) * 0.06 : 0;
      if (c.happy) c.rig.body.position.y = Math.abs(Math.sin(this.t * 12)) * 0.12;
      c.rig.armL.rotation.z = c.happy ? 2.6 : 0.08;
      c.rig.armR.rotation.z = c.happy ? -2.6 : -0.08;
    } else c.rig.body.rotation.z = 0;
  }

  customerLeaves(seat, happy) {
    const c = seat.customer;
    c.state = 'leaving';
    c.bubble.classList.add('hidden');
    c.rig.body.rotation.z = 0;
    c.rig.armL.rotation.z = 0.08;
    c.rig.armR.rotation.z = -0.08;
    this.clearPlates(seat);
    const side = seat.x <= 0 ? -1 : 1;
    c.path = [{ x: seat.x, z: KITCHEN.customerZ - 1.0 }, { x: side * 9.5, z: KITCHEN.customerZ - 1.0 }];
    if (!happy) {
      this.lost++;
      this.play('angry');
      this.float(new THREE.Vector3(seat.x, 2.5, KITCHEN.customerZ), 'Too slow!', 'bad');
      if (this.mode.id === 'score') {
        this.hearts--;
        this.event('heart', this.hearts);
        if (this.hearts <= 0) this.finish();
      }
    }
  }

  stationProgress(st) {
    const cfg = st.cfg;
    if (!cfg.time) return 0;
    if (cfg.kind === 'hold') return st.holder ? st.holder.holdT / cfg.time : 0;
    return st.timer / cfg.time;
  }

  verbFor(st, p) {
    const kind = st.cfg.kind;
    if (kind === 'tray') return p.tray ? (p.tray.items.length ? 'Busy' : 'Return') : 'Grab';
    if (kind === 'trash') return p.tray ? 'Recycle' : 'Empty';
    if (kind === 'slot') return p.tray ? (st.held ? 'Swap' : 'Set down') : st.held ? 'Pick up' : 'Empty';
    if (kind === 'batch' && st.state === 'idle') return 'Start';
    if (kind === 'batch' && st.state === 'cooking') return 'Cooking…';
    if (!p.tray) return 'Needs tray';
    if (kind === 'belt') {
      const item = this.beltItemNear(st, p.pos.x);
      return item ? `Grab ${COMP_NAMES[item.comp] || item.comp}` : 'Wait…';
    }
    if (kind === 'batch') return 'Take';
    if (kind === 'hold') return 'Hold';
    return 'Add';
  }

  updateStation(st, dt) {
    const cfg = st.cfg;
    if (cfg.kind === 'belt') this.updateBelt(st, dt);
    if (cfg.kind === 'batch' && st.state === 'cooking' && this.phase !== 'over') {
      st.timer += dt;
      if (st.timer >= cfg.time) {
        st.state = 'ready';
        st.servings = cfg.servings;
        this.play('ready');
      }
    }
    const active = !!st.holder;
    st.model.setState(st.state, this.t, active, st.servings, this.stationProgress(st));
    const targeted = this.players.some((p) => p.target?.st === st);
    const s = 1 + (targeted ? Math.sin(this.t * 8) * 0.025 + 0.03 : 0);
    st.group.scale.setScalar(st.baseScale * s);
  }

  separate() {
    const ps = this.players;
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i].pos;
        const b = ps[j].pos;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (ps[i].gone || ps[j].gone) continue;
        if (d > 0 && d < 0.75) {
          const fa = ps[i].local || ps[i].bot ? 1 : 0;
          const fb = ps[j].local || ps[j].bot ? 1 : 0;
          if (!fa && !fb) continue;
          const push = (0.75 - d) / (fa + fb);
          a.x -= (dx / d) * push * fa;
          a.z -= (dz / d) * push * fa;
          b.x += (dx / d) * push * fb;
          b.z += (dz / d) * push * fb;
        }
      }
  }

  hint(p, text) {
    if (!text || p.isBot) return;
    const last = p.hints.get(text) || 0;
    if (this.t - last < 0.8) return;
    p.hints.set(text, this.t);
    if (p.local) this.floatLocal(p.pos.clone().setY(2.3), text, 'hint');
    else this.emit({ k: 'hint', p: p.idx, txt: text });
  }

  float(pos, text, cls) {
    this.floatLocal(pos, text, cls);
    this.emit({ k: 'float', x: r2(pos.x), y: r2(pos.y), z: r2(pos.z), txt: text, cls });
  }

  floatLocal(pos, text, cls) {
    const e = el(`floater ${String(cls).replace(/[^a-z ]/g, '')}`, '', this.overlay);
    e.textContent = text;
    this.floaters.push({ e, pos: pos.clone(), t: 0 });
  }

  updateFloaters(dt) {
    this.floaters = this.floaters.filter((f) => {
      f.t += dt;
      f.pos.y += dt * 0.7;
      if (f.t > 1.3) {
        f.e.remove();
        return false;
      }
      this.place(f.e, f.pos);
      f.e.style.opacity = f.t > 0.9 ? String(1 - (f.t - 0.9) / 0.4) : '1';
      return true;
    });
  }

  project(v) {
    tmp.copy(v).project(this.camera);
    return [((tmp.x + 1) / 2) * this.W, ((1 - tmp.y) / 2) * this.H];
  }

  place(e, v) {
    const [x, y] = this.project(v);
    e.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  }

  updateOverlay() {
    const v = new THREE.Vector3();
    for (const seat of this.seats) {
      const c = seat.customer;
      if (!c) continue;
      if (c.dirty) {
        c.dirty = false;
        c.bubble.innerHTML = `<div class="mood"><div class="face">${moodIcon(c.happy ? 'happy' : c.mood)}</div></div><div class="items">${c.remaining.map((id) => `<div class="item">${dishIcon(id)}</div>`).join('')}</div>`;
        c.ring = c.bubble.querySelector('.mood');
      }
      const f = Math.max(0, c.patience / c.maxPatience);
      c.ring.style.setProperty('--f', `${(f * 360).toFixed(1)}deg`);
      c.ring.style.setProperty('--mc', f > 0.6 ? '#4cc43a' : f > 0.35 ? '#f7c531' : f > 0.15 ? '#f38b2b' : '#e2402f');
      c.bubble.classList.toggle('urgent', f <= 0.15);
      this.place(c.bubble, v.set(c.root.position.x, c.root.position.y + 2.25, c.root.position.z));
    }

    for (const st of this.stations) {
      if (!st.badge) continue;
      const cfg = st.cfg;
      let key = '';
      let html = '';
      if (cfg.kind === 'batch') {
        if (st.state === 'cooking') {
          key = 'cook';
          html = `<div class="ring"><div class="ico">${dishIcon(cfg.gives)}</div></div>`;
        } else if (st.state === 'ready') {
          key = `ready${st.servings}`;
          html = `<div class="ready"><div class="ico">${dishIcon(cfg.gives)}</div><b>×${st.servings}</b></div>`;
        } else {
          key = 'idle';
          html = `<div class="idle"><div class="ico">${dishIcon(cfg.gives)}</div><span>▶</span></div>`;
        }
      } else if (st.holder) {
        key = 'hold';
        html = '<div class="bar"><i></i></div>';
      }
      if (key !== st.badgeKey) {
        st.badgeKey = key;
        st.badge.innerHTML = html;
        st.badge.classList.toggle('hidden', !key);
      }
      if (!key) continue;
      if (key === 'cook') st.badge.querySelector('.ring').style.setProperty('--p', `${(st.timer / cfg.time) * 360}deg`);
      if (key === 'hold') st.badge.querySelector('.bar i').style.width = `${Math.min(100, (st.holder.holdT / cfg.time) * 100)}%`;
      this.place(st.badge, v.set(st.pos.x, st.pos.y + (cfg.kind === 'batch' ? 1.25 : 0.95), st.pos.z));
    }

    for (const p of this.players) {
      if (p.gone) continue;
      this.place(p.tag, v.set(p.pos.x, 2.25 + p.rig.body.position.y, p.pos.z));
      const t = p.target;
      let key = '';
      let text = '';
      if (t && p.local && this.phase === 'play') {
        if (t.type === 'station') {
          const st = t.st;
          const verb = this.verbFor(st, p);
          key = st.cfg.id + verb;
          text = `<b>${st.cfg.name}</b><span>${verb}</span>`;
        } else {
          key = 'serve';
          text = '<b>Customer</b><span>Serve</span>';
        }
      }
      if (key !== p.labelKey) {
        p.labelKey = key;
        p.label.innerHTML = text;
        p.label.classList.toggle('hidden', !key);
      }
      if (key) {
        const a = this.anchorOf(t, p);
        this.place(p.label, v.set(a.x, a.y - 0.25, a.z));
      }
    }
  }

  snapshot() {
    return {
      ph: this.phase,
      el: r2(this.elapsed),
      m: this.money,
      h: this.hearts,
      tl: r2(this.timeLeft),
      sv: this.served,
      lo: this.lost,
      p: this.players.map((p) => [r2(p.pos.x), r2(p.pos.z), r2(p.facing), r2(p.vel.length()), p.tray ? this.trayIds(p.tray) : null, p.money, p.served, p.gone ? 1 : 0]),
      s: this.stations.map((st) => [
        STATE_CODE[st.state],
        r2(st.timer),
        st.servings,
        st.holder ? st.holder.idx : -1,
        st.holder ? r2(st.holder.holdT) : 0,
        st.held ? this.trayIds(st.held.tray) : null,
        st.items ? st.items.map((it) => [it.id, it.comp, r2(it.x)]) : 0,
      ]),
      c: this.seats.map((seat) => {
        const c = seat.customer;
        if (!c) return 0;
        const r = c.root;
        return [c.id, c.seed, r2(r.position.x), r2(r.position.z), r2(r.rotation.y), c.state, c.remaining, r2(c.patience), r2(c.maxPatience), c.mood, c.happy ? 1 : 0, c.moving ? 1 : 0, r2(c.shake)];
      }),
      pl: this.seats.map((seat) => seat.plateIds),
      e: this.events.splice(0),
    };
  }

  applySnapshot(s) {
    this.phase = s.ph;
    this.elapsed = s.el;
    this.money = s.m;
    this.hearts = s.h;
    this.timeLeft = s.tl;
    this.served = s.sv;
    this.lost = s.lo;
    s.p.forEach((a, i) => {
      const p = this.players[i];
      if (!p || p.gone) return;
      if (a[7]) return this.removePlayer(p);
      if (i !== this.myIdx) p.net = { x: a[0], z: a[1], f: a[2], v: a[3] };
      this.syncTray(p, a[4]);
      p.money = a[5];
      p.served = a[6];
    });
    s.s.forEach((a, i) => {
      const st = this.stations[i];
      if (!st) return;
      st.state = STATE_NAME[a[0]];
      st.timer = a[1];
      st.servings = a[2];
      st.holder = a[3] >= 0 ? this.players[a[3]] : null;
      if (st.holder) st.holder.holdT = a[4];
      this.syncSlot(st, a[5]);
      if (st.items) this.syncBelt(st, a[6] || []);
    });
    s.c.forEach((a, i) => this.syncCustomer(this.seats[i], a));
    s.pl.forEach((ids, i) => this.syncPlates(this.seats[i], ids));
    for (const ev of s.e) this.applyEvent(ev);
  }

  syncTray(p, ids) {
    const key = ids ? ids.join(',') : null;
    if (p.trayKey === key) return;
    p.trayKey = key;
    if (!ids) {
      if (p.tray) this.dropTray(p);
      return;
    }
    if (!p.tray) this.giveTray(p);
    p.tray.ids = ids;
    p.tray.items = ids;
    this.refreshTray(p);
  }

  syncSlot(st, ids) {
    const key = ids ? ids.join(',') : null;
    if (st.heldKey === key) return;
    st.heldKey = key;
    if (st.held) this.scene.remove(st.held.model);
    st.held = null;
    if (!ids) return;
    const model = buildTray();
    this.fillTrayModel(model, ids);
    model.position.set(st.pos.x, st.pos.y + 0.09 * st.baseScale, st.pos.z);
    model.rotation.set(0, st.group.rotation.y, 0);
    model.scale.setScalar(1.25);
    this.scene.add(model);
    st.held = { tray: { items: ids, ids }, model };
  }

  syncBelt(st, list) {
    const seen = new Set();
    for (const [id, comp, x] of list) {
      seen.add(id);
      const it = st.items.find((i) => i.id === id) || this.addBeltItem(st, id, comp, x);
      it.tx = x;
    }
    for (const it of [...st.items]) if (!seen.has(it.id)) this.removeBeltItem(st, it);
  }

  syncCustomer(seat, a) {
    let c = seat.customer;
    if (!a) {
      if (c) this.removeCustomer(seat);
      return;
    }
    if (!c || c.id !== a[0]) {
      if (c) this.removeCustomer(seat);
      c = this.makeCustomer(seat, a[0], a[1], a[2], a[3]);
    }
    c.net = { x: a[2], z: a[3], ry: a[4] };
    if (c.state !== a[5]) {
      c.state = a[5];
      c.bubble.classList.toggle('hidden', c.state !== 'waiting' && c.state !== 'eating');
    }
    if (c.remaining.join() !== a[6].join()) {
      c.remaining = a[6];
      c.dirty = true;
    }
    c.patience = a[7];
    c.maxPatience = a[8];
    if (c.mood !== a[9]) {
      c.mood = a[9];
      c.dirty = true;
    }
    if (c.happy !== !!a[10]) {
      c.happy = !!a[10];
      c.dirty = true;
    }
    c.moving = a[11];
    c.shake = Math.max(c.shake, a[12]);
  }

  removeCustomer(seat) {
    const c = seat.customer;
    this.scene.remove(c.root);
    c.bubble.remove();
    seat.customer = null;
  }

  syncPlates(seat, ids) {
    const key = ids.join(',');
    if (seat.plateKey === key) return;
    seat.plateKey = key;
    this.clearPlates(seat);
    ids.forEach((id) => this.placeOnCounter(seat, id));
  }

  applyEvent(ev) {
    switch (ev.k) {
      case 'sfx':
        if (ev.p === -1 || ev.p === this.myIdx) sfx[ev.n]?.();
        break;
      case 'float':
        this.floatLocal(new THREE.Vector3(ev.x, ev.y, ev.z), ev.txt, ev.cls);
        break;
      case 'hint':
        if (ev.p === this.myIdx) this.floatLocal(this.players[this.myIdx].pos.clone().setY(2.3), ev.txt, 'hint');
        break;
      case 'count':
        this.showCount(ev.txt, ev.cls);
        break;
      case 'ev':
        this.onEvent(ev.type, ev.data);
        break;
      case 'end':
        this.phase = 'over';
        setTimeout(() => !this.disposed && this.onEnd(ev.r), 1600);
        break;
    }
  }

  updateGuest(dt) {
    this.t += dt;
    this.env.tick(this.t);
    const playing = this.phase === 'play';
    const me = this.players[this.myIdx];
    if (!me.gone) {
      let input = me.ctrl.read();
      if (!playing) input = { x: 0, z: 0, press: false, held: false };
      this.movePlayer(me, input, dt);
      for (const o of this.players) {
        if (o === me || o.gone) continue;
        const dx = me.pos.x - o.pos.x;
        const dz = me.pos.z - o.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0 && d < 0.75) {
          me.pos.x = THREE.MathUtils.clamp(me.pos.x + (dx / d) * (0.75 - d), KITCHEN.minX, KITCHEN.maxX);
          me.pos.z = THREE.MathUtils.clamp(me.pos.z + (dz / d) * (0.75 - d), KITCHEN.minZ, KITCHEN.maxZ);
        }
      }
      me.target = this.findTarget(me);
      if (input.press) this.pressSeq++;
      this.netInput = { k: 'in', x: r2(me.pos.x), z: r2(me.pos.z), f: r2(me.facing), v: r2(me.vel.length()), h: input.held ? 1 : 0, q: this.pressSeq };
      this.animatePlayer(me, dt, me.vel.length());
    }
    const k = Math.min(1, dt * 12);
    for (const p of this.players) {
      if (p === me || p.gone || !p.net) continue;
      if (Math.hypot(p.net.x - p.pos.x, p.net.z - p.pos.z) > 2.5) p.pos.set(p.net.x, 0, p.net.z);
      else {
        p.pos.x += (p.net.x - p.pos.x) * k;
        p.pos.z += (p.net.z - p.pos.z) * k;
      }
      p.facing = angleLerp(p.facing, p.net.f, k);
      p.root.rotation.y = p.facing;
      p.vel.set(Math.sin(p.facing) * p.net.v, Math.cos(p.facing) * p.net.v);
      this.animatePlayer(p, dt, p.net.v);
    }
    for (const st of this.stations) {
      if (st.items)
        for (const it of st.items) {
          const v = st.cfg.speed * dt;
          it.tx += v;
          it.x += v + (it.tx - it.x) * Math.min(1, dt * 6);
          it.mesh.position.x = it.x;
          it.mesh.rotation.y += dt * 0.6;
        }
      st.model.setState(st.state, this.t, !!st.holder, st.servings, this.stationProgress(st));
      const pulse = me.target?.st === st ? Math.sin(this.t * 8) * 0.025 + 0.03 : 0;
      st.group.scale.setScalar(st.baseScale * (1 + pulse));
    }
    for (const seat of this.seats) {
      const c = seat.customer;
      if (!c?.net) continue;
      const kc = Math.min(1, dt * 10);
      c.root.position.x += (c.net.x - c.root.position.x) * kc;
      c.root.position.z += (c.net.z - c.root.position.z) * kc;
      c.root.rotation.y = angleLerp(c.root.rotation.y, c.net.ry, kc);
      this.animateCustomer(c, seat, dt);
    }
    this.updateFloaters(dt);
    this.updateOverlay();
    if (this.countHideAt && this.t > this.countHideAt) {
      this.countHideAt = 0;
      this.countEl.classList.remove('show');
    }
  }

  remoteInput(netId, d) {
    const p = this.players.find((q) => q.netId === netId && q.remote);
    if (!p || p.gone || !d) return;
    const num = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);
    p.netIn = {
      x: num(d.x, KITCHEN.minX, KITCHEN.maxX),
      z: num(d.z, KITCHEN.minZ, KITCHEN.maxZ),
      f: num(d.f, -Math.PI * 4, Math.PI * 4),
      v: num(d.v, 0, SPEED * 1.2),
      h: d.h ? 1 : 0,
      q: Number.isInteger(d.q) ? d.q : p.lastQ,
    };
  }

  dropRemote(netId) {
    const p = this.players.find((q) => q.netId === netId);
    if (p && !p.gone) this.removePlayer(p);
  }

  removePlayer(p) {
    p.gone = true;
    if (p.holdStation) p.holdStation.holder = null;
    p.holdStation = null;
    if (p.tray) this.dropTray(p);
    this.scene.remove(p.root, p.ring, p.arrow);
    p.tag.remove();
    p.label.remove();
    p.target = null;
  }

  dispose() {
    this.disposed = true;
    this.overlay.innerHTML = '';
  }
}
