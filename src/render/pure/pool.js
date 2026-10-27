// Ring-buffer pool accounting for particles and decals. Pure: no three.
// Slots are reused oldest-first, so a full pool silently recycles the oldest
// particle instead of allocating. Tracks dirty ranges for GPU uploads.

export function createRingPool(capacity, activeCap = capacity) {
  const birth = new Float32Array(capacity);
  const life = new Float32Array(capacity);
  let cap = Math.max(1, Math.min(capacity, activeCap | 0));
  let head = 0;
  let dirtyMin = Infinity, dirtyMax = -1;
  let spawned = 0, recycled = 0;
  for (let i = 0; i < capacity; i++) { birth[i] = -1e9; life[i] = 0; }

  return {
    capacity,
    get cap() { return cap; },
    get head() { return head; },
    get spawned() { return spawned; },
    get recycled() { return recycled; },
    // Change the active cap (quality tier). Slots above it are killed.
    setCap(n, now = 0) {
      cap = Math.max(1, Math.min(capacity, n | 0));
      if (head >= cap) head = 0;
      for (let i = cap; i < capacity; i++) { if (birth[i] + life[i] > now) { birth[i] = -1e9; life[i] = 0; this.markDirty(i); } }
    },
    // Claim the next slot. Returns its index.
    alloc(now, lifeSec) {
      const i = head;
      if (birth[i] + life[i] > now) recycled++;
      birth[i] = now;
      life[i] = lifeSec;
      head = (head + 1) % cap;
      spawned++;
      this.markDirty(i);
      return i;
    },
    markDirty(i) {
      if (i < dirtyMin) dirtyMin = i;
      if (i > dirtyMax) dirtyMax = i;
    },
    // Returns [min, max] of dirty slots via the out array, or false if clean, and clears.
    takeDirty(out) {
      if (dirtyMax < 0) return false;
      out[0] = dirtyMin; out[1] = dirtyMax;
      dirtyMin = Infinity; dirtyMax = -1;
      return true;
    },
    isAlive(i, now) { return birth[i] <= now && birth[i] + life[i] > now; },
    alive(now) {
      let n = 0;
      for (let i = 0; i < cap; i++) if (birth[i] <= now && birth[i] + life[i] > now) n++;
      return n;
    },
    kill(i) { birth[i] = -1e9; life[i] = 0; this.markDirty(i); },
    clear() { for (let i = 0; i < capacity; i++) { birth[i] = -1e9; life[i] = 0; } head = 0; dirtyMin = 0; dirtyMax = capacity - 1; },
  };
}

// Fractional spawn accumulator: emits whole particles at `rate` per second
// without drift. Returns the count to spawn this frame.
export function createEmitter() {
  let acc = 0;
  return {
    take(rate, dt) {
      acc += Math.max(0, rate) * dt;
      const n = Math.floor(acc);
      acc -= n;
      return n;
    },
    reset() { acc = 0; },
  };
}
