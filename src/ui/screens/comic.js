// Storybook comic: intro (four panels), one panel between worlds, the ending.
// Panels reveal one at a time; tap anywhere or Next to carry on, Skip to leave.

import { h } from '../dom.js';
import { icon } from '../icons.js';
import { comicPanels } from '../art.js';
import { btn } from '../kit.js';
import { t } from '../../core/copy/index.js';
import { safe } from '../data.js';

const ROT = ['-1.4deg', '1deg', '-0.6deg', '1.5deg'];

export function comicScreen(ctx, params) {
  const { app } = ctx;
  const kind = params.kind || 'intro';
  const look = safe(() => app.profile.getLook('oli'), {});
  const panels = comicPanels(kind, look);
  let shown = 0;
  let done = false;

  const strip = h('div', { class: 'gp-comic-strip' + (panels.length > 3 ? ' gp-four' : '') });
  const els = panels.map((p, i) => {
    const art = h('div', { class: 'gp-comic-art', html: p.svg });
    const shout = p.key.endsWith('intro.4');
    const el = h('div', { class: 'gp-comic-panel' + (p.wide ? ' gp-wide' : ''), vars: { rot: ROT[i % ROT.length] } }, art, h('div', { class: 'gp-caption' + (shout ? ' gp-shout' : '') }, t(p.key)));
    strip.appendChild(el);
    return el;
  });
  const dots = h('div', { class: 'gp-comic-dots' }, panels.map(() => h('i')));

  function finish() {
    if (done) return;
    done = true;
    if (params.onDone) params.onDone();
    else ctx.show(params.then || 'title', params.thenParams || {});
  }
  function advance() {
    if (shown < panels.length) {
      els[shown].classList.add('gp-shown');
      dots.children[shown].classList.add('gp-on');
      shown++;
      ctx.sound(shown === panels.length && kind === 'intro' ? 'star' : 'whoosh');
    } else finish();
  }

  const nextBtn = btn(ctx, t('ui.next'), { icon: 'next', onClick: (e) => { e.stopPropagation(); advance(); }, sound: null, attrs: { 'data-default': '1' } });
  const skipBtn = btn(ctx, t('ui.comic.skip'), { variant: 'cream', sm: true, onClick: (e) => { e.stopPropagation(); finish(); }, sound: 'back' });
  const el = h('div', { class: 'gp-comic' }, strip, h('div', { class: 'gp-comic-bar' }, dots, skipBtn, nextBtn));
  el.addEventListener('click', () => advance());
  setTimeout(() => advance(), 250);

  return {
    el,
    scene: null,
    back: finish,
    onMenu(a) { if (a === 'right') { advance(); return true; } return false; },
  };
}
