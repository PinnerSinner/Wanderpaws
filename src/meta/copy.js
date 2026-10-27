// Copy for the meta game: achievements (ach.*) and everything else (meta.*).
// British English, no em dashes.

import { registerCopy } from '../core/copy/index.js';
import { SPECIES, SPECIES_ORDER } from '../animals/species.js';
import { DEFAULT_NAMES } from './data.js';
import { STAT_KEYS } from './save.js';

const ACH = {
  elevenses: ['Elevenses', 'Gobble your very first thing.'],
  peckish: ['A Bit Peckish', 'Gobble 1,000 things in total.'],
  bigLad: ['Big Lad', 'Grow to 10 metres.'],
  absoluteUnit: ['Absolute Unit', 'Grow to 100 metres. In this economy.'],
  visibleFromSpace: ['Visible From Space', 'Grow to 300 metres.'],
  teaTotal: ['Tea-Total', 'Have five Tea Times in a single run.'],
  milkTwoSugars: ['Milk, Two Sugars', 'Drink 100 cups of tea. Auntie Pru approves.'],
  puddleProfessional: ['Puddle Professional', 'Make 50 splashes. Somebody fetch a towel.'],
  fluentInPombo: ['Fluent in Pombo', 'Scare 100 pigeons. They had it coming.'],
  allBark: ['All Bark', 'Bark 500 times. The neighbours have noted it.'],
  veryPolite: ['Ever So Polite', 'Play-bow 50 times.'],
  bitWobbly: ['A Bit Wobbly', 'Visit the lime squash stand. It was definitely lime squash.'],
  walkies: ['Walkies!', 'Cover 10 kilometres on your paws (or flippers).'],
  onARoll: ['On a Roll', 'Chain a 10-gobble combo.'],
  comboBreaker: ['Combo Breaker', 'Chain a 25-gobble combo.'],
  butterpaws: ['Butterpaws', 'Get bumped ten times in one run. Whoopsie.'],
  notAScratch: ['Not a Scratch', 'Reach the goal size without touching a single hazard.'],
  goldStar: ['Gold Star for Effort', 'Earn your first star.'],
  hatTrick: ['Hat Trick', 'Earn all three stars in one run.'],
  teachersPet: ["Teacher's Pet", 'Earn every star in every world.'],
  beatTheKettle: ['Beat the Kettle', 'Reach the goal size under par time.'],
  geraldWho: ['Gerald Who?', 'Finish all five worlds and get your ball back.'],
  feetUp: ['Feet Up', 'Finish a run in Chill mode.'],
  offLikeAShot: ['Off Like a Shot', 'Finish a Zoomies run.'],
  eggsBenedict: ['Eggs Benedict', 'Find 10 easter eggs.'],
  fullEnglish: ['Full English', 'Find every easter egg in one world.'],
  wholeClutch: ['The Whole Clutch', 'Find every easter egg in every world.'],
  pingPong: ['Ping? Pong!', 'Catch the kiosk router mid-blink.'],
  noPlaceLikeHome: ['No Place Like 127.0.0.1', 'Have a cosy nap at home.'],
  golaco: ['GOLAÇO!', 'Get the footvolley crowd on its feet.'],
  localhostExpress: ['The 127 to Localhost', 'Wait patiently for a very particular bus.'],
  stiffUpperLip: ['Stiff Upper Lip', 'Make the sentry crack the tiniest smile.'],
  threeWayHandshake: ['Three-Way Handshake', 'SYN, SYN-ACK, play-bow.'],
  turnItOffAndOn: ['Have You Tried Turning It Off and On Again', 'Help the data centre with its little problem.'],
  midasPaws: ['Midas Paws', 'Find a golden collectible.'],
  gildedLily: ['Gilded Lily', 'Find the golden collectible in all five worlds.'],
  nosyParker: ['Nosy Parker', 'Fill in half of the Journal.'],
  knowItAll: ['Know-It-All', 'Complete the Journal. Every last bottle cap.'],
  everyAnimal: ['Every Animal Is a Good Animal', 'Play as all 13 animals.'],
  purrfectlyNetworked: ['Purrfectly Networked', 'Untangle three kittens from the cable spaghetti.'],
  biscuitTin: ['Biscuit Tin', 'Have 500 biccies in the tin at once.'],
  retailTherapy: ['Retail Therapy', 'Buy something nice from the shop.'],
  dressedToTheNines: ['Dressed to the Nines', 'Own nine cosmetics.'],
  whatsInAName: ["What's in a Name?", 'Give one of your animals a new name.'],
  sameTimeTomorrow: ['Same Time Tomorrow?', 'Complete a daily challenge.'],
  creatureOfHabit: ['Creature of Habit', 'Keep a seven-day daily streak.'],
  characterBuilding: ['Cheating Is Character Building', 'Type a secret word on the title screen.'],
  goodBoyMode: ["Who's a Good Boy?", 'Up, up, down, down... you know the rest.'],
  secretSquirrel: ['Secret Squirrel', 'Find all seven title-screen secrets.'],
};

