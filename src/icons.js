const svg = (body) => `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

const plate = '<ellipse cx="20" cy="30" rx="16" ry="5" fill="#f7f4ee" stroke="#c9c2b4" stroke-width="1.5"/>';
const rice = '<rect x="9" y="19" width="22" height="10" rx="5" fill="#fffdf6" stroke="#d9d3c3" stroke-width="1.5"/>';

// Fillings drawn around (0,0) so the same shape works on the big and small roll.
const FILLINGS = {
  salmon: '<rect x="-5" y="-4.5" width="10" height="9" rx="3.5" fill="#f47a45" stroke="#c4532a" stroke-width=".8"/><path d="M-2.5 -4 l2.5 8 M1.5 -4 l2.5 7.5" stroke="#ffe0cc" stroke-width="1.4" stroke-linecap="round"/>',
  tamago: '<rect x="-4.8" y="-4.8" width="9.6" height="9.6" rx="1" fill="#f6cf3d" stroke="#c9a024" stroke-width=".8"/><path d="M-4.8 -1.6 h9.6 M-4.8 1.6 h9.6" stroke="#fbeaa2" stroke-width="1.2"/>',
  tuna: '<rect x="-4.6" y="-4.6" width="9.2" height="9.2" rx="1.6" fill="#c8243c" stroke="#7a1424" stroke-width=".8"/><path d="M-2.6 -2.4 h3.6" stroke="#f07a8a" stroke-width="1.4" stroke-linecap="round"/>',
  cucumber: '<circle r="5" fill="#2f7a2a"/><circle r="3.8" fill="#bfe39a"/><circle cx="-1.3" cy="-.6" r=".8" fill="#f4fbe6"/><circle cx="1.3" cy="-.6" r=".8" fill="#f4fbe6"/><circle cy="1.4" r=".8" fill="#f4fbe6"/>',
};

const roll = (cx, cy, r, fill, k) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#1d3324"/><circle cx="${cx}" cy="${cy}" r="${r - 2}" fill="#fffdf6"/>` +
  `<g fill="#e9e2cf"><ellipse cx="${cx - r * 0.55}" cy="${cy - r * 0.3}" rx=".9" ry=".5"/><ellipse cx="${cx + r * 0.5}" cy="${cy + r * 0.45}" rx=".9" ry=".5"/><ellipse cx="${cx + r * 0.35}" cy="${cy - r * 0.55}" rx=".9" ry=".5"/></g>` +
  `<g transform="translate(${cx} ${cy}) scale(${k})">${FILLINGS[fill]}</g>`;

// Small roll behind, big cross-section in front: the filling's shape and colour tell the rolls apart.
const maki = (fill) => svg(`${plate}${roll(11, 19, 7.5, fill, 0.6)}${roll(24, 21, 11, fill, 1)}`);

const sacherSlice = (dx) =>
  `<g transform="translate(${dx} 0)"><path d="M5 22 L27 13 L31 16 L31 29 L5 29 Z" fill="#5a3220" stroke="#2a140a" stroke-width="1.5" stroke-linejoin="round"/><path d="M5 22 L27 13 L31 16 L5 25 Z" fill="#2a140a"/><path d="M5 26.5 h26" stroke="#f0a030" stroke-width="2"/><ellipse cx="21" cy="17" rx="3" ry="1.3" fill="#4a2414" stroke="#8a5a3a" stroke-width=".8"/></g>`;

const breadBottom = '<path d="M5 28 L34 22 Q38 27 33 30 L7 32 Q4 31 5 28Z" fill="#e2a75a" stroke="#a8641e" stroke-width="1.5" stroke-linejoin="round"/>';
const breadSeeds = '<g fill="#fff6dc"><ellipse cx="17" cy="21" rx="1.1" ry=".6"/><ellipse cx="24" cy="18" rx="1.1" ry=".6"/><ellipse cx="29" cy="20" rx="1.1" ry=".6"/><ellipse cx="21" cy="24" rx="1.1" ry=".6"/></g>';

