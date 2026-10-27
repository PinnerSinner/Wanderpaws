// "Make it your pet": a photo is read locally on a canvas (never uploaded),
// downsampled, and fed to paletteFromPixels. Optional circular face decal with
// a drag-and-zoom cropper that produces a small PNG data URL.

import { h, clear } from '../dom.js';
import { icon } from '../icons.js';
import { btn, sliderRow } from '../kit.js';
import { t } from '../../core/copy/index.js';
import { downsampleSize, cropRect, simplePalette } from '../logic.js';
import { safe } from '../data.js';
import * as Customise from '../../animals/customise.js';

const DECAL_PX = 128;

export function petPanel(ctx, { getLook, setLook }) {
  const wrap = h('div', { class: 'gp-pet' });
  const file = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
  wrap.appendChild(file);
  let img = null;       // HTMLImageElement or ImageBitmap
  let thumbUrl = null;  // small preview data URL
  let palette = null;
  let state = 'idle';

  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    state = 'working'; render();
    try {
      img = await loadImage(f);
      const { w, h: hh } = downsampleSize(img.width, img.height, 96);
      const c = document.createElement('canvas');
      c.width = w; c.height = hh;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, w, hh);
      const data = g.getImageData(0, 0, w, hh).data;
      palette = safe(() => (Customise.paletteFromPixels ? Customise.paletteFromPixels(data, w, hh) : null), null) || simplePalette(data, w, hh);
      const tc = document.createElement('canvas');
      const ts = downsampleSize(img.width, img.height, 220);
      tc.width = ts.w; tc.height = ts.h;
      tc.getContext('2d').drawImage(img, 0, 0, ts.w, ts.h);
      thumbUrl = tc.toDataURL('image/jpeg', 0.8);
      state = 'result';
    } catch (e) {
      console.warn('[ui] photo failed', e);
      state = 'fail';
    }
    render();
  });

  function pick() { ctx.sound('select'); file.click(); }

  function render() {
    for (const el of [...wrap.children]) if (el !== file) el.remove();
    const look = getLook();
    if (state === 'idle' || state === 'fail' || state === 'working') {
      wrap.appendChild(h('div', { class: 'gp-pet-drop' }, icon('photo'),
        h('b', { class: 'gp-h3' }, t('ui.pet.title')),
        h('p', { class: 'gp-p gp-muted' }, state === 'fail' ? t('ui.pet.fail') : state === 'working' ? t('ui.pet.working') : t('ui.pet.blurb')),
        btn(ctx, t('ui.pet.choose'), { icon: 'photo', onClick: pick, sound: null, attrs: state === 'working' ? { disabled: true } : {} }),
        h('span', { class: 'gp-chip gp-chip--sea' }, icon('lock'), t('ui.pet.local'))));
      wrap.appendChild(h('p', { class: 'gp-small', style: { textAlign: 'center', margin: 0 } }, t('ui.pet.fallback')));
    } else if (state === 'result') {
      const keys = ['base', 'secondary', 'belly', 'tips'];
      wrap.appendChild(h('b', { class: 'gp-h3' }, t('ui.pet.found')));
      wrap.appendChild(h('div', { class: 'gp-pet-result' }, h('img', { class: 'gp-pet-thumb', src: thumbUrl, alt: '' }),
        h('div', { class: 'gp-swatches' }, keys.map((k) => h('span', { class: 'gp-swatch' }, h('i', { vars: { c: palette[k] } }), t(`ui.dress.slot.${k}`))))));
      const pal = {}; for (const k of keys) if (palette[k]) pal[k] = palette[k];
      wrap.appendChild(h('div', { class: 'gp-row gp-wrap' },
        btn(ctx, t('ui.pet.accept'), { icon: 'check', variant: 'sea', onClick: () => { setLook(pal, false); ctx.toast(t('ui.saved'), { icon: 'check' }); } }),
        btn(ctx, t('ui.pet.nudge'), { icon: 'paw', variant: 'butter', onClick: () => setLook(pal, true) }),
        btn(ctx, t('ui.pet.again'), { icon: 'photo', variant: 'cream', sm: true, onClick: pick, sound: null })));
      wrap.appendChild(h('div', { class: 'gp-divider' }));
      wrap.appendChild(h('div', { class: 'gp-row gp-wrap' },
        btn(ctx, t('ui.pet.face'), { icon: 'eye', variant: 'lilac', onClick: () => { state = 'crop'; render(); } }),
        look.decal ? btn(ctx, t('ui.pet.faceRemove'), { icon: 'close', variant: 'cream', sm: true, onClick: () => { setLook({ decal: null }); render(); } }) : null));
    } else if (state === 'crop') {
      wrap.appendChild(cropper());
    }
    if (state !== 'result' && state !== 'crop' && look.decal) {
      wrap.appendChild(h('div', { class: 'gp-row' }, h('img', { src: look.decal, alt: '', style: { width: 'calc(8 * var(--u))', borderRadius: '50%' } }),
        btn(ctx, t('ui.pet.faceRemove'), { icon: 'close', variant: 'cream', sm: true, onClick: () => { setLook({ decal: null }); render(); } })));
    }
  }

  function cropper() {
    const box = h('div', { class: 'gp-col' });
    const canvas = h('canvas', { width: 320, height: 320 });
    const frame = h('div', { class: 'gp-cropper' }, canvas);
    let zoom = 1.4, panX = 0, panY = 0;
    const g = canvas.getContext('2d');
    function draw() {
      const r = cropRect(img.width, img.height, zoom, panX, panY);
      panX = r.x + r.side / 2 - img.width / 2; panY = r.y + r.side / 2 - img.height / 2;
      g.clearRect(0, 0, 320, 320);
      g.drawImage(img, r.x, r.y, r.side, r.side, 0, 0, 320, 320);
    }
    let drag = null;
    frame.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; frame.setPointerCapture?.(e.pointerId); });
    frame.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const r = cropRect(img.width, img.height, zoom, panX, panY);
      const k = r.side / (frame.clientWidth || 320);
      panX -= (e.clientX - drag.x) * k; panY -= (e.clientY - drag.y) * k;
      drag = { x: e.clientX, y: e.clientY };
      draw();
    });
    frame.addEventListener('pointerup', () => { drag = null; });
    frame.addEventListener('wheel', (e) => { e.preventDefault(); zoom = Math.min(4, Math.max(1, zoom * (e.deltaY < 0 ? 1.08 : 0.93))); zs.s.set(zoom); draw(); }, { passive: false });
    const zs = sliderRow(ctx, t('ui.pet.zoom'), { value: zoom, min: 1, max: 4, step: 0.05, format: (v) => v.toFixed(1) + '×', onInput: (v) => { zoom = v; draw(); } });
    box.append(h('b', { class: 'gp-h3' }, t('ui.pet.faceTitle')), frame, zs.row,
      h('div', { class: 'gp-row gp-wrap' },
        btn(ctx, t('ui.pet.faceUse'), { icon: 'check', variant: 'sea', onClick: () => { setLook({ decal: makeDecal(img, cropRect(img.width, img.height, zoom, panX, panY)) }); state = 'result'; render(); } }),
        btn(ctx, t('ui.back'), { variant: 'cream', sound: 'back', onClick: () => { state = 'result'; render(); } })));
    requestAnimationFrame(draw);
    return box;
  }

  render();
  return wrap;
}

function makeDecal(img, r) {
  const c = document.createElement('canvas');
  c.width = DECAL_PX; c.height = DECAL_PX;
  const g = c.getContext('2d');
  g.drawImage(img, r.x, r.y, r.side, r.side, 0, 0, DECAL_PX, DECAL_PX);
  // soft circular edge
  g.globalCompositeOperation = 'destination-in';
  const grad = g.createRadialGradient(DECAL_PX / 2, DECAL_PX / 2, DECAL_PX * 0.36, DECAL_PX / 2, DECAL_PX / 2, DECAL_PX / 2);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, DECAL_PX, DECAL_PX);
  return c.toDataURL('image/png');
}

function loadImage(fileObj) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(fileObj);
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(fileObj);
    const im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); res(im); };
    im.onerror = (e) => { URL.revokeObjectURL(url); rej(e); };
    im.src = url;
  });
}
