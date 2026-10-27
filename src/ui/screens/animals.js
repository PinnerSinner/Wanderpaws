// Animal select: roster grid, the hero on the showroom stage, and details.

import { h, clear } from '../dom.js';
import { icon } from '../icons.js';
import { btn, topBar, portraitEl, biccieChip, statBarsEl } from '../kit.js';
import { t } from '../../core/copy/index.js';
import { unlockHintFor } from '../logic.js';
import { safe, tk, speciesName, worldName } from '../data.js';
import { startRun } from './flow.js';

export function unlockText(app, sp) {
  const key = safe(() => app.profile.unlockHint(sp.id), '');
  if (key) {
    const s = tk(key, null);
    if (s) return s;
  }
  const u = unlockHintFor(sp);
  const vars = { ...u.vars };
  if (vars.world) vars.world = worldName(vars.world);
  return t(u.key, vars);
}

export function traitsOf(sp) {
  const out = [];
  if (sp.swims) out.push('swims');
  if (sp.floats) out.push('floats');
  const tr = sp.traits || {};
  for (const k of ['squeezeGaps', 'underFences', 'climbs', 'noDrops']) if (tr[k]) out.push(k);
  if (tr.foodBonus) out.push('foodBonus');
  if (sp.canJump === false) out.push('noJump');
  return out;
}

export function animalsScreen(ctx, params) {
  const { app } = ctx;
  const { SPECIES, SPECIES_ORDER } = app.data;
  const order = (SPECIES_ORDER || Object.keys(SPECIES)).filter((id) => SPECIES[id]);
  const unlocked = (id) => safe(() => app.profile.isUnlocked(id), true);
  let sel = params.speciesId && SPECIES[params.speciesId] ? params.speciesId : (safe(() => app.profile.lastSpecies, 'oli') || 'oli');
  const back = () => ctx.show(params.from && params.from !== 'animals' ? params.from : 'title', params.from === 'worlds' ? { worldId: params.worldId, mode: params.mode, speciesId: params.speciesId } : {});

  const grid = h('div', { class: 'gp-roster' });
  const cards = order.map((id, i) => {
    const open = unlocked(id);
    const look = safe(() => app.profile.getLook(id), SPECIES[id].defaults);
    const card = h('button', { class: 'gp-card gp-nav gp-pop' + (open ? '' : ' gp-locked'), type: 'button', vars: { i: Math.min(i, 12) }, 'aria-label': open ? speciesName(id) : t('ui.locked') },
      portraitEl(id, look, { silhouette: !open }),
      h('span', { class: 'gp-card-name' }, open ? safe(() => app.profile.getName(id), speciesName(id)) : t('ui.unknown')),
      open ? null : h('span', { class: 'gp-lock-badge' }, icon('lock')));
    if (id === sel) card.dataset.default = '1';
    card.addEventListener('click', () => { ctx.sound('select'); select(id); });
    card.addEventListener('dblclick', () => { if (open) choose(); });
    grid.appendChild(card);
    return card;
  });

  const detail = h('div', { class: 'gp-panel gp-split gp-slide-r' });
  const stageName = h('div', { class: 'gp-stage-name gp-chip' });

  function choose() {
    if (!unlocked(sel)) return;
    safe(() => app.profile.setLastSpecies(sel));
    if (params.from === 'worlds' && params.worldId) {
      if (params.pick) ctx.show('worlds', { worldId: params.worldId, mode: params.mode, speciesId: sel, from: 'title' });
      else startRun(ctx, { worldId: params.worldId, speciesId: sel, mode: params.mode || 'story' });
    } else ctx.show('worlds', { speciesId: sel, from: 'animals' });
  }

  function select(id) {
    sel = id;
    cards.forEach((c, i) => c.classList.toggle('gp-on', order[i] === id));
    const sp = SPECIES[id];
    const open = unlocked(id);
    const look = safe(() => app.profile.getLook(id), sp.defaults);
    if (open) ctx.sceneShowroom(id, look);
    stageName.textContent = open ? speciesName(id) : t('ui.unknown');
    stageName.style.display = open ? '' : 'none';
    clear(detail);
    const body = h('div', { class: 'gp-scroll gp-col' });
    body.appendChild(h('div', { class: 'gp-col', style: { gap: 'calc(0.5 * var(--u))' } },
      h('span', { class: 'gp-eyebrow' }, open ? speciesName(id) : t('ui.locked')),
      h('h2', { class: 'gp-h2' }, open ? safe(() => app.profile.getName(id), speciesName(id)) : t('ui.unknown')),
      open ? h('p', { class: 'gp-p gp-muted' }, tk(sp.blurbKey, '')) : null));
    if (!open) body.appendChild(h('div', { class: 'gp-lock-note' }, icon('lock'), h('div', null, h('div', { class: 'gp-small', style: { color: '#ffe9c9' } }, t('ui.animals.howUnlock')), unlockText(app, sp))));
    body.appendChild(h('div', { class: 'gp-sig-card' }, h('span', { class: 'gp-sig-ico' }, icon('bolt')),
      h('div', { class: 'gp-col', style: { gap: 'calc(0.4 * var(--u))' } },
        h('span', { class: 'gp-small' }, t('ui.animals.signature')),
        h('b', { class: 'gp-h3' }, tk(sp.signature?.nameKey, sp.signature?.kind || '')),
        h('span', { class: 'gp-small', style: { color: 'var(--ink)' } }, tk(sp.signature?.descKey, '')))));
    body.appendChild(h('span', { class: 'gp-label' }, t('ui.animals.stats')));
    body.appendChild(statBarsEl(sp));
    const traits = traitsOf(sp);
    if (traits.length) body.appendChild(h('div', { class: 'gp-traits' }, traits.map((k) => h('span', { class: 'gp-chip gp-chip--ghost' }, t(`ui.trait.${k}`)))));
    detail.appendChild(body);
    const foot = [btn(ctx, t('ui.animals.dress'), { icon: 'shirt', variant: 'cream', onClick: () => ctx.show('dressing', { speciesId: sel, from: 'animals', back: params }), attrs: open ? {} : { disabled: true } })];
    const label = params.from === 'worlds' && params.worldId && !params.pick ? t('ui.animals.choose', { name: safe(() => app.profile.getName(id), speciesName(id)) }) : t('ui.animals.select', { name: safe(() => app.profile.getName(id), speciesName(id)) });
    foot.push(btn(ctx, label, { icon: 'paw', onClick: choose, attrs: open ? {} : { disabled: true } }));
    detail.appendChild(h('div', { class: 'gp-foot' }, foot));
  }

  select(sel);

  const left = h('div', { class: 'gp-panel gp-pad gp-scroll gp-slide-l' }, grid);
  const el = h('div', { class: 'gp-backdrop gp-see-through' },
    topBar(ctx, t('ui.animals.title'), { onBack: back, right: [btn(ctx, t('ui.animals.log'), { icon: 'book', variant: 'cream', sm: true, onClick: () => ctx.show('species', { from: 'animals' }) }), biccieChip(safe(() => app.profile.biccies, 0))] }),
    h('div', { class: 'gp-three' }, left, h('div', { class: 'gp-stage' }, stageName), detail));

  return {
    el,
    scene: { kind: 'showroom', speciesId: unlocked(sel) ? sel : 'oli' },
    back,
    tab(dir) { const i = (order.indexOf(sel) + dir + order.length) % order.length; select(order[i]); },
  };
}
