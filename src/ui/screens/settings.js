// Settings: Video, Audio, Accessibility, Controls, Language and Save data.
// Every control writes straight to app.settings.

import { h, clear } from '../dom.js';
import { icon } from '../icons.js';
import { btn, topBar, slider, toggle, seg, panel } from '../kit.js';
import { t } from '../../core/copy/index.js';
import { safe } from '../data.js';
import { prettyCode, showControls } from './pause.js';

const TABS = [['video', 'eye'], ['audio', 'speaker'], ['access', 'heart'], ['controls', 'pad'], ['language', 'globe'], ['save', 'door']];
const REBINDABLE = ['up', 'down', 'left', 'right', 'jump', 'sprint', 'sig', 'bark', 'photo', 'lookLeft', 'lookRight', 'lookUp', 'lookDown'];
const ACTION_LABEL = { up: 'ui.controls.move', down: 'ui.controls.move', left: 'ui.controls.move', right: 'ui.controls.move', lookLeft: 'ui.controls.camera', lookRight: 'ui.controls.camera', lookUp: 'ui.controls.camera', lookDown: 'ui.controls.camera' };
const ARROW = { up: '↑', down: '↓', left: '←', right: '→', lookUp: '↑', lookDown: '↓', lookLeft: '←', lookRight: '→' };

