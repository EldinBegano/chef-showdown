import * as THREE from 'three';
import { CHARACTERS, buildCharacter, poseIdle, buildLobbyStage } from './models.js';
import { Game } from './game.js';
import { Bot } from './bot.js';
import { LEVELS, LEVEL_ORDER, MODES, COMP_NAMES } from './levels.js';
import { Keyboard, Touch, keyController } from './input.js';
import { Net } from './net.js';
import { sfx } from './audio.js';
import { save, levelFromXp, xpForLevel, board, submitScore } from './save.js';
import { dishIcon, UI_ICONS, BURGER_LOGO } from './icons.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const CPU_SKILL = { easy: 0.35, normal: 0.65, hard: 0.95 };
const CPU_NAMES = ['Chef Bot', 'Robo Roux', 'Auto Sous', 'Byte Chef'];

const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0);

const kb = new Keyboard();
const isTouch = matchMedia('(pointer: coarse)').matches;
const touch = isTouch ? new Touch($('#touch')) : null;

const state = {
  screen: 'lobby',
  game: null,
  p2: null,
  cpu: 'normal',
  front: 'score',
  idx1: Math.max(0, CHARACTERS.findIndex((c) => c.id === save.data.char)),
  idx2: Math.max(0, CHARACTERS.findIndex((c) => c.id === save.data.char2)),
};

const offscreen = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
offscreen.setPixelRatio(1);
offscreen.shadowMap.enabled = true;
offscreen.shadowMap.type = THREE.PCFSoftShadowMap;

const STAGE_STYLE = {
  sushi: { color: '#d8322a', icon: 'salmon_nigiri' },
  street: { color: '#e8317d', icon: 'tuna_maki' },
  burger: { color: '#f4a128', icon: 'deluxe' },
  happy: { color: '#9b4fd6', icon: 'milkshake' },
};
if (save.data.kitchen?.versus === 'diner') save.data.kitchen.versus = 'happy';
for (const m of ['score', 'versus']) if (!LEVELS[save.data.kitchen?.[m]]) save.data.kitchen = { ...save.data.kitchen, [m]: m === 'score' ? 'sushi' : 'happy' };

const portraits = renderPortraits();
const stageShots = {};

function renderPortraits() {
  const r = offscreen;
  r.setSize(256, 256);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff1e0, 0x664466, 1.5));
  const d = new THREE.DirectionalLight(0xffffff, 1.7);
  d.position.set(2, 4, 5);
  scene.add(d);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  cam.position.set(0, 1.5, 2.6);
  cam.lookAt(0, 1.42, 0);
  const out = {};
  for (const c of CHARACTERS) {
    const { root, rig } = buildCharacter(c.id);
    poseIdle(rig, 0);
    rig.head.rotation.set(0, 0, 0);
    root.rotation.y = -0.3;
    scene.add(root);
    r.render(scene, cam);
    out[c.id] = r.domElement.toDataURL('image/png');
    scene.remove(root);
  }
  return out;
}

function renderStageShot(levelId) {
  const game = new Game({ mode: MODES.score, levelId, players: [], overlay: document.createElement('div'), onEnd() {}, onEvent() {} });
  game.phase = 'play';
  game.menuIds = Object.keys(LEVELS[levelId].menu);
  game.seats.forEach((s) => (s.cooldown = 0));
  game.stations.forEach((st) => {
    if (st.cfg.kind === 'batch') {
      st.state = 'ready';
      st.servings = st.cfg.servings;
    }
  });
  for (let i = 0; i < 120; i++) game.update(1 / 30);
  const w = 360;
  const h = 300;
  offscreen.setSize(w, h);
  const cam = new THREE.PerspectiveCamera(34, w / h, 0.1, 80);
  const target = new THREE.Vector3(0, 0.9, -0.9);
  cam.position.copy(target).addScaledVector(new THREE.Vector3(0, 0.78, 0.62).normalize(), 15.5);
  cam.lookAt(target);
  if (game.scene.fog) {
    game.scene.fog.near = 18;
    game.scene.fog.far = 32;
  }
  offscreen.render(game.scene, cam);
  return offscreen.domElement.toDataURL('image/jpeg', 0.85);
}

const charLevel = () => levelFromXp(save.data.xp).level;
const isUnlocked = (c) => charLevel() >= c.level;

/* ---------- lobby 3D ---------- */

const lobby = (() => {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffe6d0, 0x5a2030, 1.3));
  const key = new THREE.DirectionalLight(0xfff0e0, 1.8);
  key.position.set(2, 5, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff6a8a, 1.4);
  rim.position.set(-4, 3, -4);
  scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.35 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 1.25, 6.6);
  camera.lookAt(0, 1.0, 0);
  const s1 = buildLobbyStage(scene);
  const s2 = buildLobbyStage(scene);
  return { scene, camera, slots: [{ stage: s1, model: null, hop: 0 }, { stage: s2, model: null, hop: 0 }] };
})();

function setLobbyChar(slot, idx, { silhouette = false } = {}) {
  const s = lobby.slots[slot];
  if (s.model) lobby.scene.remove(s.model.root);
  if (idx == null) {
    s.model = null;
    s.stage.visible = false;
    return;
  }
  s.model = buildCharacter(CHARACTERS[idx].id, { silhouette });
  s.model.root.traverse((o) => o.isMesh && (o.castShadow = true));
  lobby.scene.add(s.model.root);
  s.stage.visible = true;
  s.hop = 0.35;
  layoutLobby();
}

