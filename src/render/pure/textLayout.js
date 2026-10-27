// Floating text layout: keeps labels off each other, off the player's animal and
// off the HUD corners, and inside the safe area. Pure and allocation-free.
//
// Each label is described by its desired anchor (centre x, bottom y) in CSS
// pixels plus its measured width and height. The resolver writes the resolved
// centre x and bottom y into ox/oy. Higher prio labels are placed first and
// keep their spot; others move up (or down when there's no room above).

export function createLayout(max = 32) {
  return {
    max, n: 0,
    x: new Float32Array(max), y: new Float32Array(max),
    w: new Float32Array(max), h: new Float32Array(max),
    prio: new Float32Array(max),
    ox: new Float32Array(max), oy: new Float32Array(max),
    order: new Int16Array(max),
    placed: new Int16Array(max),
    // rectangles to avoid: l, t, r, b packed
    avoid: new Float32Array(4 * 8), avoidN: 0,
  };
}

export function clearLayout(L) { L.n = 0; L.avoidN = 0; }

export function addLabel(L, x, y, w, h, prio) {
  if (L.n >= L.max) return -1;
  const i = L.n++;
  L.x[i] = x; L.y[i] = y; L.w[i] = w; L.h[i] = h; L.prio[i] = prio;
  L.ox[i] = x; L.oy[i] = y;
  return i;
}

export function addAvoid(L, l, t, r, b) {
  if (L.avoidN >= 8) return;
  const o = L.avoidN * 4;
  L.avoid[o] = l; L.avoid[o + 1] = t; L.avoid[o + 2] = r; L.avoid[o + 3] = b;
  L.avoidN++;
}

// Returns the index of the first rectangle the candidate overlaps, encoded as
// >= 0 for placed labels (label index) and <= -2 for avoid rects (-2 - k), or -1 for none.
function firstHit(L, nPlaced, l, t, r, b, gap) {
  for (let k = 0; k < L.avoidN; k++) {
    const o = k * 4;
    if (l < L.avoid[o + 2] + gap && r > L.avoid[o] - gap && t < L.avoid[o + 3] + gap && b > L.avoid[o + 1] - gap) return -2 - k;
  }
  for (let p = 0; p < nPlaced; p++) {
    const j = L.placed[p];
    const jl = L.ox[j] - L.w[j] * 0.5, jr = L.ox[j] + L.w[j] * 0.5, jb = L.oy[j], jt = jb - L.h[j];
    if (l < jr + gap && r > jl - gap && t < jb + gap && b > jt - gap) return j;
  }
  return -1;
}

function hitTop(L, hit) {
  if (hit >= 0) return L.oy[hit] - L.h[hit];
  return L.avoid[(-2 - hit) * 4 + 1];
}
function hitBottom(L, hit) {
  if (hit >= 0) return L.oy[hit];
  return L.avoid[(-2 - hit) * 4 + 3];
}

// safe = {l, t, r, b}. gap = spacing in px between labels.
export function resolveLayout(L, safe, gap = 4) {
  const n = L.n;
  // order by priority, descending (insertion sort, n is small)
  for (let i = 0; i < n; i++) L.order[i] = i;
  for (let i = 1; i < n; i++) {
    const v = L.order[i];
    let j = i - 1;
    while (j >= 0 && L.prio[L.order[j]] < L.prio[v]) { L.order[j + 1] = L.order[j]; j--; }
    L.order[j + 1] = v;
  }
  let nPlaced = 0;
  for (let k = 0; k < n; k++) {
    const i = L.order[k];
    const w = L.w[i], h = L.h[i];
    const x = clampC(L.x[i], safe.l + w * 0.5, safe.r - w * 0.5);
    const y0 = clampC(L.y[i], safe.t + h, safe.b);
    let y = y0;
    let ok = false;
    // try moving up first
    for (let it = 0; it < 10; it++) {
      const hit = firstHit(L, nPlaced, x - w * 0.5, y - h, x + w * 0.5, y, gap);
      if (hit === -1) { ok = true; break; }
      y = hitTop(L, hit) - gap;
      if (y - h < safe.t) break;
    }
    if (!ok) {
      // then down
      y = y0;
      for (let it = 0; it < 10; it++) {
        const hit = firstHit(L, nPlaced, x - w * 0.5, y - h, x + w * 0.5, y, gap);
        if (hit === -1) { ok = true; break; }
        y = hitBottom(L, hit) + gap + h;
        if (y > safe.b) break;
      }
    }
    if (!ok) y = y0; // give up gracefully: overlap rather than vanish
    L.ox[i] = x;
    L.oy[i] = clampC(y, safe.t + h, safe.b);
    L.placed[nPlaced++] = i;
  }
  return L;
}

function clampC(v, a, b) { return a > b ? (a + b) * 0.5 : v < a ? a : v > b ? b : v; }

// Opacity factor for a label near the safe-area edge (fades over `band` px).
export function edgeFade(x, y, w, h, safe, band) {
  const dl = x - w * 0.5 - safe.l, dr = safe.r - (x + w * 0.5);
  const dt = y - h - safe.t, db = safe.b - y;
  const d = Math.min(dl, dr, dt, db);
  if (d >= band) return 1;
  if (d <= 0) return 0.35;
  return 0.35 + 0.65 * (d / band);
}

// Default time on screen for a line, in seconds, by its length and style.
export function defaultTtl(text, style) {
  const n = text ? text.length : 0;
  const base = style === 'big' ? 2.6 : style === 'item' ? 1.6 : 2.0;
  return Math.min(6.5, base + n * 0.055);
}
