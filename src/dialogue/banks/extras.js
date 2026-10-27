// Small banks for egg cameos: Nigel (Gerald's Cockney cousin, L2), the sloth
// who finishes one sentence across a whole level (T13), the heckling toucan
// (T1) and the Good Boy Mode captions (G6). Not part of ambient chatter.

export const nigel = {
  speaker: 'nigel',
  lines: {
    throwaway: [
      'Oi oi! Wotcha lookin\' at, fluffy?',
      'Gerald? Never \'eard of \'im. Bit of a plonker, by all accounts.',
      'Best view in London, this. And the best breadcrumbs.',
      'You \'avin\' a laugh? Get off my column!',
      'Cor blimey, you\'re a big \'un.',
      'I \'ad a ball once. Lovely ball. Gerald nicked it.',
      'Mind \'ow you go, sunshine.',
      'Pigeons run this town. Always \'ave.',
    ],
  },
};

// The sloth says one word a minute; these run in order.
export const sloth = {
  speaker: 'sloth',
  lines: {
    sentence: ['Hello.', 'I.', 'Have.', 'Been.', 'Meaning.', 'To.', 'Say.', 'That.', 'You.', 'Are.', 'Doing.', 'Very.', 'Well.'],
  },
};

export const toucan = {
  speaker: 'toucan',
  lines: {
    throwaway: [
      'Squawk! Nice hat, pigeon!',
      'Oi, explorer! You\'re lost!',
      'Ha! Ha! Ha! Look at the pigeon!',
      'Squawk! Gap year? Gap brain!',
    ],
  },
};

export const goodboy = {
  speaker: 'goodboy',
  lines: {
    any: [
      'Good boy!', 'Who\'s a good boy?', 'Such a good boy!', 'Good boy! Good boy!', 'The goodest boy.',
      'Good boy, yes you are!', 'Best boy in the world.', 'Good boy. Very good boy.',
    ],
  },
};
