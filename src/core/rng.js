// Seeded randomness. The sim only ever uses these, never Math.random.

export function hashString(str) {
  // FNV-1a, 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createRng(seed = 1) {
  let s = (typeof seed === 'string' ? hashString(seed) : seed >>> 0) || 0x9e3779b9;
  const rng = {
    get seed() { return s; },
    next() {
      // mulberry32
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(a, b) { return a + (b - a) * rng.next(); },
    int(a, b) { return a + Math.floor(rng.next() * (b - a + 1)); },
    chance(p) { return rng.next() < p; },
    pick(arr) { return arr[Math.floor(rng.next() * arr.length)]; },
    sign() { return rng.next() < 0.5 ? -1 : 1; },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    },
    // Independent child stream, stable for a given label.
    fork(label) { return createRng((s ^ hashString(String(label))) >>> 0); },
  };
  return rng;
}

// Date helpers for the daily challenge (local date, no backend).
export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dateSeed(d = new Date()) {
  return hashString('daily:' + dateKey(d));
}
