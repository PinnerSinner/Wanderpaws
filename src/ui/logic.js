// Pure UI maths and state helpers. No DOM, no window: Node tests import this.
// Everything visual in src/ui is built on these so the numbers stay testable.

export const UNIT_MIN_PX = 3.6;

// The layout unit: u = min(innerHeight, 0.55 * innerWidth) / 100, floored for phones.
export function unitPx(w, h, scale = 1, min = UNIT_MIN_PX) {
  const u = Math.max(min, Math.min(h, 0.55 * w) / 100);
  return u * clampScale(scale);
}

export function clampScale(s) {
  const v = Number(s);
  if (!Number.isFinite(v)) return 1;
  return Math.min(1.6, Math.max(0.8, v));
}

// Body text in px: 2.6u with a 14 px floor, scaled by textScale.
export function bodyPx(w, h, textScale = 1) {
  return Math.max(14, 2.6 * unitPx(w, h, textScale));
}

// How many columns a menu gets at this aspect. Below about 1.3:1 we reflow to one.
export function menuColumns(w, h) {
  const a = w / Math.max(1, h);
  if (a < 1.3) return 1;
  if (a < 2.05) return 2;
  return 3;
}

// Layout extents in units, used to check the design fits at every target size.
export function viewportInUnits(w, h, scale = 1) {
  const u = unitPx(w, h, scale);
  return { u, wide: w / u, tall: h / u };
}

// ---------------------------------------------------------------- easing
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeOutQuart = (t) => 1 - Math.pow(1 - clamp01(t), 4);
export function easeOutBack(t, s = 1.70158) {
  const x = clamp01(t) - 1;
  return 1 + (s + 1) * x * x * x + s * x * x;
}
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

// Count-up: eases from `from` to `to` over `duration` seconds.
export function countUp(from, to, elapsed, duration) {
  if (duration <= 0 || elapsed >= duration) return to;
  if (elapsed <= 0) return from;
  return from + (to - from) * easeOutQuart(elapsed / duration);
}

// Bigger jumps count for longer, within a sensible window.
export function countUpDuration(delta, min = 0.5, max = 1.6) {
  const d = Math.abs(delta);
  if (d === 0) return 0;
  return Math.min(max, Math.max(min, 0.35 + Math.log10(1 + d) * 0.4));
}

// How many integer steps a count-up passes through (drives the tick sound, throttled).
export function countTicks(prev, next) {
  return Math.abs(Math.floor(next) - Math.floor(prev));
}

// Damped spring towards a target, one step. Returns the new {x, v}.
export function springTo(s, target, dt, freq = 6, zeta = 0.45) {
  const w = freq * Math.PI * 2;
  const f = 1 + 2 * dt * zeta * w;
  const oo = w * w, hoo = dt * oo, hhoo = dt * hoo;
  const det = 1 / (f + hhoo);
  const x = (f * s.x + dt * s.v + hhoo * target) * det;
  const v = (s.v + hoo * (target - s.x)) * det;
  s.x = x; s.v = v;
  return s;
}

// ---------------------------------------------------------------- formatting
export function formatInt(n) {
  const v = Math.round(Number(n) || 0);
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (v < 0 ? '-' : '') + s;
}

export function formatSizeUI(m) {
  if (!Number.isFinite(m)) return '0 cm';
  if (m < 1) return `${Math.max(1, Math.round(m * 100))} cm`;
  if (m < 10) return `${m.toFixed(1)} m`;
  return `${formatInt(m)} m`;
}