function layoutLobby() {
  const a = innerWidth / innerHeight;
  const halfW = lobby.camera.position.z * Math.tan(THREE.MathUtils.degToRad(15)) * a;
  const narrow = innerWidth <= 820 || innerHeight <= 560;
  const x1 = narrow ? 0 : 0.04 * halfW * 2;
  const x2 = 0.72 * halfW;
  const p1 = lobby.slots[0];
  const p2 = lobby.slots[1];
  p1.stage.position.set(x1, 0, 0);
  p2.stage.position.set(x2, 0, -1.2);
  if (p1.model) p1.model.root.position.set(x1, 0, 0);
  if (p2.model) {
    p2.model.root.position.set(x2, 0, -1.2);
    p2.model.root.scale.setScalar(0.92);
  }
  if (narrow && a < 1) {
    lobby.camera.position.set(0, 1.3, 11);
    lobby.camera.lookAt(0, 0.45, 0);
  } else if (narrow) {
    lobby.camera.position.set(0, 1.45, 7.6);
    lobby.camera.lookAt(0, 1.6, 0);
  } else {
    lobby.camera.position.set(0, 1.25, 6.6);
    lobby.camera.lookAt(0, 0.88, 0);
  }
}

function tickLobby(dt, t) {
  lobby.slots.forEach((s, i) => {
    if (!s.model) return;
    poseIdle(s.model.rig, t + i * 1.7);
    s.hop = Math.max(0, s.hop - dt);
    s.model.root.position.y = Math.sin((s.hop / 0.35) * Math.PI) * 0.25;
    s.model.root.rotation.y = Math.sin(t * 0.5 + i) * 0.18 - (i ? 0.25 : 0);
  });
}

/* ---------- lobby UI ---------- */

function fillStatic() {
  $('.logo .burger').innerHTML = BURGER_LOGO;
  $('.burger-ico').innerHTML = BURGER_LOGO;
  $('.unlocks .badge-ico').innerHTML = '';
  $('.shake-ico').innerHTML = dishIcon('milkshake');
  $('.sushi-ico').innerHTML = dishIcon('salmon_nigiri');
  $('.score-art .trophy').innerHTML = UI_ICONS.trophy;
  $('.vs-a').innerHTML = dishIcon('salmon_maki');
  $('.vs-b').innerHTML = dishIcon('tamago_nigiri');
  $('[data-action=prev]').innerHTML = UI_ICONS.left;
  $('[data-action=next]').innerHTML = UI_ICONS.right;
  $('[data-action=prev2]').innerHTML = UI_ICONS.left;
  $('[data-action=next2]').innerHTML = UI_ICONS.right;
  $('.cash-ico').innerHTML = UI_ICONS.cash;
  $('.who .name').value = save.data.name;
  updateSoundBtn();
}

function updateSoundBtn() {
  $('[data-action=sound]').innerHTML = sfx.enabled ? UI_ICONS.sound : UI_ICONS.mute;
}

function refreshLobby() {
  const lv = levelFromXp(save.data.xp);
  const c1 = CHARACTERS[state.idx1];
  $('.avatar img').src = portraits[isUnlocked(c1) ? c1.id : 'morel'];
  $('.avatar .lvl b').textContent = lv.level;
  $('.who .xpbar i').style.width = `${(lv.into / lv.need) * 100}%`;

  const locked = !isUnlocked(c1);
  $('.char-name').textContent = c1.name;
  const lock = $('.char-lock');
  lock.classList.toggle('hidden', !locked);
  lock.innerHTML = `${UI_ICONS.lock}<span>Reach level ${c1.level} to unlock</span>`;
  $$('[data-action=play]').forEach((b) => {
    b.disabled = locked;
    b.style.opacity = locked ? 0.5 : 1;
  });

  const upcoming = CHARACTERS.filter((c) => !isUnlocked(c)).slice(0, 2);
  const shown = upcoming.length ? upcoming : CHARACTERS.slice(-2);
  $('.tiles').innerHTML = shown
    .map((c) => `<div class="tile ${c.tier} ${isUnlocked(c) ? '' : 'locked'}"><img src="${portraits[c.id]}" alt="${c.name}"><span class="tier ${c.tier}">${c.tier === 'gold' ? 'GOLD' : 'FREE'} · LV ${c.level}</span></div>`)
    .join('');
  const next = upcoming[0];
  $('.togo').textContent = next ? `${xpForLevel(next.level) - save.data.xp} XP to go` : 'Everything unlocked!';

  $('.opp').textContent = state.p2 != null ? 'Local 2 players' : `vs CPU · ${state.cpu[0].toUpperCase()}${state.cpu.slice(1)}`;

  const entries = board();
  const mine = entries.findIndex((e) => e.name === save.data.name);
  $('.best-rank').textContent = mine >= 0 ? mine + 1 : '–';

  $('.join').classList.toggle('hidden', state.p2 != null);
  $('.p2ui').classList.toggle('hidden', state.p2 == null);
  if (state.p2 != null) $('.p2tag').textContent = `Player 2 · ${CHARACTERS[state.p2].name}`;
}

function setFront(mode) {
  state.front = mode;
  $$('.card').forEach((c) => {
    const f = c.dataset.mode === mode;
    c.classList.toggle('front', f);
    c.classList.toggle('back', !f);
  });
}