const WORLD_SHORT = { w1: 'Copacabana', w2: 'London', w3: 'Tijuca', w4: 'the Highlands', w5: 'the Marcoverse' };
const WORLD_HINT_AREA = { w1: 'the beach', w2: 'the park', w3: 'the rainforest', w4: 'the Highlands', w5: 'the Marcoverse' };
const NUM = ['no', 'one', 'two', 'three'];

function eggArea(egg) {
  const p = String(egg || '').charAt(0);
  return { C: 'w1', L: 'w2', T: 'w3', H: 'w4', M: 'w5' }[p] || null;
}

export function hintText(rule) {
  if (!rule || !rule.kind || rule.kind === 'start') return 'Ready to play.';
  const w = WORLD_SHORT[rule.world] || 'Copacabana';
  let s;
  switch (rule.kind) {
    case 'stars': {
      const n = rule.count ?? 1;
      s = `Earn ${NUM[n] || n} star${n === 1 ? '' : 's'} ${rule.world ? 'in ' + w : 'in total'}.`;
      break;
    }
    case 'finish': s = `Finish ${w}.`; break;
    case 'journal': s = `Fill in ${rule.pct ?? 100}% of the Journal.`; break;
    case 'golden': s = `Find the golden collectible in ${w}.`; break;
    case 'secret':
    case 'egg': s = `A secret. Have a good sniff around ${WORLD_HINT_AREA[eggArea(rule.egg)] || 'everywhere'}.`; break;
    case 'story': s = 'Finish the story and get your ball back.'; break;
    case 'price': s = 'Available in the shop.'; break;
    case 'achievement': s = 'Earn a particular achievement.'; break;
    default: s = 'Keep playing to find out.';
  }
  if (rule.price != null && rule.kind !== 'price') s += ' Or buy it in the shop.';
  return s;
}

