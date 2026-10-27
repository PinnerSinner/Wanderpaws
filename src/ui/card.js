// Shareable result card: composites the animal screenshot, world art, name,
// stars and size onto a 1200 x 630 canvas and returns a PNG data URL.

import { resultCardLayout, formatSizeUI } from './logic.js';
import { worldArt, portraitSVG, svgDataUrl, WORLD_TINTS, FONT_STACK } from './art.js';

function loadImg(src) {
  return new Promise((res) => {
    if (!src) { res(null); return; }
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function star(g, cx, cy, r, fill) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.48 : r;
    g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = r * 0.14;
  g.strokeStyle = '#4b2e26';
  g.lineJoin = 'round';
  g.stroke();
}

// opts: { shot, worldId, speciesId, look, name, stars, size, worldName, title, footer }
export async function renderResultCard(opts) {
  const L = resultCardLayout(1200, 630);
  const c = document.createElement('canvas');
  c.width = L.W; c.height = L.H;
  const g = c.getContext('2d');
  const tint = WORLD_TINTS[opts.worldId] || WORLD_TINTS.w1;

  const bg = g.createLinearGradient(0, 0, L.W, L.H);
  bg.addColorStop(0, '#fff6e2');
  bg.addColorStop(1, tint.b);
  g.fillStyle = bg;
  g.fillRect(0, 0, L.W, L.H);
  g.globalAlpha = 0.18;
  for (let i = 0; i < 26; i++) { g.fillStyle = [tint.a, tint.accent, '#ffd166'][i % 3]; g.beginPath(); g.arc((i * 137) % L.W, (i * 89) % L.H, 8 + (i % 4) * 6, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;

  // photo: world art behind, then the screenshot (or a portrait if there isn't one)
  const P = L.photo;
  g.save();
  rr(g, P.x, P.y, P.w, P.h, P.r);
  g.clip();
  const art = await loadImg(svgDataUrl(worldArt(opts.worldId, 'rect')));
  if (art) drawCover(g, art, P.x, P.y, P.w, P.h);
  const shot = await loadImg(opts.shot);
  if (shot) drawCover(g, shot, P.x, P.y, P.w, P.h);
  else {
    const por = await loadImg(svgDataUrl(portraitSVG(opts.speciesId, opts.look || {})));
    if (por) { const s = Math.min(P.w, P.h) * 0.75; g.drawImage(por, P.x + (P.w - s) / 2, P.y + (P.h - s) / 2, s, s); }
  }
  g.restore();
  g.lineWidth = 12;
  g.strokeStyle = '#ffffff';
  rr(g, P.x, P.y, P.w, P.h, P.r);
  g.stroke();

  // text column
  g.textBaseline = 'alphabetic';
  g.fillStyle = tint.ink;
  g.font = `900 ${L.title.size}px ${FONT_STACK}`;
  fitText(g, opts.worldName || '', L.title.x, L.title.y, L.colW);
  g.fillStyle = '#4b2e26';
  g.font = `900 ${L.name.size}px ${FONT_STACK}`;
  fitText(g, opts.name || '', L.name.x, L.name.y, L.colW);
  for (let i = 0; i < 3; i++) star(g, L.stars.x + i * L.stars.gap, L.stars.y, L.stars.r, opts.stars?.[i] ? '#ffc23a' : '#eadfce');
  g.fillStyle = '#ff7a59';
  g.font = `900 ${L.size.size}px ${FONT_STACK}`;
  fitText(g, formatSizeUI(opts.size || 0), L.size.x, L.size.y, L.colW);
  g.fillStyle = '#85665a';
  g.font = `800 ${L.meta.size}px ${FONT_STACK}`;
  fitText(g, opts.title || '', L.meta.x, L.meta.y, L.colW);
  g.font = `800 ${L.footer.size}px ${FONT_STACK}`;
  g.fillStyle = '#85665a';
  fitText(g, opts.footer || '', L.footer.x, L.footer.y, L.colW);
  return c.toDataURL('image/png');
}

function fitText(g, s, x, y, maxW) {
  const w = g.measureText(s).width;
  if (w <= maxW) { g.fillText(s, x, y); return; }
  g.save();
  g.translate(x, y);
  g.scale(maxW / w, 1);
  g.fillText(s, 0, 0);
  g.restore();
}

function drawCover(g, im, x, y, w, h) {
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
  const k = Math.max(w / iw, h / ih);
  const dw = iw * k, dh = ih * k;
  g.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}
