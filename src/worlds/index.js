// The five worlds, in story order. Importing this also registers the worlds'
// copy (names, journal lines, egg text) with the copy table.
import './copy.js';
import { W1 } from './w1-copacabana.js';
import { W2 } from './w2-london.js';
import { W3 } from './w3-tijuca.js';
import { W4 } from './w4-highlands.js';
import { W5 } from './w5-marcoverse.js';

export const WORLDS = [W1, W2, W3, W4, W5];
export const WORLD_IDS = WORLDS.map((w) => w.id);
export function getWorld(id) { return WORLDS.find((w) => w.id === id) || WORLDS[0]; }
export { W1, W2, W3, W4, W5 };
