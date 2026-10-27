// Original inline-SVG art for menus: the logo, world vignettes, species
// portraits, comic panels and pattern swatches. Pure string builders, so they
// import in Node too (handy for tests and for drawing onto canvases).

export const FONT_STACK = `ui-rounded, 'SF Pro Rounded', 'Nunito', 'Varela Round', 'Arial Rounded MT Bold', 'Segoe UI Black', 'Segoe UI', 'Inter', system-ui, sans-serif`;

const INK = '#4b2e26';

let uid = 0;
const nid = (p) => `${p}${++uid}`;

// ---------------------------------------------------------------- logo
export function logoSVG(name = 'Gobblepaws') {
  const split = name.toLowerCase().endsWith('paws') ? [name.slice(0, -4), name.slice(-4)] : [name, ''];
  const a = nid('lga'), b = nid('lgb'), sh = nid('lgs');
  const top = split[0], bottom = split[1];
  const topLen = Math.min(600, 100 * Math.max(4, top.length));
  const botLen = Math.min(420, 92 * Math.max(3, bottom.length));
  return `<svg class="gp-logo-svg" viewBox="0 0 640 320" role="img" aria-label="${esc(name)}">
  <defs>
    <linearGradient id="${a}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0a8"/><stop offset=".55" stop-color="#ffd166"/><stop offset="1" stop-color="#ff9b54"/></linearGradient>
    <linearGradient id="${b}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ff0d6"/><stop offset="1" stop-color="#2bb59a"/></linearGradient>
    <filter id="${sh}" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#7a3b1e" flood-opacity=".28"/></filter>
  </defs>
  <g filter="url(#${sh})" font-family="${FONT_STACK}" font-weight="900" text-anchor="middle" stroke-linejoin="round" stroke-linecap="round">
    <g transform="rotate(-5 320 140)">
      <text x="320" y="168" font-size="158" textLength="${topLen}" lengthAdjust="spacingAndGlyphs" fill="${INK}" stroke="${INK}" stroke-width="40" transform="translate(0 12)">${esc(top)}</text>
      <text x="320" y="168" font-size="158" textLength="${topLen}" lengthAdjust="spacingAndGlyphs" fill="url(#${a})" stroke="${INK}" stroke-width="24" paint-order="stroke">${esc(top)}</text>
      <text x="320" y="150" font-size="158" textLength="${topLen}" lengthAdjust="spacingAndGlyphs" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="5" stroke-dasharray="2 34" >${esc(top)}</text>
    </g>
    ${bottom ? `<g transform="rotate(-2 400 262)">
      <text x="400" y="292" font-size="124" textLength="${botLen}" lengthAdjust="spacingAndGlyphs" fill="${INK}" stroke="${INK}" stroke-width="36" transform="translate(0 10)">${esc(bottom)}</text>
      <text x="400" y="292" font-size="124" textLength="${botLen}" lengthAdjust="spacingAndGlyphs" fill="url(#${b})" stroke="${INK}" stroke-width="22" paint-order="stroke">${esc(bottom)}</text>
    </g>` : ''}
    <g transform="translate(118 236) rotate(-18)">
      <g fill="${INK}" transform="translate(0 6)">${pawPath(1.25)}</g>
      <g fill="#ff7a59" stroke="${INK}" stroke-width="8" paint-order="stroke">${pawPath(1.25)}</g>
    </g>
  </g>
</svg>`;
}

