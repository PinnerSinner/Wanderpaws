// Ghost runs: compact storage for the flat Int32 sample stream main.js records
// (stride 5: x cm, y cm, z cm, yaw mrad, size mm; one sample every 2 ticks).
// Encoding: per-channel delta, zigzag, LEB128 varint, then base64. Typical
// runs land at 1 to 2 bytes per value. Anything over the cap is decimated.

export const GHOST_CAP = 150 * 1024;     // max characters of base64 per world
export const GHOST_VERSION = 1;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INV = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

export function bytesToBase64(bytes, len = bytes.length) {
  let out = '';
  let i = 0;
  const parts = [];
  for (; i + 2 < len; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    if (out.length > 8192) { parts.push(out); out = ''; }
  }
  const rem = len - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '==';
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
  }
  parts.push(out);
  return parts.join('');
}

export function base64ToBytes(str) {
  const clean = String(str).replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(len);
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64_INV[clean.charCodeAt(i)], b = B64_INV[clean.charCodeAt(i + 1)];
    const c = i + 2 < clean.length ? B64_INV[clean.charCodeAt(i + 2)] : 0;
    const d = i + 3 < clean.length ? B64_INV[clean.charCodeAt(i + 3)] : 0;
    if (a < 0 || b < 0 || c < 0 || d < 0) throw new Error('bad base64');
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    if (o < len) out[o++] = (n >> 16) & 255;
    if (o < len && i + 2 < clean.length) out[o++] = (n >> 8) & 255;
    if (o < len && i + 3 < clean.length) out[o++] = n & 255;
  }
  return o === len ? out : out.subarray(0, o);
}

const zig = (n) => ((n << 1) ^ (n >> 31)) >>> 0;
const unzig = (n) => (n >>> 1) ^ -(n & 1);

function toInt(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.max(-2147483648, Math.min(2147483647, n)) | 0;
}

// Encode a flat sample array into a base64 string.
export function encodeSamples(samples, stride = 5) {
  const n = samples.length - (samples.length % stride);
  const buf = new Uint8Array(Math.max(16, n * 5));
  let o = 0;
  const prev = new Int32Array(stride);
  for (let i = 0; i < n; i++) {
    const ch = i % stride;
    const v = toInt(samples[i]);
    let z = zig((v - prev[ch]) | 0);
    prev[ch] = v;
    while (z >= 0x80) { buf[o++] = (z & 0x7f) | 0x80; z >>>= 7; }
    buf[o++] = z;
  }
  return bytesToBase64(buf, o);
}

export function decodeSamples(str, stride = 5) {
  const bytes = base64ToBytes(str);
  const out = [];
  const prev = new Int32Array(stride);
  let i = 0, ch = 0;
  while (i < bytes.length) {
    let z = 0, shift = 0, b;
    do {
      if (i >= bytes.length) throw new Error('truncated ghost');
      b = bytes[i++];
      z |= (b & 0x7f) << shift;
      shift += 7;
    } while (b & 0x80 && shift < 35);
    const v = (prev[ch] + unzig(z >>> 0)) | 0;
    prev[ch] = v;
    out.push(v);
    ch = (ch + 1) % stride;
  }
  return Int32Array.from(out);
}

// Keep every k-th frame (a frame is `stride` values).
export function decimate(samples, stride, k) {
  const frames = Math.floor(samples.length / stride);
  const out = [];
  for (let f = 0; f < frames; f += k) for (let c = 0; c < stride; c++) out.push(samples[f * stride + c]);
  return out;
}

// Build the stored record, decimating until it fits under the cap.
export function packGhost(samples, { stride = 5, every = 2, cap = GHOST_CAP, meta = null } = {}) {
  let s = Array.from(samples || [], toInt);
  s.length -= s.length % stride;
  let ev = every;
  let data = encodeSamples(s, stride);
  let guard = 0;
  while (data.length > cap && s.length > stride && guard++ < 12) {
    s = decimate(s, stride, 2);
    ev *= 2;
    data = encodeSamples(s, stride);
  }
  return { v: GHOST_VERSION, stride, every: ev, frames: s.length / stride, d: data, meta };
}

// Unpack a stored record to an Int32Array with .stride, .every and .frames attached.
export function unpackGhost(rec) {
  if (!rec || rec.v !== GHOST_VERSION || typeof rec.d !== 'string') return null;
  try {
    const stride = rec.stride || 5;
    const arr = decodeSamples(rec.d, stride);
    arr.stride = stride;
    arr.every = rec.every || 2;
    arr.frames = Math.floor(arr.length / stride);
    if (rec.meta) arr.meta = rec.meta;
    return arr;
  } catch { return null; }
}
