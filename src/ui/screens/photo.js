// Photo mode toolbar: filter, shutter, done. The HUD is hidden while it's up.

import { h, download } from '../dom.js';
import { icon } from '../icons.js';
import { iconBtn, btn } from '../kit.js';
import { t } from '../../core/copy/index.js';
import { safe } from '../data.js';

export const PHOTO_FILTERS = {
  none: 'none',
  warm: 'sepia(0.22) saturate(1.3) hue-rotate(-8deg) brightness(1.05)',
  mono: 'grayscale(1) contrast(1.12) sepia(0.18)',
  dreamy: 'saturate(1.25) brightness(1.08) contrast(0.92)',
  pop: 'saturate(1.8) contrast(1.18)',
  carrot: 'sepia(0.55) saturate(2.1) hue-rotate(-18deg) contrast(1.05)',
};

export function photoScreen(ctx) {
  const { app } = ctx;
  const canvas = document.getElementById('game');
  const ids = Object.keys(PHOTO_FILTERS).filter((k) => k !== 'carrot' || safe(() => app.profile.eggs.has('H5'), false));
  let i = 0;
  const label = h('span', { class: 'gp-filter-name' }, t('ui.filter.none'));
  const apply = () => {
    label.textContent = t(`ui.filter.${ids[i]}`);
    if (canvas) canvas.style.filter = PHOTO_FILTERS[ids[i]] === 'none' ? '' : PHOTO_FILTERS[ids[i]];
  };
  const step = (d) => { i = (i + d + ids.length) % ids.length; apply(); ctx.sound('tick'); };

  async function snap() {
    ctx.sound('select');
    const url = safe(() => app.screenshot(), null);
    if (!url) return;
    ctx.fxLayer.appendChild(Object.assign(h('div', { class: 'gp-flash' }), {}));
    setTimeout(() => ctx.fxLayer.querySelector('.gp-flash')?.remove(), 600);
    let out = url;
    if (ids[i] !== 'none') {
      out = await new Promise((res) => {
        const im = new Image();
        im.onload = () => {
          const c = document.createElement('canvas');
          c.width = im.width; c.height = im.height;
          const g = c.getContext('2d');
          g.filter = PHOTO_FILTERS[ids[i]];
          g.drawImage(im, 0, 0);
          res(c.toDataURL('image/png'));
        };
        im.onerror = () => res(url);
        im.src = url;
      });
    }
    download(out, `${app.GAME?.slug || 'gobblepaws'}-photo.png`);
    ctx.toast(t('ui.photo.saved'), { icon: 'camera' });
  }
  const exit = () => { if (canvas) canvas.style.filter = ''; safe(() => app.exitPhoto()); ctx.show('pause'); };

  const shutter = h('button', { class: 'gp-shutter gp-nav', type: 'button', 'aria-label': t('ui.photo.snap'), 'data-default': '1' }, icon('camera'));
  shutter.addEventListener('click', snap);
  const bar = h('div', { class: 'gp-photo-bar' },
    iconBtn(ctx, 'back', t('ui.photo.filter'), () => step(-1), 'cream', null), label, iconBtn(ctx, 'next', t('ui.photo.filter'), () => step(1), 'cream', null),
    shutter,
    btn(ctx, t('ui.photo.exit'), { icon: 'check', variant: 'sea', onClick: exit }));
  const el = h('div', { class: 'gp-photo' }, bar);
  apply();
  return { el, scene: null, back: exit, destroy() { if (canvas) canvas.style.filter = ''; }, tab: (d) => step(d) };
}
