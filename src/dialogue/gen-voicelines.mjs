// Generates VOICELINES.md from the banks: a curated, modest recording list.
//   node src/dialogue/gen-voicelines.mjs
// Every voiceId listed here exists in the banks (test/dialogue/voicelines.test.js).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANKS } from './banks/index.js';
import { SPECIES_VOICES } from '../audio/creatures.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const PERSONA = {
  narrator: 'Warm storybook narrator, unhurried, a smile in the voice',
  gerald: 'Gerald: smug London pigeon, posh-ish, very pleased with himself',
  marco: 'Marco: you, cheery and teacherly, as if mid-jog',
  kev: 'Captain Kev: booming lifeguard, everything is an emergency',
  ze: 'Seu Zé: Rio beach vendor singing like an opera tenor (pt-BR)',
  pru: 'Auntie Pru: genteel British auntie, tea-obsessed, faintly scandalised',
  packet: 'Packet: chirpy robotic sat-nav, over-keen',
  nigel: 'Nigel: Gerald\'s Cockney cousin, cheeky and gruff',
  player: 'Read as a caption announcer, light and dry',
};
const TAG_NOTE = (tag) => {
  if (tag.startsWith('story-')) return 'storyline beat, play it big';
  if (tag.startsWith('intro-')) return 'world intro, sets the scene';
  if (tag.startsWith('outro-')) return 'world outro, gentle wrap-up';
  if (tag.startsWith('egg-')) return 'easter egg payoff, land the joke';
  if (tag.startsWith('activity-')) return 'mini-game moment';
  if (tag.startsWith('weather-')) return 'reacting to the weather';
  return {
    throwaway: 'ambient chatter, conversational', gobble: 'quick reaction', combo: 'rising excitement', milestone: 'big moment, impressed',
    bump: 'sympathetic wince', finish: 'level complete, celebratory', golden: 'delighted surprise', star: 'congratulatory', timerWarn: 'urgent but friendly',
    splash: 'reacting to a splash', shake: 'just got sprayed', bark: 'answering a bark', achievement: 'proud announcement', 'buff-tea': 'satisfied sip',
  }[tag] || 'reaction';
};

function pick(speaker, tag, n) {
  const list = BANKS[speaker]?.tags[tag] || [];
  return list.slice(0, n);
}

const sections = [];
const add = (title, intro, entries) => sections.push({ title, intro, entries: entries.filter(Boolean) });
const E = (l) => ({ file: `assets/user/voice/${l.voiceId}.mp3`, words: l.text, sub: l.sub, note: `${PERSONA[l.speaker] || l.speaker}; ${TAG_NOTE(l.tag)}` });

// 1. Animal sounds
const animal = [];
const ANIMAL_NOTES = {
  bark: 'a single happy bark or woof', happy: 'a happy whine or contented noise', sad: 'a soft whimper', excited: 'excited yips, two or three',
  sniff: 'close-up sniffing, two or three sniffs', yawn: 'a big yawn', gulp: 'a gulp or lip smack', sig: 'an eager "on the scent" huff',
};
for (const kind of ['bark', 'bark', 'happy', 'excited', 'sad', 'sniff', 'yawn', 'gulp']) {
  const n = animal.filter((a) => a.kind === kind).length + 1;
  animal.push({ kind, file: `assets/user/voice/animal-oli-${kind}-0${n}.mp3`, words: `(Oli: ${kind})`, note: ANIMAL_NOTES[kind] + '. Record Oli himself if he obliges' });
}
add('1. Animal sounds and reactions', 'The animals never speak English. These replace the synthesised sounds for the matching species. Any number of takes per kind works: name them `animal-<species>-<kind>-01.mp3`, `-02`, and the game picks one at random each time. Species ids: ' + SPECIES_VOICES.map((s) => '`' + s + '`').join(', ') + '. Kinds: bark, happy, sad, excited, sniff, yawn, gulp, sig. Start with Oli:', animal);

// 2. Narrator: world intros and outros
const narr = [];
for (const w of ['w1', 'w2', 'w3', 'w4', 'w5']) { narr.push(...pick('narrator', 'intro-' + w, 1).map(E)); narr.push(...pick('narrator', 'outro-' + w, 1).map(E)); }
add('2. Narrator: world intros and outros', '`{name}` is the player\'s pet name: say "Oli". A recording with `{name}` in it only plays when the pet is called Oli; renamed pets hear the blip voice and see their own name.', narr);

// 3. Gerald's storyline
const ger = [];
for (const w of ['w1', 'w2', 'w3', 'w4', 'w5']) ger.push(...pick('gerald', 'story-' + w, 4).map(E));
add('3. Gerald\'s storyline (all five worlds)', 'These play in order, one world at a time. The most important set after the narrator.', ger);

