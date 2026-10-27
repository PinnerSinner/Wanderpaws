import { GAME } from './game.js';

// localStorage wrapped in try/catch with an in-memory fallback, so private
// windows, blocked storage and Node all behave.
export function createStorage(prefix = `${GAME.slug}.v${GAME.saveVersion}.`) {
  const mem = new Map();
  let ls = null;
  try {
    if (typeof localStorage !== 'undefined') {
      const k = prefix + '__probe';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      ls = localStorage;
    }
  } catch { ls = null; }

  return {
    get persistent() { return !!ls; },
    get(key, fallback = null) {
      try {
        const raw = ls ? ls.getItem(prefix + key) : mem.get(key);
        if (raw == null) return fallback;
        return JSON.parse(raw);
      } catch { return fallback; }
    },
    set(key, value) {
      const raw = JSON.stringify(value);
      mem.set(key, raw);
      try { if (ls) ls.setItem(prefix + key, raw); } catch { /* quota or blocked: memory copy still holds */ }
    },
    remove(key) {
      mem.delete(key);
      try { if (ls) ls.removeItem(prefix + key); } catch { /* ignore */ }
    },
    keys() {
      const out = new Set(mem.keys());
      try {
        if (ls) for (let i = 0; i < ls.length; i++) {
          const k = ls.key(i);
          if (k && k.startsWith(prefix)) out.add(k.slice(prefix.length));
        }
      } catch { /* ignore */ }
      return [...out];
    },
    clearAll() { for (const k of this.keys()) this.remove(k); },
  };
}