const ICONS = {
  rice: svg(`${plate}<ellipse cx="20" cy="25" rx="10" ry="6" fill="#fffdf6" stroke="#d9d3c3" stroke-width="1.5"/>`),
  salmon_nigiri: svg(`${plate}${rice}<rect x="6" y="12" width="28" height="10" rx="5" fill="#f47a45" stroke="#c4532a" stroke-width="1.5"/><path d="M13 13l-3 8M20 13l-3 8M27 13l-3 8" stroke="#ffd5be" stroke-width="2" stroke-linecap="round"/>`),
  tamago_nigiri: svg(`${plate}${rice}<rect x="7" y="11" width="26" height="11" rx="3" fill="#f6cf3d" stroke="#c9a024" stroke-width="1.5"/><rect x="17" y="10" width="6" height="19" rx="1" fill="#1d3324"/>`),
  onigiri: svg(`${plate}<path d="M20 6 L33 27 Q34 30 30 30 L10 30 Q6 30 7 27 Z" fill="#fffdf6" stroke="#d9d3c3" stroke-width="1.5" stroke-linejoin="round"/><rect x="14" y="20" width="12" height="10" rx="1.5" fill="#1d3324"/>`),
  salmon_maki: maki('salmon'),
  tamago_maki: maki('tamago'),
  tuna_nigiri: svg(`${plate}${rice}<rect x="6" y="12" width="28" height="10" rx="4" fill="#c8243c" stroke="#7a1424" stroke-width="1.5"/><path d="M11 15 h12" stroke="#f07a8a" stroke-width="2" stroke-linecap="round"/>`),
  ebi_nigiri: svg(`${plate}${rice}<path d="M5 17 q0 -6 12 -6 h14 l5 -4 v12 l-5 -3 h-14 q-12 0 -12 1z" fill="#fff6f0" stroke="#c4532a" stroke-width="1.5"/><path d="M11 12v8M17 11v9M23 11v9M29 11v8" stroke="#f26a3a" stroke-width="2.6"/>`),
  tuna_maki: maki('tuna'),
  cucumber_maki: maki('cucumber'),
  miso: svg(`<path d="M6 16 h28 q0 16 -14 16 q-14 0 -14 -16z" fill="#3a2418" stroke="#1a0e08" stroke-width="1.5"/><ellipse cx="20" cy="16" rx="14" ry="4" fill="#c9853a"/><rect x="13" y="14" width="4" height="3" fill="#fff8e8"/><rect x="21" y="15" width="4" height="3" fill="#fff8e8"/><path d="M15 18 h9" stroke="#4caf50" stroke-width="2"/><path d="M15 10 q2 -3 0 -6 M23 10 q2 -3 0 -6" stroke="#cfd8dc" stroke-width="1.5" fill="none"/>`),
  bun: svg(`${plate}<path d="M8 27 q0 -14 12 -14 q12 0 12 14z" fill="#f0a14a" stroke="#a8641e" stroke-width="1.5"/>`),
  burger: svg(`${plate}<path d="M8 19 q0 -12 12 -12 q12 0 12 12z" fill="#f0a14a" stroke="#a8641e" stroke-width="1.5"/><rect x="7" y="19" width="26" height="6" rx="3" fill="#6b3a1e"/><rect x="8" y="25" width="24" height="5" rx="2.5" fill="#e59a45" stroke="#a8641e" stroke-width="1.2"/>`),
  cheeseburger: svg(`${plate}<path d="M8 18 q0 -12 12 -12 q12 0 12 12z" fill="#f0a14a" stroke="#a8641e" stroke-width="1.5"/><path d="M7 18 h26 l-4 5 h-18z" fill="#f6c434"/><rect x="7" y="20" width="26" height="6" rx="3" fill="#6b3a1e"/><rect x="8" y="26" width="24" height="5" rx="2.5" fill="#e59a45" stroke="#a8641e" stroke-width="1.2"/>`),
  garden: svg(`${plate}<path d="M8 17 q0 -12 12 -12 q12 0 12 12z" fill="#f0a14a" stroke="#a8641e" stroke-width="1.5"/><rect x="7" y="17" width="26" height="6" rx="3" fill="#6b3a1e"/><path d="M6 24 q3 -3 6 0 q3 -3 6 0 q3 -3 6 0 q3 -3 6 0 q3 -3 4 0 v2 h-28z" fill="#7cc142"/><rect x="8" y="26" width="24" height="5" rx="2.5" fill="#e59a45" stroke="#a8641e" stroke-width="1.2"/>`),
  deluxe: svg(`${plate}<path d="M8 16 q0 -12 12 -12 q12 0 12 12z" fill="#f0a14a" stroke="#a8641e" stroke-width="1.5"/><path d="M7 16 h26 l-4 5 h-18z" fill="#f6c434"/><rect x="7" y="18" width="26" height="6" rx="3" fill="#6b3a1e"/><path d="M6 25 q3 -3 6 0 q3 -3 6 0 q3 -3 6 0 q3 -3 6 0 q3 -3 4 0 v2 h-28z" fill="#7cc142"/><rect x="8" y="27" width="24" height="4" rx="2" fill="#e59a45" stroke="#a8641e" stroke-width="1.2"/><circle cx="16" cy="9" r="1" fill="#fff4d6"/><circle cx="22" cy="8" r="1" fill="#fff4d6"/>`),
  fries: svg(`<g stroke="#c9952a" stroke-width="1"><rect x="11" y="5" width="4" height="18" rx="1" fill="#f6c434" transform="rotate(-10 13 14)"/><rect x="16" y="3" width="4" height="20" rx="1" fill="#f8d04a"/><rect x="21" y="4" width="4" height="19" rx="1" fill="#f6c434" transform="rotate(8 23 14)"/><rect x="25" y="6" width="4" height="17" rx="1" fill="#f8d04a" transform="rotate(14 27 14)"/></g><path d="M8 16 h24 l-3 19 h-18z" fill="#e2402f" stroke="#8a1a10" stroke-width="1.5"/><path d="M14 16 v19 M20 16 v19 M26 16 v19" stroke="#fff" stroke-width="2.5" opacity=".85"/>`),
  schnitzel_raw: svg(`<ellipse cx="20" cy="29" rx="18" ry="6" fill="#f7f4ee" stroke="#c9c2b4" stroke-width="1.5"/><path d="M6 24 q2 -9 14 -9 q13 0 14 8 q-1 6 -14 6 q-13 0 -14 -5z" fill="#e98f8a" stroke="#b5605a" stroke-width="1.5"/>`),
  schnitzel_breaded: svg(`<ellipse cx="20" cy="29" rx="18" ry="6" fill="#f7f4ee" stroke="#c9c2b4" stroke-width="1.5"/><path d="M6 24 q2 -9 14 -9 q13 0 14 8 q-1 6 -14 6 q-13 0 -14 -5z" fill="#e7d2a2" stroke="#b89a60" stroke-width="1.5"/>`),
  schnitzel: svg(`<ellipse cx="20" cy="29" rx="18" ry="6" fill="#f7f4ee" stroke="#c9c2b4" stroke-width="1.5"/><path d="M5 24 q2 -10 14 -10 q14 0 15 8 q-1 7 -15 7 q-13 0 -14 -5z" fill="#d6953a" stroke="#9a5e1a" stroke-width="1.5"/><path d="M11 20 l2 1 M17 18 l2 1 M23 19 l2 1 M14 24 l2 1 M21 23 l2 1 M27 22 l2 1" stroke="#b07020" stroke-width="1.6" stroke-linecap="round"/><path d="M28 26 a6 6 0 0 1 10 0 z" fill="#f6d33a" stroke="#c9a024" stroke-width="1.2"/>`),
  beer: svg(`<rect x="9" y="11" width="18" height="24" rx="3" fill="#f2b632" stroke="#a8761a" stroke-width="1.5"/><path d="M27 15 h4 a3 3 0 0 1 3 3 v8 a3 3 0 0 1 -3 3 h-4" fill="none" stroke="#c8d6de" stroke-width="3"/><path d="M8 13 q2 -7 7 -4 q3 -5 7 -1 q5 -4 6 2 v4 h-20z" fill="#fffaf0" stroke="#e0d6c0" stroke-width="1.5"/><circle cx="14" cy="22" r="1.4" fill="#fff6c8"/><circle cx="20" cy="28" r="1.2" fill="#fff6c8"/>`),
  sacher: svg(`${plate}${sacherSlice(2)}`),
  sacher_schlag: svg(`${plate}${sacherSlice(-3)}<path d="M19 30 q-4 -1 -3 -6 q-3 -5 2 -8 q0 -6 7 -6 q4 -5 9 0 q6 1 4 7 q4 4 0 8 q1 5 -5 5z" fill="#fffdf8" stroke="#bdb39c" stroke-width="1.4"/><path d="M23 15 q4 -2 7 1 M21 21 q5 -2 10 1" stroke="#ddd5c2" stroke-width="1.3" fill="none" stroke-linecap="round"/>`),
  schmarrn: svg(`${plate}<g stroke="#a8641e" stroke-width="1.2"><rect x="8" y="19" width="9" height="6" rx="2" fill="#f0c46a" transform="rotate(-15 12 22)"/><rect x="17" y="16" width="10" height="6" rx="2" fill="#e3a64a" transform="rotate(10 22 19)"/><rect x="14" y="22" width="10" height="6" rx="2" fill="#f0c46a" transform="rotate(5 19 25)"/><rect x="24" y="21" width="8" height="6" rx="2" fill="#e3a64a" transform="rotate(-20 28 24)"/></g><circle cx="15" cy="20" r="1" fill="#fff"/><circle cx="22" cy="18" r="1" fill="#fff"/><circle cx="26" cy="24" r="1" fill="#fff"/><circle cx="19" cy="25" r="1" fill="#fff"/>`),
  tea: svg(`<path d="M10 14 h20 l-2 16 q-1 4 -5 4 h-6 q-4 0 -5 -4 z" fill="#efe8d6" stroke="#b8ad94" stroke-width="1.5"/><ellipse cx="20" cy="14" rx="10" ry="3" fill="#8fbf5a" stroke="#b8ad94" stroke-width="1.5"/><path d="M14 22 h12" stroke="#3f7a3a" stroke-width="2.5"/><path d="M16 9 q2 -3 0 -6 M23 9 q2 -3 0 -6" stroke="#cfd8dc" stroke-width="1.5" fill="none"/>`),
  cola: svg(`<path d="M11 10 h18 l-2.5 25 h-13 z" fill="#e2402f" stroke="#a82a20" stroke-width="1.5"/><path d="M12 18 h16 l-.6 6 h-14.8 z" fill="#fff"/><rect x="9.5" y="7" width="21" height="4" rx="2" fill="#fff" stroke="#a82a20" stroke-width="1.5"/><path d="M22 7 l4 -6" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`),
  lemonade: svg(`<path d="M12 9 h16 l-2 26 h-12 z" fill="#f48fb1" stroke="#c2185b" stroke-width="1.5" opacity=".95"/><circle cx="28" cy="10" r="5.5" fill="#f4d03f" stroke="#c9a024" stroke-width="1.5"/><path d="M28 5 v10 M23 10 h10" stroke="#fff6b0" stroke-width="1"/><circle cx="17" cy="20" r="1.5" fill="#fff"/><circle cx="21" cy="26" r="1.2" fill="#fff"/>`),
  rootbeer: svg(`<rect x="9" y="12" width="18" height="22" rx="3" fill="#7a3e1c" stroke="#4a2410" stroke-width="1.5"/><path d="M27 16 h4 a3 3 0 0 1 3 3 v6 a3 3 0 0 1 -3 3 h-4" fill="none" stroke="#c8e6f0" stroke-width="3"/><path d="M8 13 q3 -6 7 -3 q3 -5 7 -1 q4 -4 6 2 v3 h-20z" fill="#fff4dc" stroke="#d8cbb0" stroke-width="1.5"/>`),
  coffee: svg(`<ellipse cx="18" cy="33" rx="14" ry="3.5" fill="#f7f4ee" stroke="#c9c2b4" stroke-width="1.5"/><path d="M8 15 h20 v10 q0 7 -7 7 h-6 q-7 0 -7 -7z" fill="#fff" stroke="#c9c2b4" stroke-width="1.5"/><ellipse cx="18" cy="15" rx="10" ry="2.8" fill="#5a3218"/><path d="M28 18 h3 a3 3 0 0 1 0 7 h-3" fill="none" stroke="#c9c2b4" stroke-width="2.5"/><path d="M14 10 q2 -3 0 -6 M21 10 q2 -3 0 -6" stroke="#cfd8dc" stroke-width="1.5" fill="none"/>`),
  milkshake: svg(`<path d="M12 15 h16 l-2.5 20 h-11 z" fill="#f8bbd0" stroke="#c2185b" stroke-width="1.5"/><path d="M10 15 q0 -7 10 -7 q10 0 10 7z" fill="#fff" stroke="#d9d3c3" stroke-width="1.5"/><circle cx="20" cy="6" r="3.2" fill="#d4182d"/><path d="M25 10 l5 -9" stroke="#4fc3f7" stroke-width="2.5" stroke-linecap="round"/>`),
  cake: svg(`${plate}<path d="M7 18 L30 11 L33 15 L33 27 L7 27 Z" fill="#f3d6a6" stroke="#c9a46a" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 18 L30 11 L33 15 L7 21 Z" fill="#f7a6c8"/><path d="M7 23 h26" stroke="#f7a6c8" stroke-width="2"/><circle cx="29" cy="9" r="3" fill="#d4182d"/>`),
  // döner bread side-on: closed, opened with meat, then stuffed
  ekmek: svg(`${plate}<path d="M5 28 L32 13 Q40 19 35 28 Z" fill="#e2a75a" stroke="#a8641e" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 27 L35 22" stroke="#c9852f" stroke-width="1.3"/>${breadSeeds}`),
  doner_wip: svg(`${plate}${breadBottom}<path d="M7 26 L33 17 L35 23 L8 29Z" fill="#8a4a26"/><path d="M5 25 L30 10 Q38 13 35 18 L8 27 Z" fill="#d99a4c" stroke="#a8641e" stroke-width="1.5" stroke-linejoin="round"/>`),
  doner: svg(`${plate}${breadBottom}<path d="M7 26 L33 16 L35 23 L8 29Z" fill="#8a4a26"/><path d="M8 25 l3 -4 l3 2 l3 -5 l3 2 l3 -5 l3 2 l3 -5 l3 1 l2 5z" fill="#7cc142"/><circle cx="19" cy="20" r="2.3" fill="#e2402f"/><circle cx="27" cy="16.5" r="2.3" fill="#e2402f"/><path d="M4 23 L29 6 Q37 8 35 13 L8 24 Z" fill="#d99a4c" stroke="#a8641e" stroke-width="1.5" stroke-linejoin="round"/><path d="M17 15 q1 4 0 6 M24 11 q1 4 0 5" stroke="#fffdf4" stroke-width="2" stroke-linecap="round"/>`),
  yufka: svg(`${plate}<ellipse cx="20" cy="26" rx="15" ry="6" fill="#ecd29c" stroke="#b8925a" stroke-width="1.4"/><g fill="#c9935a"><ellipse cx="13" cy="25" rx="1.6" ry=".8"/><ellipse cx="22" cy="23.5" rx="1.4" ry=".7"/><ellipse cx="27" cy="27" rx="1.6" ry=".8"/><ellipse cx="17" cy="28.5" rx="1.2" ry=".6"/></g>`),
  durum_wip: svg(`${plate}<ellipse cx="20" cy="26" rx="15" ry="6" fill="#ecd29c" stroke="#b8925a" stroke-width="1.4"/><rect x="9" y="23" width="22" height="5" rx="2.5" fill="#8a4a26"/><circle cx="13" cy="23.5" r="1.8" fill="#7cc142"/><circle cx="19" cy="23" r="1.8" fill="#e2402f"/><circle cx="25" cy="23.5" r="1.8" fill="#7cc142"/>`),
  durum: svg(`${plate}<g transform="rotate(-38 20 20)"><rect x="4" y="15" width="32" height="11" rx="5.5" fill="#ecd29c" stroke="#b8925a" stroke-width="1.4"/><rect x="4" y="14.5" width="17" height="12" rx="3" fill="#f4f2ee" stroke="#b8b0a0" stroke-width="1.2"/><rect x="17" y="14.5" width="3" height="12" fill="#c8202a"/><ellipse cx="35" cy="20.5" rx="2.8" ry="5" fill="#8a4a26"/><circle cx="35" cy="18" r="1.4" fill="#7cc142"/><circle cx="35.4" cy="22.4" r="1.3" fill="#e2402f"/></g>`),
  ayran: svg(`<path d="M12 10 h16 l-2 25 h-12 z" fill="#f8f8f4" stroke="#b8c0c8" stroke-width="1.5"/><path d="M12.6 17 h14.8 l-.5 6 h-13.8z" fill="#2d6fb5"/><ellipse cx="20" cy="10" rx="8.5" ry="2.6" fill="#ffffff" stroke="#d8dde2" stroke-width="1.2"/><circle cx="17" cy="9.4" r="1.2" fill="#eef2f4"/><circle cx="22" cy="10.4" r="1" fill="#eef2f4"/>`),
};