export function settingsScreen(ctx, params) {
  const { app } = ctx;
  const S = app.settings;
  const get = (k, d) => safe(() => S.get(k), d);
  const set = (k, v) => safe(() => S.set(k, v));
  let tab = params.tab || 'video';
  const from = params.from || 'title';
  const back = () => ctx.show(from, {});

  const rail = h('div', { class: 'gp-panel gp-rail gp-slide-l' });
  const content = h('div', { class: 'gp-panel gp-scroll gp-pad gp-slide-r' });

  function renderRail() {
    clear(rail);
    for (const [id, ic] of TABS) {
      const b = h('button', { class: 'gp-nav' + (id === tab ? ' gp-on' : ''), type: 'button', 'data-default': id === tab ? '1' : null }, icon(ic), t(`ui.settings.tab.${id}`));
      b.addEventListener('click', () => { ctx.sound('tick'); tab = id; renderRail(); render(); });
      rail.appendChild(b);
    }
  }

  const row = (key, ctrl, { desc = true, wide = false, label } = {}) => h('div', { class: 'gp-set-row' + (wide ? ' gp-wide-ctrl' : '') },
    h('div', { class: 'gp-set-text' }, h('span', { class: 'gp-set-label' }, label || t(`ui.set.${key}`)), desc && t(`ui.set.${key}.desc`) !== `ui.set.${key}.desc` ? h('span', { class: 'gp-set-desc' }, t(`ui.set.${key}.desc`)) : null),
    h('div', { class: 'gp-set-ctrl' }, ctrl));
  const tog = (key) => row(key, toggle(ctx, !!get(key, false), (v) => set(key, v), t(`ui.set.${key}`)).el);
  const vol = (key) => {
    const s = slider(ctx, { value: get(key, 0.8), min: 0, max: 1, step: 0.01, label: t(`ui.set.${key}`), format: (v) => Math.round(v * 100) + '%', onInput: (v) => set(key, v), onCommit: () => ctx.sound('tick') });
    return row(key, [s.el, s.val], { desc: false, wide: true });
  };
  const scale = (key) => {
    const s = slider(ctx, { value: get(key, 1), min: 0.8, max: 1.6, step: 0.05, label: t(`ui.set.${key}`), format: (v) => Math.round(v * 100) + '%', onCommit: (v) => set(key, v) });
    return row(key, [s.el, s.val], { desc: false, wide: true });
  };
  const title = (key) => h('h3', { class: 'gp-h3 gp-section-title' }, t(key));

  function render() {
    clear(content);
    const grid = h('div', { class: 'gp-set-grid' });
    content.appendChild(grid);
    if (tab === 'video') {
      const q = seg(ctx, ['auto', 'low', 'medium', 'high'].map((id) => ({ id, label: t(`ui.quality.${id}`) })), get('quality', 'auto'), (v) => { set('quality', v); safe(() => app.renderer.setQuality(v)); });
      grid.append(row('quality', q.el, { wide: true }), tog('fovKick'), tog('showFps'));
    } else if (tab === 'audio') {
      grid.append(vol('volMaster'), vol('volMusic'), vol('volSfx'), vol('volVoice'), vol('volAmbience'), tog('speechSynth'));
    } else if (tab === 'access') {
      const cb = seg(ctx, ['none', 'deuteranopia', 'protanopia', 'tritanopia'].map((id) => ({ id, label: t(`ui.cb.${id}`) })), get('colourBlind', 'none'), (v) => set('colourBlind', v));
      grid.append(
        tog('reducedMotion'), tog('assist'),
        scale('textScale'), scale('hudScale'),
        tog('highContrast'), tog('shapeCodes'),
        row('colourBlind', cb.el, { wide: true }),
        tog('subtitles'), tog('translatePt'), tog('chatter'),
        tog('autoSprint'), tog('oneHanded'));
    } else if (tab === 'controls') {
      const sens = slider(ctx, { value: get('lookSensitivity', 1), min: 0.3, max: 2.5, step: 0.05, label: t('ui.set.lookSensitivity'), format: (v) => v.toFixed(2) + '×', onCommit: (v) => set('lookSensitivity', v) });
      grid.append(row('lookSensitivity', [sens.el, sens.val], { desc: false, wide: true }), tog('invertY'));
      grid.appendChild(title('ui.set.bindings'));
      const binds = safe(() => app.input.bindings(), null);
      if (!binds || !Object.keys(binds).length) grid.appendChild(h('p', { class: 'gp-p gp-muted' }, t('ui.set.noRebind')));
      else for (const a of REBINDABLE) {
        if (!binds[a]) continue;
        const keys = binds[a].filter((c) => !/^Pad\d+$/.test(c));
        const keyEl = h('span', { class: 'gp-key' }, keys.slice(0, 2).map(prettyCode).join(' / ') || '-');
        const b = btn(ctx, t('ui.set.rebind'), { variant: 'cream', sm: true, onClick: () => listen(a, keyEl, b) });
        const lab = (ACTION_LABEL[a] ? t(ACTION_LABEL[a]) + ' ' + ARROW[a] : t(`ui.controls.${a}`));
        grid.appendChild(row(a, [keyEl, b], { desc: false, label: lab }));
      }
      grid.appendChild(h('div', { class: 'gp-row gp-wrap', style: { gridColumn: '1 / -1' } },
        btn(ctx, t('ui.pause.controls'), { icon: 'pad', variant: 'sky', onClick: () => showControls(ctx) })));
    } else if (tab === 'language') {
      const lang = seg(ctx, [{ id: 'en-GB', label: t('ui.set.lang.en') }, { id: 'pt-BR', label: `${t('ui.set.lang.pt')} (${t('ui.set.lang.soon')})`, disabled: true }], 'en-GB', (v) => set('locale', v));
      grid.append(h('div', { class: 'gp-set-row gp-wide-ctrl', style: { gridColumn: '1 / -1' } }, h('div', { class: 'gp-set-text' }, h('span', { class: 'gp-set-label' }, t('ui.settings.tab.language'))), h('div', { class: 'gp-set-ctrl' }, lang.el)));
    } else if (tab === 'save') {
      const wipe = btn(ctx, t('ui.set.reset'), { icon: 'close', cls: 'gp-danger', onClick: confirmReset });
      grid.appendChild(row('reset', wipe));
      if (safe(() => app.profile.loadStatus, '') === 'memory' || safe(() => ctx.store.persistent, true) === false) grid.appendChild(h('p', { class: 'gp-p gp-muted' }, t('ui.set.storageNote')));
    }
  }

  let stopCapture = null;
  function listen(action, keyEl, button) {
    stopCapture?.();
    keyEl.textContent = t('ui.set.listening');
    button.disabled = true;
    const done = (code) => {
      button.disabled = false;
      stopCapture = null;
      if (code) { safe(() => app.input.rebind(action, code)); ctx.sound('select'); }
      render();
    };
    if (app.input.captureNext) stopCapture = app.input.captureNext(done);
    else {
      const onKey = (e) => { e.preventDefault(); e.stopPropagation(); window.removeEventListener('keydown', onKey, true); done(e.code === 'Escape' ? null : e.code); };
      window.addEventListener('keydown', onKey, true);
      stopCapture = () => window.removeEventListener('keydown', onKey, true);
    }
  }

  function confirmReset() {
    ctx.modal({
      title: t('ui.set.reset'),
      body: h('p', { class: 'gp-p' }, t('ui.set.resetConfirm')),
      buttons: [
        { label: t('ui.set.resetNo'), variant: 'cream', sound: 'back' },
        { label: t('ui.set.resetYes'), variant: 'coral', icon: 'close', onClick: () => { safe(() => app.profile.reset()); ctx.store.set('ui.seen', {}); ctx.toast(t('ui.set.resetDone'), { icon: 'heart' }); } },
      ],
    });
  }

  renderRail(); render();
  const el = h('div', { class: 'gp-backdrop' },
    topBar(ctx, t('ui.settings.title'), { onBack: back }),
    h('div', { class: 'gp-settings-body' }, rail, content));
  return {
    el,
    scene: from === 'pause' ? null : { kind: 'title', speciesId: safe(() => app.profile.lastSpecies, 'oli') },
    back,
    destroy() { stopCapture?.(); },
    tab(dir) { const ids = TABS.map((x) => x[0]); tab = ids[(ids.indexOf(tab) + dir + ids.length) % ids.length]; renderRail(); render(); },
  };
}
