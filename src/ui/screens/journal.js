// Journal: every item type per world (silhouettes until found), one-liners,
// completion per world, golden variants, and a Secrets tab for eggs.

import { h, clear } from '../dom.js';
import { icon } from '../icons.js';
import { topBar, tokenEl, biccieChip } from '../kit.js';
import { t } from '../../core/copy/index.js';
import { formatSizeUI } from '../logic.js';
import { safe, tk, worldIds, worldName, itemName, itemsForWorld } from '../data.js';

export function pctRing(pct, colour = 'var(--sea)') {
  const r = 42, c = 2 * Math.PI * r;
  const w = h('div', { class: 'gp-pct-ring' });
  w.innerHTML = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${r}" fill="#fff" stroke="rgba(75,46,38,.1)" stroke-width="12"/><circle cx="50" cy="50" r="${r}" fill="none" stroke="${colour}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - Math.min(1, pct / 100))).toFixed(1)}"/></svg>`;
  w.appendChild(h('b', { class: 'gp-num' }, Math.round(pct) + '%'));
  return w;
}

export function journalScreen(ctx, params) {
  const { app } = ctx;
  const ids = worldIds(app).slice(0, 5);
  let tab = params.tab || params.worldId || 'w1';
  let selItem = null;
  const back = () => ctx.show(params.from && params.from !== 'journal' ? params.from : 'title', {});
  const J = app.profile?.journal || {};
  const has = (id) => !!safe(() => J.has(id), false);
  const goldenOf = (id) => Object.values(app.data.CATALOGUE || {}).find((c) => c.goldenOf === id);
  const isGolden = (id) => !!safe(() => J.golden(id), false) || (goldenOf(id) && has(goldenOf(id).id));

  const tabs = h('div', { class: 'gp-tabs' });
  const gridPanel = h('div', { class: 'gp-panel gp-scroll gp-pad gp-slide-l' });
  const detail = h('div', { class: 'gp-panel gp-split gp-slide-r' });

  function renderTabs() {
    clear(tabs);
    const all = [...ids.map((w) => ({ id: w, label: worldName(w), pct: safe(() => J.pct(w), 0) })), { id: 'eggs', label: t('ui.journal.eggs') }];
    for (const tb of all) {
      const b = h('button', { class: 'gp-tab gp-nav' + (tb.id === tab ? ' gp-on' : ''), type: 'button', title: tb.label },
        tb.id === 'eggs' ? icon('egg') : h('span', null, tb.id.toUpperCase()), tb.id === 'eggs' ? tb.label : null,
        tb.pct != null ? h('span', { class: 'gp-tab-pct gp-num' }, Math.round(tb.pct) + '%') : null);
      b.addEventListener('click', () => { ctx.sound('tick'); setTab(tb.id); });
      tabs.appendChild(b);
    }
  }
  function setTab(id) { tab = id; selItem = null; renderTabs(); render(); }

  function render() {
    clear(gridPanel);
    if (tab === 'eggs') { renderEggs(); return; }
    const items = itemsForWorld(app, tab);
    const grid = h('div', { class: 'gp-jgrid' });
    items.forEach((it, i) => {
      const found = has(it.id);
      const gold = found && isGolden(it.id);
      const card = h('button', { class: 'gp-jcard gp-nav gp-pop' + (found ? '' : ' gp-unfound'), type: 'button', vars: { i: Math.min(i, 14) } },
        tokenEl(it, { found, golden: gold, label: itemName(it.id) }),
        h('span', { class: 'gp-jcard-name' }, found ? itemName(it.id) : t('ui.unknown')),
        gold ? h('span', { class: 'gp-gold-pip' }, icon('star')) : null);
      if (i === 0) card.dataset.default = '1';
      card.addEventListener('click', () => { ctx.sound('select'); select(it, card); });
      card.addEventListener('focus', () => select(it, card));
      grid.appendChild(card);
    });
    gridPanel.appendChild(grid);
    selItem = null;
    renderDetail(null);
  }

  let lastCard = null;
  function select(it, card) {
    if (selItem === it) return;
    selItem = it;
    lastCard?.classList.remove('gp-on');
    card.classList.add('gp-on');
    lastCard = card;
    renderDetail(it);
  }

  function renderDetail(it) {
    clear(detail);
    const pct = safe(() => J.pct(tab), 0);
    const count = safe(() => J.count(tab), 0), total = safe(() => J.total(tab), itemsForWorld(app, tab).length);
    const head = h('div', { class: 'gp-row' }, pctRing(pct), h('div', { class: 'gp-col', style: { gap: 'calc(0.4 * var(--u))' } },
      h('span', { class: 'gp-eyebrow' }, tab.toUpperCase()), h('b', { class: 'gp-h3' }, worldName(tab)), h('span', { class: 'gp-small' }, `${count} / ${total} · ${t('ui.journal.found', { pct: Math.round(pct) })}`)));
    const body = h('div', { class: 'gp-scroll gp-col' }, head, h('div', { class: 'gp-divider' }));
    if (!it) body.appendChild(h('p', { class: 'gp-p gp-muted' }, t('ui.journal.pick')));
    else {
      const found = has(it.id);
      body.appendChild(h('div', { class: 'gp-detail-hero' }, tokenEl(it, { found, golden: found && isGolden(it.id), label: itemName(it.id) }),
        h('div', { class: 'gp-col', style: { gap: 'calc(0.4 * var(--u))' } }, h('h2', { class: 'gp-h2' }, found ? itemName(it.id) : t('ui.unknown')),
          found ? h('span', { class: 'gp-small' }, t('ui.journal.size', { size: formatSizeUI(it.size) })) : null)));
      body.appendChild(h('blockquote', { class: 'gp-quote' }, found ? tk(it.journalKey || `journal.${it.id}`, '') : t('ui.journal.undiscovered')));
      if (found) {
        body.appendChild(h('div', { class: 'gp-traits' },
          it.food ? h('span', { class: 'gp-chip gp-chip--ghost' }, icon('heart'), t('ui.journal.food')) : null,
          h('span', { class: 'gp-chip gp-chip--ghost' }, icon('biccie'), t('ui.journal.worth', { n: it.value || 1 })),
          goldenOf(it.id) ? h('span', { class: 'gp-chip ' + (isGolden(it.id) ? 'gp-chip--butter' : 'gp-chip--ghost') }, icon('star'), isGolden(it.id) ? t('ui.journal.golden') : t('ui.journal.goldenMissing')) : null));
      }
    }
    detail.appendChild(body);
  }

  function renderEggs() {
    const list = h('div', { class: 'gp-egg-list' });
    const groups = [...ids, 'G'];
    let any = false;
    for (const w of groups) {
      const eggs = w === 'G'
        ? (safe(() => app.profile.eggs.list(), []) || []).filter((e) => String(e.id).startsWith('G'))
        : (safe(() => app.profile.eggs.list(w), null) || (app.data.WORLDS.find((x) => x.id === w)?.eggs || []).map((e) => ({ id: e.id, found: safe(() => app.profile.eggs.has(e.id), false) })));
      if (!eggs.length) continue;
      any = true;
      const found = eggs.filter((e) => e.found).length;
      list.appendChild(h('div', { class: 'gp-egg-group' }, h('b', { class: 'gp-h3' }, w === 'G' ? t('ui.journal.everywhere') : worldName(w)), h('span', { class: 'gp-chip gp-chip--ghost' }, t('ui.journal.eggsFound', { n: found, total: eggs.length }))));
      for (const e of eggs) {
        list.appendChild(h('div', { class: 'gp-egg' + (e.found ? ' gp-found' : '') },
          h('span', { class: 'gp-egg-ico' }, icon(e.found ? 'check' : 'egg')),
          h('div', { class: 'gp-col', style: { gap: 'calc(0.3 * var(--u))' } },
            h('span', { class: 'gp-egg-id' }, e.id),
            h('b', { class: 'gp-body' }, e.found ? tk(`egg.${e.id}.name`, e.id) : t('ui.unknown')),
            h('span', { class: 'gp-small' }, e.found ? tk(`egg.${e.id}.desc`, '') : `${t('ui.journal.hint')}: ${tk(`egg.${e.id}.hint`, t('ui.unlock.secret'))}`))));
      }
    }
    if (!any) list.appendChild(h('div', { class: 'gp-empty' }, icon('egg'), t('ui.journal.noEggs')));
    gridPanel.appendChild(list);
    clear(detail);
    const total = safe(() => app.profile.eggs.total(), 0), count = safe(() => app.profile.eggs.count(), 0);
    detail.appendChild(h('div', { class: 'gp-scroll gp-col' },
      h('div', { class: 'gp-row' }, pctRing(total ? (count / total) * 100 : 0, 'var(--coral)'), h('div', { class: 'gp-col', style: { gap: 'calc(0.4 * var(--u))' } }, h('b', { class: 'gp-h3' }, t('ui.journal.eggs')), h('span', { class: 'gp-small' }, t('ui.journal.eggsFound', { n: count, total })))),
      h('div', { class: 'gp-divider' }),
      h('blockquote', { class: 'gp-quote' }, t('ui.ach.secretDesc'))));
  }

  renderTabs(); render();
  const el = h('div', { class: 'gp-backdrop' },
    topBar(ctx, t('ui.journal.title'), { onBack: back, right: [biccieChip(safe(() => app.profile.biccies, 0))] }),
    tabs,
    h('div', { class: 'gp-journal-body' }, gridPanel, detail));
  return {
    el,
    scene: { kind: 'title', speciesId: safe(() => app.profile.lastSpecies, 'oli') },
    back,
    tab(dir) { const all = [...ids, 'eggs']; setTab(all[(all.indexOf(tab) + dir + all.length) % all.length]); },
  };
}
