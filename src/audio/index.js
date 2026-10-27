// Gobblepaws audio engine (WebAudio). Everything is synthesised: sounds are
// rendered by the pure modules (sfxlib, creatures, blips, instruments,
// ambience) into buffers, cached, and played through four buses:
//
//   music ─────────────────────────────────────────┐
//   sfx ───────────────────────────────────────────┤
//   ambience ──────────────────────────────────────┼─> master fader -> safety limiter -> out
//   voice: pre -> compressor -> makeup -> limiter -> voice fader ┘
//
// Music is constant and never ducked. Voice sits about +5 dB over music at the
// default settings (see mixdesign.js). The AudioContext is created lazily on
// unlock(), so this module imports in Node without touching WebAudio.

import { EV } from '../core/events.js';
import { DEFAULT_SETTINGS } from '../core/settings.js';
import { getWorld } from '../worlds/index.js';
import {
  dbToGain, gainToDb, powerToDb, sliderToGain, gobblePitch, spatial, clamp, loudness, normGainDb, peak,
} from './dsp.js';
import { SR, SR_AMB } from './synth.js';
import { renderSfx, SFX, SURFACES } from './sfxlib.js';
import { renderCreature, variantsFor, hasVoice } from './creatures.js';
import { renderBlipLine, voiceProfile, blipDuration } from './blips.js';
import { renderNote, noteKey } from './instruments.js';
import { renderLoop, renderShot, SOUNDSCAPES, WORLD_AMBIENCE, AMBIENCE_ALIASES, WEATHER_LOOPS, WEATHER_SHOTS } from './ambience.js';
import { createMusicPlayer } from './music.js';
import {
  CAL, TARGET, VOICE_COMP, VOICE_LIMIT, MASTER_LIMIT, VOICE_COMP_MAKEUP_DB, VOICE_LIMIT_MAKEUP_DB, MASTER_LIMIT_MAKEUP_DB,
  VOICE_PRE_DB, VOICE_COMP_LOSS_DB, CLIP_LUFS, designLevels,
} from './mixdesign.js';

export const VOICE_CAP = 6;
export const SPEAKER_WINDOW_S = 2.5;
const SFX_CAP = 32;
const QUEUE_BUDGET_MS = 3;

export { gobblePitch };