function cycleP1(dir) {
  state.idx1 = (state.idx1 + dir + CHARACTERS.length) % CHARACTERS.length;
  const c = CHARACTERS[state.idx1];
  if (isUnlocked(c)) {
    save.data.char = c.id;
    save.write();
  }
  setLobbyChar(0, state.idx1, { silhouette: !isUnlocked(c) });
  refreshLobby();
}

function cycleP2(dir) {
  const n = CHARACTERS.length;
  let i = state.p2;
  for (let k = 0; k < n; k++) {
    i = (i + dir + n) % n;
    if (isUnlocked(CHARACTERS[i])) break;
  }
  state.p2 = i;
  save.data.char2 = CHARACTERS[i].id;
  save.write();
  setLobbyChar(1, i);
  refreshLobby();
}

function showLobby() {
  state.screen = 'lobby';
  document.body.classList.add('in-lobby');
  $('#lobby').classList.remove('hidden');
  $('#hud').classList.add('hidden');
  $('#touch').classList.add('hidden');
  renderer.setClearColor(0x000000, 0);
  setLobbyChar(0, state.idx1, { silhouette: !isUnlocked(CHARACTERS[state.idx1]) });
  setLobbyChar(1, state.p2);
  refreshLobby();
}

/* ---------- game ---------- */

function playerChars(modeId) {
  const c1 = CHARACTERS[state.idx1];
  if (state.p2 != null) return [c1.id, CHARACTERS[state.p2].id];
  if (modeId !== 'versus') return [c1.id];
  if (!state.cpuChar || state.cpuChar === c1.id) {
    const others = CHARACTERS.filter((c) => c.id !== c1.id);
    state.cpuChar = others[Math.floor(Math.random() * others.length)].id;
  }
  return [c1.id, state.cpuChar];
}

function openStages(modeId) {
  if (!isUnlocked(CHARACTERS[state.idx1])) return;
  state.screen = 'stages';
  state.stageMode = modeId;
  state.stageIdx = Math.max(0, LEVEL_ORDER.indexOf(save.data.kitchen[modeId]));
  const sec = $('#stages');
  sec.classList.remove('hidden');
  document.body.classList.add('in-stages');
  sec.dataset.mode = modeId;
  $('#lobby').classList.add('hidden');
  $('.stage-sub').textContent = modeId === 'versus' ? (state.p2 != null ? 'LOCAL VERSUS' : `VS CPU · ${state.cpu.toUpperCase()}`) : state.p2 != null ? 'CO-OP SCORE ATTACK' : 'SCORE ATTACK';
  const chars = playerChars(modeId);
  $('.stage-players').innerHTML = chars.map((id, i) => `<div class="sp ${i ? 'teal' : 'red'}"><img src="${portraits[id]}" alt=""><b>${i === 0 ? escapeHtml(save.data.name) : state.p2 != null ? 'Player 2' : 'CPU'}</b></div>`).join('');
  const label = modeId === 'versus' ? 'VERSUS' : 'SCORE ATTACK';
  $('.stage-cards').innerHTML = LEVEL_ORDER.map((id, i) => {
    const lv = LEVELS[id];
    const st = STAGE_STYLE[id];
    return `<button class="stage-card ${i === state.stageIdx ? 'sel' : ''}" data-action="stage" data-level="${id}" style="--sc:${st.color}">
      <div class="shot">${stageShots[id] ? `<img src="${stageShots[id]}" alt="">` : '<div class="loading"></div>'}</div>
      <div class="label"><small>${label}</small><b>${lv.name}</b><span>${lv.blurb}</span></div>
      <span class="stage-ico">${dishIcon(st.icon)}</span>
    </button>`;
  }).join('');
  const missing = LEVEL_ORDER.filter((id) => !stageShots[id]);
  const next = () => {
    const id = missing.shift();
    if (!id || state.screen !== 'stages') return;
    stageShots[id] = renderStageShot(id);
    const slot = $(`.stage-card[data-level=${id}] .shot`);
    if (slot) slot.innerHTML = `<img src="${stageShots[id]}" alt="">`;
    setTimeout(next, 30);
  };
  setTimeout(next, 60);
}

function closeStages() {
  $('#stages').classList.add('hidden');
  document.body.classList.remove('in-stages');
}

function moveStage(d) {
  state.stageIdx = (state.stageIdx + d + LEVEL_ORDER.length) % LEVEL_ORDER.length;
  $$('.stage-card').forEach((c, i) => c.classList.toggle('sel', i === state.stageIdx));
}

function startGame(modeId, levelId = save.data.kitchen[modeId]) {
  const c1 = CHARACTERS[state.idx1];
  if (!isUnlocked(c1)) return;
  save.data.kitchen = { ...save.data.kitchen, [modeId]: levelId };
  save.write();
  closeStages();
  state.lastLevel = levelId;
  const name = save.data.name || 'Chef';
  const players = [];
  if (state.p2 != null) {
    players.push({ name, charId: c1.id, controller: keyController(kb, 'p1', touch) });
    players.push({ name: 'Player 2', charId: CHARACTERS[state.p2].id, controller: keyController(kb, 'p2') });
  } else {
    players.push({ name, charId: c1.id, controller: keyController(kb, 'solo', touch) });
    if (modeId === 'versus') players.push({ name: CPU_NAMES[Math.floor(Math.random() * CPU_NAMES.length)], charId: playerChars('versus')[1], bot: true });
  }
  launchGame(modeId, levelId, players, null);
}

