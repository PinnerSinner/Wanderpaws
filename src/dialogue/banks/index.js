// Builds the normalised line table from the bank files. Every line gets a
// stable id (<tag>-<nn>, or the tag itself for one-off egg lines), a copy key
// (bark.<speaker>.<id>) and a voiceId (<speaker>-<id>) for recorded clips.

import gerald from './gerald.js';
import marco from './marco.js';
import kev from './kev.js';
import ze from './ze.js';
import pru from './pru.js';
import packet from './packet.js';
import narrator from './narrator.js';
import player from './player.js';
import eggs from './eggs.js';
import { nigel, sloth, toucan, goodboy } from './extras.js';

export const CAST_IDS = ['gerald', 'marco', 'kev', 'ze', 'pru', 'packet', 'narrator', 'player'];
const SOURCES = { gerald, marco, kev, ze, pru, packet, narrator, player, nigel, sloth, toucan, goodboy };

const pad = (n) => String(n).padStart(2, '0');

function normalise(speaker, tag, raw, i, single) {
  let e;
  if (typeof raw === 'string') e = { t: raw };
  else if (Array.isArray(raw)) e = { t: raw[0], sub: raw[1] };
  else e = { ...raw };
  const id = single ? tag : `${tag}-${pad(i + 1)}`;
  return {
    speaker, tag, id,
    key: `bark.${speaker}.${id}`,
    voiceId: `${speaker}-${id}`,
    text: e.t,
    sub: e.sub,
    w: e.w ?? 1,
    species: e.species || null,
    worlds: e.worlds || null,
    react: e.react || null,
    lang: speaker === 'ze' ? 'pt-BR' : 'en-GB',
  };
}

export function buildBanks() {
  const banks = {};
  for (const [speaker, src] of Object.entries(SOURCES)) {
    const tags = {};
    for (const [tag, list] of Object.entries(src.lines)) tags[tag] = list.map((raw, i) => normalise(speaker, tag, raw, i, false));
    banks[speaker] = { speaker, tags };
  }
  for (const [speaker, byTag] of Object.entries(eggs)) {
    banks[speaker] = banks[speaker] || { speaker, tags: {} };
    for (const [tag, list] of Object.entries(byTag)) banks[speaker].tags[tag] = list.map((raw, i) => normalise(speaker, tag, raw, i, list.length === 1));
  }
  return banks;
}

export const BANKS = buildBanks();

export function allLines() {
  const out = [];
  for (const b of Object.values(BANKS)) for (const list of Object.values(b.tags)) out.push(...list);
  return out;
}

export const LINE_BY_KEY = new Map(allLines().map((l) => [l.key, l]));

export function lineCount(speaker) {
  const b = BANKS[speaker];
  return b ? Object.values(b.tags).reduce((a, l) => a + l.length, 0) : 0;
}
