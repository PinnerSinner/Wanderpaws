// Procedural canvas textures (wave pavement, signs, waterfall streaks...).
// In Node (tests) there is no canvas, so every maker returns null and callers
// fall back to plain vertex colours.

const _cache = new WeakMap();

export const FONT = "'Baloo 2', 'Nunito', 'Trebuchet MS', 'Verdana', 'Segoe UI', sans-serif";

export function hasCanvas() {
  return typeof document !== 'undefined' && typeof document.createElement === 'function';
}

function makeCanvas(w, h) {
  if (!hasCanvas()) return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// key: cache key; draw(ctx, w, h)
export function canvasTexture(THREE, key, w, h, draw, o = {}) {
  let per = _cache.get(THREE);
  if (!per) { per = new Map(); _cache.set(THREE, per); }
  if (per.has(key)) return per.get(key);
  const c = makeCanvas(w, h);
  if (!c) { per.set(key, null); return null; }
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = o.repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.anisotropy = o.anisotropy ?? 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  per.set(key, tex);
  return tex;
}

// A fresh (uncached) clone with its own repeat/offset, sharing the image.
export function texClone(tex, rx = 1, ry = 1) {
  if (!tex) return null;
  const t = tex.clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Fit text on one line inside maxW, returns the font size used.
function fitText(ctx, text, maxW, size, weight = 800) {
  let s = size;
  ctx.font = `${weight} ${s}px ${FONT}`;
  while (s > 8 && ctx.measureText(text).width > maxW) { s -= 2; ctx.font = `${weight} ${s}px ${FONT}`; }
  return s;
}

// A sign face: rounded board with border and centred lines of text.
// lines: [{ text, size?, color?, weight? } | string]
export function signTexture(THREE, key, lines, o = {}) {
  const w = o.w || 512, h = o.h || 256;
  return canvasTexture(THREE, 'sign:' + key, w, h, (ctx) => {
    ctx.fillStyle = o.edge || '#3a2a22';
    ctx.fillRect(0, 0, w, h);
    const pad = o.pad ?? 14;
    ctx.fillStyle = o.bg || '#fff6e0';
    roundRect(ctx, pad, pad, w - pad * 2, h - pad * 2, o.radius ?? 26);
    ctx.fill();
    if (o.inner) {
      ctx.strokeStyle = o.inner; ctx.lineWidth = 5;
      roundRect(ctx, pad + 12, pad + 12, w - pad * 2 - 24, h - pad * 2 - 24, (o.radius ?? 26) - 8);
      ctx.stroke();
    }
    if (o.deco) o.deco(ctx, w, h);
    const L = lines.map((l) => (typeof l === 'string' ? { text: l } : l));
    const sizes = L.map((l) => l.size || (L.length === 1 ? h * 0.42 : h * 0.26));
    const total = sizes.reduce((a, b) => a + b * 1.12, 0);
    let y = h / 2 - total / 2 + (o.yOff || 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    L.forEach((l, i) => {
      const s = fitText(ctx, l.text, w - pad * 2 - 40, sizes[i], l.weight || 800);
      y += s * 0.56;
      ctx.fillStyle = l.color || o.fg || '#3a2a22';
      ctx.fillText(l.text, w / 2, y);
      y += s * 0.56 + sizes[i] * 0.12;
    });
  });
}

// ---------------------------------------------------------------------------
// The Copacabana wave pavement: cream and charcoal bands undulating along the
// promenade (u = along, v = across). One tile = one wave period along u and two
// bands across v, so it repeats seamlessly.

export function waveTexture(THREE, o = {}) {
  const W = 512, H = 256;
  const dark = o.dark || '#2b2b30', light = o.light || '#f6f0e2';
  return canvasTexture(THREE, 'wave:' + dark + light, W, H, (ctx) => {
    const img = ctx.createImageData(W, H);
    const d = img.data;
    const c1 = hex(dark), c2 = hex(light);
    const SS = 3; // supersampling for soft edges
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let acc = 0;
        for (let sy = 0; sy < SS; sy++) {
          for (let sx = 0; sx < SS; sx++) {
            const u = (x + (sx + 0.5) / SS) / W;
            const v = (y + (sy + 0.5) / SS) / H;
            const a = u * Math.PI * 2;
            // the characteristic bulbous wave: fundamental plus a second harmonic
            const off = 0.23 * Math.sin(a) + 0.06 * Math.sin(2 * a - 0.6);
            const t = (v * 2 + off * 2 + 4) % 2;
            acc += t < 1 ? 1 : 0;
          }
        }
        const k = acc / (SS * SS);
        const i = (y * W + x) * 4;
        // little stone speckle
        const n = (hash(x, y) - 0.5) * 18;
        d[i] = clamp255(c1[0] * k + c2[0] * (1 - k) + n);
        d[i + 1] = clamp255(c1[1] * k + c2[1] * (1 - k) + n);
        d[i + 2] = clamp255(c1[2] * k + c2[2] * (1 - k) + n);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // faint mosaic grout grid (Portuguese pavement is small stones)
    ctx.globalAlpha = 0.07; ctx.strokeStyle = '#000';
    for (let x = 0; x < W; x += 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 8) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }, { repeat: true });
}

// The Marcoverse version: the same wave, drawn in glowing 1s and 0s.
export function binaryTexture(THREE) {
  const W = 512, H = 256;
  return canvasTexture(THREE, 'binarywave', W, H, (ctx) => {
    ctx.fillStyle = '#2d2758'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 15px ${FONT}`;
    const cols = 40, rows = 20;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const u = (c + 0.5) / cols, v = (r + 0.5) / rows;
        const a = u * Math.PI * 2;
        const off = 0.23 * Math.sin(a) + 0.06 * Math.sin(2 * a - 0.6);
        const t = (v * 2 + off * 2 + 4) % 2;
        const on = t < 1;
        ctx.fillStyle = on ? '#7fe3c4' : '#b9a3ff';
        ctx.globalAlpha = on ? 1 : 0.55;
        ctx.fillText(hash(c, r) > 0.5 ? '1' : '0', (c + 0.5) * W / cols, (r + 0.5) * H / rows);
      }
    }
    ctx.globalAlpha = 1;
  }, { repeat: true });
}

// Tarmac with a centre dash; tile = 8 m of road along u.
export function roadTexture(THREE, o = {}) {
  const W = 256, H = 256;
  return canvasTexture(THREE, 'road:' + (o.line || '#fff') + (o.base || ''), W, H, (ctx) => {
    ctx.fillStyle = o.base || '#5a5f66'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = hash(i, 3) > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(hash(i, 1) * W, hash(i, 2) * H, 3, 3);
    }
    ctx.fillStyle = o.line || '#fff6d0';
    ctx.fillRect(0, H / 2 - 5, W * 0.55, 10);
  }, { repeat: true });
}

export function slabTexture(THREE, o = {}) {
  const W = 256, H = 256;
  return canvasTexture(THREE, 'slab:' + (o.base || ''), W, H, (ctx) => {
    ctx.fillStyle = o.base || '#c9c4bb'; ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const k = (hash(r, c) - 0.5) * 16;
      ctx.fillStyle = `rgba(${k > 0 ? 255 : 0},${k > 0 ? 255 : 0},${k > 0 ? 255 : 0},${Math.abs(k) / 120})`;
      ctx.fillRect(c * 64 + 2, r * 64 + 2, 60, 60);
    }
    ctx.strokeStyle = 'rgba(60,50,40,0.35)'; ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(W, i * 64); ctx.stroke();
    }
  }, { repeat: true });
}

// Vertical streaks for the waterfall, scrolled in update.
export function fallTexture(THREE) {
  const W = 128, H = 256;
  return canvasTexture(THREE, 'fall', W, H, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#9fe6f0'); g.addColorStop(0.5, '#d8f7ff'); g.addColorStop(1, '#9fe6f0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      const x = hash(i, 9) * W, y = hash(i, 4) * H, len = 20 + hash(i, 5) * 70;
      ctx.strokeStyle = hash(i, 6) > 0.4 ? 'rgba(255,255,255,0.85)' : 'rgba(90,180,210,0.5)';
      ctx.lineWidth = 2 + hash(i, 7) * 4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + len); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - H); ctx.lineTo(x, y - H + len); ctx.stroke();
    }
  }, { repeat: true });
}

// Glowing cable river: bundled strands.
export function cableTexture(THREE) {
  const W = 256, H = 128;
  return canvasTexture(THREE, 'cables', W, H, (ctx) => {
    ctx.fillStyle = '#2a2350'; ctx.fillRect(0, 0, W, H);
    const cols = ['#7fe3c4', '#b9a3ff', '#ffb347', '#ff7ad9', '#6cc4f0'];
    for (let i = 0; i < 14; i++) {
      const y = 6 + i * 8.6;
      ctx.strokeStyle = cols[i % cols.length]; ctx.lineWidth = 5;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) ctx.lineTo(x, y + Math.sin((x / W) * Math.PI * 2 * 2 + i) * 2.5);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect((hash(i, 2) * W) | 0, y - 1.5, 10, 3);
    }
  }, { repeat: true });
}

function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }
export function hash(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