function launchGame(modeId, levelId, players, net) {
  const mode = MODES[modeId];
  closeStages();
  disposeGame();
  const game = new Game({ mode, levelId, players, overlay: $('#world'), onEnd: (r) => endGame(r), onEvent, net });
  game.players.forEach((p) => p.isBot && (p.bot = new Bot(game, p, CPU_SKILL[state.cpu])));
  game.resize(innerWidth, innerHeight);
  state.game = game;
  state.screen = 'game';
  state.lastMoney = -1;
  document.body.classList.remove('in-lobby');
  $('#lobby').classList.add('hidden');
  const hud = $('#hud');
  hud.classList.remove('hidden');
  hud.className = modeId;
  $('#touch').classList.toggle('hidden', !touch);
  renderer.setClearColor(0x000000, 1);
  if (modeId === 'versus') {
    const [a, b] = game.players;
    $('.vsbar .red img').src = portraits[a.charId];
    $('.vsbar .teal img').src = portraits[b.charId];
    $('.vs-side.left img').src = portraits[a.charId];
    $('.vs-side.right img').src = portraits[b.charId];
    $('.n1').textContent = a.name;
    $('.n2').textContent = b.name;
  }
  renderHearts();
  closeModal();
  document.activeElement?.blur();
}

/* ---------- online ---------- */

const cleanName = (n) => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 14) || 'Chef';
const cleanChar = (id) => (CHARACTERS.some((c) => c.id === id) ? id : 'morel');
const myChar = () => (isUnlocked(CHARACTERS[state.idx1]) ? CHARACTERS[state.idx1].id : 'morel');

function openOnline(code = '', err = '') {
  if (state.online) return renderRoom();
  openModal(`<header class="teal">Play Online</header><div class="body online">
    <label class="field"><span>Your name</span><input class="online-name" maxlength="14" value="${escapeHtml(save.data.name)}" spellcheck="false"></label>
    <div class="online-choice">
      <div class="choice">
        <h3>Host a room</h3>
        <p>Get a room code and send it to your mate.</p>
        <button class="btn teal" data-action="host-room">Host</button>
      </div>
      <div class="choice">
        <h3>Join a room</h3>
        <input class="code-in" maxlength="4" placeholder="CODE" value="${escapeHtml(code)}" spellcheck="false" autocomplete="off">
        <button class="btn play" data-action="join-room">Join</button>
      </div>
    </div>
    <p class="err">${escapeHtml(err)}</p>
    <p class="note">Everyone opens the game from the same server (<code>npm run online</code>). The README explains how to play over the internet.</p>
  </div>`);
}

function onlineName() {
  const input = $('.online-name');
  if (input) {
    save.data.name = cleanName(input.value);
    save.write();
    $('.who .name').value = save.data.name;
  }
  return save.data.name;
}

async function connectNet(code = '') {
  const net = new Net();
  try {
    await net.connect();
  } catch {
    openOnline(code, "Couldn't reach the game server. Start it with npm run online, then open the address it prints.");
    return null;
  }
  return net;
}

async function hostRoom() {
  const name = onlineName();
  const net = await connectNet();
  if (!net) return;
  net.on('created', (m) => {
    state.online = { net, role: 'host', code: m.code, myId: m.id, me: 0, mode: 'score', level: save.data.kitchen.score, roster: [{ id: m.id, name, charId: myChar() }], lastSnap: 0 };
    renderRoom();
  });
  net.on('peer-join', (m) => {
    const o = state.online;
    let name = cleanName(m.data?.name);
    const taken = new Set(o.roster.map((r) => r.name));
    for (let n = 2; taken.has(name); n++) name = `${cleanName(m.data?.name).slice(0, 11)} ${n}`;
    o.roster.push({ id: m.id, name, charId: cleanChar(m.data?.charId) });
    if (o.mode === 'versus' && o.roster.length > 2) o.mode = 'score';
    sfx.arrive();
    syncRoom();
  });
  net.on('peer-leave', (m) => {
    const o = state.online;
    o.roster = o.roster.filter((r) => r.id !== m.id);
    if (state.game) {
      state.game.dropRemote(m.id);
      if (state.game.mode.id === 'versus' && state.game.phase !== 'over') state.game.finish();
    }
    syncRoom();
  });
  net.on('from', (m) => {
    if (m.data?.k === 'in') state.game?.remoteInput(m.id, m.data);
  });
  net.on('close', () => leaveOnline('Lost connection to the game server.'));
  net.send({ t: 'create' });
}

async function joinRoom() {
  const name = onlineName();
  const code = ($('.code-in')?.value || '').toUpperCase().trim();
  if (code.length !== 4) return openOnline(code, 'Room codes are 4 characters.');
  const net = await connectNet(code);
  if (!net) return;
  net.on('error', (m) => {
    net.close();
    openOnline(code, m.msg);
  });
  net.on('joined', (m) => {
    state.online = { net, role: 'guest', code: m.code, myId: m.id, me: 0, mode: 'score', level: 'sushi', roster: [], lastIn: 0 };
    renderRoom();
  });
  net.on('host', (m) => onHostMessage(m.data));
  net.on('host-left', () => leaveOnline('The host closed the room.'));
  net.on('close', () => leaveOnline('Lost connection to the game server.'));
  net.send({ t: 'join', code, data: { name, charId: myChar() } });
}

function onHostMessage(d) {
  const o = state.online;
  if (!o || !d) return;
  if (d.k === 'snap') return state.game?.applySnapshot(d.s);
  if (d.k === 'roster') {
    o.roster = d.roster;
    o.mode = d.mode;
    o.level = d.level;
    if (!state.game) renderRoom();
  } else if (d.k === 'start') launchOnline(d);
  else if (d.k === 'room') {
    disposeGame();
    showLobby();
    renderRoom();
  }
}

