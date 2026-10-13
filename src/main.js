import * as THREE from 'three';
import { CHARACTERS, buildCharacter, poseIdle, buildLobbyStage } from './models.js';
import { Game, PLAYER_COLORS } from './game.js';
import { Bot } from './bot.js';
import { LEVELS, LEVEL_ORDER, MODES, COMP_NAMES } from './levels.js';
import { Keyboard, Touch, makeController, CONTROL_IDS, CONTROL_LABELS, connectedPads, padJoinPresses } from './input.js';
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
  locals: [],
  p1ctrl: 'p1',
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
  const slots = Array.from({ length: 4 }, () => ({ stage: buildLobbyStage(scene), model: null, hop: 0, idx: null }));
  return { scene, camera, slots, slotScreen: [] };
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

const LOCAL_X = [0.3, 0.58, 0.86];

function layoutLobby() {
  const a = innerWidth / innerHeight;
  const halfW = lobby.camera.position.z * Math.tan(THREE.MathUtils.degToRad(15)) * a;
  const narrow = innerWidth <= 820 || innerHeight <= 560;
  const x1 = narrow ? 0 : 0.04 * halfW * 2;
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
  const depth = (6.6 + 1.2) / 6.6;
  lobby.slots.forEach((s, k) => {
    const x = k === 0 ? x1 : LOCAL_X[k - 1] * halfW * depth;
    const z = k === 0 ? 0 : -1.2;
    s.stage.position.set(x, 0, z);
    if (s.model) {
      s.model.root.position.set(x, s.model.root.position.y, z);
      s.model.root.scale.setScalar(k === 0 ? 1 : 0.8);
      s.model.root.visible = k === 0 || !narrow;
    }
    if (k > 0 && narrow) s.stage.visible = false;
  });
  lobby.camera.updateMatrixWorld();
  lobby.slotScreen = lobby.slots.map((s) => {
    const v = s.stage.position.clone().project(lobby.camera);
    return { x: Math.round(((v.x + 1) / 2) * innerWidth), y: Math.round(((1 - v.y) / 2) * innerHeight) };
  });
  if ($('.local-slots')) renderLocalSlots();
}

