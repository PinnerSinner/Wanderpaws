// Looks: merging, validation, randomising, and "make it your pet" palette
// extraction from photo pixels. Node-importable, deterministic.

import { clamp01, hexToRgb, rgbToHex, rgbToHsl, hslToRgb, shadeHex, mixHex } from '../core/math.js';
import { PATTERNS, SPECIES } from './species.js';
import { getCosmetic } from './cosmetics.js';

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const COLOUR_KEYS = ['base', 'secondary', 'belly', 'tips', 'eyes', 'nose', 'patternColor'];
const ACC_SLOTS = ['head', 'neck', 'back', 'face', 'badge'];
const MAX_DECAL = 400000; // characters of data URL (about 300 KB)

export function normHex(v, fallback = null) {
  if (typeof v !== 'string') return fallback;
  const m = HEX_RE.exec(v.trim());
  if (!m) return fallback;
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return '#' + h;
}

function cosmeticOrNull(id, slot) {
  if (id == null || id === '') return null;
  const c = getCosmetic(id);
  return c && c.slot === slot ? c.id : null;
}

// Sanitises any look-shaped object into a complete, valid Look. Unknown or bad
// values fall back to `fallback` (a Look, usually the species defaults).
export function validateLook(look, fallback = SPECIES.oli.defaults) {
  const src = look && typeof look === 'object' ? look : {};
  const fb = fallback || SPECIES.oli.defaults;
  const out = {};
  for (const k of COLOUR_KEYS) out[k] = normHex(src[k], normHex(fb[k], '#888888'));
  out.pattern = PATTERNS.includes(src.pattern) ? src.pattern : (PATTERNS.includes(fb.pattern) ? fb.pattern : 'none');
  const seed = Number(src.patternSeed);
  out.patternSeed = Number.isFinite(seed) ? (Math.floor(Math.abs(seed)) >>> 0) : (fb.patternSeed >>> 0 || 1);
  const amt = Number(src.patternAmount);
  out.patternAmount = Number.isFinite(amt) ? clamp01(amt) : clamp01(Number(fb.patternAmount) || 0.5);
  const acc = src.accessories && typeof src.accessories === 'object' ? src.accessories : {};
  const fbAcc = fb.accessories || {};
  out.accessories = {};
  for (const s of ACC_SLOTS) {
    const v = s in acc ? acc[s] : fbAcc[s];
    out.accessories[s] = cosmeticOrNull(v, s);
  }
  out.trail = cosmeticOrNull('trail' in src ? src.trail : fb.trail, 'trail');
  out.soundPack = cosmeticOrNull('soundPack' in src ? src.soundPack : fb.soundPack, 'sound');
  const d = 'decal' in src ? src.decal : fb.decal;
  out.decal = typeof d === 'string' && d.startsWith('data:image/') && d.length <= MAX_DECAL ? d : null;
  return out;
}

// species defaults <- partial. Accessories merge per slot.
export function mergeLook(species, partial) {
  const sp = species && species.defaults ? species : SPECIES.oli;
  const p = partial && typeof partial === 'object' ? partial : {};
  const merged = {
    ...sp.defaults,
    ...p,
    accessories: { ...(sp.defaults.accessories || {}), ...(p.accessories || {}) },
  };
  return validateLook(merged, sp.defaults);
}

export function applyPreset(species, presetId, current) {
  const pr = (species.presets || []).find((x) => x.id === presetId);
  if (!pr) return mergeLook(species, current);
  const keep = current ? { accessories: current.accessories, trail: current.trail, soundPack: current.soundPack, decal: current.decal } : {};
  return mergeLook(species, { ...species.defaults, pattern: 'none', ...pr.look, ...keep });
}

