import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANKS, CAST_IDS, allLines, lineCount, LINE_BY_KEY } from '../../src/dialogue/banks/index.js';
import { t, hasCopy } from '../../src/core/copy/index.js';
import '../../src/dialogue/copy.js';
import { SPECIES_ORDER } from '../../src/animals/species.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('every cast bank has 25+ throwaway lines', () => {
  for (const s of CAST_IDS) {
    const n = BANKS[s].tags.throwaway?.length || 0;
    assert.ok(n >= 25, `${s} has ${n} throwaway lines`);
  }
});

test('every cast bank has event-tagged lines too', () => {
  for (const s of CAST_IDS) {
    const tags = Object.keys(BANKS[s].tags).filter((k) => k !== 'throwaway');
    assert.ok(tags.length >= 8, `${s} has ${tags.length} event tags`);
    assert.ok(lineCount(s) >= 60, `${s} has ${lineCount(s)} lines`);
  }
});

test('voiceIds and copy keys are unique', () => {
  const lines = allLines();
  assert.equal(new Set(lines.map((l) => l.voiceId)).size, lines.length);
  assert.equal(new Set(lines.map((l) => l.key)).size, lines.length);
  for (const l of lines) assert.match(l.voiceId, /^[a-z]+-[A-Za-z0-9-]+$/);
});

test('no em dashes or en dashes anywhere in dialogue text', () => {
  for (const l of allLines()) {
    assert.ok(!/[\u2014\u2013]/.test(l.text), l.key + ': ' + l.text);
    if (l.sub) assert.ok(!/[\u2014\u2013]/.test(l.sub), l.key + ' sub');
  }
});

test('no em dashes in my source files or VOICELINES.md', () => {
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else files.push(f); } };
  for (const d of ['src/audio', 'src/dialogue', 'test/audio', 'test/dialogue']) if (fs.existsSync(path.join(root, d))) walk(path.join(root, d));
  if (fs.existsSync(path.join(root, 'VOICELINES.md'))) files.push(path.join(root, 'VOICELINES.md'));
  for (const f of files) assert.ok(!fs.readFileSync(f, 'utf8').includes(String.fromCharCode(0x2014)), f);
});

test('Seu Zé speaks only pt-BR, always with an English sub', () => {
  const ze = allLines().filter((l) => l.speaker === 'ze');
  assert.ok(ze.length >= 50);
  const enHints = /\b(the|and|you|is|with|lovely)\b/i;
  for (const l of ze) {
    assert.equal(l.lang, 'pt-BR');
    assert.ok(l.sub && l.sub.length > 1, l.key + ' needs an English sub');
    assert.notEqual(l.text, l.sub);
    assert.ok(!enHints.test(l.text), 'no English in the pt line: ' + l.text);
    assert.equal(t(l.key + '.en'), l.sub);
  }
});

test('nobody but Zé has a translation sub', () => {
  for (const l of allLines()) if (l.speaker !== 'ze') assert.equal(l.sub, undefined, l.key);
});

test('every line is registered with the copy table', () => {
  for (const l of allLines()) {
    assert.ok(hasCopy(l.key), l.key);
    assert.equal(t(l.key), l.text);
  }
  for (const s of ['gerald', 'marco', 'kev', 'ze', 'pru', 'packet', 'narrator']) assert.ok(hasCopy(`cast.${s}.name`));
  assert.equal(t('cast.ze.name'), 'Seu Zé');
});

test('Gerald has a storyline beat set for all five worlds', () => {
  for (const w of ['w1', 'w2', 'w3', 'w4', 'w5']) assert.ok(BANKS.gerald.tags['story-' + w]?.length >= 3, w);
  assert.match(BANKS.gerald.tags['story-w5'].at(-1).text, /ball/i);
});

test('narrator has an intro and an outro for every world', () => {
  for (const w of ['w1', 'w2', 'w3', 'w4', 'w5']) {
    assert.ok(BANKS.narrator.tags['intro-' + w]?.length >= 1);
    assert.ok(BANKS.narrator.tags['outro-' + w]?.length >= 1);
  }
});

test('player thoughts use the name and every species has flavoured lines', () => {
  const p = BANKS.player.tags;
  for (const l of p.throwaway) assert.ok(l.text.includes('{name}'), l.text);
  for (const id of SPECIES_ORDER) {
    const n = p.throwaway.filter((l) => l.species && l.species.includes(id)).length;
    assert.ok(n >= 2, `${id} has ${n} flavoured thoughts`);
  }
});

test('player react kinds are real species sound kinds', () => {
  const kinds = new Set(['bark', 'happy', 'sad', 'excited', 'sniff', 'yawn', 'gulp', 'sig']);
  for (const l of allLines()) if (l.react) assert.ok(kinds.has(l.react), l.key + ' ' + l.react);
});

test('egg lines have stable keys World-data can use', () => {
  assert.equal(LINE_BY_KEY.get('bark.kev.egg-C11').text, 'Oi. I can see you.');
  assert.ok(LINE_BY_KEY.get('bark.player.egg-L6'));
  assert.ok(LINE_BY_KEY.get('bark.ze.egg-T11').sub);
});

test('British spellings, not American ones', () => {
  const bad = /\b(color|favorite|center|organize|realize|mom|candy|cookie|vacation|gotten)\b/i;
  for (const l of allLines()) if (l.lang === 'en-GB') assert.ok(!bad.test(l.text), l.text);
});
