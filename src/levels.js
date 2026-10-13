import { buildSushiBar, buildSushiStreet, buildBurgerDiner, buildHappyHour, buildWirtshaus } from './maps.js';

export const TRAY_CAP = 3;

const SUSHI_TOPS = ['salmon', 'tamago', 'tuna', 'ebi', 'cucumber'];

function sushiDishId(d) {
  if (d.kind !== 'sushi') return d.kind;
  if (d.nori && d.top) return `${d.top}_maki`;
  if (d.nori) return 'onigiri';
  if (d.top) return `${d.top}_nigiri`;
  return 'rice';
}

function sushiCompose(items, comp) {
  const next = items.map((d) => ({ ...d }));
  if (comp === 'rice') {
    if (next.length >= TRAY_CAP) return { error: 'Tray is full!' };
    next.push({ kind: 'sushi', top: null, nori: false });
    return { items: next };
  }
  if (SUSHI_TOPS.includes(comp)) {
    const d = next.findLast((x) => x.kind === 'sushi' && !x.top);
    if (!d) return { error: 'Add rice first!' };
    d.top = comp;
    return { items: next };
  }
  if (comp === 'nori') {
    const d = next.findLast((x) => x.kind === 'sushi' && !x.nori);
    if (!d) return { error: 'Add rice first!' };
    d.nori = true;
    return { items: next };
  }
  if (next.length >= TRAY_CAP) return { error: 'Tray is full!' };
  next.push({ kind: comp });
  return { items: next };
}

const BURGER_IDS = { '': 'bun', P: 'burger', PC: 'cheeseburger', PL: 'garden', PCL: 'deluxe' };
const BURGER_PARTS = { patty: 'P', cheese: 'C', lettuce: 'L' };

function burgerDishId(d) {
  if (d.kind !== 'burger') return d.kind;
  const flags = ['P', 'C', 'L'].filter((f) => d[f]).join('');
  return BURGER_IDS[flags] || 'bun';
}

function burgerCompose(items, comp) {
  const next = items.map((d) => ({ ...d }));
  if (comp === 'bun') {
    if (next.length >= TRAY_CAP) return { error: 'Tray is full!' };
    next.push({ kind: 'burger', P: false, C: false, L: false });
    return { items: next };
  }
  const flag = BURGER_PARTS[comp];
  if (flag) {
    const d = next.findLast((x) => x.kind === 'burger' && !x[flag]);
    if (!d) return { error: 'Grab a bun first!' };
    d[flag] = true;
    return { items: next };
  }
  if (next.length >= TRAY_CAP) return { error: 'Tray is full!' };
  next.push({ kind: comp });
  return { items: next };
}

function austrianDishId(d) {
  if (d.kind === 'schnitzel') return d.fried ? 'schnitzel' : d.breaded ? 'schnitzel_breaded' : 'schnitzel_raw';
  if (d.kind === 'sacher') return d.cream ? 'sacher_schlag' : 'sacher';
  return d.kind;
}

function austrianCompose(items, comp) {
  const next = items.map((d) => ({ ...d }));
  const full = next.length >= TRAY_CAP;
  if (comp === 'meat') {
    if (full) return { error: 'Tray is full!' };
    next.push({ kind: 'schnitzel', breaded: false, fried: false });
    return { items: next };
  }
  if (comp === 'crumbs') {
    const d = next.findLast((x) => x.kind === 'schnitzel' && !x.breaded);
    if (!d) return { error: 'Pound some veal first!' };
    d.breaded = true;
    return { items: next };
  }
  if (comp === 'fry') {
    const d = next.findLast((x) => x.kind === 'schnitzel' && x.breaded && !x.fried);
    if (!d) return { error: next.some((x) => x.kind === 'schnitzel' && !x.breaded) ? 'Bread it first!' : 'Nothing to fry!' };
    d.fried = true;
    return { items: next };
  }
  if (comp === 'cream') {
    const d = next.findLast((x) => x.kind === 'sacher' && !x.cream);
    if (!d) return { error: 'Grab a slice of Sachertorte first!' };
    d.cream = true;
    return { items: next };
  }
  if (full) return { error: 'Tray is full!' };
  next.push(comp === 'sacher' ? { kind: 'sacher', cream: false } : { kind: comp });
  return { items: next };
}

function simpleCompose(items, comp) {
  if (items.length >= TRAY_CAP) return { error: 'Tray is full!' };
  return { items: [...items, { kind: comp }] };
}

export const COMP_NAMES = { salmon: 'Salmon', tuna: 'Tuna', ebi: 'Shrimp', cucumber: 'Cucumber', tamago: 'Tamago' };