function pawPath(k = 1) {
  const e = (cx, cy, rx, ry) => `<ellipse cx="${cx * k}" cy="${cy * k}" rx="${rx * k}" ry="${ry * k}"/>`;
  return e(-22, -10, 9, 11) + e(-8, -28, 9, 11) + e(10, -28, 9, 11) + e(24, -10, 9, 11)
    + `<path d="M${1 * k} ${-6 * k}c${12 * k} 0 ${25 * k} ${16 * k} ${25 * k} ${26 * k}c0 ${8 * k} ${-6 * k} ${12 * k} ${-12 * k} ${12 * k}c${-5 * k} 0 ${-8 * k} ${-3 * k} ${-13 * k} ${-3 * k}s${-8 * k} ${3 * k} ${-13 * k} ${3 * k}c${-6 * k} 0 ${-12 * k} ${-4 * k} ${-12 * k} ${-12 * k}c0 ${-10 * k} ${13 * k} ${-26 * k} ${25 * k} ${-26 * k}z"/>`;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ---------------------------------------------------------------- worlds
export const WORLD_TINTS = {
  w1: { a: '#3cc0c8', b: '#ffe3b0', accent: '#ff7a59', ink: '#1e6f86' },
  w2: { a: '#8cc56a', b: '#e9f2dc', accent: '#d9372b', ink: '#3d6b2e' },
  w3: { a: '#2f9e6a', b: '#d9f5c4', accent: '#ffb02e', ink: '#1f5e42' },
  w4: { a: '#8f7fd1', b: '#f5ecff', accent: '#5aa7e0', ink: '#4b3f8a' },
  w5: { a: '#7b6be0', b: '#e6fff6', accent: '#55e0b5', ink: '#3b2f8a' },
};

// Square vignette, 200 x 200. `shape`: 'circle' clips round, 'rect' fills.
export function worldArt(id, shape = 'circle') {
  const c = nid('wc'), g = nid('wg');
  const body = WORLD_BODIES[id] ? WORLD_BODIES[id](g) : WORLD_BODIES.w1(g);
  const clip = shape === 'circle' ? `<clipPath id="${c}"><circle cx="100" cy="100" r="96"/></clipPath>` : `<clipPath id="${c}"><rect width="200" height="200"/></clipPath>`;
  return `<svg class="gp-world-art" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>${clip}</defs><g clip-path="url(#${c})">${body}</g></svg>`;
}

const WORLD_BODIES = {
  w1: (g) => `
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd3f2"/><stop offset="1" stop-color="#ffe9c2"/></linearGradient></defs>
    <rect width="200" height="200" fill="url(#${g})"/>
    <circle cx="150" cy="48" r="20" fill="#fff4c2"/><circle cx="150" cy="48" r="28" fill="#fff4c2" opacity=".35"/>
    <path d="M18 112c8-34 22-52 34-52 9 0 12 18 18 28 6-22 16-40 28-40 14 0 20 34 26 64z" fill="#4f9a7c"/>
    <path d="M18 112c8-34 22-52 34-52 6 0 9 8 12 16-10 6-20 20-28 36z" fill="#6bb894"/>
    <rect y="104" width="200" height="30" fill="#2fb3c4"/>
    <path d="M0 108c20-5 30 5 50 0s30-5 50 0 30 5 50 0 30-5 50 0" stroke="#fff" stroke-width="4" fill="none" opacity=".8"/>
    <path d="M0 124c18-4 32 4 50 0s32-4 50 0 32 4 50 0 32-4 50 0" stroke="#bff3f0" stroke-width="3" fill="none" opacity=".7"/>
    <rect y="132" width="200" height="30" fill="#f7deb0"/>
    <rect y="160" width="200" height="40" fill="#f4f1ea"/>
    <path d="M-5 172c15-10 25 10 40 0s25-10 40 0 25 10 40 0 25-10 40 0 25 10 40 0M-5 190c15-10 25 10 40 0s25-10 40 0 25 10 40 0 25-10 40 0 25 10 40 0" stroke="#2a2422" stroke-width="7" fill="none"/>
    <path d="M58 150V120" stroke="#8a5a3a" stroke-width="3"/>
    <path d="M30 124c8-14 48-14 56 0z" fill="#ff7a59"/><path d="M44 124c4-10 20-10 24 0z" fill="#fff" opacity=".7"/>
    <circle cx="128" cy="146" r="8" fill="#fff" stroke="#e05a3b" stroke-width="2"/><path d="M120 146h16M128 138v16" stroke="#e05a3b" stroke-width="2"/>
    <circle cx="170" cy="150" r="5" fill="#d7f25a" stroke="#9bb82a" stroke-width="1.5"/>`,
  w2: (g) => `
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bcdcf0"/><stop offset="1" stop-color="#eef6e4"/></linearGradient></defs>
    <rect width="200" height="200" fill="url(#${g})"/>
    <g fill="#fff" opacity=".95"><circle cx="58" cy="44" r="16"/><circle cx="78" cy="38" r="20"/><circle cx="100" cy="46" r="14"/><rect x="44" y="44" width="70" height="14" rx="7"/></g>
    <path d="M60 64l-4 10M76 66l-4 10M92 64l-4 10" stroke="#7aa8d0" stroke-width="3" stroke-linecap="round"/>
    <circle cx="160" cy="44" r="16" fill="#fff1b8"/>
    <path d="M0 120c30-16 70-20 100-14s60 6 100-8v102H0z" fill="#7fbf5e"/>
    <path d="M0 140c40-10 80-8 120 0s60 4 80 0v60H0z" fill="#69ad4c"/>
    <circle cx="34" cy="100" r="22" fill="#4f9a3e"/><circle cx="48" cy="90" r="18" fill="#5fae4a"/><rect x="36" y="110" width="6" height="22" fill="#7a5236"/>
    <rect x="120" y="96" width="70" height="40" rx="8" fill="#d9372b"/><rect x="120" y="76" width="70" height="26" rx="8" fill="#e8463a"/>
    <g fill="#cfe8ff"><rect x="126" y="82" width="12" height="12" rx="2"/><rect x="142" y="82" width="12" height="12" rx="2"/><rect x="158" y="82" width="12" height="12" rx="2"/><rect x="174" y="82" width="12" height="12" rx="2"/><rect x="126" y="104" width="12" height="12" rx="2"/><rect x="142" y="104" width="12" height="12" rx="2"/><rect x="158" y="104" width="12" height="12" rx="2"/></g>
    <circle cx="134" cy="138" r="7" fill="#2f2a28"/><circle cx="176" cy="138" r="7" fill="#2f2a28"/>
    <rect x="92" y="98" width="20" height="44" rx="4" fill="#c52b22"/><rect x="96" y="104" width="12" height="16" fill="#ffe9a8"/>
    <ellipse cx="60" cy="168" rx="30" ry="9" fill="#8fc7e8"/>
    <path d="M54 164c2-4 8-4 10 0" stroke="#ffd23a" stroke-width="5" stroke-linecap="round" fill="none"/>`,
  w3: (g) => `
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfeccf"/><stop offset="1" stop-color="#f4fbe0"/></linearGradient></defs>
    <rect width="200" height="200" fill="url(#${g})"/>
    <path d="M0 90c20-30 50-40 70-30s30-20 60-20 50 20 70 30v130H0z" fill="#3e9c68"/>
    <path d="M86 50h26v110H86z" fill="#e9fbff"/><path d="M90 50v110M100 50v110M108 50v110" stroke="#bfe9f5" stroke-width="2"/>
    <path d="M0 120c30-20 60-24 86-14v94H0zM112 104c30-10 60-6 88 10v86H112z" fill="#2f8a56"/>
    <ellipse cx="99" cy="166" rx="40" ry="10" fill="#9fe3f0"/>
    <path d="M20 200c0-40 10-60 30-80-6 30-4 50 4 80z" fill="#1f6e42"/>
    <path d="M190 200c-10-40-30-56-56-64 20 20 28 40 30 64z" fill="#256f45"/>
    <path d="M150 70c20-20 40-20 48-10-16 0-30 8-40 20z" fill="#5cc27a"/>
    <path d="M10 60c10-22 30-28 46-20-16 4-28 12-36 26z" fill="#5cc27a"/>
    <g transform="translate(150 118)"><ellipse rx="10" ry="8" fill="#222"/><path d="M6-4c10-6 22-2 24 4-8 2-16 4-24 2z" fill="#ffb02e"/><circle cx="2" cy="-2" r="2" fill="#fff"/></g>
    <circle cx="44" cy="150" r="7" fill="#ffcf3a"/><circle cx="56" cy="146" r="6" fill="#ff8a3a"/>`,
  w4: (g) => `
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8e7fd6"/><stop offset=".55" stop-color="#f3b6c6"/><stop offset="1" stop-color="#ffe2c4"/></linearGradient></defs>
    <rect width="200" height="200" fill="url(#${g})"/>
    <path d="M0 50c40-20 70 10 110-6s60-20 90-6" stroke="#8ff0c8" stroke-width="10" fill="none" opacity=".55"/>
    <path d="M10 38c40-16 70 8 110-4s50-16 80-4" stroke="#c9a8ff" stroke-width="6" fill="none" opacity=".6"/>
    <path d="M-10 130 40 60l30 36 30-50 50 70 40-30 30 44z" fill="#6a5fa8"/>
    <path d="M40 60 52 76l-8 2-10 10-6-10zM100 46l14 22-10-2-8 10-8-8-8 4zM150 116 158 106l12 10z" fill="#fff"/>
    <rect y="128" width="200" height="22" fill="#5aa7e0"/><path d="M10 138h40M80 142h50M150 136h30" stroke="#d7efff" stroke-width="3" stroke-linecap="round"/>
    <path d="M0 150h200v50H0z" fill="#f7f4ff"/>
    <path d="M0 150c30 8 60 10 100 4s70-6 100 2" fill="#e7e2fa"/>
    <g transform="translate(160 160)"><path d="M0-34 14-8H6l12 18H-18L-6-8h-8z" fill="#3f7a5a"/><rect x="-3" y="10" width="6" height="8" fill="#6b4a32"/></g>
    <g transform="translate(46 176)"><ellipse rx="18" ry="11" fill="#c0703f"/><ellipse cx="-16" cy="-4" rx="8" ry="7" fill="#c0703f"/><path d="M-22-10c-4-6 0-8 4-4M-14-11c2-6 6-6 6-1" stroke="#f3e2c4" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M-24-4c4-6 10-6 14 0" fill="#e6a26e"/></g>`,
  w5: (g) => `
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2f7a"/><stop offset=".6" stop-color="#8a6fe0"/><stop offset="1" stop-color="#ffd9b8"/></linearGradient></defs>
    <rect width="200" height="200" fill="url(#${g})"/>
    <g fill="#fff"><circle cx="20" cy="22" r="1.6"/><circle cx="60" cy="14" r="1.2"/><circle cx="96" cy="30" r="1.6"/><circle cx="140" cy="18" r="1.2"/><circle cx="182" cy="34" r="1.6"/><circle cx="34" cy="56" r="1.2"/></g>
    <circle cx="160" cy="54" r="16" fill="#ffe9b8"/><circle cx="166" cy="50" r="14" fill="#5a47b0"/>
    <g fill="#f5f0ff"><circle cx="40" cy="160" r="30"/><circle cx="80" cy="150" r="34"/><circle cx="130" cy="156" r="32"/><circle cx="172" cy="164" r="28"/><rect x="10" y="160" width="190" height="40"/></g>
    <g><rect x="56" y="78" width="24" height="70" rx="4" fill="#2f2766"/><rect x="88" y="62" width="28" height="86" rx="4" fill="#3b3180"/><rect x="124" y="90" width="22" height="58" rx="4" fill="#2f2766"/></g>
    <g fill="#55e0b5"><rect x="61" y="86" width="14" height="3" rx="1.5"/><rect x="61" y="96" width="9" height="3" rx="1.5"/><rect x="61" y="106" width="14" height="3" rx="1.5"/><rect x="94" y="72" width="16" height="3" rx="1.5"/><rect x="94" y="82" width="10" height="3" rx="1.5"/><rect x="94" y="92" width="16" height="3" rx="1.5"/><rect x="128" y="100" width="14" height="3" rx="1.5"/></g>
    <g fill="#ffb86b"><circle cx="72" cy="120" r="2"/><circle cx="106" cy="110" r="2"/><circle cx="138" cy="120" r="2"/></g>
    <path d="M102 62V40M94 46c5-5 11-5 16 0M90 40c7-8 17-8 24 0" stroke="#55e0b5" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M20 182c30-10 60 10 90 0s60-10 90 0" stroke="#b9a3ff" stroke-width="4" fill="none"/>`,
};

// ---------------------------------------------------------------- portraits

// A friendly head-and-shoulders portrait per species, coloured from a Look.
// silhouette: draws it as a dark shape for locked animals.
export function portraitSVG(speciesId, look = {}, { silhouette = false } = {}) {
  const L = {
    base: '#e8c27a', secondary: '#c9a05a', belly: '#f3dca6', tips: '#c9a05a', eyes: '#5a3a1e', nose: '#2a1d17',
    pattern: 'none', patternColor: '#ffffff', ...look,
  };
  const bg = nid('pb');
  let art = (PORTRAITS[speciesId] || PORTRAITS.oli)(L);
  if (silhouette) art = `<g class="gp-silhouette" fill="#3b2a24" stroke="#3b2a24">${art.replace(/fill="[^"]*"/g, 'fill="#3b2a24"').replace(/stroke="(?!none)[^"]*"/g, 'stroke="#3b2a24"')}</g>`;
  return `<svg class="gp-portrait" viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="${bg}" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="50" cy="48" r="44" fill="url(#${bg})"/>${art}</svg>`;
}

const eyes = (L, y = 46, dx = 12, r = 5) => `
  <circle cx="${50 - dx}" cy="${y}" r="${r}" fill="${L.eyes}"/><circle cx="${50 + dx}" cy="${y}" r="${r}" fill="${L.eyes}"/>
  <circle cx="${50 - dx + r * 0.35}" cy="${y - r * 0.4}" r="${r * 0.38}" fill="#fff"/><circle cx="${50 + dx + r * 0.35}" cy="${y - r * 0.4}" r="${r * 0.38}" fill="#fff"/>`;
const blush = (y = 58, dx = 20) => `<ellipse cx="${50 - dx}" cy="${y}" rx="5" ry="3" fill="#ff8f8f" opacity=".45"/><ellipse cx="${50 + dx}" cy="${y}" rx="5" ry="3" fill="#ff8f8f" opacity=".45"/>`;
const bodyBase = (L, w = 34) => `<path d="M${50 - w} 100c0-20 14-30 ${w} -30s${w} 10 ${w} 30z" fill="${L.base}"/><path d="M${50 - w * 0.45} 100c0-12 6-20 ${w * 0.45} -20s${w * 0.45} 8 ${w * 0.45} 20z" fill="${L.belly}"/>`;

const PORTRAITS = {
  oli: (L) => `${bodyBase(L)}
    <path d="M22 34c-10 4-14 22-8 34 4 6 10 4 12-2l6-24z" fill="${L.tips}"/>
    <path d="M78 34c10 4 14 22 8 34-4 6-10 4-12-2l-6-24z" fill="${L.tips}"/>
    <ellipse cx="50" cy="46" rx="28" ry="26" fill="${L.base}"/>
    <ellipse cx="50" cy="60" rx="16" ry="12" fill="${L.belly}"/>
    ${eyes(L, 44, 12, 4.6)}
    <ellipse cx="50" cy="54" rx="6" ry="4.4" fill="${L.nose}"/>
    <path d="M50 58v4M44 63c3 3 9 3 12 0" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M47 64c0 6 6 6 6 0" fill="#ff8a9a"/>${blush(56, 19)}`,
  cat: (L) => `${bodyBase(L, 30)}
    <path d="M24 38 26 12l20 16zM76 38 74 12 54 28z" fill="${L.base}"/>
    <path d="M28 32l1-12 10 8zM72 32l-1-12-10 8z" fill="${L.belly}"/>
    <ellipse cx="50" cy="48" rx="27" ry="24" fill="${L.base}"/>
    ${L.pattern === 'stripes' ? `<path d="M50 25v8M42 26l2 7M58 26l-2 7" stroke="${L.patternColor}" stroke-width="3" stroke-linecap="round"/>` : ''}
    <ellipse cx="50" cy="60" rx="12" ry="9" fill="${L.belly}"/>
    <ellipse cx="38" cy="46" rx="5" ry="5.6" fill="${L.eyes}"/><ellipse cx="62" cy="46" rx="5" ry="5.6" fill="${L.eyes}"/>
    <ellipse cx="38" cy="46" rx="1.6" ry="4.4" fill="#1a1a1a"/><ellipse cx="62" cy="46" rx="1.6" ry="4.4" fill="#1a1a1a"/>
    <circle cx="39.5" cy="43.5" r="1.4" fill="#fff"/><circle cx="63.5" cy="43.5" r="1.4" fill="#fff"/>
    <path d="M46 55h8l-4 4z" fill="${L.nose}"/>
    <path d="M50 59c-2 3-5 3-7 1M50 59c2 3 5 3 7 1" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <path d="M30 58h-12M30 62l-11 3M70 58h12M70 62l11 3" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".9"/>`,
  routercat: (L) => PORTRAITS.cat(L) + `
    <path d="M34 22V6M66 22V6" stroke="#5a5a66" stroke-width="3" stroke-linecap="round"/><circle cx="34" cy="6" r="3.5" fill="#55e0b5"/><circle cx="66" cy="6" r="3.5" fill="#ff7a59"/>
    <g fill="#55e0b5"><circle cx="42" cy="86" r="2.4"/><circle cx="50" cy="86" r="2.4"/><circle cx="58" cy="86" r="2.4" fill="#ffd166"/></g>`,
  capybara: (L) => `${bodyBase(L, 36)}
    <circle cx="30" cy="26" r="6" fill="${L.secondary}"/><circle cx="70" cy="26" r="6" fill="${L.secondary}"/>
    <rect x="22" y="22" width="56" height="50" rx="24" fill="${L.base}"/>
    <rect x="30" y="46" width="40" height="28" rx="14" fill="${L.secondary}"/>
    <ellipse cx="42" cy="56" rx="3" ry="2.4" fill="${L.nose}"/><ellipse cx="58" cy="56" rx="3" ry="2.4" fill="${L.nose}"/>
    <path d="M36 40c3-2 6-2 8 0M56 40c2-2 5-2 8 0" stroke="${L.eyes}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
    <path d="M44 66c4 2 8 2 12 0" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <g transform="translate(64 16) rotate(18)"><circle r="7" fill="#ffb02e"/><path d="M0-7v-4" stroke="#3f8a4a" stroke-width="2"/></g>`,
  penguin: (L) => `
    <path d="M16 100c0-24 14-36 34-36s34 12 34 36z" fill="${L.base}"/><path d="M30 100c0-16 8-26 20-26s20 10 20 26z" fill="${L.belly}"/>
    <ellipse cx="50" cy="46" rx="28" ry="28" fill="${L.base}"/>
    <path d="M50 32c-8-8-24-4-22 12 1 10 10 18 22 22 12-4 21-12 22-22 2-16-14-20-22-12z" fill="${L.belly}"/>
    ${eyes(L, 44, 10, 4.4)}
    <path d="M42 54h16l-8 9z" fill="${L.tips === '#c9a05a' ? '#ff9a3a' : L.tips}"/>
    ${blush(56, 16)}`,
  rabbit: (L) => `${bodyBase(L, 30)}
    <ellipse cx="38" cy="16" rx="8" ry="22" fill="${L.base}" transform="rotate(-10 38 30)"/><ellipse cx="62" cy="16" rx="8" ry="22" fill="${L.base}" transform="rotate(10 62 30)"/>
    <ellipse cx="38" cy="16" rx="4" ry="16" fill="#ffb3c0" transform="rotate(-10 38 30)"/><ellipse cx="62" cy="16" rx="4" ry="16" fill="#ffb3c0" transform="rotate(10 62 30)"/>
    <ellipse cx="50" cy="52" rx="26" ry="23" fill="${L.base}"/>
    <ellipse cx="50" cy="62" rx="12" ry="9" fill="${L.belly}"/>
    ${eyes(L, 49, 12, 4.6)}
    <path d="M46 58h8l-4 4z" fill="#ff8a9a"/><path d="M50 62v3" stroke="${INK}" stroke-width="1.8"/>
    <rect x="47" y="65" width="6" height="5" rx="1.5" fill="#fff"/>${blush(60, 18)}`,
  duck: (L) => `${bodyBase(L, 32)}
    <circle cx="50" cy="44" r="26" fill="${L.base}"/>
    ${L.pattern === 'bands' ? `<path d="M26 60c16 6 32 6 48 0" stroke="${L.patternColor}" stroke-width="4" fill="none"/>` : ''}
    <path d="M50 22c-2-8 6-10 6-4" stroke="${L.secondary}" stroke-width="4" fill="none" stroke-linecap="round"/>
    ${eyes(L, 40, 11, 4.2)}
    <ellipse cx="50" cy="56" rx="17" ry="7" fill="${L.tips === '#c9a05a' ? '#ff9a3a' : L.tips}"/>
    <path d="M36 56c8 3 20 3 28 0" stroke="#d9741f" stroke-width="1.8" fill="none"/>${blush(50, 18)}`,
  tortoise: (L) => `
    <path d="M10 100c0-32 18-46 40-46s40 14 40 46z" fill="${L.secondary}"/>
    <path d="M26 100c2-18 10-28 24-28s22 10 24 28M50 72v28M30 84h40" stroke="${L.tips}" stroke-width="3" fill="none"/>
    <ellipse cx="50" cy="40" rx="22" ry="20" fill="${L.base}"/>
    <path d="M38 56c0 12 24 12 24 0z" fill="${L.base}"/>
    ${eyes(L, 38, 9, 4)}
    <path d="M42 50c5 4 11 4 16 0" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>${blush(46, 15)}`,
  frog: (L) => `${bodyBase(L, 34)}
    <ellipse cx="50" cy="54" rx="34" ry="22" fill="${L.base}"/>
    <circle cx="32" cy="34" r="12" fill="${L.base}"/><circle cx="68" cy="34" r="12" fill="${L.base}"/>
    <circle cx="32" cy="34" r="7.5" fill="#fff"/><circle cx="68" cy="34" r="7.5" fill="#fff"/>
    <circle cx="33" cy="35" r="4.4" fill="${L.eyes}"/><circle cx="69" cy="35" r="4.4" fill="${L.eyes}"/>
    <ellipse cx="50" cy="64" rx="18" ry="8" fill="${L.belly}"/>
    <path d="M26 56c10 10 38 10 48 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>${blush(60, 26)}`,
  redpanda: (L) => `${bodyBase(L, 32)}
    <circle cx="26" cy="28" r="11" fill="${L.base}"/><circle cx="74" cy="28" r="11" fill="${L.base}"/>
    <circle cx="26" cy="28" r="6" fill="${L.belly}"/><circle cx="74" cy="28" r="6" fill="${L.belly}"/>
    <ellipse cx="50" cy="48" rx="29" ry="25" fill="${L.base}"/>
    <path d="M30 40c4-6 10-6 12 0M58 40c2-6 8-6 12 0" stroke="${L.belly}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M34 60c4-10 10-14 16-14s12 4 16 14c-6 8-26 8-32 0z" fill="${L.belly}"/>
    <path d="M30 50c2 10 6 16 10 18M70 50c-2 10-6 16-10 18" stroke="${L.secondary}" stroke-width="4" fill="none" stroke-linecap="round"/>
    ${eyes(L, 47, 12, 4.4)}
    <ellipse cx="50" cy="57" rx="4.6" ry="3.4" fill="${L.nose}"/>
    <path d="M45 62c3 2 7 2 10 0" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
  octopus: (L) => `
    <g fill="${L.base}">
      <path d="M22 70c-6 10-10 22-6 30h8c-2-8 2-18 8-26z"/><path d="M34 74c-4 10-4 20 0 26h8c-2-8-2-16 2-24z"/>
      <path d="M56 74c4 8 4 16 2 26h8c4-6 4-16 0-26z"/><path d="M68 70c6 8 10 18 8 30h8c4-8 0-20-6-30z"/>
    </g>
    <g fill="${L.belly}" opacity=".9"><circle cx="20" cy="94" r="2"/><circle cx="38" cy="94" r="2"/><circle cx="62" cy="94" r="2"/><circle cx="80" cy="94" r="2"/></g>
    <path d="M50 12c20 0 30 16 30 34 0 18-12 30-30 30S20 64 20 46c0-18 10-34 30-34z" fill="${L.base}"/>
    <g fill="${L.secondary}" opacity=".6"><circle cx="40" cy="26" r="4"/><circle cx="62" cy="22" r="3"/><circle cx="66" cy="34" r="2.4"/></g>
    ${eyes(L, 50, 11, 5)}
    <path d="M44 62c4 3 8 3 12 0" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>${blush(58, 20)}`,
  snake: (L) => `
    <path d="M10 92c10-14 34-16 50-10s28 6 32-4" stroke="${L.base}" stroke-width="16" fill="none" stroke-linecap="round"/>
    <path d="M10 92c10-14 34-16 50-10s28 6 32-4" stroke="${L.secondary}" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="4 10"/>
    <path d="M40 84c-6-14-4-30 6-40" stroke="${L.base}" stroke-width="16" fill="none" stroke-linecap="round"/>
    <ellipse cx="54" cy="38" rx="22" ry="17" fill="${L.base}"/>
    <ellipse cx="56" cy="46" rx="14" ry="7" fill="${L.belly}"/>
    ${eyes(L, 34, 10, 4.2).replace(/cx="(\d+(\.\d+)?)"/g, (m, v) => `cx="${Number(v) + 4}"`)}
    <path d="M72 46h10M82 46l4-3M82 46l4 3" stroke="#e0485a" stroke-width="2" stroke-linecap="round"/>`,
  elephant: (L) => `
    <path d="M14 100c0-24 16-34 36-34s36 10 36 34z" fill="${L.base}"/>
    <ellipse cx="20" cy="46" rx="18" ry="22" fill="${L.secondary}"/><ellipse cx="80" cy="46" rx="18" ry="22" fill="${L.secondary}"/>
    <ellipse cx="20" cy="46" rx="11" ry="15" fill="#f2b6bf" opacity=".7"/><ellipse cx="80" cy="46" rx="11" ry="15" fill="#f2b6bf" opacity=".7"/>
    <ellipse cx="50" cy="42" rx="25" ry="24" fill="${L.base}"/>
    <path d="M44 54c-2 14 0 26 8 32 4 2 8 0 6-4-4-6-4-14-2-28z" fill="${L.base}"/>
    <path d="M45 66h8M45 72h9M47 78h8" stroke="${L.secondary}" stroke-width="1.6" stroke-linecap="round"/>
    ${eyes(L, 40, 11, 4)}
    <path d="M36 56c-4 2-6 6-4 8M64 56c4 2 6 6 4 8" stroke="#fffaf0" stroke-width="4" stroke-linecap="round" fill="none"/>${blush(50, 18)}`,
};

// ---------------------------------------------------------------- patterns
export const PATTERNS = ['none', 'patches', 'stripes', 'spots', 'socks', 'blaze', 'saddle', 'mask', 'bands'];

export function patternSwatch(kind, base = '#e8c27a', mark = '#4b2e26') {
  const c = nid('ps');
  const body = {
    none: '',
    patches: `<path d="M8 14c6-6 16-4 16 4s-12 10-16 4zM28 26c6-4 14 0 12 8s-12 4-12-2z" fill="${mark}"/>`,
    stripes: `<path d="M10 4l6 40M22 2l4 42M34 2l2 42" stroke="${mark}" stroke-width="4"/>`,
    spots: `<g fill="${mark}"><circle cx="12" cy="12" r="3.5"/><circle cx="28" cy="10" r="3"/><circle cx="20" cy="24" r="3.6"/><circle cx="34" cy="28" r="3"/><circle cx="10" cy="32" r="3"/></g>`,
    socks: `<path d="M0 32h48v16H0z" fill="${mark}"/>`,
    blaze: `<path d="M20 0h8l2 48H18z" fill="${mark}"/>`,
    saddle: `<path d="M0 10c10 6 38 6 48 0v14c-10 6-38 6-48 0z" fill="${mark}"/>`,
    mask: `<path d="M4 18c6-6 12-6 20 2 8-8 14-8 20-2-2 10-12 12-20 6-8 6-18 4-20-6z" fill="${mark}"/>`,
    bands: `<path d="M0 12h48v6H0zM0 28h48v6H0z" fill="${mark}"/>`,
  }[kind] || '';
  return `<svg viewBox="0 0 48 48" class="gp-pattern-svg" aria-hidden="true"><defs><clipPath id="${c}"><circle cx="24" cy="24" r="22"/></clipPath></defs><g clip-path="url(#${c})"><rect width="48" height="48" fill="${base}"/>${body}</g><circle cx="24" cy="24" r="22" fill="none" stroke="${INK}" stroke-opacity=".25" stroke-width="2"/></svg>`;
}

// ---------------------------------------------------------------- comic
// Reusable figures, drawn in a 300 x 400 panel space.
function oli(x, y, s = 1, flip = false, look = {}) {
  const L = { base: '#e8c27a', belly: '#f3dca6', tips: '#c9a05a', nose: '#1f1714', eyes: '#5a3a1e', ...look };
  return `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">
    <path d="M-62 -10c-10-6-18-2-22 4" stroke="${L.base}" stroke-width="10" stroke-linecap="round" fill="none"/>
    <ellipse cx="-20" cy="-20" rx="48" ry="26" fill="${L.base}"/>
    <ellipse cx="-14" cy="-8" rx="30" ry="12" fill="${L.belly}"/>
    <rect x="-56" y="-8" width="13" height="34" rx="6" fill="${L.base}"/><rect x="-34" y="-6" width="13" height="32" rx="6" fill="${L.base}"/>
    <rect x="0" y="-8" width="13" height="34" rx="6" fill="${L.base}"/><rect x="16" y="-8" width="13" height="34" rx="6" fill="${L.base}"/>
    <ellipse cx="34" cy="-52" rx="30" ry="27" fill="${L.base}"/>
    <path d="M14 -66c-10 2-14 22-6 32 4 4 10 2 10-4l2-20z" fill="${L.tips}"/>
    <ellipse cx="54" cy="-42" rx="17" ry="12" fill="${L.belly}"/>
    <ellipse cx="66" cy="-48" rx="7" ry="5.4" fill="${L.nose}"/>
    <circle cx="40" cy="-60" r="4.8" fill="${L.eyes}"/><circle cx="41.6" cy="-62" r="1.8" fill="#fff"/>
    <path d="M50 -34c4 4 10 4 14 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  </g>`;
}
function gerald(x, y, s = 1, flip = false, wings = 'up') {
  const wing = wings === 'up' ? 'M-6 -16c-10-30-34-40-50-36 12 10 20 26 26 40z' : 'M-6 -10c-20 2-40 12-48 26 18-4 32-8 44-14z';
  return `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">
    <path d="M-36 4l-22 10 4-14z" fill="#6d7488"/>
    <ellipse cx="0" cy="0" rx="40" ry="24" fill="#9aa3b8"/>
    <path d="${wing}" fill="#7b849b"/>
    <ellipse cx="6" cy="8" rx="22" ry="12" fill="#c9a6c8" opacity=".7"/>
    <circle cx="34" cy="-22" r="18" fill="#8b94ab"/>
    <path d="M22 -10c6 6 16 6 22 0" stroke="#5fc79a" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M50 -24l14 4-14 5z" fill="#e8a23a"/>
    <circle cx="40" cy="-26" r="4" fill="#fff"/><circle cx="41" cy="-26" r="2.2" fill="#ff7a2a"/>
    <path d="M34 -34l12 3" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M-4 22v10M8 22v10" stroke="#e88a6a" stroke-width="3.4" stroke-linecap="round"/>
  </g>`;
}
function ball(x, y, r = 14) {
  return `<g transform="translate(${x} ${y})"><circle r="${r}" fill="#d7f25a" stroke="#9bb82a" stroke-width="${r * 0.12}"/><path d="M${-r * 0.9} ${-r * 0.3}c${r * 0.6} ${r * 0.2} ${r * 0.9} ${r * 0.8} ${r * 0.6} ${r * 1.2}M${r * 0.9} ${r * 0.3}c${-r * 0.6} ${-r * 0.2} ${-r * 0.9} ${-r * 0.8} ${-r * 0.6} ${-r * 1.2}" stroke="#fff" stroke-width="${r * 0.14}" fill="none" stroke-linecap="round"/></g>`;
}
function beachBg(sky1 = '#8fd8f5', sky2 = '#ffe9c2') {
  const g = nid('cb');
  return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky1}"/><stop offset="1" stop-color="${sky2}"/></linearGradient></defs>
  <rect width="300" height="400" fill="url(#${g})"/>
  <path d="M-10 210c20-60 50-90 70-90 16 0 22 30 32 48 10-36 28-66 50-66 24 0 36 60 46 110z" fill="#5aa889" opacity=".85"/>
  <rect y="200" width="300" height="50" fill="#36bccb"/>
  <path d="M0 208c25-6 37 6 62 0s37-6 62 0 37 6 62 0 37-6 62 0 37 6 62 0" stroke="#fff" stroke-width="5" fill="none" opacity=".8"/>
  <rect y="248" width="300" height="152" fill="#f7deb0"/>
  <path d="M-10 330c25-14 38 14 62 0s38-14 62 0 38 14 62 0 38-14 62 0 38 14 62 0M-10 362c25-14 38 14 62 0s38-14 62 0 38 14 62 0 38-14 62 0 38 14 62 0" stroke="#2a2422" stroke-width="10" fill="none" opacity=".9"/>`;
}
function burst(x, y, r, fill = '#fff36b') {
  let d = '';
  const n = 14;
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const rr = i % 2 ? r * 0.62 : r;
    d += (i ? 'L' : 'M') + (x + Math.cos(a) * rr).toFixed(1) + ' ' + (y + Math.sin(a) * rr).toFixed(1);
  }
  return `<path d="${d}z" fill="${fill}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`;
}
function speedLines(x, y, n = 5, len = 60, ang = 0) {
  let s = `<g stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".85" transform="translate(${x} ${y}) rotate(${ang})">`;
  for (let i = 0; i < n; i++) s += `<path d="M0 ${i * 16}h${-len + i * 8}"/>`;
  return s + '</g>';
}
function sparkle(x, y, r = 10, fill = '#fff') {
  return `<path transform="translate(${x} ${y})" d="M0 ${-r}C${r * 0.15} ${-r * 0.15} ${r * 0.15} ${-r * 0.15} ${r} 0C${r * 0.15} ${r * 0.15} ${r * 0.15} ${r * 0.15} 0 ${r}C${-r * 0.15} ${r * 0.15} ${-r * 0.15} ${r * 0.15} ${-r} 0C${-r * 0.15} ${-r * 0.15} ${-r * 0.15} ${-r * 0.15} 0 ${-r}z" fill="${fill}"/>`;
}
function nest(x, y, s = 1) {
  let balls = '';
  const rng = mulberry(7);
  for (let i = 0; i < 46; i++) {
    const a = rng() * Math.PI, r = 20 + rng() * 90;
    balls += ball(x + Math.cos(a) * r * (rng() > 0.5 ? 1 : -1) * 0.95, y - Math.sin(a) * r * 0.55 - 10, 9 + rng() * 5);
  }
  return `<g transform="scale(${s})"><ellipse cx="${x}" cy="${y + 12}" rx="128" ry="34" fill="#a8743f"/>${balls}<path d="M${x - 130} ${y + 6}c40 26 220 26 260 0" stroke="#7a4f27" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M${x - 120} ${y + 20}c50 18 190 18 240 0" stroke="#c8915a" stroke-width="6" fill="none" stroke-linecap="round" stroke-dasharray="14 10"/></g>`;
}
function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function panelSVG(inner) {
  return `<svg class="gp-comic-svg" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${inner}</svg>`;
}