export function dishIcon(id) {
  return ICONS[id] || ICONS.rice;
}

// Raw ingredients for recipe cards; steps that are finished items fall back to their dish icon.
const STEPS = {
  salmon: svg(`<rect x="5" y="12" width="30" height="16" rx="6" fill="#f47a45" stroke="#c4532a" stroke-width="1.5"/><path d="M12 13 l-4 14 M19 13 l-4 14 M26 13 l-4 14 M33 14 l-4 13" stroke="#ffe0cc" stroke-width="2.2" stroke-linecap="round"/>`),
  tuna: svg(`<rect x="6" y="11" width="28" height="18" rx="3" fill="#c8243c" stroke="#7a1424" stroke-width="1.5"/><path d="M10 15 h12" stroke="#f07a8a" stroke-width="2.4" stroke-linecap="round"/>`),
  tamago: svg(`<rect x="7" y="10" width="26" height="20" rx="2" fill="#f6cf3d" stroke="#c9a024" stroke-width="1.5"/><path d="M7 16.5 h26 M7 23 h26" stroke="#fbeaa2" stroke-width="2"/>`),
  ebi: svg(`<path d="M6 22 q0 -9 13 -9 h12 l5 -5 v15 l-5 -4 h-12 q-13 0 -13 3z" fill="#fff6f0" stroke="#c4532a" stroke-width="1.5"/><path d="M12 15v10M18 14v10M24 14v9M30 14v8" stroke="#f26a3a" stroke-width="2.6"/>`),
  cucumber: svg(`<rect x="4" y="15" width="22" height="12" rx="6" fill="#3f8f32" stroke="#245a1c" stroke-width="1.5"/><circle cx="28" cy="21" r="8" fill="#2f7a2a" stroke="#245a1c" stroke-width="1.5"/><circle cx="28" cy="21" r="6" fill="#bfe39a"/><circle cx="26.5" cy="20" r="1" fill="#f4fbe6"/><circle cx="29.5" cy="20" r="1" fill="#f4fbe6"/><circle cx="28" cy="23" r="1" fill="#f4fbe6"/>`),
  nori: svg(`<rect x="7" y="8" width="26" height="24" rx="2" fill="#1d3324" stroke="#0e1c12" stroke-width="1.5" transform="rotate(-6 20 20)"/><path d="M11 14 l18 -2 M11 20 l18 -2 M12 26 l18 -2" stroke="#2e4a36" stroke-width="1.5"/>`),
  patty: svg(`<ellipse cx="20" cy="22" rx="15" ry="8" fill="#6b3a1e" stroke="#3a1a08" stroke-width="1.5"/><path d="M10 20 l5 5 M16 18 l6 6 M23 17 l6 6" stroke="#3a1a08" stroke-width="2" stroke-linecap="round"/>`),
  cheese: svg(`<path d="M6 14 h28 l-3 16 h-22z" fill="#f6c434" stroke="#c9952a" stroke-width="1.5" stroke-linejoin="round"/><circle cx="14" cy="20" r="2" fill="#e0a820"/><circle cx="24" cy="24" r="2.5" fill="#e0a820"/><circle cx="26" cy="17" r="1.4" fill="#e0a820"/>`),
  lettuce: svg(`<path d="M5 24 q2 -12 15 -12 q13 0 15 12 q-3 4 -6 1 q-3 4 -6 0 q-3 4 -6 0 q-3 4 -6 0 q-3 3 -6 -1z" fill="#7cc142" stroke="#3f7a1e" stroke-width="1.5" stroke-linejoin="round"/><path d="M20 13 v12 M20 19 l-6 -4 M20 19 l6 -4" stroke="#b9e38a" stroke-width="1.4" fill="none"/>`),
  meat: svg(`<path d="M6 24 q2 -10 14 -10 q13 0 14 8 q-1 7 -14 7 q-13 0 -14 -5z" fill="#e98f8a" stroke="#b5605a" stroke-width="1.5"/><path d="M13 19 q4 2 8 0 M18 24 q4 2 8 0" stroke="#f6c4bf" stroke-width="1.6" fill="none" stroke-linecap="round"/>`),
  crumbs: svg(`<path d="M5 18 h30 q-2 14 -15 14 q-13 0 -15 -14z" fill="#c9853a" stroke="#7a4a1a" stroke-width="1.5"/><ellipse cx="20" cy="18" rx="15" ry="4" fill="#e7cf8f" stroke="#7a4a1a" stroke-width="1.5"/><g fill="#c9a050"><circle cx="13" cy="17" r="1"/><circle cx="18" cy="19" r="1"/><circle cx="24" cy="17" r="1"/><circle cx="28" cy="19" r="1"/></g>`),
  fry: svg(`<ellipse cx="17" cy="24" rx="13" ry="6" fill="#2b2b33" stroke="#111" stroke-width="1.5"/><ellipse cx="17" cy="23" rx="10" ry="4" fill="#f2b632"/><path d="M29 22 l9 -5" stroke="#3a2a20" stroke-width="3.5" stroke-linecap="round"/><g fill="#fff4c0"><circle cx="13" cy="22" r="1.2"/><circle cx="19" cy="24" r="1"/><circle cx="21" cy="21" r="1.3"/></g><path d="M12 15 q2 -3 0 -6 M19 14 q2 -3 0 -6" stroke="#cfd8dc" stroke-width="1.5" fill="none"/>`),
  cream: svg(`<path d="M7 22 h26 q-1 11 -13 11 q-12 0 -13 -11z" fill="#c8d6de" stroke="#7a8a94" stroke-width="1.5"/><path d="M9 22 q-2 -7 5 -8 q1 -7 7 -6 q6 -2 7 4 q6 1 4 10z" fill="#fffdf8" stroke="#bdb39c" stroke-width="1.4"/>`),
};

