// Player-facing copy for the animals area: species names, blurbs, signature
// moves, presets, cosmetics and the little italic thought captions.
// Registered at import time (species.js imports this file).

import { registerCopy } from '../core/copy/index.js';

const S = {
  oli: {
    name: 'Oli', blurb: 'A butter-yellow Labrador and a tail-wagging whirlwind. Thinks about food, water and you, in that order.',
    sig: 'Sniff Boost', sigDesc: 'Hold to sniff out the nearest tasty cluster, then let go to dash along the scent.',
    preset: { yellowlab: 'Yellow Lab', blacklab: 'Black Lab', choclab: 'Chocolate Lab', collie: 'Collie-ish', dalmatian: 'Spotty', beagle: 'Beagle-ish', husky: 'Husky-ish' },
    thought: ['{name} is thinking about lunch.', '{name} has spotted a puddle.', '{name} is considering the bin.', '{name} would like a biscuit, please.', '{name} is wagging so hard the back end has joined in.', '{name} has forgotten what he was doing. It was probably food.'],
  },
  cat: {
    name: 'Cat', blurb: 'Sleek, sudden and entirely unbothered. Fits through gaps that frankly should not fit a cat.',
    sig: 'Pounce', sigDesc: 'Wiggle, aim, leap. Gobbles everything in a ring where you land.',
    preset: { ginger: 'Ginger', tuxedo: 'Tuxedo', tabby: 'Tabby', siamese: 'Siamese-ish', calico: 'Calico', void: 'Little Void' },
    thought: ['{name} is judging you.', '{name} has knocked something off a table. On purpose.', '{name} is pretending that was intentional.', '{name} would like the door open. No, closed. No, open.'],
  },
  capybara: {
    name: 'Capybara', blurb: 'The calmest creature alive. Floats, naps, and makes everyone around it chill out.',
    sig: 'Chill Aura', sigDesc: 'A bubble of pure calm. Hazards relax and pigeons freeze mid-strut.',
    preset: { classic: 'Classic', golden: 'Golden Hour', mocha: 'Mocha', yuzu: 'Yuzu Bath' },
    thought: ['{name} is at peace.', '{name} has achieved inner calm. And outer calm.', '{name} is thinking about a nice warm bath.', '{name} could not be less bothered if it tried.'],
  },
  penguin: {
    name: 'Penguin', blurb: 'Waddles like a wind-up toy, slides like a rocket. Never met an icy slope it did not like.',
    sig: 'Belly-Slide', sigDesc: 'Flop on your tummy and zoom, gobbling everything in a line.',
    preset: { emperor: 'Emperor', rockhopper: 'Rockhopper', fairy: 'Little Blue', magellanic: 'Magellanic' },
    thought: ['{name} is waddling with purpose.', '{name} would like it colder, actually.', '{name} has spotted a slope and has plans.', '{name} is wearing a tuxedo. Always.'],
  },
  rabbit: {
    name: 'Rabbit', blurb: 'Bouncy, nosy and quick off the mark. Does binkies when happy, which is often.',
    sig: 'Super Hop', sigDesc: 'Charge up and spring into a huge arcing leap that gobbles on landing.',
    preset: { wild: 'Wild', lop: 'Lop-ish', snowy: 'Snowy', dutch: 'Dutch' },
    thought: ['{name} is twitching its nose at something.', '{name} has done a little binky.', '{name} is thinking about carrots. Obviously.', '{name} heard a noise and is now very alert.'],
  },
  duck: {
    name: 'Duck', blurb: 'Paddles like a pro and glides from anywhere high. Quacks at the absurdity of it all.',
    sig: 'Flap-Glide', sigDesc: 'Spread your wings and glide down from any height.',
    preset: { pekin: 'Pekin', mallard: 'Mallard', rubber: 'Rubber Duck', runner: 'Runner' },
    thought: ['{name} is going for a paddle.', '{name} would like some peas, not bread, thank you.', '{name} is preening with great seriousness.', '{name} said quack. It was a good quack.'],
  },
  tortoise: {
    name: 'Tortoise', blurb: 'Stately, smug and utterly unflappable. Never drops a thing, never hurries.',
    sig: 'Shell Up', sigDesc: 'Tuck in. Nothing can bump you, and you roll downhill like a bowling ball.',
    preset: { garden: 'Garden', desert: 'Desert', star: 'Starry', mossy: 'Mossy' },
    thought: ['{name} will get there. Eventually.', '{name} is not in a hurry. Never has been.', '{name} remembers when all this was fields.', '{name} is looking extremely pleased with itself.'],
  },
  frog: {
    name: 'Frog', blurb: 'All legs and grin. Hops lily pads in a chain and snaps things up with a satisfying thwip.',
    sig: 'Tongue Snap', sigDesc: 'Thwip! Grab one item from three times your reach.',
    preset: { tree: 'Tree Frog', poison: 'Very Blue', tomato: 'Tomato', golden: 'Golden' },
    thought: ['{name} is sitting very, very still.', '{name} has seen a fly.', '{name} said ribbit. Clearly.', '{name} is thinking about a nice damp leaf.'],
  },
  redpanda: {
    name: 'Red Panda', blurb: 'Fluffy, stripy and secretly a tree climber. Stands up tall when it means business.',
    sig: 'Stand Tall', sigDesc: 'Rear up with your arms out and count as a quarter bigger for a few seconds.',
    preset: { classic: 'Classic', ember: 'Ember', autumn: 'Autumn', snowy: 'Snowy' },
    thought: ['{name} is looking for a tree.', '{name} is being extremely fluffy about it.', '{name} has stood up to look scary. It is adorable.', '{name} is thinking about bamboo.'],
  },
  octopus: {
    name: 'Octopus', blurb: 'Eight arms, three hearts, zero chill about snacks. Grabs everything at once.',
    sig: 'Eight-Arm Grab', sigDesc: 'Fling all eight arms out and snatch up to eight nearby things.',
    preset: { coral: 'Coral', blueringed: 'Ringed', deepsea: 'Deep Sea', mimic: 'Mimic' },
    thought: ['{name} is doing eight things at once.', '{name} is changing colour to match the mood.', '{name} would like to hold that, and that, and that.', '{name} has escaped from an aquarium. Allegedly.'],
  },
  snake: {
    name: 'Snake', blurb: 'Flows like a ribbon and slips under fences. Very friendly, just a bit long.',
    sig: 'Coil Pull', sigDesc: 'Wind round a cluster of things and drag the lot in.',
    preset: { garden: 'Garden', coral: 'Coral', python: 'Pythonish', albino: 'Lemon' },
    thought: ['{name} is tasting the air.', '{name} is giving you a friendly look.', '{name} would like to be measured. It is very long.', '{name} is going under the fence. Of course it is.'],
  },
  elephant: {
    name: 'Elephant', blurb: 'Huge, gentle and never forgets a snack. Starts big and hoovers up the rest.',
    sig: 'Trunk Hoover', sigDesc: 'Point the trunk and suck up everything in a cone in front.',
    preset: { grey: 'Grey', dusty: 'Dusty', pink: 'Pink', festival: 'Festival' },
    thought: ['{name} remembers where the buns are.', '{name} is being very careful with its feet.', '{name} has a trunk full of water and a plan.', '{name} is the size of a small shed and proud of it.'],
  },
  routercat: {
    name: 'Router-Cat', blurb: 'Half cat, half home router, all attitude. The more you combo, the more bars it gets.',
    sig: 'Wi-Fi Purr', sigDesc: 'Purr at full signal and pull things in from a radius that grows with your bars.',
    preset: { stock: 'Factory Settings', beige: 'Beige Box', rgb: 'RGB Gamer', enterprise: 'Enterprise' },
    thought: ['{name} has five bars.', '{name} is turning itself off and on again.', '{name} is buffering. Please wait.', '{name} has a strong opinion about channel interference.'],
  },
};

