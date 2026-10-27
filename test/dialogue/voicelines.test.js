import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allLines } from '../../src/dialogue/banks/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const md = fs.readFileSync(path.join(root, 'VOICELINES.md'), 'utf8');

test('VOICELINES.md lists only voiceIds that exist in the banks', () => {
  const ids = new Set(allLines().map((l) => l.voiceId));
  const files = [...md.matchAll(/assets\/user\/voice\/([A-Za-z0-9-]+)\.mp3/g)].map((m) => m[1]);
  assert.ok(files.length >= 100, 'a big list: ' + files.length);
  for (const f of files) if (!f.startsWith('animal-')) assert.ok(ids.has(f), f);
  assert.equal(new Set(files).size, files.length, 'no duplicates');
});

test('VOICELINES.md words match the bank text exactly', () => {
  const byId = new Map(allLines().map((l) => [l.voiceId, l]));
  for (const m of md.matchAll(/\| `assets\/user\/voice\/([A-Za-z0-9-]+)\.mp3` \| ([^|<]+?)(?:<br>| \|)/g)) {
    const l = byId.get(m[1]);
    if (l) assert.equal(m[2].trim().replace(/\\\|/g, '|'), l.text, m[1]);
  }
});

test('VOICELINES.md has the recording instructions and every category', () => {
  for (const s of ['mono', '44.1 kHz', '-16 LUFS', '6 seconds', 'assets/user/voice/', 'If you skip a line', 'Animal sounds', 'Narrator', 'Gerald', 'Seu Zé', 'Pickups and combos', 'Easter eggs', 'Achievements', 'throwaways']) assert.ok(md.includes(s), s);
});

test('a renamed pet never plays a recording that says "Oli"', async () => {
  const { createDirector } = await import('../../src/dialogue/index.js');
  const { createRng } = await import('../../src/core/rng.js');
  for (const name of ['Oli', 'Biscuit']) {
    const d = createDirector({ rng: createRng(1) });
    const got = [];
    d.onLine((l) => got.push(l));
    d.onEvent({ type: 'intro', worldId: 'w1' }, { state: null, worldId: 'w1', playerName: name });
    d.onEvent({ type: 'finish' }, { state: null, worldId: 'w1', playerName: name });
    const outro = got.find((l) => /^narrator-outro|^Copacabana|left Copacabana/.test(l.text) || l.tag === 'outro-w1');
    if (name === 'Oli') assert.ok(outro.voiceId); else if (outro.text.includes('Biscuit')) assert.equal(outro.voiceId, undefined);
  }
});
