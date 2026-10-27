// Menu navigation helpers (pure): hold-to-repeat timing, and which keys and
// pad buttons mean what in menus.

export const MENU_DELAY = 0.38;     // seconds before a held direction repeats
export const MENU_INTERVAL = 0.11;  // seconds between repeats

// Feed it the currently held direction (or null) and the time in seconds.
// Returns the direction to fire this update, or null.
export function createRepeater({ delay = MENU_DELAY, interval = MENU_INTERVAL } = {}) {
  let cur = null;
  let next = 0;
  return {
    update(dir, t) {
      if (dir !== cur) {
        cur = dir;
        next = t + delay;
        return dir || null;
      }
      if (!dir) return null;
      if (t >= next) {
        // Catch up without bursting if we were starved of updates.
        next = Math.max(next + interval, t - interval * 0.5);
        if (next <= t) next = t + interval;
        return dir;
      }
      return null;
    },
    reset() { cur = null; next = 0; },
    get held() { return cur; },
  };
}

export const MENU_KEYS = Object.freeze({
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
});
export const MENU_EDGE_KEYS = Object.freeze({
  Enter: 'confirm', NumpadEnter: 'confirm', Escape: 'cancel', Backspace: 'cancel',
  KeyQ: 'tabPrev', KeyE: 'tabNext', BracketLeft: 'tabPrev', BracketRight: 'tabNext',
  PageUp: 'tabPrev', PageDown: 'tabNext',
});
// Pad buttons (standard mapping) to menu actions.
export const MENU_PAD = Object.freeze({ 0: 'confirm', 1: 'cancel', 4: 'tabPrev', 5: 'tabNext' });

const TEXT_TYPES = new Set(['', 'text', 'search', 'email', 'number', 'password', 'url', 'tel', 'date', 'time', 'datetime-local', 'month', 'week']);

// True when keyboard input belongs to a text field and the game should keep out.
export function isTextTarget(el) {
  if (!el || typeof el !== 'object') return false;
  if (el.isContentEditable) return true;
  const tag = String(el.tagName || '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return TEXT_TYPES.has(String(el.type || '').toLowerCase());
  return false;
}

// True when the browser will itself activate the element on Enter or Space.
export function isNativeActivator(el) {
  if (!el || typeof el !== 'object') return false;
  const tag = String(el.tagName || '').toUpperCase();
  if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return true;
  if (tag === 'INPUT') return ['button', 'submit', 'reset', 'checkbox', 'radio'].includes(String(el.type || '').toLowerCase());
  return false;
}

// Typed characters worth reporting to onText (letters and digits).
export function textChar(e) {
  if (!e || e.ctrlKey || e.metaKey || e.altKey) return null;
  const k = e.key;
  if (typeof k !== 'string' || k.length !== 1) return null;
  return /[a-z0-9]/i.test(k) ? k.toUpperCase() : null;
}