const table = {
  // Achievement chrome
  'meta.ach.title': 'Achievements',
  'meta.ach.locked': 'Not yet',
  'meta.ach.earned': 'Achievement!',
  'meta.ach.progress': '{n} of {total}',
  'meta.group.grow': 'Growing',
  'meta.group.gobble': 'Gobbling',
  'meta.group.explore': 'Worlds',
  'meta.group.eggs': 'Easter eggs',
  'meta.group.play': 'Mucking about',
  'meta.group.collect': 'Collecting',
  'meta.group.social': 'Habits',
  // Unlocks
  'meta.unlock.species': 'New animal: {name}!',
  'meta.unlock.world': 'New world unlocked!',
  'meta.unlock.cosmetic': 'New in the shop!',
  'meta.unlock.locked': 'Locked',
  'meta.worldHint.w1': 'Open from the start.',
  'meta.worldHint.w2': 'Earn a star in Copacabana to open London.',
  'meta.worldHint.w3': 'Earn a star in London to open Tijuca.',
  'meta.worldHint.w4': 'Earn a star in Tijuca to open the Highlands.',
  'meta.worldHint.w5': 'Earn a star in the Highlands to open the Marcoverse.',
  // Journal
  'meta.journal.new': 'New: {item}!',
  'meta.journal.pct': '{pct}% complete',
  'meta.journal.unknown': '???',
  'meta.journal.golden': 'Golden!',
  'meta.eggs.count': '{n} of {total} secrets found',
  // Economy
  'meta.biccies': 'Biccies',
  'meta.biccies.count': '{n} biccies',
  'meta.biccies.earned': '+{n} biccies',
  'meta.bic.gobbles': 'Gobbling',
  'meta.bic.combos': 'Combos',
  'meta.bic.stars': 'Stars',
  'meta.bic.eggs': 'Secrets',
  'meta.bic.discoveries': 'New Journal entries',
  'meta.bic.golden': 'Golden finds',
  'meta.bic.activities': 'Mini-games',
  'meta.bic.daily': 'Daily challenge',
  'meta.bic.finish': 'Turning up',
  'meta.shop.cantAfford': 'Not enough biccies yet.',
  'meta.shop.owned': 'Owned',
  'meta.shop.bought': 'Lovely. That suits you.',
  // Records
  'meta.record.size': 'New biggest size!',
  'meta.record.time': 'New best time!',
  'meta.record.star': 'New star!',
  // Daily
  'meta.daily.title': 'Daily challenge',
  'meta.daily.done': 'Done for today. Same time tomorrow?',
  'meta.daily.streak': '{n}-day streak',
  'meta.daily.streakNone': 'No streak yet',
  'meta.daily.special': 'Special item: worth triple biccies',
  // Modifiers
  'meta.mod.bigHead': 'Big Head',
  'meta.mod.lowGravity': 'Moonwalk',
  'meta.mod.disco': 'Disco',
  'meta.mod.tiny': 'Tiny World',
  'meta.mod.duckRain': 'Quackers',
  'meta.mod.goodBoy': 'Good Boy Mode',
  'meta.mod.oliZoomies': 'Zoomies!',
  'meta.mod.speedy': 'Speedy',
  'meta.mod.mirror': 'Mirror World',
  'meta.mod.on': '{mod}: on',
  'meta.mod.off': '{mod}: off',
  // Stats
  'meta.stats.title': 'Stats',
  'meta.stat.distance': 'Distance walked',
  'meta.stat.gobbled': 'Things gobbled',
  'meta.stat.biggestSize': 'Biggest size',
  'meta.stat.pigeons': 'Pigeons scared',
  'meta.stat.tea': 'Cups of tea',
  'meta.stat.eggs': 'Secrets found',
  'meta.stat.runs': 'Runs finished',
  'meta.stat.timePlayed': 'Time played',
  'meta.stat.barks': 'Barks (and meows, and quacks)',
  'meta.stat.playBows': 'Play-bows',
  'meta.stat.splashes': 'Splashes',
  'meta.stat.jumps': 'Jumps',
  'meta.stat.bumps': 'Whoopsies',
  'meta.stat.bestCombo': 'Best combo',
  'meta.stat.goldens': 'Golden finds',
  'meta.stat.dailies': 'Daily challenges',
  'meta.stat.stars': 'Stars earned',
  'meta.stat.biccies': 'Biccies earned',
  // Save
  'meta.save.backup': 'Your save had a wobble, so we used the backup.',
  'meta.save.reset': 'Your save could not be read, so we started a fresh one.',
  // Input (owned by the same agent)
  'meta.input.sig': 'Signature move',
};

for (const id in ACH) {
  table[`ach.${id}.name`] = ACH[id][0];
  table[`ach.${id}.desc`] = ACH[id][1];
}
for (const id of Object.keys(DEFAULT_NAMES)) table[`meta.name.${id}`] = DEFAULT_NAMES[id];
for (const id of SPECIES_ORDER) {
  if (!table[`meta.name.${id}`]) table[`meta.name.${id}`] = 'Buddy';
  table[`meta.hint.${id}`] = hintText(SPECIES[id]?.unlock);
}
for (const k of STAT_KEYS) if (!table[`meta.stat.${k}`]) table[`meta.stat.${k}`] = k;

registerCopy('en-GB', table);

export const ACH_COPY = ACH;
