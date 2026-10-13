import { KITCHEN } from './maps.js';

const sameTarget = (a, b) => a && b && a.type === b.type && a.st === b.st && a.seat === b.seat;

export class Bot {
  constructor(game, player, skill = 0.65) {
    this.g = game;
    this.p = player;
    this.skill = skill;
    this.speedMul = 0.7 + skill * 0.28;
    this.wait = 0.6 + (1 - skill);
    this.job = null;
    this.si = 0;
    this.lastRev = 0;
    this.pending = null;
    this.goalKey = '';
    this.goalT = 0;
  }

  think(dt) {
    const out = { x: 0, z: 0, press: false, held: false };
    const p = this.p;
    if (this.wait > 0) {
      this.wait -= dt;
      return out;
    }
    const goal = this.decide();
    p.botTarget = goal?.target || null;
    p.faceTo = null;
    if (!goal) return out;

    const key = goal.target ? (goal.target.st?.cfg.id || `seat${goal.target.seat.x}`) + goal.verb : 'idle';
    this.goalT = key === this.goalKey ? this.goalT + dt : 0;
    this.goalKey = key;
    if (this.goalT > (goal.verb === 'wait' ? 12 : 5)) return this.reset();

    const dx = goal.ip.x - p.pos.x;
    const dz = goal.ip.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    const inReach = goal.target?.st?.cfg.kind !== 'belt' && d < 0.7 && sameTarget(p.target, goal.target);
    if (d > 0.2 && !inReach) {
      const s = Math.min(1, d / 0.6 + 0.35);
      out.x = (dx / d) * s;
      out.z = (dz / d) * s;
      return out;
    }
    if (goal.look) p.faceTo = Math.atan2(goal.look.x - p.pos.x, goal.look.z - p.pos.z);
    if (!sameTarget(p.target, goal.target)) return out;
    if (goal.verb === 'hold') out.held = true;
    else if (goal.verb === 'press') {
      out.press = true;
      this.wait = 0.12 + (1 - this.skill) * 0.55 + Math.random() * 0.15;
    }
    return out;
  }

  reset() {
    this.job = null;
    this.pending = null;
    this.si = 0;
    this.goalT = 0;
    this.trashFirst = !!this.p.tray?.items.length;
    this.wait = 0.3;
    return { x: 0, z: 0, press: false, held: false };
  }

  stationGoal(st, verb) {
    return { target: { type: 'station', st }, ip: st.ip, look: { x: st.pos.x, z: st.pos.z }, verb };
  }

  nearest(list) {
    const p = this.p;
    let best = null;
    let bd = Infinity;
    for (const st of list) {
      const d = Math.hypot(st.ip.x - p.pos.x, st.ip.z - p.pos.z);
      if (d < bd) {
        bd = d;
        best = st;
      }
    }
    return best;
  }

  chooseSource(comp) {
    const p = this.p;
    let best = null;
    let bs = Infinity;
    for (const st of this.g.stations) {
      const isBelt = st.cfg.kind === 'belt' && st.cfg.pool.includes(comp);
      if (st.cfg.gives !== comp && !isBelt) continue;
      const ip = this.g.ipFor(st, p.pos.x);
      const d = Math.hypot(ip.x - p.pos.x, ip.z - p.pos.z) * 0.4;
      let s = d;
      if (isBelt) s += st.items.some((it) => it.comp === comp) ? 0 : 3;
      if (st.cfg.kind === 'batch') s += st.state === 'ready' ? 0 : st.state === 'cooking' ? 1 + (st.cfg.time - st.timer) : 3 + st.cfg.time;
      if (st.holder && st.holder !== p) s += 4;
      if (s < bs) {
        bs = s;
        best = st;
      }
    }
    return best;
  }

