// Cosmetics: hats, neckwear, back bits, face furniture, trails, sound packs and
// badges. Prices are in Biccies. `unlock` (optional) gates an item behind
// something other than money; the profile decides what counts as met:
//   { kind: 'achievement', id }   an achievement id (see REQUESTS.md for the list we assume)
//   { kind: 'egg', egg }          an easter egg id from SPEC §7
//   { kind: 'finish', world }     finish that world
//   { kind: 'stars', count }      total stars across all worlds
//   { kind: 'golden', world }     that world's golden item
// Names are `cosmetic.<id>.name` (src/animals/copy.js). `free: true` items are
// owned from the start.
//
// Trail and sound ids double as the kind: look.trail = 'bubbles' and
// look.soundPack = 'kazoo' are what render and audio key off.
// View-side hints (not needed by the sim): `colors` is the default tint for the
// mesh builder, `trail` and `sound` are ids render and audio key off.

const C = (id, slot, price, extra = {}) => ({ id, slot, nameKey: `cosmetic.${id}.name`, descKey: `cosmetic.${id}.desc`, price, ...extra });

export const COSMETICS = [
  // head
  C('bowler', 'head', 120, { colors: ['#2a2624', '#1a1716'] }),
  C('carnivalcrown', 'head', 300, { colors: ['#f2c234', '#e0407a', '#3ac0e0'], unlock: { kind: 'finish', world: 'w1' } }),
  C('partyhat', 'head', 60, { colors: ['#ff6fa8', '#ffd23a'], free: true }),
  C('goggles', 'head', 150, { colors: ['#6a4a2a', '#9ad8f0'] }),
  C('flatcap', 'head', 110, { colors: ['#7a6a52', '#5f5240'] }),
  C('bobblehat', 'head', 90, { colors: ['#d8343a', '#f4f1ea'] }),
  C('beret', 'head', 100, { colors: ['#2a2a3a', '#1c1c26'] }),
  C('tiara', 'head', 250, { colors: ['#e8e8f0', '#ff7ab8'], unlock: { kind: 'stars', count: 9 } }),
  C('crown', 'head', 500, { colors: ['#f2c234', '#d8343a'], unlock: { kind: 'achievement', id: 'absoluteUnit' } }),
  C('bearskin', 'head', 280, { colors: ['#1a1716', '#d8343a'], unlock: { kind: 'egg', egg: 'L11' } }),
  // neck
  C('collarred', 'neck', 0, { colors: ['#d8343a', '#f2c234'], free: true }),
  C('collarteal', 'neck', 40, { colors: ['#2ab0a0', '#f2c234'] }),
  C('bandanared', 'neck', 70, { colors: ['#d8343a', '#ffffff'] }),
  C('bandanablue', 'neck', 70, { colors: ['#2f6ad0', '#ffffff'] }),
  C('bowtie', 'neck', 90, { colors: ['#d8343a', '#a8202a'] }),
  C('scarf', 'neck', 130, { colors: ['#c0302a', '#1f4a2a', '#f2c234'] }),
  C('lei', 'neck', 160, { colors: ['#ff6fa8', '#ffd23a', '#ff8a3a'], unlock: { kind: 'egg', egg: 'C8' } }),
  C('goodanimal', 'neck', 200, { colors: ['#2f6ad0', '#f2c234'], unlock: { kind: 'achievement', id: 'goodBoyMode' } }),
  // back
  C('cape', 'back', 180, { colors: ['#d8343a', '#f2c234'] }),
  C('backpack', 'back', 120, { colors: ['#f2a63a', '#7a4a2a'] }),
  C('swimring', 'back', 100, { colors: ['#ff5a5a', '#ffffff'] }),
  C('fairywings', 'back', 260, { colors: ['#b8e8ff', '#ffb8f0'], unlock: { kind: 'golden', world: 'w3' } }),
  // face
  C('sunglasses', 'face', 80, { colors: ['#1a1a1a', '#3a3a3a'], free: true }),
  C('monocle', 'face', 140, { colors: ['#f2c234', '#d0f0ff'] }),
  C('heartglasses', 'face', 120, { colors: ['#ff4a7a', '#ff9ab8'] }),
  C('moustache', 'face', 90, { colors: ['#3a2618'] }),
  C('snorkel', 'face', 150, { colors: ['#f2c234', '#9ad8f0'], unlock: { kind: 'finish', world: 'w4' } }),
  // trails
  C('bubbles', 'trail', 150, { trail: 'bubbles' }),
  C('sparkles', 'trail', 200, { trail: 'sparkles' }),
  C('hearts', 'trail', 180, { trail: 'hearts' }),
  C('teasteam', 'trail', 220, { trail: 'teasteam', unlock: { kind: 'achievement', id: 'teaTotal' } }),
  C('wavetiles', 'trail', 250, { trail: 'wavetiles', unlock: { kind: 'finish', world: 'w1' } }),
  C('datapackets', 'trail', 300, { trail: 'datapackets', unlock: { kind: 'finish', world: 'w5' } }),
  // sound packs
  C('squeaky', 'sound', 120, { sound: 'squeaky' }),
  C('kazoo', 'sound', 150, { sound: 'kazoo' }),
  C('opera', 'sound', 250, { sound: 'opera', unlock: { kind: 'egg', egg: 'T11' } }),
  C('robot', 'sound', 200, { sound: 'robot', unlock: { kind: 'finish', world: 'w5' } }),
  // badges (worn as a little pin on the chest, accessories.badge)
  C('badge_good', 'badge', 50, { colors: ['#2f6ad0', '#f2c234'] }),
  C('badge_tea', 'badge', 80, { colors: ['#f4f1ea', '#a0522d'] }),
  C('badge_ping', 'badge', 100, { colors: ['#5ef0c2', '#1c1c24'], unlock: { kind: 'egg', egg: 'C1' } }),
  C('badge_star', 'badge', 150, { colors: ['#f2c234', '#d8343a'], unlock: { kind: 'stars', count: 15 } }),
];

export const COSMETIC_SLOTS = ['head', 'neck', 'back', 'face', 'trail', 'sound', 'badge'];

const byId = new Map(COSMETICS.map((c) => [c.id, c]));
export function getCosmetic(id) { return byId.get(id) || null; }
export function cosmeticsForSlot(slot) { return COSMETICS.filter((c) => c.slot === slot); }
