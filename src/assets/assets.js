// User assets are embedded at build time as data URIs into a global map
// (window.__ASSETS__ = { 'photos/oli-front.jpg': 'data:image/jpeg;base64,...', ... }).
// Everything works with zero assets; features upgrade when a key exists.

const g = typeof globalThis !== 'undefined' ? globalThis : {};

function map() { return g.__ASSETS__ || {}; }
function meta() { return g.__ASSETS_META__ || {}; }

const imageCache = new Map();
const audioCache = new Map();

export const Assets = {
  has(key) { return Object.prototype.hasOwnProperty.call(map(), key); },
  uri(key) { return map()[key] || null; },
  meta(key) { return meta()[key] || null; },
  keys() { return Object.keys(map()); },
  keysWithPrefix(prefix) { return Object.keys(map()).filter((k) => k.startsWith(prefix)); },
  text(key) {
    const u = map()[key];
    if (!u) return null;
    const comma = u.indexOf(',');
    const body = u.slice(comma + 1);
    if (u.slice(0, comma).includes(';base64')) {
      const bin = typeof atob === 'function' ? atob(body) : Buffer.from(body, 'base64').toString('binary');
      try { return decodeURIComponent(escape(bin)); } catch { return bin; }
    }
    return decodeURIComponent(body);
  },
  image(key) {
    if (!this.has(key) || typeof Image === 'undefined') return Promise.resolve(null);
    if (imageCache.has(key)) return imageCache.get(key);
    const p = new Promise((res) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => { console.warn('[assets] image failed', key); res(null); };
      img.src = map()[key];
    });
    imageCache.set(key, p);
    return p;
  },
  async audioBuffer(ctx, key) {
    if (!this.has(key) || !ctx) return null;
    if (audioCache.has(key)) return audioCache.get(key);
    const p = (async () => {
      try {
        const res = await fetch(map()[key]);
        const ab = await res.arrayBuffer();
        return await ctx.decodeAudioData(ab);
      } catch (e) { console.warn('[assets] audio failed', key, e); return null; }
    })();
    audioCache.set(key, p);
    return p;
  },
};