STEPS.bread = ICONS.ekmek;
STEPS.kebab = svg(`<rect x="19" y="2" width="2.4" height="36" rx="1" fill="#c0c7cf"/><path d="M10 7 h20 l-4 25 h-12z" fill="#9a5a2e" stroke="#5a2e12" stroke-width="1.5" stroke-linejoin="round"/><path d="M11.5 12 h17 M12.5 18 h15 M13.5 24 h13" stroke="#7a4220" stroke-width="2.2"/><path d="M28 30 q4 1 5 4 M30 26 q4 0 6 3" stroke="#9a5a2e" stroke-width="2.4" fill="none" stroke-linecap="round"/>`);
STEPS.salad = svg(`<circle cx="13" cy="19" r="5" fill="#7cc142"/><circle cx="20" cy="16" r="5" fill="#93d65a"/><circle cx="27" cy="19" r="5" fill="#7cc142"/><circle cx="17" cy="20" r="3" fill="#e2402f"/><circle cx="25" cy="18" r="2.6" fill="#8a2a6a"/><path d="M6 20 h28 q-2 13 -14 13 q-12 0 -14 -13z" fill="#e8eef2" stroke="#8a9098" stroke-width="1.5"/>`);
STEPS.sauce = svg(`<path d="M16 13 l4 -9 l4 9z" fill="#f6f4ec" stroke="#b8b0a0" stroke-width="1.3" stroke-linejoin="round"/><rect x="12" y="12" width="16" height="24" rx="4" fill="#f6f4ec" stroke="#b8b0a0" stroke-width="1.5"/><rect x="12" y="20" width="16" height="8" fill="#7cc142"/><path d="M18 22 q2 -2 4 0 q1 3 -2 4 q-3 -1 -2 -4z" fill="#ffffff"/>`);

