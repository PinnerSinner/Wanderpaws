// Copy coverage: every literal ui.* key used in src/ui is registered, there are
// no em dashes, and the Node-safe UI modules import without a DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UI_COPY } from '../../src/ui/copy.js';
import { hasCopy } from '../../src/core/copy/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/ui');
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith('.js') || e.name.endsWith('.css') ? [path.join(dir, e.name)] : []));
}

test('every literal ui.* key used in src/ui is registered', () => {
  const missing = [];
  for (const f of files(root)) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/['"`](ui\.[a-zA-Z0-9_.]+)['"`]/g)) {
      const k = m[1];
      if (k.endsWith('.')) continue;
      if (!hasCopy(k)) missing.push(`${path.basename(f)}: ${k}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('templated key families are complete', () => {
  const need = [];
  for (const m of ['story', 'chill', 'speedrun', 'zoomies']) need.push(`ui.mode.${m}`, `ui.mode.${m}Desc`);
  for (const n of [0, 1, 2, 3]) need.push(`ui.end.title.${n}`);
  for (const w of ['w1', 'w2', 'w3', 'w4', 'w5']) need.push(`ui.world.${w}`, `ui.worldBlurb.${w}`);
  for (const w of ['w2', 'w3', 'w4', 'w5']) need.push(`ui.comic.between.${w}`);
  for (const i of [1, 2, 3, 4]) need.push(`ui.comic.intro.${i}`);
  for (const i of [1, 2, 3]) need.push(`ui.comic.ending.${i}`);
  for (const p of ['none', 'patches', 'stripes', 'spots', 'socks', 'blaze', 'saddle', 'mask', 'bands']) need.push(`ui.pattern.${p}`);
  for (const s of ['base', 'secondary', 'belly', 'tips', 'eyes', 'nose', 'patternColor']) need.push(`ui.dress.slot.${s}`);
  for (const s of ['head', 'neck', 'back', 'face', 'trail', 'sound', 'badge']) need.push(`ui.slot.${s}`);
  for (const s of ['speed', 'accel', 'turn', 'jump', 'reach', 'startSize', 'waterSpeed']) need.push(`ui.stat.${s}`);
  for (const a of ['move', 'camera', 'jump', 'sprint', 'sig', 'bark', 'photo', 'pause']) need.push(`ui.controls.${a}`, `ui.controls.k.${a}`, `ui.controls.p.${a}`, `ui.controls.t.${a}`);
  for (const k of ['none', 'warm', 'mono', 'dreamy', 'pop', 'carrot']) need.push(`ui.filter.${k}`);
  for (const k of ['start', 'stars', 'finish', 'journal', 'golden', 'secret', 'egg', 'story']) need.push(`ui.unlock.${k}`);
  for (const k of ['noHazards', 'collectAll', 'golden', 'combo', 'par']) need.push(`ui.star3.${k}`);
  for (const k of ['video', 'audio', 'access', 'controls', 'language', 'save']) need.push(`ui.settings.tab.${k}`);
  for (const k of ['colours', 'pattern', 'accessories', 'extras', 'pet']) need.push(`ui.dress.tab.${k}`);
  for (const k of ['volMaster', 'volMusic', 'volSfx', 'volVoice', 'volAmbience', 'reducedMotion', 'colourBlind', 'shapeCodes', 'textScale', 'hudScale', 'highContrast', 'assist', 'autoSprint', 'oneHanded', 'subtitles', 'translatePt', 'chatter', 'lookSensitivity', 'invertY', 'quality', 'fovKick', 'showFps', 'speechSynth', 'reset']) need.push(`ui.set.${k}`);
  assert.deepEqual(need.filter((k) => !(k in UI_COPY)), []);
});

test('no em dashes in UI copy or code', () => {
  for (const f of files(root)) assert.ok(!fs.readFileSync(f, 'utf8').includes('—'), path.basename(f));
  for (const v of Object.values(UI_COPY)) assert.ok(!String(v).includes('—'));
});

test('Node-safe UI modules import without a DOM', async () => {
  for (const m of ['logic.js', 'art.js', 'data.js', 'copy.js']) await import(path.join(root, m));
  const art = await import(path.join(root, 'art.js'));
  for (const id of ['oli', 'cat', 'capybara', 'penguin', 'rabbit', 'duck', 'tortoise', 'frog', 'redpanda', 'octopus', 'snake', 'elephant', 'routercat']) {
    assert.match(art.portraitSVG(id, {}), /^<svg/);
    assert.match(art.portraitSVG(id, {}, { silhouette: true }), /gp-silhouette/);
  }
  for (const w of ['w1', 'w2', 'w3', 'w4', 'w5']) assert.match(art.worldArt(w), /<svg/);
  assert.equal(art.comicPanels('intro').length, 4);
  assert.equal(art.comicPanels('ending').length, 3);
  assert.equal(art.comicPanels('between-w3').length, 1);
});
