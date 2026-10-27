// Shuffle bags: every line comes out once per bag before any repeats, weights
// add extra copies, and a line never plays twice in a row (even across a
// refill). A filter lets one bag serve several worlds or species.

export function createShuffleBag(items, rng, { weightOf = (it) => it.w ?? 1 } = {}) {
  const random = typeof rng === 'function' ? rng : (rng && rng.next ? () => rng.next() : Math.random);
  let bag = [];
  let last = null;

  function refill(filter) {
    // leftover copies (only possible when they equal the last line) are kept
    // and dealt first next time, so heavy lines keep their full weight
    const keep = bag;
    bag = [];
    for (const it of items) {
      if (filter && !filter(it)) continue;
      const w = Math.max(0, weightOf(it));
      const whole = Math.floor(w);
      for (let k = 0; k < whole; k++) bag.push(it);
      if (random() < w - whole) bag.push(it);
    }
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const tmp = bag[i]; bag[i] = bag[j]; bag[j] = tmp;
    }
    if (keep.length) bag = bag.concat(filter ? keep.filter(filter) : keep);
  }

  function take(filter) {
    for (let i = bag.length - 1; i >= 0; i--) {
      const it = bag[i];
      if (it === last) continue;
      if (filter && !filter(it)) continue;
      bag.splice(i, 1);
      return it;
    }
    return null;
  }

  return {
    get size() { return items.length; },
    get remaining() { return bag.length; },
    get last() { return last; },
    next(filter) {
      let it = take(filter);
      if (!it) { refill(filter); it = take(filter); }
      if (!it) {
        // only the last line matches: allow the repeat rather than go silent
        const pool = items.filter((x) => !filter || filter(x));
        if (!pool.length) return null;
        it = pool[0];
      }
      last = it;
      return it;
    },
    reset() { bag = []; last = null; },
  };
}

// A sequence that plays in order (used for Gerald's storyline beats).
export function createSequence(items) {
  let i = 0;
  return {
    get done() { return i >= items.length; },
    get index() { return i; },
    next() { return i < items.length ? items[i++] : null; },
    peek() { return items[i] || null; },
    reset() { i = 0; },
  };
}
