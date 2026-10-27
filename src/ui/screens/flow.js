// Run-start flow: plays a comic first when the story calls for one.

import { comicBefore } from '../logic.js';
import { safe } from '../data.js';

export function startRun(ctx, opts) {
  const { app } = ctx;
  const seen = ctx.seen.all();
  const kind = comicBefore({ worldId: opts.worldId, mode: opts.mode || 'story', seen });
  const go = () => { safe(() => app.startRun(opts)); };
  if (kind) {
    ctx.show('comic', { kind, speciesId: opts.speciesId, onDone: () => { ctx.seen.set(kind); go(); } });
  } else go();
}

export function currentSpecies(app) {
  const id = safe(() => app.profile.lastSpecies, 'oli') || 'oli';
  return safe(() => app.profile.isUnlocked(id), true) ? id : 'oli';
}