// A believable random look: often a preset, sometimes a gentle hue drift of
// the defaults, with a random marking. rng is a createRng() instance.
export function randomLook(species, rng, opts = {}) {
  const sp = species && species.defaults ? species : SPECIES.oli;
  const r = rng || { next: Math.random };
  const rnd = () => r.next();
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  let look = { ...sp.defaults };
  if (sp.presets.length && rnd() < 0.6) {
    look = { ...look, pattern: 'none', ...pick(sp.presets).look };
  } else {
    const dh = (rnd() - 0.5) * 0.06, dl = (rnd() - 0.5) * 0.16;
    const drift = (hex) => {
      const { r: R, g, b } = hexToRgb(hex);
      const hsl = rgbToHsl(R, g, b);
      const o = hslToRgb((hsl.h + dh + 1) % 1, clamp01(hsl.s * (0.8 + rnd() * 0.4)), clamp01(hsl.l + dl));
      return rgbToHex(o.r, o.g, o.b);
    };
    for (const k of ['base', 'secondary', 'belly', 'tips']) look[k] = drift(look[k]);
    if (rnd() < 0.55) {
      look.pattern = pick(PATTERNS.slice(1));
      look.patternColor = rnd() < 0.5 ? shadeHex(look.base, -0.25) : mixHex(look.belly, '#ffffff', 0.5);
    }
  }
  look.patternSeed = Math.floor(rnd() * 100000);
  look.patternAmount = 0.3 + rnd() * 0.5;
  look.accessories = { head: null, neck: null, back: null, face: null, badge: null };
  if (Array.isArray(opts.owned) && opts.owned.length) {
    for (const s of ACC_SLOTS) {
      const pool = opts.owned.map(getCosmetic).filter((c) => c && c.slot === s);
      if (pool.length && rnd() < 0.4) look.accessories[s] = pick(pool).id;
    }
  }
  return validateLook(look, sp.defaults);
}

// ---------------------------------------------------------------------------
// Photo palette: centre-weighted, background-rejecting weighted k-means (k=5)
// in CIE Lab, mapped to base / secondary / belly / tips by area and lightness.