export function stepIcon(id) {
  return STEPS[id] || ICONS[id] || ICONS.rice;
}

const MOODS = {
  happy: { fill: '#6cc04a', mouth: '<path d="M12 23 q8 8 16 0" stroke="#24451a" stroke-width="2.5" fill="#24451a"/>', brows: '' },
  ok: { fill: '#f7c531', mouth: '<path d="M13 25 q7 4 14 0" stroke="#5a4210" stroke-width="2.5" fill="none" stroke-linecap="round"/>', brows: '' },
  meh: { fill: '#f38b2b', mouth: '<path d="M13 27 q7 -5 14 0" stroke="#5a2a10" stroke-width="2.5" fill="none" stroke-linecap="round"/>', brows: '' },
  angry: { fill: '#e2402f', mouth: '<path d="M12 28 q8 -8 16 0 z" fill="#4a1010"/>', brows: '<path d="M10 12 l8 4 M30 12 l-8 4" stroke="#4a1010" stroke-width="2.5" stroke-linecap="round"/>' },
};

export function moodIcon(mood) {
  const m = MOODS[mood] || MOODS.ok;
  return svg(`<circle cx="20" cy="20" r="17" fill="${m.fill}" stroke="#fff" stroke-width="3"/><ellipse cx="14.5" cy="17" rx="2.2" ry="3" fill="#222"/><ellipse cx="25.5" cy="17" rx="2.2" ry="3" fill="#222"/>${m.brows}${m.mouth}`);
}

