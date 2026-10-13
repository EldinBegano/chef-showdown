const svg = (body) => `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

const plate = '<ellipse cx="20" cy="30" rx="16" ry="5" fill="#f7f4ee" stroke="#c9c2b4" stroke-width="1.5"/>';
const rice = '<rect x="9" y="19" width="22" height="10" rx="5" fill="#fffdf6" stroke="#d9d3c3" stroke-width="1.5"/>';

const ICONS = {
  rice: svg(`${plate}<ellipse cx="20" cy="25" rx="10" ry="6" fill="#fffdf6" stroke="#d9d3c3" stroke-width="1.5"/>`),
  salmon_nigiri: svg(`${plate}${rice}<rect x="6" y="12" width="28" height="10" rx="5" fill="#f47a45" stroke="#c4532a" stroke-width="1.5"/><path d="M13 13l-3 8M20 13l-3 8M27 13l-3 8" stroke="#ffd5be" stroke-width="2" stroke-linecap="round"/>`),
  tamago_nigiri: svg(`${plate}${rice}<rect x="7" y="11" width="26" height="11" rx="3" fill="#f6cf3d" stroke="#c9a024" stroke-width="1.5"/><rect x="17" y="10" width="6" height="19" rx="1" fill="#1d3324"/>`),
  onigiri: svg(`${plate}<path d="M20 6 L33 27 Q34 30 30 30 L10 30 Q6 30 7 27 Z" fill="#fffdf6" stroke="#d9d3c3" stroke-width="1.5" stroke-linejoin="round"/><rect x="14" y="20" width="12" height="10" rx="1.5" fill="#1d3324"/>`),
  salmon_maki: svg(`${plate}<circle cx="13" cy="22" r="7.5" fill="#1d3324"/><circle cx="13" cy="22" r="5.5" fill="#fffdf6"/><circle cx="13" cy="22" r="2.5" fill="#f47a45"/><circle cx="27" cy="22" r="7.5" fill="#1d3324"/><circle cx="27" cy="22" r="5.5" fill="#fffdf6"/><circle cx="27" cy="22" r="2.5" fill="#f47a45"/>`),
  tamago_maki: svg(`${plate}<circle cx="13" cy="22" r="7.5" fill="#1d3324"/><circle cx="13" cy="22" r="5.5" fill="#fffdf6"/><circle cx="13" cy="22" r="2.5" fill="#f6cf3d"/><circle cx="27" cy="22" r="7.5" fill="#1d3324"/><circle cx="27" cy="22" r="5.5" fill="#fffdf6"/><circle cx="27" cy="22" r="2.5" fill="#f6cf3d"/>`),
  tuna_nigiri: svg(`${plate}${rice}<rect x="6" y="12" width="28" height="10" rx="5" fill="#d6324a" stroke="#8a1a2a" stroke-width="1.5"/><path d="M13 13l-3 8M20 13l-3 8M27 13l-3 8" stroke="#f07a8a" stroke-width="2" stroke-linecap="round"/>`),
  ebi_nigiri: svg(`${plate}${rice}<path d="M5 17 q0 -6 12 -6 h14 l5 -4 v12 l-5 -3 h-14 q-12 0 -12 1z" fill="#fff6f0" stroke="#c4532a" stroke-width="1.5"/><path d="M11 12v8M17 11v9M23 11v9M29 11v8" stroke="#f26a3a" stroke-width="2.6"/>`),
  tuna_maki: svg(`${plate}<circle cx="13" cy="22" r="7.5" fill="#1d3324"/><circle cx="13" cy="22" r="5.5" fill="#fffdf6"/><circle cx="13" cy="22" r="2.5" fill="#d6324a"/><circle cx="27" cy="22" r="7.5" fill="#1d3324"/><circle cx="27" cy="22" r="5.5" fill="#fffdf6"/><circle cx="27" cy="22" r="2.5" fill="#d6324a"/>`),
  cucumber_maki: svg(`${plate}<circle cx="13" cy="22" r="7.5" fill="#1d3324"/><circle cx="13" cy="22" r="5.5" fill="#fffdf6"/><circle cx="13" cy="22" r="2.5" fill="#5dbb4a"/><circle cx="27" cy="22" r="7.5" fill="#1d3324"/><circle cx="27" cy="22" r="5.5" fill="#fffdf6"/><circle cx="27" cy="22" r="2.5" fill="#5dbb4a"/>`),
  miso: svg(`<path d="M6 16 h28 q0 16 -14 16 q-14 0 -14 -16z" fill="#3a2418" stroke="#1a0e08" stroke-width="1.5"/><ellipse cx="20" cy="16" rx="14" ry="4" fill="#c9853a"/><rect x="13" y="14" width="4" height="3" fill="#fff8e8"/><rect x="21" y="15" width="4" height="3" fill="#fff8e8"/><path d="M15 18 h9" stroke="#4caf50" stroke-width="2"/><path d="M15 10 q2 -3 0 -6 M23 10 q2 -3 0 -6" stroke="#cfd8dc" stroke-width="1.5" fill="none"/>`),
  bun: svg(`${plate}<path d="M8 27 q0 -14 12 -14 q12 0 12 14z" fill="#f0a14a" stroke="#a8641e" stroke-width="1.5"/>`),
  burger: svg(`${plate}<path d="M8 19 q0 -12 12 -12 q12 0 12 12z" fill="#f0a14a" stroke="#a8641e" stroke-width="1.5"/><rect x="7" y="19" width="26" height="6" rx="3" fill="#6b3a1e"/><rect x="8" y="25" width="24" height="5" rx="2.5" fill="#e59a45" stroke="#a8641e" stroke-width="1.2"/>`),
  cheeseburger: svg(`${plate}<path d="M8 18 q0 -12 12 -12 q12 0 12 12z" fill="#f0a14a" stroke="#a8641e" stroke-width="1.5"/><path d="M7 18 h26 l-4 5 h-18z" fill="#f6c434"/><rect x="7" y="20" width="26" height="6" rx="3" fill="#6b3a1e"/><rect x="8" y="26" width="24" height="5" rx="2.5" fill="#e59a45" stroke="#a8641e" stroke-width="1.2"/>`),
  garden: svg(`${plate}<path d="M8 17 q0 -12 12 -12 q12 0 12 12z" fill="#f0a14a" stroke="#a8641e" stroke-width="1.5"/><rect x="7" y="17" width="26" height="6" rx="3" fill="#6b3a1e"/><path d="M6 24 q3 -3 6 0 q3 -3 6 0 q3 -3 6 0 q3 -3 6 0 q3 -3 4 0 v2 h-28z" fill="#7cc142"/><rect x="8" y="26" width="24" height="5" rx="2.5" fill="#e59a45" stroke="#a8641e" stroke-width="1.2"/>`),
  deluxe: svg(`${plate}<path d="M8 16 q0 -12 12 -12 q12 0 12 12z" fill="#f0a14a" stroke="#a8641e" stroke-width="1.5"/><path d="M7 16 h26 l-4 5 h-18z" fill="#f6c434"/><rect x="7" y="18" width="26" height="6" rx="3" fill="#6b3a1e"/><path d="M6 25 q3 -3 6 0 q3 -3 6 0 q3 -3 6 0 q3 -3 6 0 q3 -3 4 0 v2 h-28z" fill="#7cc142"/><rect x="8" y="27" width="24" height="4" rx="2" fill="#e59a45" stroke="#a8641e" stroke-width="1.2"/><circle cx="16" cy="9" r="1" fill="#fff4d6"/><circle cx="22" cy="8" r="1" fill="#fff4d6"/>`),
  fries: svg(`<g stroke="#c9952a" stroke-width="1"><rect x="11" y="5" width="4" height="18" rx="1" fill="#f6c434" transform="rotate(-10 13 14)"/><rect x="16" y="3" width="4" height="20" rx="1" fill="#f8d04a"/><rect x="21" y="4" width="4" height="19" rx="1" fill="#f6c434" transform="rotate(8 23 14)"/><rect x="25" y="6" width="4" height="17" rx="1" fill="#f8d04a" transform="rotate(14 27 14)"/></g><path d="M8 16 h24 l-3 19 h-18z" fill="#e2402f" stroke="#8a1a10" stroke-width="1.5"/><path d="M14 16 v19 M20 16 v19 M26 16 v19" stroke="#fff" stroke-width="2.5" opacity=".85"/>`),
  tea: svg(`<path d="M10 14 h20 l-2 16 q-1 4 -5 4 h-6 q-4 0 -5 -4 z" fill="#efe8d6" stroke="#b8ad94" stroke-width="1.5"/><ellipse cx="20" cy="14" rx="10" ry="3" fill="#8fbf5a" stroke="#b8ad94" stroke-width="1.5"/><path d="M14 22 h12" stroke="#3f7a3a" stroke-width="2.5"/><path d="M16 9 q2 -3 0 -6 M23 9 q2 -3 0 -6" stroke="#cfd8dc" stroke-width="1.5" fill="none"/>`),
  cola: svg(`<path d="M11 10 h18 l-2.5 25 h-13 z" fill="#e2402f" stroke="#a82a20" stroke-width="1.5"/><path d="M12 18 h16 l-.6 6 h-14.8 z" fill="#fff"/><rect x="9.5" y="7" width="21" height="4" rx="2" fill="#fff" stroke="#a82a20" stroke-width="1.5"/><path d="M22 7 l4 -6" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`),
  lemonade: svg(`<path d="M12 9 h16 l-2 26 h-12 z" fill="#f48fb1" stroke="#c2185b" stroke-width="1.5" opacity=".95"/><circle cx="28" cy="10" r="5.5" fill="#f4d03f" stroke="#c9a024" stroke-width="1.5"/><path d="M28 5 v10 M23 10 h10" stroke="#fff6b0" stroke-width="1"/><circle cx="17" cy="20" r="1.5" fill="#fff"/><circle cx="21" cy="26" r="1.2" fill="#fff"/>`),
  rootbeer: svg(`<rect x="9" y="12" width="18" height="22" rx="3" fill="#7a3e1c" stroke="#4a2410" stroke-width="1.5"/><path d="M27 16 h4 a3 3 0 0 1 3 3 v6 a3 3 0 0 1 -3 3 h-4" fill="none" stroke="#c8e6f0" stroke-width="3"/><path d="M8 13 q3 -6 7 -3 q3 -5 7 -1 q4 -4 6 2 v3 h-20z" fill="#fff4dc" stroke="#d8cbb0" stroke-width="1.5"/>`),
  coffee: svg(`<ellipse cx="18" cy="33" rx="14" ry="3.5" fill="#f7f4ee" stroke="#c9c2b4" stroke-width="1.5"/><path d="M8 15 h20 v10 q0 7 -7 7 h-6 q-7 0 -7 -7z" fill="#fff" stroke="#c9c2b4" stroke-width="1.5"/><ellipse cx="18" cy="15" rx="10" ry="2.8" fill="#5a3218"/><path d="M28 18 h3 a3 3 0 0 1 0 7 h-3" fill="none" stroke="#c9c2b4" stroke-width="2.5"/><path d="M14 10 q2 -3 0 -6 M21 10 q2 -3 0 -6" stroke="#cfd8dc" stroke-width="1.5" fill="none"/>`),
  milkshake: svg(`<path d="M12 15 h16 l-2.5 20 h-11 z" fill="#f8bbd0" stroke="#c2185b" stroke-width="1.5"/><path d="M10 15 q0 -7 10 -7 q10 0 10 7z" fill="#fff" stroke="#d9d3c3" stroke-width="1.5"/><circle cx="20" cy="6" r="3.2" fill="#d4182d"/><path d="M25 10 l5 -9" stroke="#4fc3f7" stroke-width="2.5" stroke-linecap="round"/>`),
  cake: svg(`${plate}<path d="M7 18 L30 11 L33 15 L33 27 L7 27 Z" fill="#f3d6a6" stroke="#c9a46a" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 18 L30 11 L33 15 L7 21 Z" fill="#f7a6c8"/><path d="M7 23 h26" stroke="#f7a6c8" stroke-width="2"/><circle cx="29" cy="9" r="3" fill="#d4182d"/>`),
};

export function dishIcon(id) {
  return ICONS[id] || ICONS.rice;
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
