// Daily challenge: today's world, animal, twist and special item, the streak, Start.

import { h } from '../dom.js';
import { icon } from '../icons.js';
import { worldArt } from '../art.js';
import { btn, topBar, portraitEl, biccieChip, svgEl, splitPanel } from '../kit.js';
import { t } from '../../core/copy/index.js';
import { safe, worldName, speciesName, modName, itemName, getWorldData } from '../data.js';
import { tokenEl } from '../kit.js';

export function dailyScreen(ctx, params) {
  const { app } = ctx;
  const back = () => ctx.show(params.from && params.from !== 'daily' ? params.from : 'title', {});
  const d = safe(() => app.profile.daily(), null);
  const streak = safe(() => app.profile.streak, 0) || 0;
  const done = d ? !!safe(() => app.profile.dailyDone(d.key), false) : false;
  const dateStr = safe(() => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }), '');

  let left, right;
  if (!d) {
    left = h('div', { class: 'gp-panel gp-daily-art' }, h('div', { class: 'gp-empty' }, icon('calendar'), t('ui.daily.none')));
    right = h('div', { class: 'gp-panel gp-pad' });
  } else {
    const w = getWorldData(app, d.worldId);
    const art = svgEl(worldArt(d.worldId, 'rect'), '');
    left = h('div', { class: 'gp-panel gp-daily-art gp-slide-l' }, art.firstElementChild,
      h('span', { class: 'gp-chip gp-daily-date' }, icon('calendar'), dateStr),
      h('div', { class: 'gp-daily-over' }, h('span', { class: 'gp-eyebrow' }, t('ui.daily.title')), h('h2', { class: 'gp-h1' }, worldName(d.worldId)),
        h('span', { class: 'gp-small' }, t('ui.daily.resets'))));
    const special = d.specialItem ? app.data.CATALOGUE?.[d.specialItem] : null;
    const look = safe(() => app.profile.getLook(d.speciesId), app.data.SPECIES[d.speciesId]?.defaults);
    const facts = h('div', { class: 'gp-daily-facts' },
      fact('#2bb59a', h('span', { class: 'gp-icon' }, icon('map')), t('ui.daily.world'), worldName(d.worldId)),
      fact('#fff', portraitEl(d.speciesId, look), t('ui.daily.animal'), speciesName(d.speciesId)),
      fact('#a996ff', icon('sparkle'), t('ui.daily.modifier'), d.modifier ? modName(d.modifier) : t('ui.mod.none')),
      special ? fact('#e9a93a', icon('star'), t('ui.daily.special'), itemName(special.id), t('ui.daily.specialDesc')) : null);
    const streakEl = h('div', { class: 'gp-streak' }, icon('flame'), h('div', { class: 'gp-col', style: { gap: 0 } }, h('b', { class: 'gp-num' }, String(streak)), h('span', { class: 'gp-label', style: { color: 'var(--ink)' } }, streak ? t('ui.daily.streak', { n: streak }) : t('ui.daily.noStreak'))));
    const start = () => safe(() => app.startRun({ worldId: d.worldId, speciesId: d.speciesId, mode: 'daily', seed: d.seed, modifiers: d.modifiers || (d.modifier ? { [d.modifier]: true } : {}), daily: d }));
    right = splitPanel('gp-slide-r', [streakEl, facts, done ? h('div', { class: 'gp-lock-note', style: { background: 'var(--sea)' } }, icon('check'), t('ui.daily.done')) : null],
      [btn(ctx, done ? t('ui.daily.again') : t('ui.daily.start'), { icon: 'play', big: true, variant: done ? 'cream' : undefined, onClick: start, attrs: { 'data-default': '1' }, sound: 'select' })]);
    if (!w) right.querySelector('.gp-btn')?.setAttribute('disabled', '');
  }

  function fact(col, ico, label, value, sub) {
    return h('div', { class: 'gp-fact' }, h('span', { class: 'gp-fact-ico', vars: { c: col } }, ico),
      h('div', { class: 'gp-col', style: { gap: 'calc(0.2 * var(--u))', minWidth: 0 } }, h('span', { class: 'gp-small' }, label), h('b', { class: 'gp-body' }, value), sub ? h('span', { class: 'gp-small' }, sub) : null));
  }

  const el = h('div', { class: 'gp-backdrop' },
    topBar(ctx, t('ui.daily.title'), { onBack: back, right: [biccieChip(safe(() => app.profile.biccies, 0))] }),
    h('div', { class: 'gp-daily-body' }, left, right));
  return { el, back, scene: { kind: 'title', speciesId: d?.speciesId && safe(() => app.profile.isUnlocked(d.speciesId), false) ? d.speciesId : safe(() => app.profile.lastSpecies, 'oli') } };
}