  beltGoal(st, comp) {
    const p = this.p;
    const lead = 0.25 + (1 - this.skill) * 0.2;
    let item = null;
    let bs = Infinity;
    for (const it of st.items) {
      if (it.comp !== comp || it.x > KITCHEN.maxX + 0.2) continue;
      const eta = Math.abs(it.x - p.pos.x) / (4.4 * this.speedMul);
      const s = Math.abs(it.x + st.cfg.speed * eta - p.pos.x);
      if (s < bs) {
        bs = s;
        item = it;
      }
    }
    const target = { type: 'station', st };
    const look = { x: p.pos.x, z: st.pos.z + 1 };
    if (!item) return { target, ip: { x: Math.max(KITCHEN.minX, -1.5), z: KITCHEN.maxZ }, look, verb: 'wait' };
    const x = Math.min(KITCHEN.maxX, Math.max(KITCHEN.minX, item.x + lead));
    this.pending = comp;
    const nearest = this.g.beltItemNear(st, p.pos.x);
    const ready = nearest === item && p.pos.z > KITCHEN.maxZ - 0.3;
    return { target, ip: { x, z: KITCHEN.maxZ }, look, verb: ready ? 'press' : 'wait' };
  }

  pickCustomer() {
    let best = null;
    let bs = Infinity;
    for (const seat of this.g.seats) {
      const c = seat.customer;
      if (c?.state !== 'waiting' || !c.remaining.length) continue;
      const s = c.patience + c.remaining.length * 4 + Math.random() * 8 * (1.2 - this.skill);
      if (s < bs) {
        bs = s;
        best = seat;
      }
    }
    return best;
  }

  decide() {
    const g = this.g;
    const p = this.p;

    if (!p.tray) {
      this.job = null;
      this.pending = null;
      this.trashFirst = false;
      return this.stationGoal(this.nearest(g.stations.filter((s) => s.cfg.kind === 'tray')), 'press');
    }

    if (p.tray.rev !== this.lastRev) {
      this.lastRev = p.tray.rev;
      if (this.pending && this.job) {
        this.si++;
        const steps = g.level.menu[this.job.queue[0]].steps;
        if (this.si >= steps.length) {
          this.job.queue.shift();
          this.si = 0;
        }
      }
      this.pending = null;
      this.wait = 0.08 + (1 - this.skill) * 0.25;
    }

    if (this.trashFirst) {
      if (!p.tray.items.length) this.trashFirst = false;
      else return this.stationGoal(this.nearest(g.stations.filter((s) => s.cfg.kind === 'trash')), 'press');
    }

    const job = this.job;
    if (job && (job.seat.customer !== job.customer || job.customer.state !== 'waiting')) {
      this.job = null;
      this.si = 0;
      this.pending = null;
    }

    if (!this.job) {
      if (p.tray.items.length) {
        const ids = p.tray.items.map((it) => g.level.dishId(it));
        const seat = g.seats.find((s) => s.customer?.state === 'waiting' && s.customer.remaining.some((r) => ids.includes(r)));
        if (seat) this.job = { seat, customer: seat.customer, queue: [] };
        else {
          this.trashFirst = true;
          return this.stationGoal(this.nearest(g.stations.filter((s) => s.cfg.kind === 'trash')), 'press');
        }
      } else {
        const seat = this.pickCustomer();
        if (!seat) {
          const idle = g.stations.filter((s) => s.cfg.kind === 'batch' && s.state === 'idle');
          if (idle.length) return this.stationGoal(this.nearest(idle), 'press');
          return { target: null, ip: { x: 0, z: 0.4 }, verb: 'none' };
        }
        this.job = { seat, customer: seat.customer, queue: seat.customer.remaining.slice(0, 3) };
        this.si = 0;
      }
    }

    const j = this.job;
    if (j.queue.length) {
      const comp = g.level.menu[j.queue[0]].steps[this.si];
      const st = this.chooseSource(comp);
      if (!st) return this.reset();
      if (st.cfg.kind === 'belt') return this.beltGoal(st, comp);
      if (st.cfg.kind === 'batch') {
        if (st.state === 'idle') return this.stationGoal(st, 'press');
        if (st.state === 'cooking') return this.stationGoal(st, 'wait');
        this.pending = comp;
        return this.stationGoal(st, 'press');
      }
      this.pending = comp;
      if (st.holder && st.holder !== p) return this.stationGoal(st, 'wait');
      return this.stationGoal(st, st.cfg.kind === 'hold' ? 'hold' : 'press');
    }

    this.pending = null;
    return { target: { type: 'seat', seat: j.seat }, ip: j.seat.ip, look: { x: j.seat.x, z: KITCHEN.counterZ }, verb: 'press' };
  }
}