// 4. Cast characters
const castPicks = {
  gerald: [['throwaway', 6], ['pigeonScare', 1], ['bump', 1], ['finish', 1]],
  marco: [['throwaway', 6], ['activity-fetch-start', 1], ['activity-fetch-success', 1], ['activity-fetch-fail', 1], ['finish', 1], ['milestone', 1]],
  kev: [['throwaway', 6], ['bump', 1], ['splash', 1], ['timerWarn', 1], ['milestone', 1]],
  ze: [['throwaway', 6], ['milestone', 1], ['weather-parade', 1], ['finish', 1]],
  pru: [['throwaway', 6], ['buff-tea', 2], ['shake', 1], ['finish', 1]],
  packet: [['throwaway', 6], ['timerWarn', 1], ['milestone', 1], ['finish', 1]],
};
for (const [sp, picks] of Object.entries(castPicks)) {
  const list = [];
  for (const [tag, n] of picks) list.push(...pick(sp, tag, n).map(E));
  const extra = sp === 'ze' ? ' Seu Zé speaks only Brazilian Portuguese: record the pt-BR words (the English is the on-screen subtitle). A Carioca friend would be perfect; if you record it yourself, ham up the opera.' : sp === 'marco' ? ' This is you.' : '';
  add(`4.${Object.keys(castPicks).indexOf(sp) + 1} ${PERSONA[sp].split(':')[0]}`, `${PERSONA[sp]}.${extra}`, list);
}

// 5. Pickups and combos
const pick5 = [];
for (const sp of ['marco', 'gerald', 'kev', 'packet']) { pick5.push(...pick(sp, 'gobble', 1).map(E)); pick5.push(...pick(sp, 'combo', 1).map(E)); }
add('5. Pickups and combos', 'Short and punchy; these fire a lot, so keep them under two seconds. `{count}` is said as "ten" (it only plays on round numbers, but the text shows the real count).', pick5);

// 6. Easter eggs
const eggs = [];
for (const [sp, b] of Object.entries(BANKS)) for (const [tag, list] of Object.entries(b.tags)) if (tag.startsWith('egg-') && sp !== 'player') eggs.push(...list.map(E));
add('6. Easter eggs', 'Payoff lines for secrets around the worlds (SPEC §7). Player-caption egg lines stay as text, so they are not listed.', eggs);

// 7. Achievements
add('7. Achievements', 'The narrator announces some achievements (about half of them, never twice in 20 s).', pick('narrator', 'achievement', 4).map(E));

// 8. Funny throwaways (the best of)
const best = [
  ...pick('narrator', 'throwaway', 4).map(E),
  ...['weather-rain', 'weather-fog'].flatMap((t) => pick('kev', t, 1).map(E)),
  ...pick('pru', 'weather-rain', 1).map(E),
  ...pick('packet', 'weather-datastorm', 1).map(E),
];
add('8. Funny throwaways', 'Extras that make the world feel alive. Nice to have.', best);

const total = sections.reduce((a, s) => a + s.entries.length, 0);
const esc = (s) => String(s).replace(/\|/g, '\\|');

let md = `# Voice lines to record

Generated from the dialogue banks by \`node src/dialogue/gen-voicelines.mjs\`. **${total} lines** in all, grouped by priority. Record as many or as few as you like: every line works on its own, and anything you skip keeps its current fallback.

## How to record and drop them in

- **Format:** mp3, **mono**, **44.1 kHz**, around 128 to 192 kbps. Aim for about **-16 LUFS** integrated, peaks under -1 dBFS, and keep each clip **under about 6 seconds** (most are 1 to 3 s).
- **Where:** save each file at the exact path shown, \`assets/user/voice/<voiceId>.mp3\`, then run \`node tools/build.mjs\`. That is all: the build embeds them and the game plays them at once.
- **Loudness:** don't fuss. The game measures each clip's loudness when it first plays and normalises it to -16 LUFS, then plays it through the voice bus (compressor, then limiter) about 5 dB above the music. A sidecar \`<file>.mp3.json\` with \`{ "gainDb": -2.5 }\` overrides the measured gain if one ever sounds off.
- **Room:** a quiet room, phone or USB mic 15 to 20 cm away, a little off-axis to avoid pops. Leave half a second of silence at each end; the game doesn't trim.
- **Words:** read the words exactly, so the subtitles match. \`{name}\` is the player's pet name; say "Oli".
- **If you skip a line:** the character keeps its synthesised "blip" voice (a distinct pitch and timbre per character) plus the floating text, exactly as now. Animals keep their synthesised sounds. Nothing breaks.
- **How many:** the sections are in priority order. Sections 1 to 3 (about ${sections.slice(0, 3).reduce((a, s) => a + s.entries.length, 0)} clips) make the biggest difference; everything after is a bonus.
- **Where they're used:** chatter is small floating text near the speaker. Narrator lines are bigger and centred. Seu Zé's English shows underneath when "Translate Portuguese" is on.

`;
for (const s of sections) {
  md += `## ${s.title}\n\n${s.intro}\n\n| File | Words | Delivery |\n|---|---|---|\n`;
  for (const e of s.entries) md += `| \`${e.file}\` | ${esc(e.words)}${e.sub ? `<br>*(${esc(e.sub)})*` : ''} | ${esc(e.note)} |\n`;
  md += '\n';
}
md += `## Beyond this list

Every line in the game has a voiceId, so any of the ${Object.values(BANKS).reduce((a, b) => a + Object.values(b.tags).reduce((x, l) => x + l.length, 0), 0)} lines in \`src/dialogue/banks/\` can be recorded the same way: the file name is \`<speaker>-<tag>-<nn>.mp3\` (for example \`gerald-throwaway-07.mp3\` is the 7th line in Gerald's throwaway list). Egg lines that World-data writes itself use their copy key with dots turned into dashes (\`egg.C1.pong\` becomes \`egg-C1-pong.mp3\`).
`;

fs.writeFileSync(path.join(root, 'VOICELINES.md'), md);
console.log(`[voicelines] wrote VOICELINES.md with ${total} lines`);
export { sections };
