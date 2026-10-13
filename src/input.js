const SCHEMES = {
  solo: { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], act: ['Space', 'KeyE', 'Enter', 'KeyJ'] },
  p1: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], act: ['Space', 'KeyE'] },
  p2: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], act: ['Enter', 'ShiftRight', 'Slash', 'Numpad0', 'NumpadEnter'] },
};

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

export function keyController(kb, schemeName, touch = null) {
  const s = SCHEMES[schemeName];
  const any = (codes) => codes.some((c) => kb.down.has(c));
  const anyPressed = (codes) => codes.some((c) => kb.pressed.has(c));
  return {
    read() {
      let x = (any(s.right) ? 1 : 0) - (any(s.left) ? 1 : 0);
      let z = (any(s.down) ? 1 : 0) - (any(s.up) ? 1 : 0);
      let press = anyPressed(s.act);
      let held = any(s.act);
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
