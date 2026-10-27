// W2 London easter eggs: L1 to L13 (SPEC §7), plus LX extras, G8 and G9.

import { EV, say, egg, withLines, zoneEgg, gobbleEgg, npcEgg, findNpc, npcDist, countEvents, sayOnce, distXZ, playerName, teaTimeEgg, geraldDisguiseEgg } from './common.js';

export function makeEggsW2(P) {
  const L1 = withLines(egg('L1', 'w2', {
    tick(ctx) {
      const z = ctx.zone('phonebox');
      if (!ctx.isFound()) {
        if (z.inside && ctx.stillTime() >= 2) { ctx.found(); say(ctx, 'narrator', 'egg.L1.line1'); ctx.flag('L1.t', ctx.state.time); }
        return;
      }
      const t = ctx.flag('L1.t');
      if (t != null && z.inside && ctx.state.time - t > 4.5) { ctx.flag('L1.t', null); say(ctx, 'narrator', 'egg.L1.line2'); }
    },
  }), ['egg.L1.line1', 'egg.L1.line2']);

  const L2 = npcEgg('L2', 'w2', { npc: 'nigel', r: 16, line: 'egg.L2.line' });

  const L3 = withLines(egg('L3', 'w2', {
    tick(ctx) {
      if (ctx.isFound()) return;
      const z = ctx.zone('busstop');
      if (!z.inside || z.time < 30) return;
      ctx.found();
      ctx.flag('bus127', true);
      ctx.spawnItem('doubledecker', P.bus.x, P.bus.z, {});
      say(ctx, 'narrator', 'egg.L3.line');
    },
  }), ['egg.L3.line']);

  // L4: a proper puddle belly-flop, then a shake-off that soaks a commuter.
  const L4 = withLines(egg('L4', 'w2', {
    tick(ctx) {
      if (ctx.isFound() || (ctx.state.tick & 7) !== 0) return;
      const p = ctx.player;
      for (const pd of P.puddles) {
        if (distXZ(p.x, p.z, pd.x, pd.z) < pd.r + p.size * 0.5) { ctx.flag('L4.wet', ctx.state.time); return; }
      }
    },
    onEvent(ev, ctx) {
      if (ctx.isFound()) return;
      if ((ev.type === EV.HAZARD && ev.kind === 'puddle') || ev.type === EV.SPLASH) { ctx.flag('L4.wet', ctx.state.time); return; }
      if (ev.type !== EV.SHAKE) return;
      const wet = ctx.flag('L4.wet');
      if (wet == null || ctx.state.time - wet > 10) return;
      const r = Math.max(5, ctx.player.size * 5);
      for (const n of ctx.state.npcs || []) {
        if (n.kind !== 'commuter' && n.kind !== 'queuer' && n.kind !== 'tourist') continue;
        if (ctx.dist(n.x, n.z) > r) continue;
        ctx.found();
        ctx.setNpcAnim(n.id, 'tut');
        say(ctx, n.id, 'egg.L4.line');
        return;
      }
    },
  }), ['egg.L4.line']);

  const L5 = withLines(egg('L5', 'w2', {
    tick(ctx) {
      if (ctx.isFound() || !ctx.zone('queueFront').inside) return;
      ctx.found();
      const ids = ['q1', 'q2', 'q3', 'q4', 'q5'];
      for (const id of ids) ctx.setNpcAnim(id, 'tut');
      ctx.emit({ type: 'tut', ids });
      say(ctx, 'q3', 'egg.L5.line');
    },
  }), ['egg.L5.line']);

  const L6 = gobbleEgg('L6', 'w2', { type: 'cable', line: 'egg.L6.line' });

  // L7: the squirrel with the scone. Catch it, or keep on its tail for long enough.
  const L7 = withLines(egg('L7', 'w2', {
    tick(ctx) {
      if (ctx.isFound() || (ctx.state.tick & 7) !== 0) return;
      const sq = findNpc(ctx, 'squirrel');
      if (!sq) return;
      const d = ctx.dist(sq.x, sq.z);
      const big = Math.max(1, ctx.player.size);
      if (d < 14 * big) sayOnce(ctx, 'narrator', 'egg.L7.line1', null, 60);
      let chase = ctx.flag('L7.chase') || 0;
      if (d < 6 * big) chase += 8 / 60;
      ctx.flag('L7.chase', chase);
      if (d < 1.8 * big || chase > 7) {
        ctx.found();
        ctx.spawnItem('scone', sq.x, sq.z, { golden: true });
        say(ctx, 'narrator', 'egg.L7.line2');
      }
    },
  }), ['egg.L7.line1', 'egg.L7.line2']);

  // L8: brollies are only gobble-able while open, and they only open in the rain.
  // In a dry run a passing shower blows through between 150 s and 210 s.
  const L8 = withLines(egg('L8', 'w2', {
    init(ctx) { ctx.flag('nogobble:brolly', true); },
    tick(ctx) {
      if ((ctx.state.tick & 15) !== 0) return;
      const t = ctx.state.time;
      const shower = t > 150 && t < 210;
      const open = (ctx.state.weather && ctx.state.weather.kind === 'rain') || shower;
      if (ctx.flag('shower') !== shower) ctx.flag('shower', shower);
      if (!!ctx.flag('nogobble:brolly') === open) {
        ctx.flag('nogobble:brolly', !open);
        ctx.flag('brolly.open', open);
        if (open) sayOnce(ctx, 'narrator', 'egg.L8.line1', null, 60);
      }
    },
    onEvent(ev, ctx) {
      if (ctx.isFound() || ev.type !== EV.GOBBLE || ev.itemType !== 'brolly') return;
      ctx.found();
      say(ctx, 'player', 'egg.L8.line2');
    },
  }), ['egg.L8.line1', 'egg.L8.line2']);

  const L9 = withLines(egg('L9', 'w2', {
    onEvent(ev, ctx) {
      if (ctx.isFound() || (ev.type !== EV.BARK && ev.type !== EV.PLAY_BOW)) return;
      if (ctx.dist(P.postbox.x, P.postbox.z) > Math.max(4, ctx.player.size * 2.5)) return;
      ctx.found();
      say(ctx, 'narrator', 'egg.L9.line');
    },
  }), ['egg.L9.line']);

  const L10 = zoneEgg('L10', 'w2', { zone: 'plaque', secs: 2, line: 'egg.L10.line' });

  const L11 = withLines(egg('L11', 'w2', {
    onEvent(ev, ctx) {
      if (ctx.isFound() || ev.type !== EV.PLAY_BOW) return;
      if (npcDist(ctx, 'sentry') > Math.max(7, ctx.player.size * 3)) return;
      const n = countEvents(ctx, 'L11.bows', ctx.state.time, 40);
      if (n < 3) { say(ctx, 'narrator', 'egg.L11.line1'); return; }
      ctx.found();
      const s = findNpc(ctx, 'sentry');
      if (s) s.mood = 'smile';
      say(ctx, 'sentry', 'egg.L11.line2');
    },
  }), ['egg.L11.line1', 'egg.L11.line2']);

  const L12 = zoneEgg('L12', 'w2', { zone: 'gallery', secs: 2, line: 'egg.L12.line', vars: (ctx) => ({ name: playerName(ctx) }) });

  const L13 = withLines(egg('L13', 'w2', {
    init(ctx) { ctx.flag('teaMult', 1); },
    tick(ctx) {
      if (ctx.isFound() || (ctx.state.tick & 7) !== 0) return;
      if (npcDist(ctx, 'pru') > Math.max(3.5, ctx.player.size * 2) || ctx.stillTime() < 1.5) return;
      ctx.found();
      ctx.flag('teaMult', 2);
      ctx.buff('tea', 12);
      say(ctx, 'pru', 'egg.L13.line');
    },
  }), ['egg.L13.line']);

  const LX1 = zoneEgg('LX1', 'w2', { zone: 'gardenGap', secs: 0, line: 'egg.LX1.line' });

  const LX2 = withLines(egg('LX2', 'w2', {
    onEvent(ev, ctx) {
      if (ctx.isFound() || ev.type !== EV.GOBBLE || ev.itemType !== 'teamug') return;
      const n = (ctx.flag('LX2.n') || 0) + 1;
      ctx.flag('LX2.n', n);
      if (n >= 12) { ctx.found(); say(ctx, 'pru', 'egg.LX2.line'); }
    },
  }), ['egg.LX2.line']);

  return [L1, L2, L3, L4, L5, L6, L7, L8, L9, L10, L11, L12, L13, LX1, LX2, teaTimeEgg('w2'), geraldDisguiseEgg('w2')];
}
