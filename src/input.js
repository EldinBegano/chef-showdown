const SCHEMES = {
  solo: { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], act: ['Space', 'KeyE', 'Enter', 'KeyJ'] },
  p1: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], act: ['Space', 'KeyE'] },
  p2: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], act: ['Enter', 'ShiftRight', 'Slash'] },
  p3: { up: ['KeyI'], down: ['KeyK'], left: ['KeyJ'], right: ['KeyL'], act: ['KeyO', 'KeyU'] },
  p4: { up: ['Numpad8'], down: ['Numpad5', 'Numpad2'], left: ['Numpad4'], right: ['Numpad6'], act: ['Numpad0', 'NumpadEnter', 'NumpadAdd'] },
};

export const CONTROL_LABELS = { p1: 'WASD', p2: 'Arrows', p3: 'IJKL', p4: 'Numpad', pad0: 'Gamepad 1', pad1: 'Gamepad 2', pad2: 'Gamepad 3', pad3: 'Gamepad 4' };
export const CONTROL_IDS = Object.keys(CONTROL_LABELS);

function padState(index) {
  const pad = navigator.getGamepads?.()[index];
  if (!pad?.connected) return null;
  let x = pad.axes[0] || 0;
  let z = pad.axes[1] || 0;
  if (Math.hypot(x, z) < 0.25) x = z = 0;
  const b = (i) => !!pad.buttons[i]?.pressed;
  if (b(14)) x = -1;
  if (b(15)) x = 1;
  if (b(12)) z = -1;
  if (b(13)) z = 1;
  return { x, z, held: b(0) || b(2) };
}

export function connectedPads() {
  return [...(navigator.getGamepads?.() || [])].filter((p) => p?.connected).map((p) => p.index);
}

const lobbyPadPrev = new Map();
export function padJoinPresses() {
  const out = [];
  for (const i of connectedPads()) {
    const held = !!padState(i)?.held;
    if (held && !lobbyPadPrev.get(i)) out.push(i);
    lobbyPadPrev.set(i, held);
  }
  return out;
}

export class Keyboard {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
  }
  endFrame() {
    this.pressed.clear();
  }
}

export class Touch {
  constructor(root) {
    this.x = 0;
    this.z = 0;
    this.held = false;
    this.pressed = false;
    this.root = root;
    const stick = root.querySelector('.stick');
    const knob = root.querySelector('.knob');
    const btn = root.querySelector('.act');
    let id = null;
    let cx = 0;
    let cy = 0;
    const R = 50;
    stick.addEventListener('pointerdown', (e) => {
      id = e.pointerId;
      const r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      stick.setPointerCapture(id);
      move(e);
    });
    const move = (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > R) {
        dx = (dx / len) * R;
        dy = (dy / len) * R;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.x = dx / R;
      this.z = dy / R;
    };
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      this.x = this.z = 0;
      knob.style.transform = '';
    };
    stick.addEventListener('pointermove', move);
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.held = true;
      this.pressed = true;
      btn.classList.add('on');
    });
    const up = () => {
      this.held = false;
      btn.classList.remove('on');
    };
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
  }
  endFrame() {
    this.pressed = false;
  }
}

export function makeController(id, kb, touch = null) {
  const s = SCHEMES[id];
  const pads = id === 'solo' ? [0] : id.startsWith('pad') ? [Number(id.slice(3))] : [];
  const any = (codes) => codes.some((c) => kb.down.has(c));
  const anyPressed = (codes) => codes.some((c) => kb.pressed.has(c));
  let padPrev = false;
  return {
    read() {
      let x = 0;
      let z = 0;
      let press = false;
      let held = false;
      if (s) {
        x = (any(s.right) ? 1 : 0) - (any(s.left) ? 1 : 0);
        z = (any(s.down) ? 1 : 0) - (any(s.up) ? 1 : 0);
        press = anyPressed(s.act);
        held = any(s.act);
      }
      let padHeld = false;
      for (const i of pads) {
        const p = padState(i);
        if (!p) continue;
        if (p.x || p.z) {
          x = p.x;
          z = p.z;
        }
        padHeld ||= p.held;
      }
      press ||= padHeld && !padPrev;
      held ||= padHeld;
      padPrev = padHeld;
      if (touch) {
        if (Math.abs(touch.x) + Math.abs(touch.z) > 0.15) {
          x = touch.x;
          z = touch.z;
        }
        press ||= touch.pressed;
        held ||= touch.held;
      }
      const len = Math.hypot(x, z);
      if (len > 1) {
        x /= len;
        z /= len;
      }
      return { x, z, press, held };
    },
  };
}

export const keyController = (kb, scheme, touch = null) => makeController(scheme, kb, touch);