const COSMETIC_NAMES = {
  bowler: ['Bowler Hat', 'Very proper. Raises its brim to strangers.'],
  carnivalcrown: ['Carnival Crown', 'Feathers, sequins and absolutely no shame.'],
  partyhat: ['Party Hat', 'Every day is a party if you are a dog.'],
  goggles: ['Aviator Goggles', 'For high-speed zoomies.'],
  flatcap: ['Flat Cap', 'Off down the pub? No, the park.'],
  bobblehat: ['Bobble Hat', 'The bobble bobbles. That is the whole point.'],
  beret: ['Beret', 'Instantly more artistic.'],
  tiara: ['Tiara', 'For the royalty you already are.'],
  crown: ['Royal Crown', 'For an Absolute Unit.'],
  bearskin: ['Bearskin Hat', 'Do not move. Do not smile. Well, maybe a small one.'],
  touristhat: ['Tourist Hat', 'Part of a cunning disguise.'],
  explorer: ['Explorer Helmet', 'Part of a cunning disguise.'],
  hoodie: ['Hoodie', 'Part of a cunning disguise.'],
  collarred: ['Red Collar', 'A classic. Jingles slightly.'],
  collarteal: ['Teal Collar', 'Smart and seaside fresh.'],
  bandanared: ['Red Bandana', 'Rugged. Windswept. Possibly a cowboy.'],
  bandanablue: ['Blue Bandana', 'For the coolest animal on the beach.'],
  bowtie: ['Bow Tie', 'Bow ties are cool.'],
  scarf: ['Tartan Scarf', 'Keeps the Highland wind off.'],
  lei: ['Flower Garland', 'Smells lovely. Do not eat it.'],
  goodanimal: ['Certified Good Animal', 'Official. Laminated. Indisputable.'],
  cape: ['Hero Cape', 'Flaps dramatically at top speed.'],
  backpack: ['Tiny Backpack', 'Snacks for the road.'],
  swimring: ['Swim Ring', 'Safety first, splashing second.'],
  fairywings: ['Fairy Wings', 'They do not work. They do look magical.'],
  sunglasses: ['Sunglasses', 'Too cool for the beach. Goes anyway.'],
  monocle: ['Monocle', 'Indubitably.'],
  heartglasses: ['Heart Glasses', 'Sees the world with love. And slightly pink.'],
  moustache: ['Moustache', 'Distinguished. Twirlable.'],
  snorkel: ['Snorkel Mask', 'For proper underwater nosing about.'],
  bubbles: ['Bubble Trail', 'Leaves a trail of happy bubbles.'],
  sparkles: ['Sparkle Trail', 'Shimmers wherever you go.'],
  hearts: ['Heart Trail', 'Leaves a little love behind you.'],
  teasteam: ['Tea Steam Trail', 'A gentle waft of a fresh brew.'],
  wavetiles: ['Wave Pavement Trail', 'Your own bit of Copacabana underfoot.'],
  datapackets: ['Data Packet Trail', 'Packets in flight. Mostly delivered.'],
  squeaky: ['Squeaky Toy', 'Every noise is a squeak now. Sorry.'],
  kazoo: ['Kazoo', 'The noblest of instruments.'],
  opera: ['Tiny Opera', 'Every bark is an aria.'],
  robot: ['Robot Voice', 'BEEP. HELLO. I AM A GOOD ANIMAL.'],
  badge_good: ['Good Animal Pin', 'A tiny badge of honour.'],
  badge_tea: ['Tea Pin', 'Milk, no sugar.'],
  badge_ping: ['Ping Pin', 'Pong.'],
  badge_star: ['Star Pin', 'For collecting stars like a pro.'],
};

