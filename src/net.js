export class Net {
  constructor() {
    this.ws = null;
    this.handlers = {};
  }

  on(type, fn) {
    this.handlers[type] = fn;
    return this;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
      const ws = new WebSocket(url);
      this.ws = ws;
      let opened = false;
      ws.onopen = () => {
        opened = true;
        resolve();
      };
      ws.onerror = () => !opened && reject(new Error('unreachable'));
      ws.onclose = () => {
        if (this.ws === ws) this.ws = null;
        if (opened) this.handlers.close?.();
      };
      ws.onmessage = (e) => {
        let m;
        try {
          m = JSON.parse(e.data);
        } catch {
          return;
        }
        this.handlers[m.t]?.(m);
      };
    });
  }

  send(msg) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg));
  }

  close() {
    this.handlers = {};
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }
}

export function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
