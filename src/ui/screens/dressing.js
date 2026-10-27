// Dressing room: colours, markings, clobber, trails and sounds, the pet photo
// palette and face decal, a name, presets, random and reset. The hero stands
// on the showroom stage in the middle and updates live.

import { h, clear } from '../dom.js';
import { icon } from '../icons.js';
import { patternSwatch, PATTERNS } from '../art.js';
import { btn, iconBtn, topBar, portraitEl, biccieChip, sliderRow, splitPanel } from '../kit.js';
import { t } from '../../core/copy/index.js';
import { hexToHsl, hslToHex, formatInt } from '../logic.js';
import { safe, tk, speciesName, cosmeticName, prettyId } from '../data.js';
import * as Customise from '../../animals/customise.js';
import { createRng } from '../../core/rng.js';
import { petPanel } from './pet.js';

const SLOTS = ['base', 'secondary', 'belly', 'tips', 'eyes', 'nose', 'patternColor'];
const ACC = ['head', 'neck', 'back', 'face', 'badge'];
const SLOT_ICON = { head: 'hat', neck: 'collar', back: 'cape', face: 'glasses', badge: 'badge', trail: 'trail', sound: 'music' };
const QUICK = ['#e8c27a', '#c9a05a', '#6b4129', '#22201f', '#f6f3ec', '#9b6f47', '#e08a3c', '#8a7a68', '#6e7378', '#ffd23a', '#ff7a59', '#ff9fb2', '#a996ff', '#4fa6d4', '#2bb59a', '#7fbf5e'];
const TABS = ['colours', 'pattern', 'accessories', 'extras', 'pet'];

export function cosmeticIcon(c) {
  const col = c?.colors?.[0] || '#ff7a59';
  const el = h('span', { class: 'gp-item-ico', vars: { c: col } }, icon(SLOT_ICON[c?.slot] || 'sparkle'));
  return el;
}

