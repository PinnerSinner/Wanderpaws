// Title: the living 3D scene on the left, the logo and menu column on the right.

import { h } from '../dom.js';
import { icon } from '../icons.js';
import { logoSVG } from '../art.js';
import { btn, biccieChip, svgEl } from '../kit.js';
import { t } from '../../core/copy/index.js';
import { safe, modName } from '../data.js';
import { currentSpecies } from './flow.js';

export function titleScreen(ctx) {
  const { app } = ctx;
  const go = (s, p) => () => ctx.show(s, { from: 'title', ...(p || {}) });
  const logo = svgEl(logoSVG(app.GAME?.name || 'Gobblepaws'), 'gp-logo');
  const tag = h('div', { class: 'gp-title-tag' }, t('game.tagline'));

  const play = btn(ctx, t('ui.title.play'), { icon: 'play', big: true, sub: t('ui.title.playSub'), onClick: go('worlds'), i: 0, attrs: { 'data-default': '1' } });
  const daily = btn(ctx, t('ui.title.daily'), { icon: 'calendar', variant: 'sea', sub: t('ui.title.dailySub'), onClick: go('daily'), i: 1 });
  const zoom = btn(ctx, t('ui.title.zoomies'), { icon: 'bolt', variant: 'butter', sub: t('ui.title.zoomiesSub'), onClick: go('worlds', { mode: 'zoomies' }), i: 2 });

  const tiles = [
    ['book', 'ui.title.journal', 'journal', '#2bb59a'],
    ['shirt', 'ui.title.dressing', 'dressing', '#ff7a59'],
    ['bag', 'ui.title.shop', 'shop', '#e9a93a'],
    ['paw', 'ui.title.animals', 'animals', '#a996ff'],
    ['trophy', 'ui.title.achievements', 'achievements', '#e9a93a'],
    ['chart', 'ui.title.stats', 'stats', '#4fa6d4'],
  ];
  const grid = h('div', { class: 'gp-title-grid' }, tiles.map(([ic, key, scr, col], i) => {
    const b = h('button', { class: 'gp-tile gp-nav gp-pop', type: 'button', vars: { i: i + 3, tile: col } }, icon(ic), h('span', null, t(key)));
    b.addEventListener('click', () => {
      ctx.sound('select');
      const p = { from: 'title' };
      if (scr === 'dressing' || scr === 'animals') p.speciesId = currentSpecies(app);
      ctx.show(scr, p);
    });
    return b;
  }));

  const settingsBtn = btn(ctx, t('ui.title.settings'), { icon: 'gear', variant: 'cream', sm: true, onClick: go('settings') });
  const foot = h('div', { class: 'gp-title-foot gp-pop', vars: { i: 10 } }, settingsBtn, biccieChip(safe(() => app.profile.biccies, 0)));
  const streak = safe(() => app.profile.streak, 0);
  if (streak > 0) foot.appendChild(h('span', { class: 'gp-chip gp-chip--coral' }, icon('flame'), t('ui.title.streak', { n: streak })));
  const mods = Object.keys(safe(() => app.profile.modifiers, {}) || {}).filter((k) => app.profile.modifiers[k]);
  for (const m of mods.slice(0, 3)) foot.appendChild(h('span', { class: 'gp-chip gp-chip--butter' }, icon('sparkle'), modName(m)));

  const col = h('div', { class: 'gp-title-col' }, logo, tag,
    h('div', { class: 'gp-title-main' }, play, h('div', { class: 'gp-title-pair' }, daily, zoom)),
    grid, foot);
  const el = h('div', { class: 'gp-title' }, col);

  return {
    el,
    scene: { kind: 'title', speciesId: currentSpecies(app) },
    back: null,
  };
}