const CRITTERS = {
  pigeon: 'Pigeon', gerald: 'Gerald', nigel: 'Nigel', gull: 'Gull', toucan: 'Toucan', marmoset: 'Marmoset', squirrel: 'Squirrel',
  sloth: 'Sloth', highlandcow: 'Highland Cow', haggis: 'Wild Haggis', kitten: 'Kitten', magpenguin: 'Holiday Penguin', frog: 'Frog',
  duckling: 'Duckling', butterfly: 'Butterfly', fox: 'Fox',
};

const table = {};
for (const [id, s] of Object.entries(S)) {
  table[`species.${id}.name`] = s.name;
  table[`species.${id}.blurb`] = s.blurb;
  table[`species.${id}.sig`] = s.sig;
  table[`species.${id}.sigDesc`] = s.sigDesc;
  table[`species.${id}.thought`] = s.thought;
  for (const [p, n] of Object.entries(s.preset)) table[`species.${id}.preset.${p}`] = n;
}
for (const [id, [n, d]] of Object.entries(COSMETIC_NAMES)) { table[`cosmetic.${id}.name`] = n; table[`cosmetic.${id}.desc`] = d; }
for (const [id, n] of Object.entries(CRITTERS)) table[`species.critter.${id}.name`] = n;
table['species.slot.head'] = 'Hats';
table['species.slot.neck'] = 'Neckwear';
table['species.slot.back'] = 'Back';
table['species.slot.face'] = 'Face';
table['species.slot.trail'] = 'Trails';
table['species.slot.sound'] = 'Sound Packs';
table['species.slot.badge'] = 'Badges';
table['species.pattern.none'] = 'Plain';
table['species.pattern.patches'] = 'Patches';
table['species.pattern.stripes'] = 'Stripes';
table['species.pattern.spots'] = 'Spots';
table['species.pattern.socks'] = 'Socks';
table['species.pattern.blaze'] = 'Blaze';
table['species.pattern.saddle'] = 'Saddle';
table['species.pattern.mask'] = 'Mask';
table['species.pattern.bands'] = 'Bands';
table['species.colour.base'] = 'Coat';
table['species.colour.secondary'] = 'Shading';
table['species.colour.belly'] = 'Tummy';
table['species.colour.tips'] = 'Tips';
table['species.colour.eyes'] = 'Eyes';
table['species.colour.nose'] = 'Nose';
table['species.colour.patternColor'] = 'Markings';

registerCopy('en-GB', table);

export const ANIMAL_COPY = table;