export function dressingScreen(ctx, params) {
  const { app } = ctx;
  const { SPECIES, SPECIES_ORDER, COSMETICS = [] } = app.data;
  const unlockedList = (SPECIES_ORDER || Object.keys(SPECIES)).filter((id) => SPECIES[id] && safe(() => app.profile.isUnlocked(id), true));
  let speciesId = params.speciesId && SPECIES[params.speciesId] && unlockedList.includes(params.speciesId) ? params.speciesId : (unlockedList.includes(safe(() => app.profile.lastSpecies, 'oli')) ? app.profile.lastSpecies : 'oli');
  let sp = SPECIES[speciesId];
  let look = cloneLook(safe(() => app.profile.getLook(speciesId), sp.defaults));
  let tab = params.tab && TABS.includes(params.tab) ? params.tab : 'colours';
  let slot = 'base';
  let accSlot = 'head';
  let saveTimer = 0;

  const back = () => { flush(); const b = params.back; ctx.show(params.from && params.from !== 'dressing' ? params.from : 'title', b ? { ...b, speciesId } : { speciesId }); };

  function cloneLook(l) { try { return JSON.parse(JSON.stringify(l)); } catch { return { ...l }; } }
  function validate(l) { return safe(() => Customise.validateLook ? Customise.validateLook(l, sp.defaults) : l, l); }

  // live preview, debounced save
  let previewQueued = false;
  function changed(rerender = false) {
    look = validate(look);
    if (!previewQueued) {
      previewQueued = true;
      requestAnimationFrame(() => { previewQueued = false; safe(() => app.renderer.setLook(look)); });
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 350);
    refreshPortrait();
    if (rerender) renderLeft();
  }
  function flush() {
    clearTimeout(saveTimer);
    safe(() => app.profile.setLook(speciesId, look));
  }

  // ---------------------------------------------------------------- left: tabs
  const tabBar = h('div', { class: 'gp-tabs' });
  const left = h('div', { class: 'gp-panel gp-split gp-slide-l' });
  const leftBody = h('div', { class: 'gp-scroll gp-col' });
  left.append(h('div', { style: { padding: 'calc(1.6 * var(--u)) calc(1.6 * var(--u)) 0' } }, tabBar), leftBody);

  function renderTabs() {
    clear(tabBar);
    for (const id of TABS) {
      const b = h('button', { class: 'gp-tab gp-nav' + (id === tab ? ' gp-on' : ''), type: 'button' }, t(`ui.dress.tab.${id}`));
      b.addEventListener('click', () => { ctx.sound('tick'); setTab(id); });
      tabBar.appendChild(b);
    }
  }
  function setTab(id) { tab = id; renderTabs(); renderLeft(); }

  function renderLeft() {
    clear(leftBody);
    if (tab === 'colours') renderColours();
    else if (tab === 'pattern') renderPattern();
    else if (tab === 'accessories') renderAccessories();
    else if (tab === 'extras') renderExtras();
    else if (tab === 'pet') leftBody.appendChild(petPanel(ctx, { getLook: () => look, setLook: (l, goColours) => { look = { ...look, ...l }; changed(); if (goColours) setTab('colours'); else renderLeft(); } }));
  }

  function renderColours() {
    const slots = h('div', { class: 'gp-swatch-slots' }, SLOTS.map((s) => {
      const b = h('button', { class: 'gp-slot gp-nav' + (s === slot ? ' gp-on' : ''), type: 'button' }, h('span', { class: 'gp-dot', vars: { c: look[s] } }), h('span', null, t(`ui.dress.slot.${s}`)));
      b.addEventListener('click', () => { ctx.sound('tick'); slot = s; renderLeft(); });
      return b;
    }));
    leftBody.appendChild(slots);
    const hsl = hexToHsl(look[slot] || '#888888');
    const bigDot = h('span', { class: 'gp-big-dot', vars: { c: look[slot] } });
    const hexEl = h('span', { class: 'gp-chip gp-chip--ghost gp-num' }, (look[slot] || '').toUpperCase());
    let cur = { ...hsl };
    const apply = () => {
      const hex = hslToHex(cur.h, cur.s, cur.l);
      look[slot] = hex;
      bigDot.style.setProperty('--c', hex);
      hexEl.textContent = hex.toUpperCase();
      const dot = slots.querySelector('.gp-on .gp-dot');
      if (dot) dot.style.setProperty('--c', hex);
      updateTracks();
      changed();
    };
    const hueTrack = 'linear-gradient(90deg,' + [0, 60, 120, 180, 240, 300, 360].map((d) => hslToHex(d, 80, 60)).join(',') + ')';
    const H = sliderRow(ctx, t('ui.dress.hue'), { value: hsl.h, min: 0, max: 360, step: 1, format: (v) => Math.round(v) + '°', track: hueTrack, onInput: (v) => { cur.h = v; apply(); } });
    const S = sliderRow(ctx, t('ui.dress.sat'), { value: hsl.s, min: 0, max: 100, step: 1, format: (v) => Math.round(v) + '%', onInput: (v) => { cur.s = v; apply(); } });
    const L = sliderRow(ctx, t('ui.dress.light'), { value: hsl.l, min: 0, max: 100, step: 1, format: (v) => Math.round(v) + '%', onInput: (v) => { cur.l = v; apply(); } });
    function updateTracks() {
      S.s.setTrack(`linear-gradient(90deg, ${hslToHex(cur.h, 0, cur.l)}, ${hslToHex(cur.h, 100, cur.l)})`);
      L.s.setTrack(`linear-gradient(90deg, #000, ${hslToHex(cur.h, cur.s, 50)}, #fff)`);
    }
    updateTracks();
    const quick = h('div', { class: 'gp-quick' }, QUICK.map((c) => {
      const b = h('button', { class: 'gp-nav', type: 'button', vars: { c }, 'aria-label': c });
      b.addEventListener('click', () => { ctx.sound('tick'); look[slot] = c; changed(true); });
      return b;
    }));
    leftBody.appendChild(h('div', { class: 'gp-hsl' },
      h('div', { class: 'gp-hsl-head' }, bigDot, h('b', { class: 'gp-h3 gp-grow' }, t(`ui.dress.slot.${slot}`)), hexEl),
      H.row, S.row, L.row, quick));
  }

  function renderPattern() {
    leftBody.appendChild(h('div', { class: 'gp-patterns' }, PATTERNS.map((p) => {
      const b = h('button', { class: 'gp-pat gp-nav' + (look.pattern === p ? ' gp-on' : ''), type: 'button', html: patternSwatch(p, look.base, look.patternColor) });
      b.appendChild(h('span', null, t(`ui.pattern.${p}`)));
      b.addEventListener('click', () => { ctx.sound('tick'); look.pattern = p; changed(true); });
      return b;
    })));
    const amt = sliderRow(ctx, t('ui.dress.amount'), { value: look.patternAmount ?? 0.5, min: 0, max: 1, step: 0.01, format: (v) => Math.round(v * 100) + '%', onInput: (v) => { look.patternAmount = v; changed(); } });
    leftBody.appendChild(h('div', { class: 'gp-hsl' }, amt.row,
      h('div', { class: 'gp-row gp-wrap' },
        btn(ctx, t('ui.dress.shuffle'), { icon: 'shuffle', variant: 'sky', sm: true, onClick: () => { look.patternSeed = (Math.random() * 1e6) | 0; changed(); } }),
        btn(ctx, t('ui.dress.slot.patternColor'), { icon: 'paw', variant: 'cream', sm: true, onClick: () => { slot = 'patternColor'; setTab('colours'); } }))));
  }

  function itemButton(c, selected, onPick) {
    const owned = !c || safe(() => app.profile.owns(c.id), false);
    const status = c ? safe(() => app.profile.cosmeticStatus?.(c.id), owned ? 'owned' : 'buyable') : 'owned';
    const b = h('button', { class: 'gp-item gp-nav' + (selected ? ' gp-on' : '') + (owned ? '' : ' gp-unowned'), type: 'button' },
      c ? cosmeticIcon(c) : h('span', { class: 'gp-item-ico', vars: { c: '#b9a89c' } }, icon('close')),
      h('span', null, c ? cosmeticName(c) : t('ui.dress.none')),
      selected ? h('span', { class: 'gp-tagline' }, t('ui.dress.wearing')) : null,
      !owned ? h('span', { class: 'gp-price' }, status === 'locked' ? icon('lock') : icon('biccie'), status === 'locked' ? t('ui.locked') : formatInt(c.price)) : null);
    b.addEventListener('click', () => {
      if (owned) { ctx.sound('select'); onPick(); return; }
      if (status === 'locked') { ctx.sound('back'); return; }
      // inline shop: try it on, then offer to buy
      const before = cloneLook(look);
      onPick(true);
      const afford = safe(() => app.profile.canAfford(c.price), false);
      ctx.modal({
        title: cosmeticName(c),
        body: h('div', { class: 'gp-row' }, cosmeticIcon(c), h('span', { class: 'gp-p' }, tk(c.descKey, ''))),
        buttons: [
          afford ? { label: `${t('ui.dress.buy')} · ${formatInt(c.price)}`, icon: 'biccie', sound: 'buy', onClick: () => { if (safe(() => app.profile.buy(c.id), false)) { ctx.sound('buy'); ctx.toast(t('ui.shop.bought', { name: cosmeticName(c) }), { icon: 'bag', kind: 'gold' }); coinChip.replaceWith(coinChip = biccieChip(app.profile.biccies)); flush(); } else { look = before; changed(); } renderLeft(); } }
            : { label: t('ui.shop.short', { n: formatInt(c.price - (app.profile.biccies || 0)) }), variant: 'cream', onClick: () => { look = before; changed(true); } },
          { label: t('ui.back'), variant: 'cream', sound: 'back', onClick: () => { look = before; changed(true); } },
        ],
        onCancel: () => { look = before; changed(true); },
      });
    });
    return b;
  }

  function renderAccessories() {
    const sub = h('div', { class: 'gp-tabs' }, ACC.map((s) => {
      const b = h('button', { class: 'gp-tab gp-nav' + (s === accSlot ? ' gp-on' : ''), type: 'button' }, icon(SLOT_ICON[s]), t(`ui.slot.${s}`));
      b.addEventListener('click', () => { ctx.sound('tick'); accSlot = s; renderLeft(); });
      return b;
    }));
    leftBody.appendChild(sub);
    const list = COSMETICS.filter((c) => c.slot === accSlot);
    if (!list.length) { leftBody.appendChild(h('div', { class: 'gp-empty' }, icon('shirt'), t('ui.dress.empty'))); return; }
    const curId = look.accessories?.[accSlot] || null;
    const grid = h('div', { class: 'gp-items' });
    grid.appendChild(itemButton(null, !curId, () => { look.accessories = { ...look.accessories, [accSlot]: null }; changed(true); }));
    for (const c of list) grid.appendChild(itemButton(c, curId === c.id, (tryOnly) => { look.accessories = { ...look.accessories, [accSlot]: c.id }; changed(!tryOnly); }));
    leftBody.appendChild(grid);
  }

  function renderExtras() {
    for (const [slotName, key, title] of [['trail', 'trail', 'ui.dress.trail'], ['sound', 'soundPack', 'ui.dress.sound']]) {
      leftBody.appendChild(h('span', { class: 'gp-label' }, t(title)));
      const list = COSMETICS.filter((c) => c.slot === slotName);
      const grid = h('div', { class: 'gp-items' });
      grid.appendChild(itemButton(null, !look[key], () => { look[key] = null; changed(true); }));
      for (const c of list) grid.appendChild(itemButton(c, look[key] === (c.trail || c.sound || c.id) || look[key] === c.id, (tryOnly) => { look[key] = c.id; changed(!tryOnly); }));
      leftBody.appendChild(grid);
    }
  }

  // ---------------------------------------------------------------- right: who
  const right = h('div', { class: 'gp-panel gp-split gp-slide-r' });
  let portraitHolder = h('span');
  function refreshPortrait() {
    const p = portraitEl(speciesId, look);
    portraitHolder.replaceWith(p);
    portraitHolder = p;
  }
  function renderRight() {
    clear(right);
    portraitHolder = h('span');
    const prev = iconBtn(ctx, 'back', speciesName(prevId()), () => switchSpecies(prevId()), 'cream', 'tick');
    const next = iconBtn(ctx, 'next', speciesName(nextId()), () => switchSpecies(nextId()), 'cream', 'tick');
    const nameIn = h('input', { class: 'gp-input gp-nav', type: 'text', maxlength: '14', value: safe(() => app.profile.getName(speciesId), speciesName(speciesId)), placeholder: t('ui.dress.namePh'), 'aria-label': t('ui.dress.name'), spellcheck: 'false', autocomplete: 'off' });
    nameIn.addEventListener('change', () => { safe(() => app.profile.setName(speciesId, nameIn.value.trim())); ctx.sound('select'); });
    nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameIn.blur(); e.stopPropagation(); });
    const presets = [{ id: '__default', nameKey: 'ui.dress.default', look: sp.defaults }, ...(sp.presets || [])];
    const presetGrid = h('div', { class: 'gp-presets' }, presets.map((pr) => {
      const l = { ...sp.defaults, ...pr.look };
      const b = h('button', { class: 'gp-preset gp-nav', type: 'button' }, h('span', { class: 'gp-dots' }, ['base', 'belly', 'tips'].map((k) => h('i', { vars: { c: l[k] } }))), h('span', null, tk(pr.nameKey, prettyId(pr.id))));
      b.addEventListener('click', () => {
        ctx.sound('select');
        if (pr.id === '__default') look = { ...cloneLook(sp.defaults), accessories: look.accessories, trail: look.trail, soundPack: look.soundPack, decal: look.decal };
        else look = safe(() => Customise.applyPreset(sp, pr.id, look), { ...look, pattern: 'none', ...pr.look });
        changed(true);
      });
      return b;
    }));
    const body = h('div', { class: 'gp-scroll gp-col' },
      h('div', { class: 'gp-species-switch' }, prev, portraitHolder, h('div', { class: 'gp-col gp-grow', style: { gap: 0, alignItems: 'center', textAlign: 'center' } }, h('span', { class: 'gp-eyebrow' }, speciesName(speciesId))), next),
      h('label', { class: 'gp-col', style: { gap: 'calc(0.6 * var(--u))' } }, h('span', { class: 'gp-label' }, t('ui.dress.name')), nameIn),
      h('span', { class: 'gp-label' }, t('ui.dress.presets')), presetGrid,
      h('div', { class: 'gp-row gp-wrap' },
        btn(ctx, t('ui.dress.random'), { icon: 'dice', variant: 'lilac', sm: true, onClick: randomise }),
        btn(ctx, t('ui.dress.reset'), { icon: 'undo', variant: 'cream', sm: true, onClick: () => { look = cloneLook(sp.defaults); changed(true); } })));
    right.appendChild(body);
    right.appendChild(h('div', { class: 'gp-foot' }, btn(ctx, t('ui.dress.done'), { icon: 'check', variant: 'sea', onClick: back, attrs: { 'data-default': '1' } })));
    refreshPortrait();
  }

  function randomise() {
    const owned = COSMETICS.filter((c) => safe(() => app.profile.owns(c.id), false)).map((c) => c.id);
    const rng = createRng((Math.random() * 2 ** 31) >>> 0);
    const keep = { decal: look.decal };
    look = safe(() => Customise.randomLook(sp, rng, { owned }), null) || { ...look, base: hslToHex(Math.random() * 360, 50, 55) };
    look = { ...look, ...keep };
    changed(true);
  }

  function prevId() { const i = unlockedList.indexOf(speciesId); return unlockedList[(i - 1 + unlockedList.length) % unlockedList.length]; }
  function nextId() { const i = unlockedList.indexOf(speciesId); return unlockedList[(i + 1) % unlockedList.length]; }
  function switchSpecies(id) {
    flush();
    speciesId = id; sp = SPECIES[id];
    look = cloneLook(safe(() => app.profile.getLook(id), sp.defaults));
    safe(() => app.profile.setLastSpecies(id));
    ctx.sceneShowroom(id, look);
    renderRight(); renderLeft();
  }

  let coinChip = biccieChip(safe(() => app.profile.biccies, 0));
  renderTabs(); renderLeft(); renderRight();

  const el = h('div', { class: 'gp-backdrop gp-see-through' },
    topBar(ctx, t('ui.dress.title'), { onBack: back, right: [coinChip] }),
    h('div', { class: 'gp-three' }, left, h('div', { class: 'gp-stage' }), right));

  return {
    el,
    scene: { kind: 'showroom', speciesId, look },
    back,
    tab(dir) { setTab(TABS[(TABS.indexOf(tab) + dir + TABS.length) % TABS.length]); },
    destroy() { flush(); },
  };
}