function tickLobby(dt, t) {
  lobby.slots.forEach((s, i) => {
    if (!s.model) return;
    poseIdle(s.model.rig, t + i * 1.7);
    s.hop = Math.max(0, s.hop - dt);
    s.model.root.position.y = Math.sin((s.hop / 0.35) * Math.PI) * 0.25;
    if (i > 0) s.model.root.position.x = s.stage.position.x;
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

  const humans = 1 + state.locals.length;
  const diff = `${state.cpu[0].toUpperCase()}${state.cpu.slice(1)}`;
  $('.opp').textContent = humans === 1 ? `vs CPU · ${diff}` : humans % 2 ? `${humans} players + CPU · ${diff}` : `${humans} players · ${humans / 2} vs ${humans / 2}`;

  const entries = board();
  const mine = entries.findIndex((e) => e.name === save.data.name);
  $('.best-rank').textContent = mine >= 0 ? mine + 1 : '–';

  renderLocalSlots();
}

const JOIN_SVG = `<svg viewBox="0 0 120 220" aria-hidden="true"><path d="M60 8c-16 0-30 6-34 20-14 0-20 14-12 26 6 9 14 10 20 9v6c-4 8-6 14-6 24-12 8-20 22-22 42l-2 28h18l4-24 4 0v58l-10 6v10h28l6-36 6 36h28v-10l-10-6v-58h4l4 24h18l-2-28c-2-20-10-34-22-42 0-10-2-16-6-24v-6c6 1 14 0 20-9 8-12 2-26-12-26C90 14 76 8 60 8z" fill="rgba(0,0,0,.12)" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><path d="M60 104v34M43 121h34" stroke="#fff" stroke-width="8" stroke-linecap="round"/></svg>`;

function ctrlLabel(id) {
  const missing = id.startsWith('pad') && !connectedPads().includes(Number(id.slice(3)));
  return `Controls: ${CONTROL_LABELS[id]}${missing ? ' (not connected)' : ''}`;
}

function usedCtrls(except = -1) {
  return [state.p1ctrl, ...state.locals.map((l) => l.ctrl)].filter((_, i) => i !== except);
}

function freeCtrl(prefer) {
  const used = new Set(usedCtrls());
  const pads = connectedPads().map((i) => `pad${i}`);
  return [prefer, ...pads, 'p2', 'p3', 'p4', 'p1', ...CONTROL_IDS].find((c) => c && !used.has(c)) || 'p2';
}

function cycleCtrl(k) {
  const options = CONTROL_IDS.filter((c) => !usedCtrls(k).includes(c));
  const current = k ? state.locals[k - 1].ctrl : state.p1ctrl;
  const next = options[(options.indexOf(current) + 1) % options.length];
  if (k) state.locals[k - 1].ctrl = next;
  else state.p1ctrl = next;
  renderLocalSlots();
}

function syncLocalModels() {
  for (let k = 1; k <= 3; k++) {
    const l = state.locals[k - 1];
    const idx = l ? l.idx : null;
    if (lobby.slots[k].idx === idx) continue;
    lobby.slots[k].idx = idx;
    setLobbyChar(k, idx);
  }
}

function addLocal(ctrl) {
  if (state.locals.length >= 3) return;
  const used = new Set([state.idx1, ...state.locals.map((l) => l.idx)]);
  let idx = CHARACTERS.findIndex((c, i) => !used.has(i) && isUnlocked(c));
  if (idx < 0) idx = CHARACTERS.findIndex((c) => isUnlocked(c));
  state.locals.push({ idx, ctrl: ctrl || freeCtrl(['p2', 'p3', 'p4'][state.locals.length]) });
  sfx.arrive();
  syncLocalModels();
  refreshLobby();
}

function removeLocal(k) {
  state.locals.splice(k - 1, 1);
  syncLocalModels();
  refreshLobby();
}

function cycleLocalChar(k, dir) {
  const l = state.locals[k - 1];
  const n = CHARACTERS.length;
  let i = l.idx;
  for (let step = 0; step < n; step++) {
    i = (i + dir + n) % n;
    if (isUnlocked(CHARACTERS[i])) break;
  }
  l.idx = i;
  syncLocalModels();
  refreshLobby();
}

function renderLocalSlots() {
  const wrap = $('.local-slots');
  const pos = lobby.slotScreen;
  const n = state.locals.length;
  let html = '';
  for (let k = 1; k <= 3; k++) {
    const p = pos[k];
    if (!p) continue;
    if (k <= n) {
      const l = state.locals[k - 1];
      html += `<div class="lslot" style="left:${p.x}px;top:${p.y + 6}px">
        <div class="ltag" style="--c:${PLAYER_COLORS[k]}">P${k + 1} · ${CHARACTERS[l.idx].name}</div>
        <div class="arrows"><button class="round-btn mini" data-action="lprev" data-slot="${k}" aria-label="Previous chef">${UI_ICONS.left}</button><button class="round-btn mini" data-action="lnext" data-slot="${k}" aria-label="Next chef">${UI_ICONS.right}</button></div>
        <button class="pill" data-action="lctrl" data-slot="${k}">${ctrlLabel(l.ctrl)}</button>
        <button class="leave" data-action="lremove" data-slot="${k}">Remove</button>
      </div>`;
    } else if (k === n + 1) {
      html += `<button class="lslot join" data-action="ljoin" style="left:${p.x}px;top:${p.y}px">${JOIN_SVG}<span>Add player ${k + 1}</span><small>or press A on a gamepad</small></button>`;
    }
  }
  wrap.innerHTML = html;
  const p1 = $('.p1ctl');
  p1.classList.toggle('hidden', !n);
  p1.textContent = ctrlLabel(state.p1ctrl);
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

function showLobby() {
  state.screen = 'lobby';
  document.body.classList.add('in-lobby');
  $('#lobby').classList.remove('hidden');
  $('#hud').classList.add('hidden');
  $('#touch').classList.add('hidden');
  renderer.setClearColor(0x000000, 0);
  setLobbyChar(0, state.idx1, { silhouette: !isUnlocked(CHARACTERS[state.idx1]) });
  lobby.slots.forEach((s, k) => k && (s.idx = undefined));
  syncLocalModels();
  refreshLobby();
}

/* ---------- game ---------- */

function lineup(modeId) {
  const list = [{ name: save.data.name || 'Chef', charId: CHARACTERS[state.idx1].id }, ...state.locals.map((l, i) => ({ name: `Player ${i + 2}`, charId: CHARACTERS[l.idx].id }))];
  if (modeId === 'versus' && list.length % 2) {
    const taken = new Set(list.map((p) => p.charId));
    if (!state.cpuChar || taken.has(state.cpuChar)) {
      const pool = CHARACTERS.filter((c) => !taken.has(c.id));
      state.cpuChar = (pool.length ? pool : CHARACTERS)[Math.floor(Math.random() * (pool.length || CHARACTERS.length))].id;
    }
    state.cpuName ||= CPU_NAMES[Math.floor(Math.random() * CPU_NAMES.length)];
    list.push({ name: state.cpuName, charId: state.cpuChar, cpu: true });
  }
  return list;
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
  const lu = lineup(modeId);
  const humans = 1 + state.locals.length;
  $('.stage-sub').textContent =
    modeId === 'versus'
      ? humans === 1
        ? `VS CPU · ${state.cpu.toUpperCase()}`
        : `LOCAL VERSUS · ${lu.length / 2} VS ${lu.length / 2}`
      : humans > 1
        ? `CO-OP SCORE ATTACK · ${humans} CHEFS`
        : 'SCORE ATTACK';
  const sp = $('.stage-players');
  sp.classList.toggle('many', lu.length > 2);
  const order = modeId === 'versus' ? [...lu.filter((_, i) => i % 2 === 0), ...lu.filter((_, i) => i % 2 === 1)] : lu;
  sp.innerHTML = order.map((p) => `<div class="sp ${modeId === 'versus' && lu.indexOf(p) % 2 ? 'teal' : 'red'}"><img src="${portraits[p.charId]}" alt=""><b>${escapeHtml(p.name)}</b></div>`).join('');
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
  const players = lineup(modeId).map((p, i) =>
    p.cpu
      ? { name: p.name, charId: p.charId, bot: true }
      : { name: p.name, charId: p.charId, controller: makeController(i === 0 ? (state.locals.length ? state.p1ctrl : 'solo') : state.locals[i - 1].ctrl, kb, i === 0 ? touch : null) },
  );
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
  if (modeId === 'versus')
    for (const t of [0, 1]) {
      const members = game.players.filter((p) => p.team === t);
      const pics = members.map((p) => `<img src="${portraits[p.charId]}" alt="">`).join('');
      $(t ? '.vsbar .teal .pics' : '.vsbar .red .pics').innerHTML = pics;
      $(t ? '.vs-side.right' : '.vs-side.left').innerHTML = pics;
      $(t ? '.n2' : '.n1').textContent = members.map((p) => p.name).join(' & ');
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
    .map((r, i) => `<div class="rp"><img src="${portraits[cleanChar(r.charId)]}" alt=""><b>${escapeHtml(r.name)}</b><small>${i === 0 ? 'Host' : r.id === o.myId ? 'You' : 'Guest'}</small>${o.mode === 'versus' ? `<span class="team-tag ${i % 2 ? 'teal' : 'red'}">${i % 2 ? 'Teal' : 'Red'}</span>` : ''}</div>`)
    .join('');
  const empty = Array.from({ length: Math.max(0, 2 - o.roster.length) }, () => '<div class="rp empty"><span>+</span><small>Waiting…</small></div>').join('');
  const modes = [
    ['score', o.roster.length > 1 ? 'Co-op Score Attack' : 'Score Attack'],
    ['versus', 'Versus'],
  ];
  const opts = host
    ? `<div class="room-opts">
        <div><span>Mode</span>${modes.map(([id, name]) => `<button class="pill ${o.mode === id ? 'on' : ''}" data-action="online-mode" data-mode="${id}">${name}</button>`).join('')}</div>
        <div><span>Stage</span>${LEVEL_ORDER.map((id) => `<button class="pill ${o.level === id ? 'on' : ''}" data-action="online-stage" data-level="${id}">${LEVELS[id].name}</button>`).join('')}</div>
      </div>`
    : `<p class="room-info">${o.mode === 'versus' ? 'Versus' : 'Score Attack'} · ${LEVELS[o.level]?.name || ''}</p>`;
  const canStart = o.mode !== 'versus' || o.roster.length >= 2;
  const cpuNote = o.mode === 'versus' && o.roster.length % 2 && o.roster.length > 1 ? '<p class="note">Odd number of chefs: a CPU joins the Teal team.</p>' : '';
  openModal(
    `<header class="teal">Online Room</header><div class="body online">
      <div class="room-code"><small>ROOM CODE</small><b>${o.code}</b>
        <button class="pill" data-action="copy-link" data-link="${escapeHtml(link)}">Copy invite link</button></div>
      <p class="note">Send the code or link to your mate. They open the game from the same server and press <b>Join</b>.</p>
      <div class="roster">${roster}${empty}</div>
      ${opts}
      ${cpuNote}
      <p class="err">${escapeHtml(err)}</p>
      <div class="actions">
        ${host ? `<button class="btn teal" data-action="online-start" ${canStart ? '' : 'disabled'}>${canStart ? 'Start' : 'Versus needs 2+ players'}</button>` : '<span class="wait-host">Waiting for the host to start…</span>'}
        <button class="btn play" data-action="online-leave">Leave</button>
      </div>
    </div>`,
    { closable: false },
  );
}

function hostStart() {
  const o = state.online;
  if (o.mode === 'versus' && o.roster.length < 2) return renderRoom('Versus needs at least 2 players.');
  const players = o.roster.map((r) => ({ id: r.id, name: r.name, charId: r.charId }));
  if (o.mode === 'versus' && players.length % 2) {
    const taken = new Set(players.map((p) => p.charId));
    const pool = CHARACTERS.filter((c) => !taken.has(c.id));
    players.push({ id: -1, name: CPU_NAMES[Math.floor(Math.random() * CPU_NAMES.length)], charId: (pool[0] || CHARACTERS[0]).id, bot: true });
  }
  const msg = { k: 'start', mode: o.mode, level: o.level, players };
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
    controller: i === o.me ? makeController('solo', kb, touch) : null,
    bot: o.role === 'host' && !!p.bot,
    remote: o.role === 'host' && i !== o.me && !p.bot,
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
    const team = state.game.players[data.player]?.team ?? 0;
    const m = state.game.mode.id === 'score' ? $('.money') : $(team ? '.m2' : '.m1');
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
    const a = g.teamMoney(0);
    const b = g.teamMoney(1);
    $('.m1').textContent = `$${a}`;
    $('.m2').textContent = `$${b}`;
    $('.vsbar .red').classList.toggle('lead', a > b);
    $('.vsbar .teal').classList.toggle('lead', b > a);
    const secs = Math.ceil(g.timeLeft);
    const t = $('.timer b');
    if (t.textContent !== String(secs)) t.textContent = secs;
    $('.timer').classList.toggle('low', secs <= 10 && g.phase === 'play');
  }
}

const r_team = (p, i) => (p.team === 1 || p.team === 0 ? p.team : i % 2);

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
    players: (raw.players || []).map((p, i) => ({ name: cleanName(p.name), charId: cleanChar(p.charId), money: n(p.money), served: n(p.served), team: r_team(p, i) })),
  };
  if (r.mode === 'versus' && r.players.length < 2) r.players.push({ name: 'Nobody', charId: 'morel', money: 0, served: 0, team: 1 });
  const teamSum = (t) => r.players.reduce((sum, p) => sum + (p.team === t ? p.money : 0), 0);
  const me = state.online ? state.online.me : 0;
  const before = levelFromXp(save.data.xp).level;
  let xp = 0;
  let rank = -1;
  if (r.mode === 'score') {
    xp = r.money;
    const name = r.players.map((p) => p.name).join(' & ').slice(0, 40);
    rank = submitScore({ name, score: r.money, served: r.served, level: r.level });
  } else {
    const mine = teamSum(r.players[me].team);
    const theirs = teamSum(1 - r.players[me].team);
    xp = r.players[me].money + (mine > theirs ? 25 : mine === theirs ? 10 : 5);
  }
  save.data.xp += xp;
  save.write();
  const after = levelFromXp(save.data.xp);
  const newChars = CHARACTERS.filter((c) => c.level > before && c.level <= after.level);
  (r.mode === 'versus' && teamSum(r.players[me].team) >= teamSum(1 - r.players[me].team) ? sfx.win : sfx.end)();

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
    const teams = [0, 1].map((t) => ({ t, members: r.players.filter((p) => p.team === t), money: teamSum(t) }));
    const winner = teams[0].money === teams[1].money ? null : teams[0].money > teams[1].money ? 0 : 1;
    const solo = teams.every((tm) => tm.members.length === 1);
    const title = winner == null ? "It's a draw!" : solo ? `${escapeHtml(teams[winner].members[0].name)} wins!` : `${winner ? 'Teal' : 'Red'} team wins!`;
    const pl = (tm) => `<div class="pl ${winner === tm.t ? 'win' : ''}"><div class="pics">${tm.members.map((p) => `<img src="${portraits[p.charId]}" alt="">`).join('')}</div><b>${escapeHtml(tm.members.map((p) => p.name).join(' & '))}</b><b class="amt">$${tm.money}</b><small>${tm.members.map((p) => `${escapeHtml(p.name)}: ${p.served} served`).join(' · ')}</small></div>`;
    openModal(
      `<header class="pink">Showdown Over!</header><div class="body">
        <div class="winner">${title}</div>
        <div class="versus-result">${pl(teams[0])}${pl(teams[1])}</div>
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
      <span>Couch</span><span>Up to 4 chefs: add players with the <b>+</b> in the lobby (or press <kbd>A</kbd> on a gamepad) and pick each one's controls</span>
      <span>Layouts</span><span><kbd>WASD</kbd> + <kbd>Space</kbd> · <kbd>Arrows</kbd> + <kbd>Enter</kbd> · <kbd>IJKL</kbd> + <kbd>O</kbd> · <kbd>Numpad 8456</kbd> + <kbd>Num 0</kbd> · Gamepad stick/D-pad + <kbd>A</kbd></span>
      <span>Touch</span><span>Left stick moves, hand button interacts</span>
      <span>Menu</span><span><kbd>Esc</kbd> opens this help and pauses</span>
    </div>
    <h3>Modes</h3>
    <p><b>Score Attack</b>: three hearts, endless customers. Each walk-out costs a heart. Add a local player 2 to cook together. Scores go on the weekly board, which resets every Sunday.<br><b>Versus</b>: two minutes, shared customers, Red vs Teal (1v1 up to 2v2; an odd player count gets a CPU teammate). The team that earns the most wins.</p>
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
    case 'ljoin':
      return addLocal();
    case 'lremove':
      return removeLocal(Number(b.dataset.slot));
    case 'lprev':
      return cycleLocalChar(Number(b.dataset.slot), -1);
    case 'lnext':
      return cycleLocalChar(Number(b.dataset.slot), 1);
    case 'lctrl':
      return cycleCtrl(Number(b.dataset.slot));
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
    if (!modalOpen()) for (const i of padJoinPresses()) if (!usedCtrls().includes(`pad${i}`)) addLocal(`pad${i}`);
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