export const LEVELS = {
  sushi: {
    id: 'sushi',
    name: 'Sushi Bar',
    blurb: 'The original late-night counter',
    build: buildSushiBar,
    seats: [-2.0, 0, 2.0],
    stations: [
      { id: 'tea', name: 'Kettle', kind: 'batch', model: 'kettle', side: 'left', z: -1.6, time: 3, servings: 3, gives: 'tea' },
      { id: 'salmon', name: 'Salmon', kind: 'hold', model: 'salmon', side: 'left', z: -0.4, time: 0.85, gives: 'salmon' },
      { id: 'tamago', name: 'Tamago', kind: 'hold', model: 'tamago', side: 'left', z: 0.8, time: 0.85, gives: 'tamago' },
      { id: 'nori', name: 'Nori', kind: 'instant', model: 'nori', side: 'left', z: 2.0, gives: 'nori' },
      { id: 'trays', name: 'Trays', kind: 'tray', model: 'trays', side: 'right', z: -1.55 },
      { id: 'rice1', name: 'Rice Cooker', kind: 'batch', model: 'rice', side: 'right', z: -0.2, time: 4.5, servings: 3, gives: 'rice' },
      { id: 'rice2', name: 'Rice Cooker', kind: 'batch', model: 'rice', side: 'right', z: 1.35, time: 4.5, servings: 3, gives: 'rice' },
      { id: 'slotL', name: 'Plate', kind: 'slot', model: 'slot', side: 'front', x: -1.3 },
      { id: 'trash', name: 'Recycle', kind: 'trash', model: 'trash', side: 'front', x: 0 },
      { id: 'slotR', name: 'Plate', kind: 'slot', model: 'slot', side: 'front', x: 1.3 },
    ],
    menu: {
      salmon_nigiri: { name: 'Salmon Nigiri', price: 6, steps: ['rice', 'salmon'] },
      tea: { name: 'Green Tea', price: 3, steps: ['tea'] },
      tamago_nigiri: { name: 'Tamago Nigiri', price: 6, steps: ['rice', 'tamago'] },
      onigiri: { name: 'Onigiri', price: 5, steps: ['rice', 'nori'] },
      salmon_maki: { name: 'Salmon Maki', price: 9, steps: ['rice', 'salmon', 'nori'] },
      tamago_maki: { name: 'Tamago Maki', price: 9, steps: ['rice', 'tamago', 'nori'] },
    },
    unlocks: [
      { at: 0, dishes: ['salmon_nigiri', 'tea'] },
      { at: 25, dishes: ['tamago_nigiri'] },
      { at: 60, dishes: ['onigiri'] },
      { at: 110, dishes: ['salmon_maki'] },
      { at: 170, dishes: ['tamago_maki'] },
    ],
    compose: sushiCompose,
    dishId: sushiDishId,
  },
  street: {
    id: 'street',
    name: 'Sushi Street',
    blurb: 'Grab fish off the conveyor belt',
    build: buildSushiStreet,
    seats: [-2.0, 0, 2.0],
    stations: [
      { id: 'rice1', name: 'Rice Cooker', kind: 'batch', model: 'rice', side: 'left', z: -1.7, time: 4.5, servings: 3, gives: 'rice' },
      { id: 'rice2', name: 'Rice Cooker', kind: 'batch', model: 'rice', side: 'left', z: -0.5, time: 4.5, servings: 3, gives: 'rice' },
      { id: 'nori', name: 'Nori', kind: 'instant', model: 'nori', side: 'left', z: 0.7, gives: 'nori' },
      { id: 'slotL', name: 'Plate', kind: 'slot', model: 'slot', side: 'left', z: 1.85 },
      { id: 'trays', name: 'Trays', kind: 'tray', model: 'trays', side: 'right', z: -1.7 },
      { id: 'miso', name: 'Miso Pot', kind: 'batch', model: 'miso', side: 'right', z: -0.5, time: 4, servings: 3, gives: 'miso' },
      { id: 'trash', name: 'Recycle', kind: 'trash', model: 'trash', side: 'right', z: 0.7 },
      { id: 'slotR', name: 'Plate', kind: 'slot', model: 'slot', side: 'right', z: 1.85 },
      { id: 'belt', name: 'Conveyor', kind: 'belt', model: 'belt', side: 'front', x: 0, pool: ['salmon', 'tuna', 'ebi', 'cucumber'], every: 1.0, speed: 0.85 },
    ],
    menu: {
      salmon_nigiri: { name: 'Salmon Nigiri', price: 6, steps: ['rice', 'salmon'] },
      tuna_nigiri: { name: 'Tuna Nigiri', price: 6, steps: ['rice', 'tuna'] },
      miso: { name: 'Miso Soup', price: 4, steps: ['miso'] },
      ebi_nigiri: { name: 'Ebi Nigiri', price: 7, steps: ['rice', 'ebi'] },
      cucumber_maki: { name: 'Kappa Maki', price: 8, steps: ['rice', 'cucumber', 'nori'] },
      tuna_maki: { name: 'Tekka Maki', price: 9, steps: ['rice', 'tuna', 'nori'] },
    },
    unlocks: [
      { at: 0, dishes: ['salmon_nigiri', 'tuna_nigiri'] },
      { at: 25, dishes: ['miso'] },
      { at: 60, dishes: ['ebi_nigiri'] },
      { at: 105, dishes: ['cucumber_maki'] },
      { at: 160, dishes: ['tuna_maki'] },
    ],
    compose: sushiCompose,
    dishId: sushiDishId,
  },
  burger: {
    id: 'burger',
    name: 'Burger Diner',
    blurb: 'Stack buns, patties and fries',
    build: buildBurgerDiner,
    seats: [-2.4, -0.8, 0.8, 2.4],
    stations: [
      { id: 'buns', name: 'Buns', kind: 'instant', model: 'buns', side: 'left', z: -1.6, gives: 'bun' },
      { id: 'grill', name: 'Grill', kind: 'batch', model: 'grill', side: 'left', z: -0.35, time: 4.5, servings: 3, gives: 'patty' },
      { id: 'cheese', name: 'Cheese', kind: 'instant', model: 'cheese', side: 'left', z: 0.9, gives: 'cheese' },
      { id: 'lettuce', name: 'Lettuce', kind: 'hold', model: 'lettuce', side: 'left', z: 2.05, time: 0.7, gives: 'lettuce' },
      { id: 'trays', name: 'Trays', kind: 'tray', model: 'trays', side: 'right', z: -1.55 },
      { id: 'fryer', name: 'Fryer', kind: 'batch', model: 'fryer', side: 'right', z: -0.2, time: 5, servings: 3, gives: 'fries' },
      { id: 'soda', name: 'Soda', kind: 'hold', model: 'soda', side: 'right', z: 1.25, time: 0.8, gives: 'cola' },
      { id: 'slotL', name: 'Plate', kind: 'slot', model: 'slot', side: 'front', x: -1.3 },
      { id: 'trash', name: 'Recycle', kind: 'trash', model: 'trash', side: 'front', x: 0 },
      { id: 'slotR', name: 'Plate', kind: 'slot', model: 'slot', side: 'front', x: 1.3 },
    ],
    menu: {
      burger: { name: 'Burger', price: 6, steps: ['bun', 'patty'] },
      cola: { name: 'Soda', price: 3, steps: ['cola'] },
      fries: { name: 'Fries', price: 4, steps: ['fries'] },
      cheeseburger: { name: 'Cheeseburger', price: 8, steps: ['bun', 'patty', 'cheese'] },
      garden: { name: 'Garden Burger', price: 8, steps: ['bun', 'patty', 'lettuce'] },
      deluxe: { name: 'Deluxe', price: 11, steps: ['bun', 'patty', 'cheese', 'lettuce'] },
    },
    unlocks: [
      { at: 0, dishes: ['burger', 'cola'] },
      { at: 25, dishes: ['fries'] },
      { at: 60, dishes: ['cheeseburger'] },
      { at: 110, dishes: ['garden'] },
      { at: 170, dishes: ['deluxe'] },
    ],
    compose: burgerCompose,
    dishId: burgerDishId,
  },
  happy: {
    id: 'happy',
    name: 'Happy Hour',
    blurb: 'Neon drinks and desserts',
    build: buildHappyHour,
    seats: [-2.7, -0.9, 0.9, 2.7],
    stations: [
      { id: 'lemonade', name: 'Pink Lemonade', kind: 'hold', model: 'lemonade', side: 'left', z: -1.7, time: 0.8, gives: 'lemonade' },
      { id: 'keg', name: 'Root Beer', kind: 'hold', model: 'keg', side: 'left', z: -0.5, time: 1.0, gives: 'rootbeer' },
      { id: 'soda', name: 'Cola', kind: 'hold', model: 'soda', side: 'left', z: 0.7, time: 0.7, gives: 'cola' },
      { id: 'traysL', name: 'Trays', kind: 'tray', model: 'trays', side: 'left', z: 1.9 },
      { id: 'shake', name: 'Milkshakes', kind: 'batch', model: 'shake', side: 'right', z: -1.7, time: 5, servings: 2, gives: 'milkshake' },
      { id: 'cake', name: 'Cake', kind: 'instant', model: 'cakestand', side: 'right', z: -0.5, gives: 'cake' },
      { id: 'coffee', name: 'Coffee', kind: 'batch', model: 'coffee', side: 'right', z: 0.7, time: 4, servings: 3, gives: 'coffee' },
      { id: 'traysR', name: 'Trays', kind: 'tray', model: 'trays', side: 'right', z: 1.9 },
      { id: 'slotL', name: 'Plate', kind: 'slot', model: 'slot', side: 'front', x: -1.3 },
      { id: 'trash', name: 'Recycle', kind: 'trash', model: 'trash', side: 'front', x: 0 },
      { id: 'slotR', name: 'Plate', kind: 'slot', model: 'slot', side: 'front', x: 1.3 },
    ],
    menu: {
      cola: { name: 'Cola', price: 3, steps: ['cola'] },
      lemonade: { name: 'Pink Lemonade', price: 4, steps: ['lemonade'] },
      coffee: { name: 'Coffee', price: 4, steps: ['coffee'] },
      rootbeer: { name: 'Root Beer', price: 4, steps: ['rootbeer'] },
      cake: { name: 'Cake Slice', price: 5, steps: ['cake'] },
      milkshake: { name: 'Milkshake', price: 6, steps: ['milkshake'] },
    },
    unlocks: [
      { at: 0, dishes: ['cola', 'lemonade', 'coffee'] },
      { at: 30, dishes: ['rootbeer'] },
      { at: 70, dishes: ['cake'] },
      { at: 120, dishes: ['milkshake'] },
    ],
    compose: simpleCompose,
    dishId: (d) => d.kind,
  },
};