function syncRoom() {
  const o = state.online;
  if (!o || o.role !== 'host') return;
  o.net.send({ t: 'broadcast', data: { k: 'roster', roster: o.roster, mode: o.mode, level: o.level } });
  if (!state.game) renderRoom();
}

function renderRoom(err = '') {
  const o = state.online;
  if (!o) return;
  const host = o.role === 'host';
  const link = `${location.origin}${location.pathname}?room=${o.code}`;
  const roster = o.roster
    .map((r, i) => `<div class="rp"><img src="${portraits[cleanChar(r.charId)]}" alt=""><b>${escapeHtml(r.name)}</b><small>${i === 0 ? 'Host' : r.id === o.myId ? 'You' : 'Guest'}</small></div>`)
    .join('');
  const empty = Array.from({ length: Math.max(0, 2 - o.roster.length) }, () => '<div class="rp empty"><span>+</span><small>Waiting…</small></div>').join('');
  const modes = [
    ['score', o.roster.length > 1 ? 'Co-op Score Attack' : 'Score Attack'],
    ['versus', 'Versus'],
  ];
  const opts = host
    ? `<div class="room-opts">
        <div><span>Mode</span>${modes.map(([id, name]) => `<button class="pill ${o.mode === id ? 'on' : ''}" data-action="online-mode" data-mode="${id}" ${id === 'versus' && o.roster.length > 2 ? 'disabled' : ''}>${name}</button>`).join('')}</div>
        <div><span>Stage</span>${LEVEL_ORDER.map((id) => `<button class="pill ${o.level === id ? 'on' : ''}" data-action="online-stage" data-level="${id}">${LEVELS[id].name}</button>`).join('')}</div>
      </div>`
    : `<p class="room-info">${o.mode === 'versus' ? 'Versus' : 'Score Attack'} · ${LEVELS[o.level]?.name || ''}</p>`;
  const canStart = o.mode !== 'versus' || o.roster.length === 2;
  openModal(
    `<header class="teal">Online Room</header><div class="body online">
      <div class="room-code"><small>ROOM CODE</small><b>${o.code}</b>
        <button class="pill" data-action="copy-link" data-link="${escapeHtml(link)}">Copy invite link</button></div>
      <p class="note">Send the code or link to your mate. They open the game from the same server and press <b>Join</b>.</p>
      <div class="roster">${roster}${empty}</div>
      ${opts}
      <p class="err">${escapeHtml(err)}</p>
      <div class="actions">
        ${host ? `<button class="btn teal" data-action="online-start" ${canStart ? '' : 'disabled'}>${canStart ? 'Start' : 'Versus needs 2 players'}</button>` : '<span class="wait-host">Waiting for the host to start…</span>'}
        <button class="btn play" data-action="online-leave">Leave</button>
      </div>
    </div>`,
    { closable: false },
  );
}

function hostStart() {
  const o = state.online;
  if (o.mode === 'versus' && o.roster.length !== 2) return renderRoom('Versus needs exactly 2 players.');
  const msg = { k: 'start', mode: o.mode, level: o.level, players: o.roster.map((r) => ({ id: r.id, name: r.name, charId: r.charId })) };
  o.net.send({ t: 'lock', locked: true });
  o.net.send({ t: 'broadcast', data: msg });
  launchOnline(msg);
}

function launchOnline(msg) {
  const o = state.online;
  if (!LEVELS[msg.level] || !MODES[msg.mode]) return;
  o.mode = msg.mode;
  o.level = msg.level;
  o.me = Math.max(0, msg.players.findIndex((p) => p.id === o.myId));
  state.lastLevel = msg.level;
  const players = msg.players.slice(0, 4).map((p, i) => ({
    name: cleanName(p.name),
    charId: cleanChar(p.charId),
    netId: p.id,
    controller: i === o.me ? keyController(kb, 'solo', touch) : null,
    remote: o.role === 'host' && i !== o.me,
    puppet: o.role === 'guest' && i !== o.me,
  }));
  sfx.go();
  launchGame(msg.mode, msg.level, players, { role: o.role, myIdx: o.me });
}

function backToRoom() {
  const o = state.online;
  if (!o) return;
  disposeGame();
  if (o.role === 'host') {
    o.net.send({ t: 'lock', locked: false });
    o.net.send({ t: 'broadcast', data: { k: 'room' } });
  }
  showLobby();
  syncRoom();
  renderRoom();
}

function leaveOnline(msg = '') {
  const o = state.online;
  if (!o) return;
  state.online = null;
  o.net.send({ t: 'leave' });
  o.net.close();
  disposeGame();
  closeModal();
  showLobby();
  if (msg) openModal(`<header class="teal">Online</header><div class="body"><p>${escapeHtml(msg)}</p><div class="actions"><button class="btn teal" data-action="online">Play online</button><button class="btn play" data-action="close">OK</button></div></div>`);
}

function netTick(now) {
  const o = state.online;
  if (!o || !state.game) return;
  if (o.role === 'host' && now - o.lastSnap > 50) {
    o.lastSnap = now;
    o.net.send({ t: 'broadcast', data: { k: 'snap', s: state.game.snapshot() } });
  } else if (o.role === 'guest' && state.game.netInput && now - o.lastIn > 33) {
    o.lastIn = now;
    o.net.send({ t: 'to-host', data: state.game.netInput });
  }
}