export function formatClock(sec) {
  sec = Math.max(0, Number(sec) || 0);
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatClockPrecise(sec) {
  sec = Math.max(0, Number(sec) || 0);
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60), cs = Math.floor((sec * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function formatDistance(m) {
  m = Number(m) || 0;
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`;
}

// ---------------------------------------------------------------- HUD maths

// Progress of the size badge's arc: from the previous milestone to the next,
// measured in log space so growth feels even. After the goal it heads to the stretch.
export function milestoneProgress(size, goals) {
  const start = goals?.start ?? 0.25;
  const marks = [...(goals?.milestones || [])].filter((m) => m > start);
  if (goals?.goal) marks.push(goals.goal);
  if (goals?.stretch) marks.push(goals.stretch);
  const uniq = [...new Set(marks)].sort((a, b) => a - b);
  let prev = start;
  for (let i = 0; i < uniq.length; i++) {
    const next = uniq[i];
    if (size < next) {
      const t = (Math.log(Math.max(size, 1e-6)) - Math.log(prev)) / (Math.log(next) - Math.log(prev));
      return { index: i, prev, next, t: clamp01(t), done: false };
    }
    prev = next;
  }
  return { index: uniq.length, prev, next: prev, t: 1, done: true };
}

// 0 until the last 30 s, then rises smoothly to 1 at zero. No flashing, just a warm tint.
export function timerWarmth(timeLeft, window = 30) {
  if (timeLeft == null || !Number.isFinite(timeLeft)) return 0;
  if (timeLeft >= window) return 0;
  const t = 1 - Math.max(0, timeLeft) / window;
  return t * t * (3 - 2 * t);
}

// Mix two #rrggbb colours.
export function mixColour(a, b, t) {
  const pa = parseHex(a), pb = parseHex(b);
  const k = clamp01(t);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * k);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * k);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * k);
  return '#' + [r, g, bl].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function parseHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Relative luminance (0..1), for choosing ink on swatches.
export function luminance(hex) {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// HSL <-> hex for the dressing-room pickers. h 0..360, s and l 0..100.
export function hexToHsl(hex) {
  const [r, g, b] = parseHex(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex(h, s, l) {
  h = ((Number(h) % 360) + 360) % 360; s = clamp01(s / 100); l = clamp01(l / 100);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}

// Stat multipliers (1 = Oli) onto a 0..1 bar. 0.5 maps to a sliver, 1.6 to full.
export function statBar(mult) {
  const v = Number(mult);
  if (!Number.isFinite(v)) return 0.5;
  return clamp01(0.08 + (v - 0.5) / 1.1 * 0.92);
}

// ---------------------------------------------------------------- codes

// Rolling buffer of typed letters, checked against the profile's code list.
// check(buffer) returns { code, modifier } or null.
export function createCodeBuffer({ check, max = 12, dedupeMs = 45 } = {}) {
  let buf = '';
  let lastChar = '', lastAt = -1e9;
  return {
    get value() { return buf; },
    clear() { buf = ''; },
    // now: ms timestamp (lets two input sources deliver the same key without doubling)
    push(ch, now = 0) {
      if (typeof ch !== 'string' || ch.length !== 1) return null;
      const c = ch.toUpperCase();
      if (!/[A-Z0-9]/.test(c)) return null;
      if (c === lastChar && now - lastAt < dedupeMs) return null;
      lastChar = c; lastAt = now;
      buf = (buf + c).slice(-max);
      let hit = null;
      try { hit = check ? check(buf) : null; } catch { hit = null; }
      if (hit) buf = '';
      return hit || null;
    },
  };
}

export const KONAMI = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];

// Feeds direction and letter tokens; returns true when the whole sequence lands.
export function createKonamiMatcher(seq = KONAMI) {
  let recent = [];
  return {
    push(tok) {
      recent.push(tok);
      if (recent.length > seq.length) recent.shift();
      if (recent.length === seq.length && recent.every((x, i) => x === seq[i])) { recent = []; return true; }
      return false;
    },
    reset() { recent = []; },
  };
}

// ---------------------------------------------------------------- navigation

// Spatial focus navigation: picks the best candidate rect in a direction.
// rects: [{x, y, w, h}], from: {x, y, w, h}. Returns the index or -1.
export function navPick(from, rects, dir) {
  const fx = from.x + from.w / 2, fy = from.y + from.h / 2;
  let best = -1, bestScore = Infinity;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (r === from) continue;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    let main, cross, overlap;
    if (dir === 'right') { main = r.x - (from.x + from.w) ; cross = cy - fy; overlap = spanOverlap(from.y, from.h, r.y, r.h); if (cx <= fx + 1) continue; }
    else if (dir === 'left') { main = from.x - (r.x + r.w); cross = cy - fy; overlap = spanOverlap(from.y, from.h, r.y, r.h); if (cx >= fx - 1) continue; }
    else if (dir === 'down') { main = r.y - (from.y + from.h); cross = cx - fx; overlap = spanOverlap(from.x, from.w, r.x, r.w); if (cy <= fy + 1) continue; }
    else { main = from.y - (r.y + r.h); cross = cx - fx; overlap = spanOverlap(from.x, from.w, r.x, r.w); if (cy >= fy - 1) continue; }
    const m = Math.max(0, main);
    const score = m + Math.abs(cross) * (overlap > 0 ? 0.25 : 2.2) - overlap * 0.3;
    if (score < bestScore) { bestScore = score; best = i; }
  }
  return best;
}

function spanOverlap(a, al, b, bl) {
  return Math.max(0, Math.min(a + al, b + bl) - Math.max(a, b));
}

// Drops the second of two identical actions arriving from different sources
// within a short window (input.onMenu and the keyboard fallback both fire).
export function createActionDeduper(windowMs = 70) {
  let last = { action: '', source: '', at: -1e9 };
  return (action, source, now) => {
    if (action === last.action && source !== last.source && now - last.at < windowMs) return false;
    last = { action, source, at: now };
    return true;
  };
}

// ---------------------------------------------------------------- photo helpers

// Downsample size that keeps aspect, longest side `max`.
export function downsampleSize(w, h, max = 96) {
  if (!w || !h) return { w: 0, h: 0 };
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

// Circular cropper: which source rect lands in the square output, given zoom (>=1)
// and a pan offset in source pixels from the image centre.
export function cropRect(imgW, imgH, zoom, panX, panY) {
  const base = Math.min(imgW, imgH);
  const side = base / Math.max(1, zoom);
  let x = imgW / 2 + panX - side / 2;
  let y = imgH / 2 + panY - side / 2;
  x = Math.min(Math.max(0, x), imgW - side);
  y = Math.min(Math.max(0, y), imgH - side);
  return { x, y, side };
}

// Average-colour fallback palette if customise.paletteFromPixels is unavailable.
export function simplePalette(rgba, w, h) {
  const buckets = [[], [], []];
  const cx = w / 2, cy = h / 2, rr = Math.min(w, h) * 0.42;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (Math.hypot(x - cx, y - cy) > rr) continue;
      const i = (y * w + x) * 4;
      const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      const l = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
      buckets[l < 0.38 ? 0 : l < 0.68 ? 1 : 2].push([r, g, b]);
    }
  }
  const avg = (arr, fb) => {
    if (!arr.length) return fb;
    const s = arr.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]);
    return '#' + s.map((v) => Math.round(v / arr.length).toString(16).padStart(2, '0')).join('');
  };
  const sizes = buckets.map((b) => b.length);
  const mainIdx = sizes.indexOf(Math.max(...sizes));
  const base = avg(buckets[mainIdx], '#c9a05a');
  const dark = avg(buckets[0], mixColour(base, '#000000', 0.3));
  const light = avg(buckets[2], mixColour(base, '#ffffff', 0.35));
  return { base, secondary: mainIdx === 0 ? avg(buckets[1], dark) : dark, belly: light, tips: dark };
}

// ---------------------------------------------------------------- result card

// Layout for the shareable PNG (default 1200 x 630). All rects in px.
export function resultCardLayout(W = 1200, H = 630) {
  const pad = Math.round(H * 0.06);
  const photoW = Math.round(W * 0.52);
  const photo = { x: pad, y: pad, w: photoW - pad, h: H - pad * 2, r: Math.round(H * 0.05) };
  const colX = photo.x + photo.w + pad;
  const colW = W - colX - pad;
  const title = { x: colX, y: pad + Math.round(H * 0.07), size: Math.round(H * 0.075) };
  const name = { x: colX, y: title.y + Math.round(H * 0.13), size: Math.round(H * 0.11) };
  const starR = Math.round(Math.min(colW / 8, H * 0.06));
  const stars = { x: colX + starR, y: name.y + Math.round(H * 0.12), r: starR, gap: Math.round(starR * 2.5) };
  const size = { x: colX, y: stars.y + starR + Math.round(H * 0.17), size: Math.round(H * 0.14) };
  const meta = { x: colX, y: size.y + Math.round(H * 0.09), size: Math.round(H * 0.045) };
  const footer = { x: colX, y: H - pad, size: Math.round(H * 0.035) };
  return { W, H, pad, photo, colX, colW, title, name, stars, size, meta, footer };
}

// Checks a layout keeps every block inside the card (tests use this).
export function layoutInside(L) {
  const inside = (x, y) => x >= 0 && y >= 0 && x <= L.W && y <= L.H;
  return inside(L.photo.x, L.photo.y) && inside(L.photo.x + L.photo.w, L.photo.y + L.photo.h)
    && inside(L.stars.x + L.stars.gap * 2 + L.stars.r, L.stars.y + L.stars.r)
    && inside(L.size.x, L.size.y) && inside(L.meta.x, L.meta.y) && inside(L.footer.x, L.footer.y)
    && L.size.y < L.meta.y && L.meta.y < L.footer.y && L.stars.y < L.size.y;
}

// ---------------------------------------------------------------- misc data

// Species unlock rule into a copy key plus vars (used when the profile has no hint).
export function unlockHintFor(species) {
  const u = species?.unlock || { kind: 'start' };
  switch (u.kind) {
    case 'start': return { key: 'ui.unlock.start', vars: {} };
    case 'stars': return { key: 'ui.unlock.stars', vars: { count: u.count || 1, world: u.world || 'w1' } };
    case 'finish': return { key: 'ui.unlock.finish', vars: { world: u.world || 'w1' } };
    case 'journal': return { key: 'ui.unlock.journal', vars: { pct: u.pct || 25 } };
    case 'golden': return { key: 'ui.unlock.golden', vars: { world: u.world || 'w1' } };
    case 'secret': return { key: 'ui.unlock.secret', vars: {} };
    case 'egg': return { key: 'ui.unlock.egg', vars: {} };
    case 'story': return { key: 'ui.unlock.story', vars: {} };
    default: return { key: 'ui.unlock.secret', vars: {} };
  }
}

export const WORLD_IDS = ['w1', 'w2', 'w3', 'w4', 'w5'];

// Which comic to play, if any, before starting a run.
export function comicBefore({ worldId, mode, seen = {} }) {
  if (mode && mode !== 'story') return null;
  if (worldId === 'w1' && !seen.intro) return 'intro';
  const i = WORLD_IDS.indexOf(worldId);
  if (i > 0 && !seen['between-' + worldId]) return 'between-' + worldId;
  return null;
}

// Toast scheduling: keeps at most `max` on screen; returns the ones to show.
export function createToastQueue({ max = 3, ttl = 2.5 } = {}) {
  const live = [];
  const waiting = [];
  return {
    push(item) { waiting.push(item); },
    // returns { added: [], removed: [] } for this tick; now in seconds
    tick(now) {
      const removed = [];
      for (let i = live.length - 1; i >= 0; i--) {
        if (now - live[i].at >= (live[i].item.ttl || ttl)) removed.push(live.splice(i, 1)[0].item);
      }
      const added = [];
      while (live.length < max && waiting.length) {
        const item = waiting.shift();
        live.push({ item, at: now });
        added.push(item);
      }
      return { added, removed };
    },
    get size() { return live.length + waiting.length; },
  };
}

// Star pips: how many have been newly earned between two star arrays.
export function newStars(prev, next) {
  const out = [];
  for (let i = 0; i < 3; i++) if (next?.[i] && !prev?.[i]) out.push(i);
  return out;
}

// Picks the next world for the end screen.
export function nextWorldId(worldId) {
  const i = WORLD_IDS.indexOf(worldId);
  return i >= 0 && i < WORLD_IDS.length - 1 ? WORLD_IDS[i + 1] : null;
}
