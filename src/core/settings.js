// Player settings with defaults, persistence and change subscriptions.
// Shared by UI (edits), render (quality, motion), audio (volumes) and sim (assist).

export const DEFAULT_SETTINGS = Object.freeze({
  // video
  quality: 'auto',          // 'auto' | 'low' | 'medium' | 'high'
  resolvedQuality: 'medium',
  fovKick: true,
  // audio (0..1)
  volMaster: 0.9,
  volMusic: 0.6,
  volSfx: 0.8,
  volVoice: 0.9,
  volAmbience: 0.6,
  speechSynth: false,
  // accessibility
  reducedMotion: false,
  colourBlind: 'none',      // 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia'
  shapeCodes: false,
  textScale: 1,             // 0.8 .. 1.6
  hudScale: 1,              // 0.8 .. 1.6
  highContrast: false,
  assist: false,
  autoSprint: false,
  oneHanded: false,
  subtitles: true,
  translatePt: true,        // show English under pt-BR lines
  chatter: true,            // floating text on/off
  // controls
  bindings: null,           // null = defaults; input owns the shape
  lookSensitivity: 1,       // 0.3 .. 3
  invertY: false,
  padDeadzone: 0.18,
  padCurve: 1.6,
  // misc
  locale: 'en-GB',
  showFps: false,
});

export function createSettings(storage) {
  const subs = new Set();
  const data = { ...DEFAULT_SETTINGS, ...(storage?.get('settings', {}) || {}) };
  if (typeof matchMedia !== 'undefined' && storage && storage.get('settings', null) == null) {
    try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) data.reducedMotion = true; } catch { /* ignore */ }
  }
  return {
    get(k) { return data[k]; },
    all() { return { ...data }; },
    set(k, v) {
      if (data[k] === v) return;
      data[k] = v;
      storage?.set('settings', data);
      for (const fn of subs) { try { fn(k, v, data); } catch (e) { console.error(e); } }
    },
    patch(obj) { for (const k in obj) this.set(k, obj[k]); },
    reset() { for (const k in DEFAULT_SETTINGS) this.set(k, DEFAULT_SETTINGS[k]); },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}