function disposeGame() {
  if (state.game) {
    state.game.dispose();
    state.game = null;
  }
}

function renderHearts() {
  const g = state.game;
  if (!g || g.mode.id !== 'score') return;
  $('.hearts').innerHTML = Array.from({ length: g.mode.lives }, (_, i) => `<span>${i < g.hearts ? UI_ICONS.heart : UI_ICONS.heartEmpty}</span>`).join('');
}

let toastTimer = 0;
function onEvent(type, data) {
  if (type === 'heart') {
    renderHearts();
    const h = $('.hearts');
    h.classList.remove('hit');
    void h.offsetWidth;
    h.classList.add('hit');
  } else if (type === 'money') {
    const m = state.game.mode.id === 'score' ? $('.money') : $(data.player ? '.m2' : '.m1');
    m.classList.remove('bump');
    void m.offsetWidth;
    m.classList.add('bump');
  } else if (type === 'unlock') {
    const t = $('.toast');
    t.innerHTML = data.map((d) => `<div class="ico">${dishIcon(d.id)}</div>`).join('') + `<div><small>NEW ON THE MENU</small>${escapeHtml(data.map((d) => d.name).join(' & '))}</div>`;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }
}

function updateHud() {
  const g = state.game;
  if (!g) return;
  if (g.mode.id === 'score') {
    if (g.money !== state.lastMoney) {
      state.lastMoney = g.money;
      $('.money').textContent = `$${g.money}`;
    }
  } else {
    const [a, b] = g.players;
    $('.m1').textContent = `$${a.money}`;
    $('.m2').textContent = `$${b.money}`;
    $('.vsbar .red').classList.toggle('lead', a.money > b.money);
    $('.vsbar .teal').classList.toggle('lead', b.money > a.money);
    const secs = Math.ceil(g.timeLeft);
    const t = $('.timer b');
    if (t.textContent !== String(secs)) t.textContent = secs;
    $('.timer').classList.toggle('low', secs <= 10 && g.phase === 'play');
  }
}

