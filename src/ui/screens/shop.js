// Shop: cosmetics bought with biccies, with a live try-on in the showroom.

import { h, clear, bump } from '../dom.js';
import { icon } from '../icons.js';
import { btn, topBar, biccieChip, empty } from '../kit.js';
import { t } from '../../core/copy/index.js';
import { formatInt } from '../logic.js';
import { safe, tk, cosmeticName, speciesName } from '../data.js';
import { cosmeticIcon } from './dressing.js';

const SLOTS = ['head', 'neck', 'back', 'face', 'badge', 'trail', 'sound'];
const SLOT_ICON = { head: 'hat', neck: 'collar', back: 'cape', face: 'glasses', badge: 'badge', trail: 'trail', sound: 'music' };

function lookWith(look, c) {
  const l = { ...look, accessories: { ...(look.accessories || {}) } };
  if (c.slot === 'trail') l.trail = c.id;
  else if (c.slot === 'sound') l.soundPack = c.id;
  else l.accessories[c.slot] = c.id;
  return l;
}
function isWorn(look, c) {
  if (c.slot === 'trail') return look.trail === c.id;
  if (c.slot === 'sound') return look.soundPack === c.id;
  return look.accessories?.[c.slot] === c.id;
}
function withoutIt(look, c) {
  const l = { ...look, accessories: { ...(look.accessories || {}) } };
  if (c.slot === 'trail') l.trail = null; else if (c.slot === 'sound') l.soundPack = null; else l.accessories[c.slot] = null;
  return l;
}

