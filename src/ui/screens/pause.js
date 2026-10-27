// Pause: resume, restart, photo mode, save clip (or screenshot), settings,
// controls (the only place the controls table appears) and quit.

import { h } from '../dom.js';
import { btn, panel, starsEl } from '../kit.js';
import { t } from '../../core/copy/index.js';
import { download } from '../dom.js';
import { formatSizeUI, formatClock } from '../logic.js';
import { safe, worldName } from '../data.js';

const ACTIONS = ['move', 'camera', 'jump', 'sprint', 'sig', 'bark', 'photo', 'pause'];

export function controlsTable(app) {
  const binds = safe(() => app.input.bindings(), {}) || {};
  const keyFor = (a) => {
    const b = binds[a] || binds[{ sig: 'signature' }[a]];
    const list = (Array.isArray(b) ? b : (b?.keys || [])).filter((c) => !/^Pad\d+$/.test(c));
    if (list && list.length) return list.slice(0, 2).map(prettyCode).join(' / ');
    return t(`ui.controls.k.${a}`);
  };
  return h('table', { class: 'gp-controls-table' },
    h('thead', null, h('tr', null, ['action', 'keyboard', 'gamepad', 'touch'].map((k) => h('th', null, t(`ui.controls.${k}`))))),
    h('tbody', null, ACTIONS.map((a) => h('tr', null,
      h('td', null, t(`ui.controls.${a}`)),
      h('td', null, h('span', { class: 'gp-key' }, keyFor(a))),
      h('td', null, t(`ui.controls.p.${a}`)),
      h('td', null, t(`ui.controls.t.${a}`))))));
}

export function prettyCode(code) {
  return String(code).replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '').replace('ShiftLeft', 'Shift').replace('ShiftRight', 'Right Shift').replace('Escape', 'Esc').replace('ControlLeft', 'Ctrl');
}

export function showControls(ctx) {
  ctx.modal({ title: t('ui.controls.title'), body: h('div', { class: 'gp-scroll' }, controlsTable(ctx.app)), buttons: [{ label: t('ui.close'), variant: 'cream', sound: 'back' }] });
}

export function pauseScreen(ctx) {
  const { app } = ctx;
  const resume = () => { safe(() => app.resume()); ctx.show('hud'); };
  const clipOk = !!safe(() => app.renderer.clip.supported, false);

  async function saveClip() {
    const blob = await safe(() => app.saveClip(), null);
    if (blob) { download(blob, `${app.GAME?.slug || 'gobblepaws'}-clip.webm`); ctx.toast(t('ui.pause.clipSaved'), { icon: 'film' }); }
    else ctx.toast(t('ui.pause.clipFail'), { icon: 'film' });
  }
  function saveShot() {
    const url = safe(() => app.screenshot(), null);
    if (url) { download(url, `${app.GAME?.slug || 'gobblepaws'}.png`); ctx.toast(t('ui.pause.shotSaved'), { icon: 'camera' }); }
  }

  const items = [
    btn(ctx, t('ui.pause.resume'), { icon: 'play', big: true, onClick: resume, attrs: { 'data-default': '1' }, i: 0 }),
    btn(ctx, t('ui.pause.restart'), { icon: 'restart', variant: 'butter', onClick: () => safe(() => app.restartRun()), i: 1 }),
    btn(ctx, t('ui.pause.photo'), { icon: 'camera', variant: 'sky', onClick: () => { safe(() => app.enterPhoto()); ctx.show('photo'); }, i: 2 }),
    clipOk ? btn(ctx, t('ui.pause.clip'), { icon: 'film', variant: 'sky', onClick: saveClip, i: 3 }) : btn(ctx, t('ui.pause.shot'), { icon: 'camera', variant: 'sky', onClick: saveShot, i: 3 }),
    btn(ctx, t('ui.pause.settings'), { icon: 'gear', variant: 'cream', onClick: () => ctx.show('settings', { from: 'pause' }), i: 4 }),
    btn(ctx, t('ui.pause.controls'), { icon: 'pad', variant: 'cream', onClick: () => showControls(ctx), i: 5 }),
    btn(ctx, t('ui.pause.quit'), { icon: 'door', variant: 'cream', onClick: () => safe(() => app.quitRun()), i: 6 }),
  ];

  const st = app.state;
  const run = app.run;
  const info = panel('gp-pad gp-pause-info gp-slide-r',
    h('span', { class: 'gp-eyebrow' }, t(`ui.mode.${run?.mode || 'story'}`)),
    h('h2', { class: 'gp-h2' }, worldName(run?.worldId || 'w1')),
    h('div', { class: 'gp-kv' }, h('span', { class: 'gp-label' }, t('ui.pause.size')), h('b', null, formatSizeUI(st?.player?.size || 0))),
    st?.goals?.goal ? h('div', { class: 'gp-kv' }, h('span', { class: 'gp-label' }, t('ui.pause.goal')), h('b', null, formatSizeUI(st.goals.goal))) : null,
    st?.timeLeft != null ? h('div', { class: 'gp-kv' }, h('span', { class: 'gp-label' }, t('ui.pause.time')), h('b', null, formatClock(Math.ceil(st.timeLeft)))) : null,
    run?.mode !== 'zoomies' ? h('div', { style: { fontSize: 'max(26px, calc(5 * var(--u)))' } }, starsEl(st?.stars)) : null);

  const el = h('div', { class: 'gp-pause' },
    h('div', { class: 'gp-pause-menu' }, h('div', { class: 'gp-pause-head gp-slide-l' }, h('h1', { class: 'gp-h1' }, t('ui.pause.title')), h('span', { class: 'gp-small' }, t('ui.pause.sub'))), items),
    info);
  return { el, scene: null, back: resume };
}