LEVELS.austria = {
  id: 'austria',
  name: 'Wiener Wirtshaus',
  blurb: 'Schnitzel, Bier und Sachertorte',
  build: buildWirtshaus,
  seats: [-2.4, -0.8, 0.8, 2.4],
  stations: [
    { id: 'meat', name: 'Veal', kind: 'hold', model: 'meat', side: 'left', z: -1.7, time: 0.9, gives: 'meat' },
    { id: 'crumbs', name: 'Breading', kind: 'instant', model: 'crumbs', side: 'left', z: -0.5, gives: 'crumbs' },
    { id: 'pan', name: 'Frying Pan', kind: 'hold', model: 'pan', side: 'left', z: 0.7, time: 1.4, gives: 'fry' },
    { id: 'schmarrn', name: 'Kaiserschmarrn', kind: 'batch', model: 'schmarrn', side: 'left', z: 1.9, time: 5, servings: 3, gives: 'schmarrn' },
    { id: 'trays', name: 'Trays', kind: 'tray', model: 'trays', side: 'right', z: -1.7 },
    { id: 'tap', name: 'Beer Tap', kind: 'hold', model: 'beertap', side: 'right', z: -0.5, time: 1.2, gives: 'beer' },
    { id: 'sacher', name: 'Sachertorte', kind: 'instant', model: 'sacher', side: 'right', z: 0.7, gives: 'sacher' },
    { id: 'cream', name: 'Schlagobers', kind: 'instant', model: 'cream', side: 'right', z: 1.9, gives: 'cream' },
    { id: 'slotL', name: 'Plate', kind: 'slot', model: 'slot', side: 'front', x: -1.3 },
    { id: 'trash', name: 'Recycle', kind: 'trash', model: 'trash', side: 'front', x: 0 },
    { id: 'slotR', name: 'Plate', kind: 'slot', model: 'slot', side: 'front', x: 1.3 },
  ],
  menu: {
    schnitzel: { name: 'Wiener Schnitzel', price: 11, steps: ['meat', 'crumbs', 'fry'] },
    beer: { name: 'Bier', price: 4, steps: ['beer'] },
    sacher: { name: 'Sachertorte', price: 6, steps: ['sacher'] },
    schmarrn: { name: 'Kaiserschmarrn', price: 7, steps: ['schmarrn'] },
    sacher_schlag: { name: 'Sacher mit Schlag', price: 8, steps: ['sacher', 'cream'] },
  },
  unlocks: [
    { at: 0, dishes: ['schnitzel', 'beer'] },
    { at: 30, dishes: ['sacher'] },
    { at: 70, dishes: ['schmarrn'] },
    { at: 120, dishes: ['sacher_schlag'] },
  ],
  compose: austrianCompose,
  dishId: austrianDishId,
};

export const LEVEL_ORDER = ['sushi', 'street', 'burger', 'happy', 'austria'];

export const MODES = {
  score: { id: 'score', title: 'Score Attack', lives: 3 },
  versus: { id: 'versus', title: 'Versus', duration: 120 },
};
