// Registers cast names and every bank line with the copy table, so all chatter
// goes through t(). Seu Zé's lines are pt-BR text with the English under
// `<key>.en` (CONTRACTS §0).

import { registerCopy } from '../core/copy/index.js';
import { allLines } from './banks/index.js';

export const CAST_NAMES = {
  gerald: 'Gerald', marco: 'Marco', kev: 'Captain Kev', ze: 'Seu Zé', pru: 'Auntie Pru',
  packet: 'Packet', narrator: 'Narrator', nigel: 'Nigel', sloth: 'The Sloth', toucan: 'The Toucan',
};

const table = {};
for (const [id, name] of Object.entries(CAST_NAMES)) table[`cast.${id}.name`] = name;
for (const l of allLines()) {
  table[l.key] = l.text;
  if (l.sub) table[l.key + '.en'] = l.sub;
}
registerCopy('en-GB', table);

export const DIALOGUE_COPY = table;