function srgbToLin(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function labF(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
export function rgbToLab(r, g, b, out) {
  const R = srgbToLin(r), G = srgbToLin(g), B = srgbToLin(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const fx = labF(X), fy = labF(Y), fz = labF(Z);
  out[0] = 116 * fy - 16; out[1] = 500 * (fx - fy); out[2] = 200 * (fy - fz);
  return out;
}

function kmeans(pts, wts, n, k, iters, seedIdx, quantiles = 0) {
  // pts: Float32Array n*3, wts: Float32Array n. Deterministic init: the first
  // `quantiles` centres sit at weighted lightness quantiles (fur varies mostly
  // in lightness, so base and belly get their own seeds), the rest are chosen
  // farthest-point, scored by distance times weight.
  const cent = new Float64Array(k * 3);
  const assign = new Int32Array(n);
  let c0 = 0;
  if (quantiles > 0) {
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => pts[a * 3] - pts[b * 3] || a - b);
    let tw = 0; for (let i = 0; i < n; i++) tw += wts[i];
    const q = Math.min(quantiles, k);
    for (let c = 0; c < q; c++) {
      const target = tw * (c + 0.5) / q;
      let acc = 0, pick = order[n - 1];
      for (const i of order) { acc += wts[i]; if (acc >= target) { pick = i; break; } }
      cent[c * 3] = pts[pick * 3]; cent[c * 3 + 1] = pts[pick * 3 + 1]; cent[c * 3 + 2] = pts[pick * 3 + 2];
    }
    c0 = q;
  } else {
    let first = seedIdx;
    if (first < 0) { let bw = -1; for (let i = 0; i < n; i++) if (wts[i] > bw) { bw = wts[i]; first = i; } }
    cent[0] = pts[first * 3]; cent[1] = pts[first * 3 + 1]; cent[2] = pts[first * 3 + 2];
    c0 = 1;
  }
  const dmin = new Float64Array(n).fill(Infinity);
  for (let c = 0; c < c0; c++) for (let i = 0; i < n; i++) {
    const dx = pts[i * 3] - cent[c * 3], dy = pts[i * 3 + 1] - cent[c * 3 + 1], dz = pts[i * 3 + 2] - cent[c * 3 + 2];
    const d = dx * dx + dy * dy + dz * dz;
    if (d < dmin[i]) dmin[i] = d;
  }
  for (let c = c0; c < k; c++) {
    let best = 0, bestScore = -1;
    for (let i = 0; i < n; i++) {
      const score = dmin[i] * wts[i];
      if (score > bestScore) { bestScore = score; best = i; }
    }
    cent[c * 3] = pts[best * 3]; cent[c * 3 + 1] = pts[best * 3 + 1]; cent[c * 3 + 2] = pts[best * 3 + 2];
    for (let i = 0; i < n; i++) {
      const dx = pts[i * 3] - cent[c * 3], dy = pts[i * 3 + 1] - cent[c * 3 + 1], dz = pts[i * 3 + 2] - cent[c * 3 + 2];
      const d = dx * dx + dy * dy + dz * dz;
      if (d < dmin[i]) dmin[i] = d;
    }
  }
  const sum = new Float64Array(k * 4);
  for (let it = 0; it < iters; it++) {
    sum.fill(0);
    let moved = 0;
    for (let i = 0; i < n; i++) {
      let bc = 0, bd = Infinity;
      for (let c = 0; c < k; c++) {
        const dx = pts[i * 3] - cent[c * 3], dy = pts[i * 3 + 1] - cent[c * 3 + 1], dz = pts[i * 3 + 2] - cent[c * 3 + 2];
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bd) { bd = d; bc = c; }
      }
      if (assign[i] !== bc) moved++;
      assign[i] = bc;
      const w = wts[i];
      sum[bc * 4] += pts[i * 3] * w; sum[bc * 4 + 1] += pts[i * 3 + 1] * w; sum[bc * 4 + 2] += pts[i * 3 + 2] * w; sum[bc * 4 + 3] += w;
    }
    for (let c = 0; c < k; c++) {
      const w = sum[c * 4 + 3];
      if (w > 1e-9) { cent[c * 3] = sum[c * 4] / w; cent[c * 3 + 1] = sum[c * 4 + 1] / w; cent[c * 3 + 2] = sum[c * 4 + 2] / w; }
    }
    if (it > 0 && moved === 0) break;
  }
  // final weights
  sum.fill(0);
  for (let i = 0; i < n; i++) sum[assign[i] * 4 + 3] += wts[i];
  return { cent, weight: Array.from({ length: k }, (_, c) => sum[c * 4 + 3]), assign };
}

// rgba: Uint8Array/Uint8ClampedArray of w*h*4. Returns hex colours plus some
// diagnostics (clusters sorted by weight) for the dressing-room preview.
export function paletteFromPixels(rgba, w, h, opts = {}) {
  const k = opts.k || 5;
  const maxSide = opts.maxSide || 96;
  const step = Math.max(1, Math.ceil(Math.max(w, h) / maxSide));
  const sw = Math.ceil(w / step), sh = Math.ceil(h / step);
  const n = sw * sh;
  const rgb = new Float32Array(n * 3);
  const lab = new Float32Array(n * 3);
  const tmp = [0, 0, 0];
  let idx = 0;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      // point-sample the block centre: averaging would invent fake edge colours
      const xx = Math.min(w - 1, x * step + (step >> 1)), yy = Math.min(h - 1, y * step + (step >> 1));
      const p = (yy * w + xx) * 4;
      let r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
      const c = 1;
      if (rgba[p + 3] !== undefined && rgba[p + 3] < 16) { r = g = b = 255; }
      rgb[idx * 3] = r / c / 255; rgb[idx * 3 + 1] = g / c / 255; rgb[idx * 3 + 2] = b / c / 255;
      rgbToLab(rgb[idx * 3], rgb[idx * 3 + 1], rgb[idx * 3 + 2], tmp);
      lab[idx * 3] = tmp[0]; lab[idx * 3 + 1] = tmp[1]; lab[idx * 3 + 2] = tmp[2];
      idx++;
    }
  }
  // 1. Background model from the border ring (k=3 on border samples).
  const ring = Math.max(1, Math.round(Math.min(sw, sh) * 0.08));
  const borderIdx = [];
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    if (x < ring || y < ring || x >= sw - ring || y >= sh - ring) borderIdx.push(y * sw + x);
  }
  const bn = borderIdx.length;
  const bpts = new Float32Array(bn * 3), bw = new Float32Array(bn).fill(1);
  for (let i = 0; i < bn; i++) { const j = borderIdx[i]; bpts[i * 3] = lab[j * 3]; bpts[i * 3 + 1] = lab[j * 3 + 1]; bpts[i * 3 + 2] = lab[j * 3 + 2]; }
  const bk = Math.min(3, bn);
  const bg = kmeans(bpts, bw, bn, bk, 12, -1);
  const bgCols = [];
  for (let c = 0; c < bk; c++) if (bg.weight[c] / bn > 0.12) bgCols.push([bg.cent[c * 3], bg.cent[c * 3 + 1], bg.cent[c * 3 + 2]]);
  const sigma = opts.bgSigma || 14; // Lab distance where background-ness halves-ish
  // 2. Per-pixel weight = centre falloff * (1 - background probability).
  const wts = new Float32Array(n);
  const cx = (sw - 1) / 2, cy = (sh - 1) / 2;
  const rx = sw * 0.42, ry = sh * 0.42;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const i = y * sw + x;
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    const centre = Math.exp(-(dx * dx + dy * dy) * 1.1);
    let bgp = 0;
    for (const bc of bgCols) {
      const ex = lab[i * 3] - bc[0], ey = lab[i * 3 + 1] - bc[1], ez = lab[i * 3 + 2] - bc[2];
      const p = Math.exp(-(ex * ex + ey * ey + ez * ez) / (2 * sigma * sigma));
      if (p > bgp) bgp = p;
    }
    wts[i] = centre * (1 - bgp) + 1e-6;
  }
  // 3. Weighted k-means on the foreground.
  const km = kmeans(lab, wts, n, Math.min(k, n), 24, -1, 3);
  const total = km.weight.reduce((a, b) => a + b, 0) || 1;
  const clusters = [];
  for (let c = 0; c < km.weight.length; c++) {
    // average sRGB of members (weighted) for faithful hex output
    let r = 0, g = 0, b = 0, ww = 0;
    for (let i = 0; i < n; i++) if (km.assign[i] === c) { const wi = wts[i]; r += rgb[i * 3] * wi; g += rgb[i * 3 + 1] * wi; b += rgb[i * 3 + 2] * wi; ww += wi; }
    if (ww <= 0) continue;
    clusters.push({ hex: rgbToHex(r / ww, g / ww, b / ww), share: km.weight[c] / total, L: km.cent[c * 3], a: km.cent[c * 3 + 1], b: km.cent[c * 3 + 2] });
  }
  clusters.sort((p, q) => q.share - p.share || p.L - q.L);
  const useful = clusters.filter((c) => c.share >= 0.03);
  if (!useful.length) useful.push(clusters[0] || { hex: '#e8c27a', share: 1, L: 75, a: 0, b: 30 });
  // 4. Map clusters to roles.
  const dist = (p, q) => Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
  const base = useful[0];
  const rest = useful.slice(1).filter((c) => dist(c, base) > 8);
  let belly = null, secondary = null, tips = null;
  let lightest = null;
  for (const c of rest) if (c.L > base.L + 8 && (!lightest || c.L > lightest.L)) lightest = c;
  if (lightest) belly = lightest;
  const remaining = rest.filter((c) => c !== belly);
  if (remaining.length) secondary = remaining[0];
  const rem2 = remaining.filter((c) => c !== secondary);
  let darkest = null;
  for (const c of rem2) if (!darkest || c.L < darkest.L) darkest = c;
  tips = darkest;
  const out = {
    base: base.hex,
    secondary: secondary ? secondary.hex : shadeHex(base.hex, -0.07),
    belly: belly ? belly.hex : mixHex(base.hex, '#ffffff', 0.35),
    tips: tips ? tips.hex : (secondary ? shadeHex(secondary.hex, -0.08) : shadeHex(base.hex, -0.15)),
  };
  Object.defineProperty(out, 'clusters', { value: clusters, enumerable: false });
  return out;
}