export function createAudio({ settings, bus, assets } = {}) {
  const S = settings || { get: (k) => DEFAULT_SETTINGS[k], subscribe: () => () => {} };
  const A = assets || { has: () => false, keysWithPrefix: () => [], meta: () => null, audioBuffer: async () => null };

  let ctx = null;
  let N = null;               // nodes
  let musicPlayer = null;
  let wantMusic = null;
  let listener = { x: 0, z: 0, yaw: 0 };
  let lastState = null;
  let player = { voiceId: null, pack: null, explicit: false };
  let interval = null;

  const caches = { note: new Map(), sfx: new Map(), creature: new Map(), blip: new Map(), loop: new Map(), shot: new Map(), clip: new Map(), clipGainDb: new Map(), sfxOverride: new Map() };
  const queue = [];
  const queued = new Set();
  const voices = [];          // { src, speaker, t }
  const lastSpoke = new Map();
  let sfxActive = 0;
  const rateLimit = new Map();

  // ------------------------------------------------------------------ helpers
  const now = () => (ctx ? ctx.currentTime : 0);
  function toBuffer(f32, sr) {
    const b = ctx.createBuffer(1, f32.length, sr);
    if (b.copyToChannel) b.copyToChannel(f32, 0); else b.getChannelData(0).set(f32);
    return b;
  }
  function limited(key, gap) {
    const t = now();
    if ((rateLimit.get(key) ?? -1e9) + gap > t) return true;
    rateLimit.set(key, t);
    return false;
  }
  function enqueue(key, fn, front = false) {
    if (queued.has(key)) return;
    queued.add(key);
    if (front) queue.unshift({ key, fn }); else queue.push({ key, fn });
  }
  function runQueue(budgetMs) {
    if (!queue.length) return;
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < budgetMs) {
      const job = queue.shift();
      queued.delete(job.key);
      try { job.fn(); } catch (e) { console.warn('[audio] render failed', job.key, e); }
    }
  }

  // ------------------------------------------------------------------ buffers
  function noteBuffer(inst, midi, dur) {
    const key = noteKey(inst, midi, dur);
    let b = caches.note.get(key);
    if (!b) { b = toBuffer(renderNote(inst, midi, dur, SR), SR); caches.note.set(key, b); }
    return b;
  }
  function prerenderNote(inst, midi, dur, urgent) {
    const key = noteKey(inst, midi, dur);
    if (caches.note.has(key)) return;
    enqueue('n:' + key, () => noteBuffer(inst, midi, dur), urgent);
  }
  function sfxBuffer(id, v = 0) {
    const def = SFX[id];
    if (!def) return null;
    const n = def.variants || 1;
    const key = id + '#' + (v % n);
    let b = caches.sfx.get(key);
    if (!b) { b = toBuffer(renderSfx(id, SR, v % n), SR); caches.sfx.set(key, b); }
    return b;
  }
  function creatureBuffer(voiceId, kind, v = 0, pack = null) {
    const vid = hasVoice(voiceId) ? voiceId : 'oli';
    const n = variantsFor(kind);
    const key = vid + ':' + kind + ':' + (v % n) + ':' + (kind === 'bark' ? (pack || '') : '');
    let b = caches.creature.get(key);
    if (!b) { b = toBuffer(renderCreature(vid, kind, SR, v % n, pack), SR); caches.creature.set(key, b); }
    return b;
  }
  function blipBuffer(speaker, text) {
    const key = speaker + '|' + text;
    let b = caches.blip.get(key);
    if (b) { caches.blip.delete(key); caches.blip.set(key, b); return b; }
    b = toBuffer(renderBlipLine(speaker, text, { sr: SR }), SR);
    caches.blip.set(key, b);
    if (caches.blip.size > 48) caches.blip.delete(caches.blip.keys().next().value);
    return b;
  }
  function loopBuffer(id) {
    let b = caches.loop.get(id);
    if (!b) { b = toBuffer(renderLoop(id, SR_AMB), SR_AMB); caches.loop.set(id, b); }
    return b;
  }
  function shotBuffer(id) {
    let b = caches.shot.get(id);
    if (!b) { b = toBuffer(renderShot(id, SR_AMB), SR_AMB); caches.shot.set(id, b); }
    return b;
  }

  // Recorded clips (voice lines, animal sounds, SFX overrides): decode once,
  // measure loudness once, cache the normalising gain.
  function clip(key) {
    if (caches.clip.has(key)) return caches.clip.get(key);
    const p = Promise.resolve(A.audioBuffer(ctx, key)).then((b) => {
      if (b && !caches.clipGainDb.has(key)) caches.clipGainDb.set(key, clipGainDb(key, b));
      return b;
    }).catch(() => null);
    caches.clip.set(key, p);
    return p;
  }
  function clipGainDb(key, b) {
    const meta = A.meta ? A.meta(key) : null;
    if (meta && typeof meta.gainDb === 'number') return meta.gainDb;   // measured at build time
    const ch = b.getChannelData(0);
    let data = ch;
    if (b.numberOfChannels > 1) {
      const r = b.getChannelData(1);
      data = new Float32Array(ch.length);
      for (let i = 0; i < ch.length; i++) data[i] = 0.5 * (ch[i] + r[i]);
    }
    return normGainDb(loudness(data, b.sampleRate), CLIP_LUFS, { peakLin: peak(data), ceilingDb: -1 });
  }

  // ------------------------------------------------------------------ graph
  function build() {
    const c = ctx;
    const g = (v = 1) => { const n = c.createGain(); n.gain.value = v; return n; };
    const comp = (p) => {
      const n = c.createDynamicsCompressor();
      n.threshold.value = p.threshold; n.ratio.value = p.ratio; n.knee.value = p.knee; n.attack.value = p.attack; n.release.value = p.release;
      return n;
    };
    const n = {};
    n.master = g();
    n.masterLimit = comp(MASTER_LIMIT);
    n.masterMakeup = g(dbToGain(-MASTER_LIMIT_MAKEUP_DB));
    n.master.connect(n.masterLimit); n.masterLimit.connect(n.masterMakeup); n.masterMakeup.connect(c.destination);
    n.music = g(); n.music.connect(n.master);
    n.sfx = g(); n.sfx.connect(n.master);
    n.ambience = g(); n.ambience.connect(n.master);
    n.voiceIn = g(dbToGain(VOICE_PRE_DB));
    n.voiceComp = comp(VOICE_COMP);
    n.voiceMakeup = g(dbToGain(VOICE_COMP_LOSS_DB - VOICE_COMP_MAKEUP_DB));
    n.voiceLimit = comp(VOICE_LIMIT);
    n.voiceLimitMakeup = g(dbToGain(-VOICE_LIMIT_MAKEUP_DB));
    n.voice = g();
    n.voiceIn.connect(n.voiceComp); n.voiceComp.connect(n.voiceMakeup); n.voiceMakeup.connect(n.voiceLimit);
    n.voiceLimit.connect(n.voiceLimitMakeup); n.voiceLimitMakeup.connect(n.voice); n.voice.connect(n.master);
    n.meters = {};
    for (const [k, node] of [['music', n.music], ['sfx', n.sfx], ['ambience', n.ambience], ['voice', n.voice], ['master', n.masterMakeup]]) n.meters[k] = makeMeter(node);
    N = n;
    applyVolumes(true);
  }

  // A K-weighted stereo meter (approximate BS.1770 weighting with WebAudio biquads).
  function makeMeter(node) {
    const shelf = ctx.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 1500; shelf.gain.value = 4;
    const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = 38; hpf.Q.value = 0.5;
    const split = ctx.createChannelSplitter(2);
    const aL = ctx.createAnalyser(), aR = ctx.createAnalyser();
    aL.fftSize = aR.fftSize = 2048;
    node.connect(shelf); shelf.connect(hpf); hpf.connect(split);
    split.connect(aL, 0); split.connect(aR, 1);
    const raw = ctx.createAnalyser(); raw.fftSize = 2048; node.connect(raw);
    return { aL, aR, raw, data: new Float32Array(2048), avg: 0, avgN: 0, short: 0, peak: 0, lastActive: -1 };
  }
  function readMeter(m, dt) {
    const d = m.data;
    m.aL.getFloatTimeDomainData(d);
    let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i];
    m.aR.getFloatTimeDomainData(d);
    for (let i = 0; i < d.length; i++) s += d[i] * d[i];
    const ms = s / d.length;              // sum of channel powers, as BS.1770
    m.raw.getFloatTimeDomainData(d);
    let pk = 0; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; }
    m.peak = Math.max(pk, m.peak * Math.exp(-dt / 3));
    const L = -0.691 + powerToDb(ms);
    m.short += (ms - m.short) * Math.min(1, dt / 0.4);
    if (L > -70) {                         // gated running average over ~10 s of activity
      const a = Math.min(1, dt / 10);
      m.avg = m.avgN ? m.avg + (ms - m.avg) * a : ms;
      m.avgN++;
      m.lastActive = now();
    }
  }

  function applyVolumes(immediate = false) {
    if (!N) return;
    const set = (param, v) => { if (immediate) param.value = v; else param.setTargetAtTime(v, ctx.currentTime, 0.05); };
    set(N.master.gain, sliderToGain(S.get('volMaster')));
    set(N.music.gain, sliderToGain(S.get('volMusic')));
    set(N.sfx.gain, sliderToGain(S.get('volSfx')) * dbToGain(CAL.sfx));
    set(N.ambience.gain, sliderToGain(S.get('volAmbience')) * dbToGain(CAL.ambience));
    set(N.voice.gain, sliderToGain(S.get('volVoice')) * dbToGain(CAL.voicePost));
  }
  S.subscribe?.((k) => { if (k && k.startsWith('vol')) applyVolumes(); });

  // ------------------------------------------------------------------ playback
  function play(buffer, out, { gain = 1, rate = 1, pan = 0, when = 0, onEnd } = {}) {
    if (!ctx || !buffer) return null;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = gain;
    const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
    src.connect(g); g.connect(p); p.connect(out);
    src.start(when || 0);
    src.onended = () => { try { p.disconnect(); g.disconnect(); } catch { /* ok */ } if (onEnd) onEnd(); };
    return src;
  }
  function where(opts) {
    if (opts && opts.x != null && opts.z != null) {
      const s = spatial(listener.x, listener.z, listener.yaw, opts.x, opts.z, Math.max(6, (lastState?.player?.size || 1) * 6), Math.max(80, (lastState?.player?.size || 1) * 50));
      return { pan: s.pan, gain: Math.max(0.15, s.gain) };
    }
    return { pan: opts?.pan || 0, gain: 1 };
  }

  function sfx(id, opts = {}) {
    if (!ctx || !N) return;
    if (sfxActive >= SFX_CAP) return;
    const def = SFX[id];
    if (!def && !A.has?.('sfx/' + id + '.mp3')) return;
    const w = where(opts);
    const gain = (opts.gain ?? 1) * w.gain * dbToGain(def ? def.trim : -12);
    const rate = opts.pitch ?? 1;
    const ov = 'sfx/' + id + '.mp3';
    if (A.has?.(ov)) {
      const cached = caches.sfxOverride.get(ov);
      if (cached) {
        sfxActive++;
        play(cached, N.sfx, { gain: (opts.gain ?? 1) * w.gain * dbToGain(caches.clipGainDb.get(ov) ?? 0) * dbToGain(def ? def.trim + 4 : -8), rate, pan: w.pan, onEnd: () => sfxActive-- });
        return;
      }
      clip(ov).then((b) => { if (b) caches.sfxOverride.set(ov, b); });
    }
    if (!def) return;
    const v = def.variants ? Math.floor(Math.random() * def.variants) : 0;
    sfxActive++;
    play(sfxBuffer(id, v), N.sfx, { gain, rate, pan: w.pan, onEnd: () => sfxActive-- });
  }

  function playerSize() { return lastState?.player?.displaySize || lastState?.player?.size || 1; }
  // Bigger animals sound a little lower; keep it subtle.
  const sizeRate = (size) => clamp(1.12 - 0.06 * Math.log2(Math.max(0.1, size) / 0.5), 0.8, 1.2);

  function species(voiceId, kind = 'bark', opts = {}) {
    if (!ctx || !N) return;
    const vid = voiceId || player.voiceId || 'oli';
    const w = where(opts);
    const gain = (opts.gain ?? 1) * w.gain * dbToGain(-6);
    const rate = opts.rate ?? (opts.size ? sizeRate(opts.size) : 1) * (0.97 + Math.random() * 0.06);
    const recorded = (A.keysWithPrefix?.(`voice/animal-${vid}-${kind}`) || []).filter((k) => k.endsWith('.mp3'));
    if (recorded.length) {
      const key = recorded[Math.floor(Math.random() * recorded.length)];
      clip(key).then((b) => { if (b) play(b, N.sfx, { gain: gain * dbToGain((caches.clipGainDb.get(key) ?? 0) + 1), pan: w.pan }); });
      return;
    }
    const pack = kind === 'bark' ? (opts.pack ?? player.pack) : null;
    play(creatureBuffer(vid, kind, Math.floor(Math.random() * 2), pack), N.sfx, { gain, rate, pan: w.pan });
  }

  // ------------------------------------------------------------------ voices
  function anchorPos(anchor) {
    if (!anchor || anchor === 'player') return null;
    if (typeof anchor === 'object' && anchor.x != null) return anchor;
    const npc = lastState?.npcs?.find((n) => n.id === anchor);
    return npc ? { x: npc.x, z: npc.z } : null;
  }
  function addVoice(src, speaker) {
    if (!src) return;
    while (voices.length >= VOICE_CAP) {
      const old = voices.shift();
      try { old.src.stop(); } catch { /* ended */ }
    }
    const rec = { src, speaker, t: now() };
    voices.push(rec);
    const prev = src.onended;
    src.onended = (e) => { const i = voices.indexOf(rec); if (i >= 0) voices.splice(i, 1); if (prev) prev(e); };
  }

  function say(line) {
    if (!line || !line.text && !line.voiceId) return false;
    if (!ctx || !N) return false;
    const speaker = line.speaker || 'npc';
    const t = now();
    // per-speaker anti-spam (forced lines, such as egg lines, always speak)
    if (!line.force && t - (lastSpoke.get(speaker) ?? -1e9) < SPEAKER_WINDOW_S) return false;
    lastSpoke.set(speaker, t);

    // the animals don't speak English: a thought plays a species sound instead
    if (speaker === 'player') {
      if (line.react) species(player.voiceId || 'oli', line.react, { gain: 0.7, size: playerSize() });
      return true;
    }
    const pos = anchorPos(line.anchor);
    let pan = 0, gain = 1;
    if (pos) {
      const s = spatial(listener.x, listener.z, listener.yaw, pos.x, pos.z, 8, 120);
      pan = s.pan * 0.6; gain = 0.55 + 0.45 * s.gain;   // stay intelligible at range
    }
    const key = line.voiceId ? 'voice/' + line.voiceId + '.mp3' : null;
    if (key && A.has?.(key)) {
      clip(key).then((b) => {
        if (!b) return speakBlip(line, speaker, pan, gain);
        addVoice(play(b, N.voiceIn, { gain: gain * dbToGain(caches.clipGainDb.get(key) ?? 0), pan }), speaker);
      });
      return true;
    }
    if (S.get('speechSynth') && speakSynth(line)) return true;
    speakBlip(line, speaker, pan, gain);
    return true;
  }
  function speakBlip(line, speaker, pan, gain) {
    addVoice(play(blipBuffer(speaker, line.text || ''), N.voiceIn, { gain, pan }), speaker);
  }
  function speakSynth(line) {
    const ss = globalThis.speechSynthesis, U = globalThis.SpeechSynthesisUtterance;
    if (!ss || !U) return false;
    try {
      const u = new U(line.text);
      u.lang = line.lang || 'en-GB';
      const p = voiceProfile(line.speaker);
      u.pitch = clamp(p.pitch / 200, 0.4, 2);
      u.rate = clamp(p.rate / 6, 0.7, 1.4);
      u.volume = sliderToGain(S.get('volVoice')) * sliderToGain(S.get('volMaster'));
      ss.speak(u);
      return true;
    } catch { return false; }
  }

  // ------------------------------------------------------------------ ambience
  const amb = { id: null, worldId: null, world: null, layers: [], shots: [], weather: null, weatherKind: 'clear', weatherShot: null };

  function soundscapeFor(state) {
    if (!state) return 'title';
    const w = amb.world;
    const id = (w && w.ambience) || WORLD_AMBIENCE[state.worldId] || 'beach';
    return SOUNDSCAPES[id] ? id : (AMBIENCE_ALIASES[id] || WORLD_AMBIENCE[state.worldId] || 'beach');
  }
  function stopLayer(l, fade = 1.5) {
    if (!l.gain) return;
    const t = now();
    l.gain.gain.cancelScheduledValues(t);
    l.gain.gain.setValueAtTime(l.gain.gain.value, t);
    l.gain.gain.linearRampToValueAtTime(0, t + fade);
    const src = l.src;
    setTimeout(() => { try { src.stop(); } catch { /* ok */ } try { l.pan.disconnect(); l.gain.disconnect(); } catch { /* ok */ } }, fade * 1000 + 100);
  }
  function startLayer(l) {
    const b = caches.loop.get(l.def.loop);
    if (!b) return false;
    l.src = ctx.createBufferSource(); l.src.buffer = b; l.src.loop = true;
    l.gain = ctx.createGain(); l.gain.gain.value = 0;
    l.pan = ctx.createStereoPanner();
    l.src.connect(l.gain); l.gain.connect(l.pan); l.pan.connect(N.ambience);
    l.src.start(now(), Math.random() * b.duration);
    l.started = true;
    return true;
  }
  function setScape(id) {
    for (const l of amb.layers) stopLayer(l);
    amb.layers = []; amb.shots = [];
    amb.id = id;
    const sc = SOUNDSCAPES[id];
    if (!sc) return;
    for (const def of sc.layers) {
      const l = { def, started: false };
      amb.layers.push(l);
      if (!caches.loop.has(def.loop)) enqueue('l:' + def.loop, () => loopBuffer(def.loop));
    }
    for (const def of sc.shots) {
      amb.shots.push({ def, next: now() + def.every[0] * (0.5 + Math.random()) });
      enqueue('s:' + def.id, () => shotBuffer(def.id));
    }
  }
  function seaPoint() {
    const w = amb.world;
    const seas = (w?.water || []).filter((wa) => wa.kind === 'sea' && wa.rect);
    if (!seas.length) return null;
    let best = null, bd = Infinity;
    for (const s of seas) {
      const r = s.rect;
      const x = clamp(listener.x, r.minX, r.maxX), z = clamp(listener.z, r.minZ, r.maxZ);
      const d = Math.hypot(x - listener.x, z - listener.z);
      if (d < bd) { bd = d; best = { x, z, tide: s.tide }; }
    }
    return best;
  }
  function sceneryPoint(mesh) {
    const list = (amb.world?.scenery || []).filter((s) => s.mesh === mesh);
    let best = null, bd = Infinity;
    for (const s of list) { const d = Math.hypot(s.x - listener.x, s.z - listener.z); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  function placeGain(at, state) {
    if (!state || at === 'everywhere' || at === 'ring') return { pan: 0, gain: 1 };
    const size = state.player?.size || 1;
    if (at === 'sea') {
      const p = seaPoint();
      if (!p) return { pan: 0, gain: 0.5 };
      const s = spatial(listener.x, listener.z, listener.yaw, p.x, p.z, 12 + size * 4, 160 + size * 20);
      return { pan: s.pan * 0.7, gain: 0.2 + 0.8 * s.gain, point: p };
    }
    if (at.startsWith('scenery:')) {
      const p = sceneryPoint(at.slice(8));
      if (!p) return { pan: 0, gain: 0 };
      const s = spatial(listener.x, listener.z, listener.yaw, p.x, p.z, 10 + size * 3, 140 + size * 20);
      return { pan: s.pan, gain: s.gain };
    }
    return { pan: 0, gain: 1 };
  }
  function tideNorm(state, point) {
    const amp = point?.tide?.amp;
    if (!state || !amp) return 0.7;
    return clamp(0.5 + 0.5 * (state.tide || 0) / amp, 0, 1);
  }
  function updateAmbience(state) {
    const t = now();
    if ((state?.worldId || null) !== amb.worldId) {
      amb.worldId = state?.worldId || null;
      try { amb.world = state ? getWorld(state.worldId) : null; } catch { amb.world = null; }
    }
    const id = soundscapeFor(state);
    if (id !== amb.id) setScape(id);
    for (const l of amb.layers) {
      if (!l.started && !startLayer(l)) continue;
      const pg = placeGain(l.def.at, state);
      l.pan.pan.setTargetAtTime(pg.pan, t, 0.3);
      l.gain.gain.setTargetAtTime(pg.gain * dbToGain(l.def.gain || 0), t, 0.6);
    }
    for (const s of amb.shots) {
      if (t < s.next) continue;
      const d = s.def;
      s.next = t + d.every[0] + Math.random() * (d.every[1] - d.every[0]);
      const b = caches.shot.get(d.id);
      if (!b) continue;
      let pan = (Math.random() * 2 - 1) * 0.8, gain = dbToGain((d.gain || 0) - Math.random() * 4);
      if (d.at === 'sea') {
        const pg = placeGain('sea', state);
        pan = pg.pan; gain = dbToGain(d.gain || 0) * pg.gain * (d.tide ? 0.45 + 0.55 * tideNorm(state, pg.point) : 1);
        // bigger tides roll in a touch quicker
        if (d.tide) s.next -= tideNorm(state, pg.point) * 1.5;
      }
      play(b, N.ambience, { gain, pan, rate: 0.94 + Math.random() * 0.12 });
    }
    // weather
    const wk = state?.weather?.kind || 'clear';
    if (wk !== amb.weatherKind) {
      amb.weatherKind = wk;
      if (amb.weather) { stopLayer(amb.weather, 3); amb.weather = null; }
      const loopId = WEATHER_LOOPS[wk];
      if (loopId) { amb.weather = { def: { loop: loopId, at: 'everywhere', gain: -4 }, started: false }; enqueue('l:' + loopId, () => loopBuffer(loopId)); }
      const ws = WEATHER_SHOTS[wk];
      amb.weatherShot = ws ? { def: ws, next: t + ws.every[0] } : null;
      if (ws) enqueue('s:' + ws.id, () => shotBuffer(ws.id));
    }
    if (amb.weather) {
      const l = amb.weather;
      if (l.started || startLayer(l)) l.gain.gain.setTargetAtTime(clamp(state?.weather?.intensity ?? 1, 0.2, 1) * dbToGain(-4), t, 1.2);
    }
    if (amb.weatherShot && t > amb.weatherShot.next && caches.shot.get(amb.weatherShot.def.id)) {
      const d = amb.weatherShot.def;
      amb.weatherShot.next = t + d.every[0] + Math.random() * (d.every[1] - d.every[0]);
      play(caches.shot.get(d.id), N.ambience, { gain: dbToGain(d.gain), pan: Math.random() - 0.5 });
    }
  }

  // ------------------------------------------------------------------ events
  function pv(ev) { return ev && ev.x != null ? { x: ev.x, z: ev.z } : {}; }
  function onEvent(type, ev = {}) {
    if (!ctx || !N) {
      if (type === EV.COMBO || type === EV.COMBO_END) { /* nothing to do yet */ }
      return;
    }
    switch (type) {
      case EV.GOBBLE: {
        const big = ev.size != null && ev.size > playerSize() * 0.35;
        sfx(big ? 'popBig' : 'pop', { ...pv(ev), pitch: gobblePitch(ev.combo || 1) });
        if (!limited('squish', 0.09)) sfx('squish', { ...pv(ev), gain: 0.6, pitch: 0.9 + Math.random() * 0.2 });
        if (ev.food && !limited('gulp', 0.6)) species(player.voiceId, 'gulp', { gain: 0.6, size: playerSize() });
        if (ev.first && !limited('whum', 0.5)) sfx('whum', { gain: 0.7 });
        if (ev.golden) sfx('golden');
        break;
      }
      case EV.COMBO: musicPlayer?.setCombo((ev.count || 0) >= 5); break;
      case EV.COMBO_END: musicPlayer?.setCombo(false); if ((ev.count || 0) >= 5) sfx('comboEnd'); break;
      case EV.MILESTONE: sfx('milestone'); sfx('whum'); break;
      case EV.ALMOST: if (!limited('almost', 1.5)) sfx('almost'); break;
      case EV.BUMP:
        sfx('bump', pv(ev));
        if (ev.by === 'hazard' && ev.hazardKind) hazard(ev.hazardKind, ev);
        if ((ev.dropped || 0) > 0 && !limited('whoopsie', 1)) sfx('whoopsie', { gain: 0.8 });
        break;
      case EV.NEAR_MISS: if (!limited('near', 0.8)) sfx('nearMiss'); break;
      case EV.JUMP: sfx('jump', { pitch: sizeRate(playerSize()) }); break;
      case EV.LAND: if ((ev.impact ?? 1) > 0.15) sfx('land', { gain: clamp(ev.impact ?? 0.6, 0.3, 1), pitch: sizeRate(playerSize()) }); break;
      case EV.SPLASH: sfx((ev.size || 0) > 1.5 ? 'splashBig' : 'splash', pv(ev)); break;
      case EV.SHAKE: sfx('shake', pv(ev)); break;
      case EV.FOOTSTEP: {
        if (limited('step', 0.07)) break;
        const surf = SURFACES.includes(ev.surface) ? ev.surface : 'grass';
        const size = playerSize();
        const sp = lastState?.player?.speedNorm ?? 0.6;
        sfx('step.' + surf, { gain: clamp(0.35 + 0.18 * Math.log2(size + 1), 0.25, 1.1) * (0.6 + 0.4 * sp), pitch: sizeRate(size) * (0.94 + Math.random() * 0.12) });
        break;
      }
      case EV.BARK: species(player.voiceId, 'bark', { size: playerSize() }); break;
      case EV.PLAY_BOW: species(player.voiceId, 'happy', { size: playerSize() }); break;
      case EV.SIG: if (ev.phase !== 'end') species(player.voiceId, 'sig', { size: playerSize() }); break;
      case EV.IDLE:
        if (ev.anim === 'yawn') species(player.voiceId, 'yawn', { gain: 0.8, size: playerSize() });
        else if (ev.anim === 'sniff') species(player.voiceId, 'sniff', { gain: 0.7, size: playerSize() });
        else if (ev.anim === 'shake') sfx('shake');
        break;
      case EV.BUFF:
        if (ev.kind === 'tea') sfx('tea');
        else if (ev.kind === 'wobble') sfx('wobble');
        else if (ev.kind === 'speed') sfx('speed');
        break;
      case EV.PIGEON_SCARE: sfx('pigeonScare'); break;
      case EV.HAZARD: if (!limited('hz:' + ev.kind, 1.2)) hazard(ev.kind, ev); break;
      case EV.EGG: sfx('egg'); break;
      case EV.GOLDEN: sfx('golden'); break;
      case EV.STAR: sfx('star'); break;
      case EV.TIMER_WARN: sfx('timerWarn'); break;
      case EV.ACTIVITY:
        if (ev.phase === 'success') sfx('success'); else if (ev.phase === 'fail') sfx('fail'); else sfx('ui.select');
        break;
      case EV.GATE: if (ev.open) sfx('gate'); break;
      case EV.GO: sfx('go'); break;
      case EV.FINISH: sfx('finish'); musicPlayer?.setCombo(false); break;
      case EV.PAUSE: case EV.RESUME: sfx('ui.pause'); break;
      case EV.JOURNAL_NEW: if (!limited('page', 0.8)) sfx('page'); break;
      case EV.ACHIEVEMENT: sfx('achievement'); break;
      case EV.UNLOCK: sfx('unlock'); break;
      case EV.CODE: sfx('secret'); break;
      case 'ui': if (ev.sound && SFX['ui.' + ev.sound]) sfx('ui.' + ev.sound); break;
      default: break;
    }
  }
  function hazard(kind, ev) {
    const id = 'hazard.' + kind;
    sfx(SFX[id] ? id : 'hazard.generic', pv(ev));
  }
  bus?.on?.('*', (payload, type) => { try { onEvent(type, payload); } catch (e) { console.warn('[audio] event', type, e); } });

  // ------------------------------------------------------------------ player
  function detectPlayer() {
    if (player.explicit) return;
    const st = lastState;
    const run = globalThis.__gp?.app?.run;
    const id = st?.speciesId || st?.player?.speciesId || run?.speciesId || null;
    if (id && id !== player.voiceId) {
      player.voiceId = id;
      try { player.pack = globalThis.__gp?.profile?.getLook?.(id)?.soundPack || null; } catch { player.pack = null; }
      for (const k of ['bark', 'gulp', 'happy']) enqueue('c:' + id + k, () => creatureBuffer(id, k, 0, k === 'bark' ? player.pack : null));
    }
  }

  // ------------------------------------------------------------------ public
  function prewarm() {
    for (const id of ['pop', 'squish', 'popBig', 'whum', 'bump', 'ui.tick', 'ui.select', 'ui.back', 'ui.whoosh', 'ui.count', 'land', 'jump', 'milestone', 'star', 'egg', 'golden', 'whoopsie', 'splash', 'go', 'finish']) {
      const n = SFX[id]?.variants || 1;
      for (let v = 0; v < n; v++) enqueue('x:' + id + v, () => sfxBuffer(id, v));
    }
    for (const s of SURFACES) for (let v = 0; v < 3; v++) enqueue('x:step.' + s + v, () => sfxBuffer('step.' + s, v));
  }

  const api = {
    unlock() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return true; }
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return false;
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { console.warn('[audio] no AudioContext', e); return false; }
      build();
      // an inaudible blip inside the gesture keeps iOS happy
      try { const b = ctx.createBuffer(1, 1, 22050); const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch { /* ok */ }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      musicPlayer = createMusicPlayer({ ctx, out: N.music, getNote: noteBuffer, prerender: prerenderNote });
      if (wantMusic) musicPlayer.play(wantMusic);
      prewarm();
      interval = setInterval(() => { if (ctx && ctx.state === 'running') { musicPlayer.schedule(); runQueue(2); } }, 50);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (!ctx) return;
          if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {});
        });
      }
      return true;
    },
    get unlocked() { return !!ctx; },
    music(id) {
      wantMusic = id || null;
      if (musicPlayer) musicPlayer.play(wantMusic);
    },
    sfx,
    species,
    say,
    setPlayer({ speciesId, voiceId, soundPack, pack } = {}) {
      player = { voiceId: voiceId || speciesId || player.voiceId, pack: soundPack ?? pack ?? null, explicit: true };
    },
    tick(dtReal, simState, l) {
      lastState = simState || null;
      if (l) listener = l;
      if (!ctx || !N) return;
      runQueue(QUEUE_BUDGET_MS);
      musicPlayer.schedule();
      if (!player.explicit && (!player.voiceId || Math.random() < 0.01)) detectPlayer();
      updateAmbience(simState);
      const dt = Math.min(0.25, dtReal || 0.016);
      for (const k in N.meters) readMeter(N.meters[k], dt);
    },
    // Measured output levels (LUFS-ish: K-weighted, sum of L and R power,
    // gated at -70 and averaged over about 10 s of activity), plus dynamics
    // gain reduction and the design targets for comparison.
    levels() {
      const design = designLevels(S.all ? S.all() : DEFAULT_SETTINGS, musicPlayer?.current || 'w1');
      if (!N) return { measured: false, musicDb: null, voiceDb: null, sfxDb: null, ambienceDb: null, design };
      const db = (m) => (m.avgN ? -0.691 + powerToDb(m.avg) : null);
      const M = N.meters;
      const out = {
        measured: true,
        musicDb: db(M.music), voiceDb: db(M.voice), sfxDb: db(M.sfx), ambienceDb: db(M.ambience), masterDb: db(M.master),
        shortTerm: Object.fromEntries(Object.entries(M).map(([k, m]) => [k, -0.691 + powerToDb(m.short)])),
        peakDb: Object.fromEntries(Object.entries(M).map(([k, m]) => [k, gainToDb(m.peak)])),
        voiceCompReductionDb: N.voiceComp.reduction ?? null,
        voiceLimitReductionDb: N.voiceLimit.reduction ?? null,
        masterLimitReductionDb: N.masterLimit.reduction ?? null,
        targets: { ...TARGET },
        design,
      };
      out.voiceOverMusicDb = out.voiceDb != null && out.musicDb != null ? out.voiceDb - out.musicDb : null;
      return out;
    },
    stats() {
      return {
        unlocked: !!ctx, state: ctx?.state, queue: queue.length, voices: voices.length, sfxActive,
        cache: Object.fromEntries(Object.entries(caches).map(([k, m]) => [k, m.size])),
        music: musicPlayer ? { id: musicPlayer.current, combo: musicPlayer.combo, ...musicPlayer.stats() } : null,
        ambience: amb.id, weather: amb.weatherKind, player: { ...player },
      };
    },
    // test hooks
    get context() { return ctx; },
    _blipDuration: blipDuration,
    dispose() {
      if (interval) clearInterval(interval);
      musicPlayer?.dispose();
      try { ctx?.close(); } catch { /* ok */ }
      ctx = null; N = null;
    },
  };
  return api;
}