// Panels for each comic. Captions come from copy (ui.comic.*), keyed by index.
export function comicPanels(kind, look) {
  if (kind === 'intro') {
    return [
      { key: 'ui.comic.intro.1', svg: panelSVG(beachBg() + `<circle cx="240" cy="70" r="30" fill="#fff4c2"/>` + oli(130, 330, 1.25, false, look) + sparkle(250, 250, 12) + sparkle(40, 160, 8)) },
      { key: 'ui.comic.intro.2', svg: panelSVG(`<rect width="300" height="400" fill="#ffe9a8"/><g opacity=".5">${Array.from({ length: 12 }, (_, i) => `<path d="M150 200L${150 + Math.cos(i / 12 * Math.PI * 2) * 320} ${200 + Math.sin(i / 12 * Math.PI * 2) * 320}" stroke="#fff" stroke-width="26"/>`).join('')}</g>` + ball(150, 200, 70) + sparkle(70, 110, 16) + sparkle(235, 290, 12) + sparkle(240, 110, 9) + `<g transform="translate(150 360)"><ellipse rx="70" ry="30" fill="${look?.base || '#e8c27a'}"/><circle cx="-26" cy="-6" r="9" fill="#5a3a1e"/><circle cx="26" cy="-6" r="9" fill="#5a3a1e"/><circle cx="-23" cy="-9" r="3.4" fill="#fff"/><circle cx="29" cy="-9" r="3.4" fill="#fff"/></g>`) },
      { key: 'ui.comic.intro.3', svg: panelSVG(beachBg('#a8dcf7', '#fff1d6') + speedLines(250, 70, 5, 120, -28) + gerald(170, 120, 1.5, false, 'up') + ball(232, 168, 16) + oli(110, 340, 1.0, false, look) + `<text x="70" y="250" font-family="${FONT_STACK}" font-weight="900" font-size="54" fill="#fff" stroke="${INK}" stroke-width="8" paint-order="stroke">?!</text>`) },
      { key: 'ui.comic.intro.4', svg: panelSVG(`<rect width="300" height="400" fill="#ff9b6b"/>` + burst(150, 150, 120, '#fff36b') + speedLines(60, 290, 6, 80, 0) + oli(170, 360, 1.2, false, look) + gerald(240, 60, 0.6, true, 'down') + ball(206, 74, 7)) },
    ];
  }
  if (kind === 'ending') {
    return [
      { key: 'ui.comic.ending.1', svg: panelSVG(`<rect width="300" height="400" fill="#7d6be0"/><g fill="#f5f0ff"><circle cx="60" cy="320" r="70"/><circle cx="160" cy="300" r="80"/><circle cx="260" cy="320" r="70"/><rect y="320" width="300" height="80"/></g>` + nest(150, 270) + gerald(150, 150, 1.1, false, 'down') + sparkle(40, 60, 10) + sparkle(260, 90, 14)) },
      { key: 'ui.comic.ending.2', svg: panelSVG(`<rect width="300" height="400" fill="#ffd9b8"/>` + gerald(200, 170, 1.4, true, 'down') + ball(150, 200, 18) + oli(110, 350, 1.15, false, look) + `<path d="M150 150c-8-14 8-24 14-10" stroke="#ff7a59" stroke-width="5" fill="none" stroke-linecap="round"/>`) },
      { key: 'ui.comic.ending.3', svg: panelSVG(beachBg('#ffb38a', '#ffe0b0') + `<circle cx="150" cy="200" r="46" fill="#ffd27a" opacity=".9"/>` + oli(90, 340, 1, false, look) + ball(190, 250, 14) + gerald(240, 300, 0.7, true, 'down') + speedLines(180, 236, 3, 40, 0)) },
    ];
  }
  // between-<world>
  const w = String(kind).replace('between-', '');
  const tint = WORLD_TINTS[w] || WORLD_TINTS.w2;
  return [{
    key: `ui.comic.between.${w}`,
    wide: true,
    svg: `<svg class="gp-comic-svg" viewBox="0 0 600 340" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="600" height="340" fill="${tint.b}"/>
      <g transform="translate(330 -10) scale(1.75)">${WORLD_BODIES[w] ? WORLD_BODIES[w](nid('cw')) : ''}</g>
      <path d="M40 260C140 120 260 300 360 160" stroke="${INK}" stroke-width="5" stroke-dasharray="4 14" stroke-linecap="round" fill="none" opacity=".5"/>
      ${gerald(380, 140, 1.2, false, 'up')}${ball(440, 190, 14)}${speedLines(330, 120, 4, 90, -10)}
      ${oli(120, 320, 0.9, false, look)}
    </svg>`,
  }];
}

// SVG string to a data URL (for drawing onto canvases).
export function svgDataUrl(svg) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
}