export function shopScreen(ctx, params) {
  const { app } = ctx;
  const COS = app.data.COSMETICS || [];
  const speciesId = safe(() => app.profile.lastSpecies, 'oli') || 'oli';
  let look = safe(() => app.profile.getLook(speciesId), app.data.SPECIES[speciesId]?.defaults || {});
  let slot = params.slot || 'head';
  let sel = null;
  const back = () => { safe(() => app.renderer.setLook(look)); ctx.show(params.from && params.from !== 'shop' ? params.from : 'title', {}); };

  let coin = biccieChip(safe(() => app.profile.biccies, 0));
  const tabs = h('div', { class: 'gp-tabs' });
  const left = h('div', { class: 'gp-panel gp-split gp-slide-l' });
  const leftBody = h('div', { class: 'gp-scroll gp-col' });
  left.append(h('div', { style: { padding: 'calc(1.6 * var(--u)) calc(1.6 * var(--u)) 0' } }, tabs), leftBody);
  const detail = h('div', { class: 'gp-panel gp-split gp-slide-r' });
  const stageTag = h('div', { class: 'gp-stage-name gp-chip' });

  function refreshCoin() { const n = biccieChip(safe(() => app.profile.biccies, 0)); coin.replaceWith(n); coin = n; bump(coin); }
  function status(c) { return safe(() => app.profile.cosmeticStatus?.(c.id), safe(() => app.profile.owns(c.id), false) ? 'owned' : 'buyable'); }

  function renderTabs() {
    clear(tabs);
    for (const s of SLOTS) {
      if (!COS.some((c) => c.slot === s)) continue;
      const b = h('button', { class: 'gp-tab gp-nav' + (s === slot ? ' gp-on' : ''), type: 'button' }, icon(SLOT_ICON[s]), t(`ui.slot.${s}`));
      b.addEventListener('click', () => { ctx.sound('tick'); slot = s; sel = null; renderTabs(); renderGrid(); });
      tabs.appendChild(b);
    }
  }

  function renderGrid() {
    clear(leftBody);
    const list = COS.filter((c) => c.slot === slot);
    if (!list.length) { leftBody.appendChild(empty('bag', t('ui.shop.empty'))); renderDetail(); return; }
    const grid = h('div', { class: 'gp-items' });
    list.forEach((c, i) => {
      const st = status(c);
      const b = h('button', { class: 'gp-item gp-nav gp-pop' + (st === 'owned' ? '' : ' gp-unowned') + (sel === c ? ' gp-on' : ''), type: 'button', vars: { i: Math.min(i, 12) } },
        cosmeticIcon(c), h('span', null, cosmeticName(c)),
        st === 'owned' ? h('span', { class: 'gp-tagline' }, isWorn(look, c) ? t('ui.shop.wearing') : t('ui.shop.owned'))
          : h('span', { class: 'gp-price' }, icon(st === 'locked' ? 'lock' : 'biccie'), st === 'locked' ? t('ui.locked') : formatInt(c.price)));
      if (i === 0) b.dataset.default = '1';
      b.addEventListener('click', () => { ctx.sound('select'); pick(c); });
      b.addEventListener('focus', () => { if (sel !== c) pick(c); });
      grid.appendChild(b);
    });
    leftBody.appendChild(grid);
    if (!sel) pick(list[0], true);
  }

  function pick(c, quiet) {
    sel = c;
    [...leftBody.querySelectorAll('.gp-item')].forEach((el, i) => el.classList.toggle('gp-on', COS.filter((x) => x.slot === slot)[i] === c));
    if (c.slot !== 'sound') safe(() => app.renderer.setLook(lookWith(look, c)));
    stageTag.textContent = t('ui.shop.tryOn');
    renderDetail();
    if (!quiet) ctx.sound('tick');
  }

  function renderDetail() {
    clear(detail);
    if (!sel) return;
    const c = sel;
    const st = status(c);
    const body = h('div', { class: 'gp-scroll gp-col' },
      h('div', { class: 'gp-detail-hero' }, cosmeticIcon(c), h('div', { class: 'gp-col', style: { gap: 'calc(0.4 * var(--u))' } }, h('span', { class: 'gp-eyebrow' }, t(`ui.slot.${c.slot}`)), h('h2', { class: 'gp-h2' }, cosmeticName(c)))),
      tk(c.descKey, '') ? h('blockquote', { class: 'gp-quote' }, tk(c.descKey, '')) : null,
      h('span', { class: 'gp-chip gp-chip--ghost' }, icon('paw'), t('ui.shop.wearingOn', { name: safe(() => app.profile.getName(speciesId), speciesName(speciesId)) })));
    if (st === 'locked') {
      const u = c.unlock || {};
      body.appendChild(h('div', { class: 'gp-lock-note' }, icon('lock'), h('span', null, tk(`meta.unlock.${u.kind}`, t('ui.unlock.secret'), u))));
    }
    detail.appendChild(body);
    const foot = [];
    if (st === 'owned') {
      const worn = isWorn(look, c);
      foot.push(btn(ctx, worn ? t('ui.shop.unwear') : t('ui.shop.wear'), { icon: worn ? 'close' : 'check', variant: worn ? 'cream' : 'sea', onClick: () => { look = worn ? withoutIt(look, c) : lookWith(look, c); safe(() => app.profile.setLook(speciesId, look)); safe(() => app.renderer.setLook(look)); renderGrid(); renderDetail(); } }));
    } else if (st === 'buyable') {
      const afford = safe(() => app.profile.canAfford(c.price), false);
      foot.push(btn(ctx, afford ? `${t('ui.shop.buy')} · ${formatInt(c.price)}` : t('ui.shop.short', { n: formatInt(c.price - (app.profile.biccies || 0)) }), {
        icon: 'biccie', variant: afford ? 'coral' : 'cream', sound: null, attrs: afford ? {} : { disabled: true },
        onClick: () => {
          if (safe(() => app.profile.buy(c.id), false)) {
            ctx.sound('buy');
            ctx.toast(t('ui.shop.bought', { name: cosmeticName(c) }), { icon: 'bag', kind: 'gold' });
            look = lookWith(look, c); safe(() => app.profile.setLook(speciesId, look));
            refreshCoin(); renderGrid(); renderDetail();
          }
        },
      }));
    }
    if (foot.length) detail.appendChild(h('div', { class: 'gp-foot' }, foot));
  }

  renderTabs(); renderGrid();
  const el = h('div', { class: 'gp-backdrop gp-see-through' },
    topBar(ctx, t('ui.shop.title'), { onBack: back, right: [coin] }),
    h('div', { class: 'gp-three' }, left, h('div', { class: 'gp-stage' }, stageTag), detail));
  // the coin chip is replaced on purchase; keep the top bar pointing at the live one
  return {
    el,
    scene: { kind: 'showroom', speciesId, look },
    back,
    tab(dir) { const s = SLOTS.filter((x) => COS.some((c) => c.slot === x)); slot = s[(s.indexOf(slot) + dir + s.length) % s.length]; sel = null; renderTabs(); renderGrid(); },
  };
}
