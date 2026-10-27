// Chunky rounded line icons (24 x 24), inline SVG. No emoji: they render
// differently on every platform and Marco's on Windows.

const S = (d, extra = '') => `<svg viewBox="0 0 24 24" class="gp-ico" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
const F = (d) => `<svg viewBox="0 0 24 24" class="gp-ico" aria-hidden="true" fill="currentColor">${d}</svg>`;

export const ICONS = {
  back: S('<path d="M14.5 5 7.5 12l7 7"/>'),
  next: S('<path d="M9.5 5l7 7-7 7"/>'),
  play: F('<path d="M8 4.8c0-1.1 1.2-1.8 2.2-1.2l9.4 6.9c.9.7.9 2 0 2.7l-9.4 6.9c-1 .7-2.2 0-2.2-1.2z"/>'),
  star: F('<path d="M12 2.6l2.8 5.9 6.4.8c.8.1 1.1 1.1.5 1.6l-4.7 4.4 1.2 6.3c.2.8-.7 1.4-1.4 1L12 19.5l-5.8 3.1c-.7.4-1.6-.2-1.4-1l1.2-6.3-4.7-4.4c-.6-.5-.3-1.5.5-1.6l6.4-.8z"/>'),
  paw: F('<ellipse cx="6" cy="10" rx="2.3" ry="2.9"/><ellipse cx="10" cy="5.6" rx="2.3" ry="2.9"/><ellipse cx="14.6" cy="5.6" rx="2.3" ry="2.9"/><ellipse cx="18.4" cy="10" rx="2.3" ry="2.9"/><path d="M12.2 11.2c2.8 0 6 3.9 6 6.4 0 2-1.6 3-3.1 3-1.2 0-1.9-.6-2.9-.6s-1.8.6-3 .6c-1.6 0-3-1-3-3 0-2.5 3.2-6.4 6-6.4z"/>'),
  lock: S('<rect x="5" y="10.5" width="14" height="10" rx="3"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
  clock: S('<circle cx="12" cy="12" r="8.6"/><path d="M12 7.5V12l3 2"/>'),
  biccie: `<svg viewBox="0 0 24 24" class="gp-ico gp-biccie" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#e9a84e"/><circle cx="12" cy="12" r="7.6" fill="#f6c46f"/><circle cx="9" cy="9.5" r="1.3" fill="#a8652a"/><circle cx="14.5" cy="9" r="1.3" fill="#a8652a"/><circle cx="12" cy="13.2" r="1.3" fill="#a8652a"/><circle cx="8.6" cy="15" r="1.3" fill="#a8652a"/><circle cx="15.4" cy="14.8" r="1.3" fill="#a8652a"/></svg>`,
  gear: S('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.9 1.9M7.4 16.6l-1.9 1.9M18.5 18.5l-1.9-1.9M7.4 7.4 5.5 5.5"/>'),
  trophy: S('<path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6H4.5a3 3 0 0 0 3 4M16.5 6h3a3 3 0 0 1-3 4M12 13.5V17M8.5 20.5h7M9.5 17h5"/>'),
  book: S('<path d="M4 5.5C6.5 4 9.5 4 12 5.8 14.5 4 17.5 4 20 5.5v13c-2.5-1.5-5.5-1.5-8 .3-2.5-1.8-5.5-1.8-8-.3z"/><path d="M12 5.8v13"/>'),
  shirt: S('<path d="M8.5 3.8 4 6.2l1.6 4 2.2-.9V20h8.4V9.3l2.2.9 1.6-4-4.5-2.4a3.5 3.5 0 0 1-7 0z"/>'),
  bag: S('<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>'),
  chart: S('<path d="M4 20h16"/><path d="M7 16.5v-4M12 16.5v-9M17 16.5v-6"/>'),
  calendar: S('<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M8.5 3.5v3.5M15.5 3.5v3.5"/>'),
  bolt: F('<path d="M13.4 2.5 5.3 13.2c-.4.6 0 1.3.7 1.3h4.8l-1.3 7c-.1.6.7 1 1.1.4l8.1-10.7c.4-.6 0-1.3-.7-1.3h-4.8l1.3-7c.1-.6-.7-1-1.1-.4z"/>'),
  pause: F('<rect x="6" y="4.5" width="4.4" height="15" rx="1.6"/><rect x="13.6" y="4.5" width="4.4" height="15" rx="1.6"/>'),
  camera: S('<path d="M4 8.5h3.2l1.6-2.5h6.4l1.6 2.5H20v10.5H4z"/><circle cx="12" cy="13.3" r="3.4"/>'),
  film: S('<rect x="3.5" y="6" width="12" height="12" rx="2.5"/><path d="m15.5 10.5 5-3v9l-5-3"/>'),
  restart: S('<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5"/><path d="M4.5 4v4.5H9"/>'),
  map: S('<path d="M3.5 6.5 9 4l6 2.5 5.5-2.5v13.5L15 20l-6-2.5-5.5 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>'),
  door: S('<path d="M6 20.5V4.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16"/><path d="M3.5 20.5h17M14.5 12.5v.2"/>'),
  dice: S('<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r=".6" fill="currentColor"/><circle cx="15" cy="15" r=".6" fill="currentColor"/><circle cx="15" cy="9" r=".6" fill="currentColor"/><circle cx="9" cy="15" r=".6" fill="currentColor"/>'),
  undo: S('<path d="M8 8H14a5 5 0 0 1 0 10H9"/><path d="m11 4.5-3.5 3.5 3.5 3.5"/>'),
  photo: S('<rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m4.5 17.5 5-4.5 3.5 3 2.5-2 4 3.5"/>'),
  check: S('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  close: S('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
  speaker: S('<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  eye: S('<path d="M2.8 12S6.2 5.5 12 5.5 21.2 12 21.2 12 17.8 18.5 12 18.5 2.8 12 2.8 12z"/><circle cx="12" cy="12" r="2.8"/>'),
  pad: S('<path d="M7 7.5h10a4.5 4.5 0 0 1 4.3 5.8l-1.2 4a2.5 2.5 0 0 1-4.3.8L14 16h-4l-1.8 2.1a2.5 2.5 0 0 1-4.3-.8l-1.2-4A4.5 4.5 0 0 1 7 7.5z"/><path d="M8 10.5v3M6.5 12h3M15.5 11v.1M17.5 13v.1"/>'),
  globe: S('<circle cx="12" cy="12" r="8.6"/><path d="M3.5 12h17M12 3.4c2.5 2.4 3.6 5.3 3.6 8.6s-1.1 6.2-3.6 8.6c-2.5-2.4-3.6-5.3-3.6-8.6S9.5 5.8 12 3.4z"/>'),
  egg: S('<path d="M12 3.5c3.6 0 6.5 5.6 6.5 9.6a6.5 6.5 0 0 1-13 0c0-4 2.9-9.6 6.5-9.6z"/>'),
  sparkle: F('<path d="M12 2.5c.6 4.8 2.7 6.9 7.5 7.5-4.8.6-6.9 2.7-7.5 7.5-.6-4.8-2.7-6.9-7.5-7.5 4.8-.6 6.9-2.7 7.5-7.5zM19 15.5c.3 2.2 1.2 3.1 3.4 3.4-2.2.3-3.1 1.2-3.4 3.4-.3-2.2-1.2-3.1-3.4-3.4 2.2-.3 3.1-1.2 3.4-3.4z"/>'),
  crown: S('<path d="M4 17.5 3 8l5 3.5L12 5l4 6.5L21 8l-1 9.5z"/><path d="M4.5 20.5h15"/>'),
  flame: F('<path d="M12.6 2.4c.4 3-1 4.6-2.4 6.2-1.3 1.5-2.7 3-2.7 5.6a4.5 4.5 0 0 0 9 .2c0-1.5-.5-2.7-1.3-3.7.2 1.3-.3 2.4-1.2 2.9.6-3.1-.1-6.9-1.4-11.2zM12 21.6a7.2 7.2 0 0 1-7.2-7.2c0-3.6 2-5.7 3.4-7.3 1.6-1.8 2.7-3 2.2-5.6l-.2-.9c4.3 2 7.8 6.5 8.7 10.4.2.8.3 1.7.3 2.4A7.2 7.2 0 0 1 12 21.6z"/>'),
  ruler: S('<path d="M3.5 15.5 15.5 3.5l5 5-12 12z"/><path d="m7 12 2 2M10 9l2 2M13 6l2 2"/>'),
  mouth: S('<circle cx="12" cy="12" r="8.6"/><path d="M7.5 13.5a5 5 0 0 0 9 0z" fill="currentColor"/><path d="M9 9v.1M15 9v.1"/>'),
  shuffle: S('<path d="M3.5 7h3.5c4.5 0 5.5 10 10 10h3.5M3.5 17h3.5c1.6 0 2.7-1.2 3.6-2.8M13.4 9.8C14.3 8.2 15.4 7 17 7h3.5"/><path d="m18 4.5 2.5 2.5L18 9.5M18 14.5l2.5 2.5-2.5 2.5"/>'),
  heart: F('<path d="M12 20.5s-8.5-5-8.5-11A4.8 4.8 0 0 1 12 6.8a4.8 4.8 0 0 1 8.5 2.7c0 6-8.5 11-8.5 11z"/>'),
  music: S('<path d="M9 17.5V5.5l10-2v12"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>'),
  key: S('<circle cx="8" cy="12" r="4"/><path d="M12 12h8.5M17.5 12v3M20.5 12v2.5"/>'),
  hat: S('<path d="M3.5 17.5c3 1.6 14 1.6 17 0"/><path d="M6.5 16.6V11a5.5 5.5 0 0 1 11 0v5.6"/>'),
  collar: S('<ellipse cx="12" cy="10" rx="8" ry="3.5"/><path d="M4 10v2.5c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5V10"/><circle cx="12" cy="18.6" r="2"/>'),
  cape: S('<path d="M7 4.5h10l3 15.5c-2.5 1-5.3-.5-8-.5s-5.5 1.5-8 .5z"/><path d="M7 4.5c1.4 1.6 3.1 2.4 5 2.4s3.6-.8 5-2.4"/>'),
  glasses: S('<circle cx="7" cy="13" r="3.6"/><circle cx="17" cy="13" r="3.6"/><path d="M10.6 12.6c.9-.7 1.9-.7 2.8 0M3.4 12 2.5 9.5M20.6 12l.9-2.5"/>'),
  badge: S('<circle cx="12" cy="9.5" r="5.5"/><path d="m8.8 14 -1.8 6.5 5-2.3 5 2.3-1.8-6.5"/>'),
  trail: S('<circle cx="18" cy="7" r="2.6"/><circle cx="11" cy="11.5" r="1.9"/><circle cx="6.2" cy="15.6" r="1.4"/><circle cx="3.6" cy="19.4" r=".8"/>'),
  menu: S('<path d="M5 7h14M5 12h14M5 17h14"/>'),
  target: S('<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.4"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>'),
  tea: S('<path d="M5 9.5h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H15.5M9 3.5c-.8 1 .8 2 0 3.2M12.5 3.5c-.8 1 .8 2 0 3.2"/>'),
  pigeon: S('<path d="M5 14c0-4 3-7 7-7 1-2 3.5-2.5 5-1l2 .5-1.6 1.4c.4 2.6-.6 5.1-2.4 6.6L13.5 18H8.5l1.2-2.2C7 16 5 15.4 5 14z"/><path d="M3 12.5 5 14"/>'),
};

export function icon(name, cls = '') {
  const span = document.createElement('span');
  span.className = 'gp-icon ' + cls;
  span.innerHTML = ICONS[name] || ICONS.paw;
  return span;
}
