// Title-screen codes (SPEC §7, G1 to G7). The UI keeps a buffer of typed
// letters from input.onText and calls profile.codes.check(buffer); a match on
// the END of the buffer counts. The Konami sequence arrives as input.onKonami,
// and the UI then calls profile.codes.check(KONAMI_TOKEN).

export const KONAMI_TOKEN = 'KONAMI';

export const CODES = Object.freeze([
  { code: 'BIGHEAD', modifier: 'bigHead', egg: 'G1', toggle: true },
  { code: 'MOONWALK', modifier: 'lowGravity', egg: 'G2', toggle: true },
  { code: 'DISCO', modifier: 'disco', egg: 'G3', toggle: true },
  { code: 'TINY', modifier: 'tiny', egg: 'G4', toggle: true },
  { code: 'QUACKERS', modifier: 'duckRain', egg: 'G5', toggle: true },
  { code: KONAMI_TOKEN, modifier: 'goodBoy', egg: 'G6', toggle: true },
  { code: 'OLI', modifier: 'oliZoomies', egg: 'G7', toggle: false },   // a one-off title gag, not persisted
]);

// Modifiers that persist as toggles (title codes plus the F34 level modifiers).
export const MODIFIER_IDS = ['bigHead', 'lowGravity', 'disco', 'tiny', 'duckRain', 'goodBoy', 'speedy', 'mirror'];

const BY_LENGTH = [...CODES].sort((a, b) => b.code.length - a.code.length);

export function matchCode(buffer) {
  if (buffer == null) return null;
  const s = String(buffer).toUpperCase();
  for (const c of BY_LENGTH) if (s.endsWith(c.code)) return c;
  return null;
}
