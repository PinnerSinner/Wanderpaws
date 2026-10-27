// End of a run: the result card with stars popping in one by one, numbers
// counting up, records, unlocks, and Next, Retry, Map and Save card.

import { h } from '../dom.js';
import { icon } from '../icons.js';
import { worldArt } from '../art.js';
import { btn, portraitEl, svgEl, starsEl } from '../kit.js';
import { t } from '../../core/copy/index.js';
import { formatSizeUI, formatClock, formatInt, nextWorldId } from '../logic.js';
import { safe, tk, worldName, speciesName, cosmeticName, getWorldData } from '../data.js';
import { download } from '../dom.js';
import { renderResultCard } from '../card.js';
import { startRun } from './flow.js';
import { starRuleTexts } from './worlds.js';

export function endScreen(ctx, params) {
  const { app } = ctx;
  const run = params.run || app.run || { worldId: 'w1', speciesId: safe(() => app.profile.lastSpecies, 'oli'), mode: 'story', name: '' };
  const result = params.result || { stars: [true, true, false], size: 3.4, gobbled: 142, biccies: 0, time: 251 };
  const summary = params.summary || { biccies: 86, newUnlocks: [], achievements: [], records: {} };
  const stars = result.stars || summary.stars || [false, false, false];
  const nStars = stars.filter(Boolean).length;
  const name = run.name || safe(() => app.profile.getName(run.speciesId), speciesName(run.speciesId));
  const look = safe(() => app.profile.getLook(run.speciesId), {});
  const shot = safe(() => app.screenshot(), null);
  const rec = summary.records || {};

  // card
  const bg = svgEl(worldArt(run.worldId, 'rect'), 'gp-end-bg');
  const card = h('div', { class: 'gp-panel gp-end-card' }, bg);
  if (shot && shot.length > 2000) card.appendChild(h('img', { class: 'gp-end-shot', src: shot, alt: '' }));
  else card.appendChild(portraitEl(run.speciesId, look, { cls: 'gp-end-portrait' }));
  const starRow = starsEl([false, false, false], 'gp-end-stars');
  card.appendChild(h('div', { class: 'gp-end-over' },
    h('span', { class: 'gp-eyebrow' }, `${worldName(run.worldId)} · ${t(`ui.mode.${run.mode || 'story'}`)}`),
    h('div', { class: 'gp-end-title' }, t(`ui.end.title.${nStars}`)),
    h('b', { class: 'gp-h3' }, t('ui.end.cardLine', { name, size: formatSizeUI(result.size || 0) })),
    run.mode === 'zoomies' ? null : starRow));

  // star pop-in, one by one
  const timers = [];
  stars.forEach((on, i) => {
    timers.push(setTimeout(() => {
      const s = starRow.children[i];
      if (!s) return;
      if (on) { s.classList.add('gp-on'); ctx.sound('star'); }
      s.classList.add('gp-in');
    }, 600 + i * 520));
  });

  // stats
  const stat = (label, ico, record) => {
    const b = h('b', { class: 'gp-num' }, '0');
    const el = h('div', { class: 'gp-end-stat gp-pop' }, h('span', { class: 'gp-label' }, label), b, record ? h('span', { class: 'gp-record gp-chip gp-chip--coral' }, icon('sparkle'), t('ui.end.record')) : null);
    return { el, b };
  };
  const sSize = stat(t('ui.end.size'), 'ruler', rec.size);
  const sItems = stat(t('ui.end.items'), 'mouth');
  const sBic = stat(t('ui.end.biccies'), 'biccie');
  const sTime = stat(t('ui.end.time'), 'clock', rec.time);
  [sSize, sItems, sBic, sTime].forEach((s, i) => s.el.style.setProperty('--i', String(i + 2)));
  ctx.countUp(sSize.b, 0, result.size || 0, { delay: 0.5, dur: 1.4, format: (v) => formatSizeUI(v) });
  ctx.countUp(sItems.b, 0, result.gobbled || 0, { delay: 0.7, format: (v) => formatInt(v) });
  ctx.countUp(sBic.b, 0, summary.biccies || result.biccies || 0, { delay: 0.9, format: (v) => formatInt(v) });
  ctx.countUp(sTime.b, 0, result.time || 0, { delay: 1.1, format: (v) => formatClock(v) });

  const unlocks = [];
  for (const u of summary.newUnlocks || []) {
    let label = u.id;
    if (u.kind === 'species') label = speciesName(u.id);
    else if (u.kind === 'world') label = worldName(u.id);
    else if (u.kind === 'cosmetic') label = cosmeticName((app.data.COSMETICS || []).find((c) => c.id === u.id) || { id: u.id });
    unlocks.push(h('span', { class: 'gp-chip gp-chip--butter gp-pop', vars: { i: 8 + unlocks.length } }, icon(u.kind === 'species' ? 'paw' : u.kind === 'world' ? 'map' : 'shirt'), label));
  }
  for (const a of summary.achievements || []) unlocks.push(h('span', { class: 'gp-chip gp-chip--sea gp-pop', vars: { i: 8 + unlocks.length } }, icon('trophy'), tk(`ach.${a}.name`, a)));
  for (const e of summary.eggsNew || []) unlocks.push(h('span', { class: 'gp-chip gp-pop', vars: { i: 8 + unlocks.length } }, icon('egg'), tk(`egg.${e}.name`, e)));

  // buttons
  const nextId = nextWorldId(run.worldId);
  const story = (run.mode || 'story') === 'story';
  const nextOpen = nextId && getWorldData(app, nextId) && safe(() => app.profile.isWorldUnlocked(nextId), false);
  const btns = [];
  if (story && run.worldId === 'w5' && stars[0]) {
    btns.push(btn(ctx, t('ui.end.ending'), { icon: 'book', big: true, onClick: () => ctx.show('comic', { kind: 'ending', then: 'title' }), attrs: { 'data-default': '1' } }));
  } else if (nextOpen && run.mode !== 'daily') {
    btns.push(btn(ctx, t('ui.end.next'), { icon: 'next', big: true, onClick: () => startRun(ctx, { worldId: nextId, speciesId: run.speciesId, mode: run.mode === 'zoomies' ? 'zoomies' : (run.mode || 'story') }), attrs: { 'data-default': '1' } }));
  } else {
    btns.push(btn(ctx, t('ui.end.retry'), { icon: 'restart', big: true, onClick: () => safe(() => app.restartRun()), attrs: { 'data-default': '1' } }));
  }
  if (btns[0].textContent !== t('ui.end.retry')) btns.push(btn(ctx, t('ui.end.retry'), { icon: 'restart', variant: 'butter', onClick: () => safe(() => app.restartRun()) }));
  btns.push(btn(ctx, t('ui.end.map'), { icon: 'map', variant: 'cream', onClick: () => { safe(() => app.quitRun()); ctx.show('worlds', { worldId: run.worldId, from: 'title' }); } }));
  btns.push(btn(ctx, t('ui.end.card'), { icon: 'photo', variant: 'sky', onClick: saveCard }));

  async function saveCard() {
    const url = await renderResultCard({
      shot, worldId: run.worldId, speciesId: run.speciesId, look, name, stars, size: result.size,
      worldName: worldName(run.worldId), title: t(`ui.end.title.${nStars}`), footer: app.GAME?.domain || '',
    }).catch(() => null);
    if (url) { download(url, `${app.GAME?.slug || 'gobblepaws'}-${run.worldId}.png`); ctx.toast(t('ui.end.cardSaved'), { icon: 'photo' }); }
  }

  const w = getWorldData(app, run.worldId);
  const rules = w && run.mode !== 'zoomies' ? h('div', { class: 'gp-panel gp-pad gp-star-list gp-pop', vars: { i: 7 } }, starRuleTexts(w, run.mode).map((r, i) => h('div', { class: 'gp-row' }, h('span', { class: 'gp-star' + (stars[i] ? ' gp-on' : '') }, icon('star')), h('span', null, r), stars[i] ? h('span', { class: 'gp-chip gp-chip--sea', style: { marginLeft: 'auto' } }, icon('check')) : null))) : null;
  const side = h('div', { class: 'gp-end-side' },
    h('div', { class: 'gp-end-stats' }, sSize.el, sItems.el, sBic.el, sTime.el),
    rules,
    unlocks.length ? h('div', { class: 'gp-col', style: { gap: 'calc(0.8 * var(--u))' } }, h('span', { class: 'gp-label' }, t('ui.end.unlocks')), h('div', { class: 'gp-unlocks' }, unlocks)) : null,
    h('div', { class: 'gp-end-btns' }, btns));

  const el = h('div', { class: 'gp-end' }, card, side);
  return { el, scene: null, back: null, destroy() { timers.forEach(clearTimeout); } };
}