export const UI_ICONS = {
  cash: svg('<rect x="3" y="11" width="30" height="18" rx="3" fill="#4caf50" stroke="#1b5e20" stroke-width="2" transform="rotate(-12 20 20)"/><rect x="7" y="13" width="30" height="18" rx="3" fill="#66bb6a" stroke="#1b5e20" stroke-width="2"/><circle cx="22" cy="22" r="5" fill="#a5d6a7" stroke="#1b5e20" stroke-width="1.5"/>'),
  heart: svg('<path d="M20 34 C6 25 3 17 7 11 C11 5 18 7 20 12 C22 7 29 5 33 11 C37 17 34 25 20 34Z" fill="#e2402f" stroke="#7a1810" stroke-width="2.5"/><ellipse cx="13" cy="14" rx="3" ry="2" fill="#ff8a7a" transform="rotate(-30 13 14)"/>'),
  heartEmpty: svg('<path d="M20 34 C6 25 3 17 7 11 C11 5 18 7 20 12 C22 7 29 5 33 11 C37 17 34 25 20 34Z" fill="#6b4a3a" stroke="#3a2418" stroke-width="2.5" opacity=".5"/>'),
  sound: svg('<path d="M8 15 h6 l8 -7 v24 l-8 -7 h-6z" fill="#fff"/><path d="M26 14 q4 6 0 12 M29 10 q7 10 0 20" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>'),
  mute: svg('<path d="M8 15 h6 l8 -7 v24 l-8 -7 h-6z" fill="#fff"/><path d="M27 15 l8 10 M35 15 l-8 10" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>'),
  left: svg('<path d="M25 9 L12 20 L25 31 Z" fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>'),
  right: svg('<path d="M15 9 L28 20 L15 31 Z" fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>'),
  lock: svg('<rect x="9" y="18" width="22" height="16" rx="3" fill="#f4d03f" stroke="#7a5a10" stroke-width="2"/><path d="M13 18 v-5 a7 7 0 0 1 14 0 v5" fill="none" stroke="#7a5a10" stroke-width="3"/>'),
  trophy: svg('<path d="M12 6 h16 v8 a8 8 0 0 1 -16 0z" fill="#f4b63f" stroke="#7a5a10" stroke-width="2"/><path d="M12 9 h-5 a5 5 0 0 0 5 7 M28 9 h5 a5 5 0 0 1 -5 7" fill="none" stroke="#7a5a10" stroke-width="2"/><rect x="18" y="21" width="4" height="7" fill="#d9952a"/><rect x="12" y="28" width="16" height="5" rx="1.5" fill="#d9952a" stroke="#7a5a10" stroke-width="2"/>'),
};

