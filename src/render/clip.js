// "Save clip": two staggered MediaRecorders on the canvas stream, each
// restarting every 10 s, offset by 5 s, so one of them always holds between
// 5 and 10 seconds of the most recent play. save() stops the older one and
// returns its webm Blob, then restarts it.

const WINDOW = 10000;

export function pickMime() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return null;
  for (const m of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch { /* ignore */ }
  }
  return null;
}

export function createClipRecorder(canvas) {
  const mime = pickMime();
  const supported = !!(mime && canvas && typeof canvas.captureStream === 'function');
  let stream = null;
  const recs = [];
  let running = false;
  let timers = [];

  function makeSlot() {
    return { rec: null, chunks: [], started: 0, stopping: null };
  }

  function startSlot(slot) {
    if (!running) return;
    slot.chunks = [];
    try {
      slot.rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    } catch (e) { console.warn('[clip] recorder failed', e); slot.rec = null; return; }
    slot.rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) slot.chunks.push(ev.data); };
    slot.rec.start(500);
    slot.started = performance.now();
  }

  function restartSlot(slot) {
    if (!running) return;
    const r = slot.rec;
    if (r && r.state !== 'inactive') {
      r.onstop = () => startSlot(slot);
      try { r.stop(); } catch { startSlot(slot); }
    } else startSlot(slot);
  }

  function start() {
    if (!supported || running) return;
    try { stream = canvas.captureStream(60); } catch (e) { console.warn('[clip] captureStream failed', e); return; }
    running = true;
    recs.length = 0;
    recs.push(makeSlot(), makeSlot());
    startSlot(recs[0]);
    timers.push(setTimeout(() => {
      startSlot(recs[1]);
      timers.push(setInterval(() => restartSlot(recs[1]), WINDOW));
    }, WINDOW / 2));
    timers.push(setInterval(() => restartSlot(recs[0]), WINDOW));
  }

  function stop() {
    running = false;
    for (const t of timers) { clearTimeout(t); clearInterval(t); }
    timers = [];
    for (const s of recs) { try { if (s.rec && s.rec.state !== 'inactive') { s.rec.onstop = null; s.rec.stop(); } } catch { /* ignore */ } }
    recs.length = 0;
    if (stream) { for (const tr of stream.getTracks()) tr.stop(); stream = null; }
  }

  function save() {
    if (!supported || !running) return Promise.resolve(null);
    // the slot that has been recording the longest
    let best = null;
    for (const s of recs) if (s.rec && s.rec.state === 'recording' && (!best || s.started < best.started)) best = s;
    if (!best) return Promise.resolve(null);
    return new Promise((resolve) => {
      const slot = best;
      const r = slot.rec;
      r.onstop = () => {
        const blob = slot.chunks.length ? new Blob(slot.chunks, { type: 'video/webm' }) : null;
        startSlot(slot);
        resolve(blob);
      };
      try { r.requestData(); r.stop(); } catch { resolve(null); }
    });
  }

  return {
    supported, start, stop, save,
    get running() { return running; },
  };
}
