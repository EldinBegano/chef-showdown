const KEY = 'chef-showdown.v1';

const DEFAULTS = { name: 'Chef', xp: 0, char: 'morel', char2: 'rocco', sound: true, kitchen: { score: 'sushi', versus: 'diner' }, board: { week: '', entries: [] }, best: 0 };

function read() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export const save = {
  data: read(),
  write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {}
  },
};

export function levelFromXp(xp) {
  let level = 1;
  let need = 100;
  let floor = 0;
  while (xp >= floor + need) {
    floor += need;
    level++;
    need = 100 + 50 * (level - 1);
  }
  return { level, into: xp - floor, need, toNext: floor + need - xp };
}

export function xpForLevel(target) {
  let total = 0;
  for (let l = 1; l < target; l++) total += 100 + 50 * (l - 1);
  return total;
}

export function weekKey(d = new Date()) {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
}

export function board() {
  const b = save.data.board;
  if (b.week !== weekKey()) {
    save.data.board = { week: weekKey(), entries: [] };
    save.write();
  }
  return save.data.board.entries;
}

export function submitScore(entry) {
  const entries = board();
  const row = { ...entry, at: Date.now() };
  entries.push(row);
  entries.sort((a, b) => b.score - a.score);
  entries.length = Math.min(entries.length, 10);
  save.data.best = Math.max(save.data.best || 0, entry.score);
  save.write();
  return entries.indexOf(row);
}