export const BURGER_LOGO = `<svg viewBox="0 0 80 70" xmlns="http://www.w3.org/2000/svg">
<path d="M8 30 Q8 6 40 6 Q72 6 72 30 Z" fill="#f2a33a" stroke="#5a2a10" stroke-width="3.5" stroke-linejoin="round"/>
<g fill="#fff6d6"><ellipse cx="26" cy="16" rx="2.5" ry="1.5"/><ellipse cx="40" cy="12" rx="2.5" ry="1.5"/><ellipse cx="54" cy="17" rx="2.5" ry="1.5"/><ellipse cx="34" cy="22" rx="2.5" ry="1.5"/><ellipse cx="48" cy="23" rx="2.5" ry="1.5"/></g>
<path d="M4 33 q6 -6 12 0 q6 6 12 0 q6 -6 12 0 q6 6 12 0 q6 -6 12 0 q6 6 12 0 v4 h-72z" fill="#7bc142" stroke="#2f5a10" stroke-width="3" stroke-linejoin="round"/>
<path d="M10 37 h60 l-6 9 l-8 -6 l-8 7 l-8 -7 l-8 7 l-8 -7 l-8 6z" fill="#f6c434" stroke="#7a5a10" stroke-width="3" stroke-linejoin="round"/>
<rect x="6" y="42" width="68" height="9" rx="4.5" fill="#7a3e1c" stroke="#3a1a08" stroke-width="3"/>
<path d="M8 53 h64 q0 12 -32 12 q-32 0 -32 -12z" fill="#f2a33a" stroke="#5a2a10" stroke-width="3.5" stroke-linejoin="round"/>
</svg>`;
