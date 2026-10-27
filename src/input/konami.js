// The Konami sequence matcher: up up down down left right left right B A.
// Tokens: 'U' 'D' 'L' 'R' 'B' 'A'. Works for keyboard (arrows plus the B and
// A keys) and gamepad (d-pad plus the B and A buttons).

export const KONAMI = Object.freeze(['U', 'U', 'D', 'D', 'L', 'R', 'L', 'R', 'B', 'A']);
// What profile.codes.check expects when the sequence lands (see src/meta/codes.js).
export const KONAMI_TOKEN = 'KONAMI';

export function createKonami(seq = KONAMI) {
  const buf = [];
  return {
    // Returns true when this token completes the sequence.
    push(token) {
      buf.push(token);
      if (buf.length > seq.length) buf.shift();
      if (buf.length < seq.length) return false;
      for (let i = 0; i < seq.length; i++) if (buf[i] !== seq[i]) return false;
      buf.length = 0;
      return true;
    },
    reset() { buf.length = 0; },
    get progress() {
      // Longest suffix of the buffer that is a prefix of the sequence.
      for (let n = Math.min(buf.length, seq.length); n > 0; n--) {
        let ok = true;
        for (let i = 0; i < n; i++) if (buf[buf.length - n + i] !== seq[i]) { ok = false; break; }
        if (ok) return n;
      }
      return 0;
    },
  };
}

const KEY_TOKENS = { ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R', KeyB: 'B', KeyA: 'A' };
export function keyToken(code) { return KEY_TOKENS[code] || null; }

// Pad: d-pad 12..15, B = 1, A = 0.
const PAD_TOKENS = { 12: 'U', 13: 'D', 14: 'L', 15: 'R', 1: 'B', 0: 'A' };
export function padToken(index) { return PAD_TOKENS[index] || null; }