function endGame(raw) {
  if (!state.game) return;
  const n = (v) => Number(v) || 0;
  const r = {
    mode: raw.mode === 'versus' ? 'versus' : 'score',
    level: LEVELS[raw.level] ? raw.level : 'sushi',
    money: n(raw.money),
    served: n(raw.served),
    lost: n(raw.lost),
    elapsed: n(raw.elapsed),
    players: (raw.players || []).map((p) => ({ name: cleanName(p.name), charId: cleanChar(p.charId), money: n(p.money), served: n(p.served) })),
  };
  if (r.mode === 'versus' && r.players.length < 2) r.players.push({ name: 'Nobody', charId: 'morel', money: 0, served: 0 });
  const me = state.online ? state.online.me : 0;
  const before = levelFromXp(save.data.xp).level;
  let xp = 0;
  let rank = -1;
  if (r.mode === 'score') {
    xp = r.money;
    const name = r.players.map((p) => p.name).join(' & ').slice(0, 40);
    rank = submitScore({ name, score: r.money, served: r.served, level: r.level });
  } else {
    const a = r.players[me];
    const b = r.players[1 - me];
    xp = a.money + (a.money > b.money ? 25 : a.money === b.money ? 10 : 5);
  }
  save.data.xp += xp;
  save.write();
  const after = levelFromXp(save.data.xp);
  const newChars = CHARACTERS.filter((c) => c.level > before && c.level <= after.level);
  (r.mode === 'versus' && r.players[me].money >= r.players[1 - me].money ? sfx.win : sfx.end)();

  const xpBlock = `<div class="xp-gain">+${xp} XP ${after.level > before ? `· <span style="color:#b0124f">LEVEL UP! Level ${after.level}</span>` : `· Level ${after.level}`}
    <div class="xpbar"><i style="width:${(after.into / after.need) * 100}%"></i></div>
    ${newChars.map((c) => `Unlocked <b>${c.name}</b>!`).join(' ')}</div>`;
  const o = state.online;
  const actions = !o
    ? `<div class="actions"><button class="btn teal" data-action="again" data-mode="${r.mode}">Play again</button><button class="btn play" data-action="tolobby">Lobby</button></div>`
    : o.role === 'host'
      ? '<div class="actions"><button class="btn teal" data-action="online-again">Play again</button><button class="btn play" data-action="online-room">Back to room</button></div>'
      : '<div class="actions"><span class="wait-host">Waiting for the host…</span><button class="btn play" data-action="online-leave">Leave room</button></div>';

  if (r.mode === 'score') {
    const entries = board();
    const mm = Math.floor(r.elapsed / 60);
    const ss = String(Math.floor(r.elapsed % 60)).padStart(2, '0');
    openModal(
      `<header>Kitchen Closed!</header><div class="body">
        <div class="result-hero"><div class="big">$${r.money}</div>${rank === 0 ? '<b style="color:#b0124f">New #1 this week!</b>' : rank > 0 ? `<b>#${rank + 1} this week</b>` : ''}</div>
        <div class="stats"><div class="stat"><b>${r.served}</b><small>Served</small></div><div class="stat"><b>${r.lost}</b><small>Walked out</small></div><div class="stat"><b>${mm}:${ss}</b><small>Time</small></div></div>
        ${xpBlock}
        <h3>This week's board</h3>${boardHtml(entries, rank)}
        ${actions}</div>`,
      { closable: false },
    );
  } else {
    const [a, b] = r.players;
    const winner = a.money === b.money ? null : a.money > b.money ? a : b;
    const pl = (p) => `<div class="pl ${winner === p ? 'win' : ''}"><img src="${portraits[p.charId]}" alt=""><b>${escapeHtml(p.name)}</b><b class="amt">$${p.money}</b><small>${p.served} served</small></div>`;
    openModal(
      `<header class="pink">Showdown Over!</header><div class="body">
        <div class="winner">${winner ? `${escapeHtml(winner.name)} wins!` : "It's a draw!"}</div>
        <div class="versus-result">${pl(a)}${pl(b)}</div>
        ${xpBlock}${actions}</div>`,
      { closable: false },
    );
  }
}

function boardHtml(entries, highlight = -1) {
  if (!entries.length) return '<ol class="board"><li class="empty">No scores yet this week. Be the first!</li></ol>';
  return `<ol class="board">${entries
    .map((e, i) => `<li class="${i === highlight ? 'me' : ''}"><span>${escapeHtml(e.name)}</span><small>${e.served} served · ${LEVELS[e.level]?.name || ''}</small><b>$${e.score}</b></li>`)
    .join('')}</ol>`;
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* ---------- modals ---------- */

let modalClosable = true;
function openModal(html, { closable = true } = {}) {
  modalClosable = closable;
  $('#modal .panel').innerHTML = html;
  if (closable) $('#modal .panel > header')?.insertAdjacentHTML('beforeend', '<button class="close" data-action="close" aria-label="Close">✕</button>');
  $('#modal').classList.remove('hidden');
}

function closeModal() {
  $('#modal').classList.add('hidden');
}

const modalOpen = () => !$('#modal').classList.contains('hidden');

function helpHtml(levelId) {
  const lv = LEVELS[levelId];
  const tabs = Object.values(LEVELS)
    .map((l) => `<button class="pill ${l.id === levelId ? 'on' : ''}" data-action="helptab" data-level="${l.id}">${l.name}</button>`)
    .join('');
  const recipes = Object.entries(lv.menu)
    .map(([id, m]) => `<div class="recipe"><div class="ico">${dishIcon(id)}</div><div><b>${m.name}</b><small>${m.steps.map((s) => lv.stations.find((st) => st.gives === s)?.name || (COMP_NAMES[s] ? `${COMP_NAMES[s]} (belt)` : s)).join(' → ')}</small></div><span class="price">$${m.price}</span></div>`)
    .join('');
  return `<header class="teal">How to Play</header><div class="body">
    <ol>
      <li>Grab a <b>tray</b> from the tray stack. The tray goes to the customer with their food, so take a fresh one for every order.</li>
      <li>Walk up to stations and <b>add</b> food to your tray. ${
        { sushi: 'Every sushi starts with <b>rice</b>; toppings and nori go on the latest rice.', street: 'Every sushi starts with <b>rice</b>. Fish rides past on the <b>conveyor belt</b> up front: grab it as it goes by.', burger: 'Every burger starts with a <b>bun</b>; patty, cheese and lettuce stack on the latest bun.', happy: 'Each drink or treat is its own item.' }[levelId]
      }</li>
      <li><b>Cookers</b> (${[...new Set(lv.stations.filter((s) => s.kind === 'batch').map((s) => s.name))].join(', ')}) must be started first, then make several servings. <b>Hold</b> the button to slice or pour.</li>
      <li>Serve customers at the counter before their patience runs out. Faster service means bigger tips.</li>
      <li>Set a tray down on a spare <b>plate</b> to prep ahead or park food nobody needs yet, then pick it up later.</li>
      <li>Messed up? Toss the whole tray in the <b>recycle bin</b>.</li>
    </ol>
    <h3>Menu</h3><div class="tabs">${tabs}</div><div class="recipes">${recipes}</div>
    <h3>Controls</h3>
    <div class="keys-grid">
      <span>Solo</span><span><kbd>WASD</kbd> / <kbd>Arrows</kbd> move · <kbd>Space</kbd> <kbd>E</kbd> <kbd>Enter</kbd> interact (hold to slice/pour)</span>
      <span>Player 1</span><span><kbd>WASD</kbd> + <kbd>Space</kbd> / <kbd>E</kbd></span>
      <span>Player 2</span><span><kbd>Arrows</kbd> + <kbd>Enter</kbd> / <kbd>Right Shift</kbd></span>
      <span>Touch</span><span>Left stick moves, hand button interacts</span>
      <span>Menu</span><span><kbd>Esc</kbd> opens this help and pauses</span>
    </div>
    <h3>Modes</h3>
    <p><b>Score Attack</b>: three hearts, endless customers. Each walk-out costs a heart. Add a local player 2 to cook together. Scores go on the weekly board, which resets every Sunday.<br><b>Versus</b>: two minutes, shared customers, whoever earns the most wins.</p>
  </div>`;
}

function openHelp(levelId) {
  openModal(helpHtml(levelId || state.game?.level.id || save.data.kitchen[state.front]));
}

function openUnlocks() {
  const lv = levelFromXp(save.data.xp);
  openModal(`<header class="teal">Unlocks <small style="font-size:16px">Level ${lv.level}</small></header><div class="body">
    <p>Earn XP from every shift: each dollar is 1 XP. Level up to unlock new chefs.</p>
    <div class="chars">${CHARACTERS.map((c) => `<div class="tile ${c.tier} ${isUnlocked(c) ? '' : 'locked'}"><img src="${portraits[c.id]}" alt="${c.name}"><span class="need">${isUnlocked(c) ? '✓' : `LV ${c.level}`}</span><span class="tier ${c.tier}">${c.name}</span></div>`).join('')}</div>
  </div>`);
}

function openBoard() {
  openModal(`<header>Weekly Leaderboard</header><div class="body"><p>Resets every Sunday. Top 10 Score Attack runs on this device.</p>${boardHtml(board())}</div>`);
}

/* ---------- events ---------- */

document.addEventListener('click', (e) => {
  sfx.unlock();
  const back = e.target.closest('.card.back');
  if (back) {
    sfx.click();
    return setFront(back.dataset.mode);
  }
  if (e.target.id === 'modal' && modalClosable) return closeModal();
  const b = e.target.closest('[data-action]');
  if (!b || b.disabled) return;
  const a = b.dataset.action;
  if (!['play', 'again'].includes(a)) sfx.click();
  switch (a) {
    case 'prev':
      return cycleP1(-1);
    case 'next':
      return cycleP1(1);
    case 'prev2':
      return cycleP2(-1);
    case 'next2':
      return cycleP2(1);
    case 'join':
      state.p2 = state.idx2 === state.idx1 ? (state.idx1 + 1) % CHARACTERS.length : state.idx2;
      if (!isUnlocked(CHARACTERS[state.p2])) state.p2 = CHARACTERS.findIndex((c, i) => i !== state.idx1 && isUnlocked(c));
      setLobbyChar(1, state.p2);
      return refreshLobby();
    case 'leave':
      state.p2 = null;
      setLobbyChar(1, null);
      return refreshLobby();
    case 'play':
      return openStages(b.dataset.mode);
    case 'stage':
      sfx.go();
      return startGame(state.stageMode, b.dataset.level);
    case 'stage-back':
      closeStages();
      return showLobby();
    case 'again':
      sfx.go();
      return startGame(b.dataset.mode, state.lastLevel);
    case 'tolobby':
      closeModal();
      disposeGame();
      return showLobby();
    case 'quit':
      if (state.online) return state.online.role === 'host' ? backToRoom() : leaveOnline();
      disposeGame();
      return showLobby();
    case 'online':
      return openOnline();
    case 'host-room':
      return hostRoom();
    case 'join-room':
      return joinRoom();
    case 'online-mode':
      state.online.mode = b.dataset.mode;
      return syncRoom();
    case 'online-stage':
      state.online.level = b.dataset.level;
      return syncRoom();
    case 'online-start':
      return hostStart();
    case 'online-again':
      closeModal();
      disposeGame();
      return hostStart();
    case 'online-room':
      return backToRoom();
    case 'online-leave':
      return leaveOnline();
    case 'copy-link': {
      const link = b.dataset.link;
      if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => (b.textContent = 'Copied!'), () => prompt('Copy this link', link));
      else prompt('Copy this link', link);
      return;
    }
    case 'cpu':
      if (state.p2 != null) return;
      state.cpu = { easy: 'normal', normal: 'hard', hard: 'easy' }[state.cpu];
      return refreshLobby();
    case 'board':
      return openBoard();
    case 'unlocks':
      return openUnlocks();
    case 'help':
      return openHelp();
    case 'helptab':
      return openHelp(b.dataset.level);
    case 'close':
      return closeModal();
    case 'sound':
      sfx.enabled = !sfx.enabled;
      save.data.sound = sfx.enabled;
      save.write();
      return updateSoundBtn();
  }
});

addEventListener('keydown', (e) => {
  sfx.unlock();
  if (e.code === 'Escape') {
    if (modalOpen()) modalClosable && closeModal();
    else if (state.screen === 'game') openHelp();
  }
  if (state.screen === 'lobby' && !modalOpen() && !(e.target instanceof HTMLInputElement)) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') cycleP1(-1);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') cycleP1(1);
    if (e.code === 'Enter') openStages(state.front);
  } else if (state.screen === 'stages' && !modalOpen()) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') moveStage(-1);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') moveStage(1);
    if (e.code === 'Enter' || e.code === 'Space') {
      sfx.go();
      startGame(state.stageMode, LEVEL_ORDER[state.stageIdx]);
    }
    if (e.code === 'Escape') {
      closeStages();
      showLobby();
    }
  }
});

$('.who .name').addEventListener('input', (e) => {
  save.data.name = e.target.value.trim().slice(0, 14) || 'Chef';
  save.write();
});

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  lobby.camera.aspect = innerWidth / innerHeight;
  lobby.camera.updateProjectionMatrix();
  layoutLobby();
  state.game?.resize(innerWidth, innerHeight);
}
addEventListener('resize', resize);

/* ---------- loop ---------- */

sfx.enabled = save.data.sound !== false;
fillStatic();
resize();
showLobby();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  if (state.screen === 'lobby') {
    tickLobby(dt, t);
    renderer.render(lobby.scene, lobby.camera);
  } else if (state.screen === 'stages') {
    renderer.clear();
  } else if (state.game) {
    const g = state.game;
    const paused = modalOpen() && g.phase !== 'over' && !state.online;
    if (!paused) g.update(dt);
    updateHud();
    renderer.render(g.scene, g.camera);
    netTick(now);
  }
  kb.endFrame();
  touch?.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const roomParam = new URLSearchParams(location.search).get('room');
if (roomParam) {
  history.replaceState(null, '', location.pathname);
  openOnline(roomParam.toUpperCase().slice(0, 4));
}

if (import.meta.env.DEV) window.__cs = { state, startGame, Bot };
