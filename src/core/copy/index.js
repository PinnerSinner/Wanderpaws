// One copy table for every player-facing string. Each area registers its own
// table at import time (registerCopy) so no two agents edit the same file.
// Lookup: t('ui.title.play'), with {vars} interpolation and en-GB fallback.

const tables = { 'en-GB': {}, 'pt-BR': {} };
let locale = 'en-GB';

export function registerCopy(loc, table) {
  if (!tables[loc]) tables[loc] = {};
  Object.assign(tables[loc], table);
}

export function setLocale(loc) { if (tables[loc]) locale = loc; }
export function getLocale() { return locale; }

export function hasCopy(key, loc = locale) {
  return key in tables[loc] || key in tables['en-GB'];
}

export function t(key, vars) {
  let s = tables[locale][key];
  if (s == null) s = tables['en-GB'][key];
  if (s == null) return key; // visible but harmless; tests check coverage
  if (Array.isArray(s)) s = s[0];
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  return s;
}

// Raw value (arrays allowed, for bark banks and journal lines)
export function tRaw(key, loc = locale) {
  return tables[loc][key] ?? tables['en-GB'][key];
}

export function allKeys(loc = 'en-GB') { return Object.keys(tables[loc] || {}); }

// Core strings
registerCopy('en-GB', {
  'game.tagline': 'Gobble everything smaller than you.',
  'common.ok': 'OK',
  'common.back': 'Back',
  'common.close': 'Close',
  'common.yes': 'Yes',
  'common.no': 'No',
});
