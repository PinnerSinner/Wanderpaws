// W3 Tijuca easter eggs: T1 to T13 (SPEC §7), plus TX extras, G8 and G9.

import { EV, say, egg, withLines, zoneEgg, gobbleEgg, npcEgg, findNpc, npcDist, near, sayOnce, distXZ, playerName, teaTimeEgg, geraldDisguiseEgg } from './common.js';

export const LILY_ZONES = ['lily1', 'lily2', 'lily3', 'lily4', 'lily5']; // lowest pitch (biggest pad) first

export function makeEggsW3(P) {
  // T1: the toucan heckles Gerald; catch them both in one frame (stand still with both in view).
  const T1 = withLines(egg('T1', 'w3', {
    tick(ctx) {
      if (ctx.isFound() || (ctx.state.tick & 7) !== 0) return;
      const t = findNpc(ctx, 'toucan'), g = findNpc(ctx, 'gerald');
      if (!t || !g) return;
      const apart = distXZ(t.x, t.z, g.x, g.z);
      const big = Math.max(1, ctx.player.size / 3);
      if (apart > 25 * big) return;
      sayOnce(ctx, 'toucan', 'egg.T1.heckle', null, 30);
      if (ctx.dist(t.x, t.z) > 30 * big || ctx.dist(g.x, g.z) > 30 * big || ctx.stillTime() < 1.5) return;
      ctx.found();
      say(ctx, 'toucan', 'egg.T1.line');
    },
  }), ['egg.T1.heckle', 'egg.T1.line']);

  // T2: the cave behind the waterfall (a 1.8 m lip: you need to be 4 m) holds the golden mango.
  const T2 = withLines(egg('T2', 'w3', {
    tick(ctx) {
      if ((ctx.state.tick & 15) !== 0 || ctx.flag('T2.seen')) return;
      if (ctx.zone('cave').inside) { ctx.flag('T2.seen', true); say(ctx, 'player', 'egg.T2.line1'); }
    },
    onEvent(ev, ctx) {
      if (ctx.isFound() || ev.type !== EV.GOBBLE || ev.itemType !== 'mango' || !ev.golden) return;
      ctx.found();
      say(ctx, 'narrator', 'egg.T2.line2');
    },
  }), ['egg.T2.line1', 'egg.T2.line2']);

  // T3: idle as the capybara and the locals pile on.
  const T3 = withLines(egg('T3', 'w3', {
    tick(ctx) {
      if (ctx.isFound() || ctx.species.id !== 'capybara' || ctx.stillTime() < 10) return;
      ctx.found();
      ctx.emit({ type: 'pileOn', kinds: ['marmoset', 'duckling', 'frog'], x: ctx.player.x, z: ctx.player.z });
      say(ctx, 'player', 'egg.T3.line');
    },
  }), ['egg.T3.line']);

  // T4: the marmoset pinches your hat; catch it to get it back (and a bonus).
  const T4 = withLines(egg('T4', 'w3', {
    onEvent(ev, ctx) {
      if (ctx.isFound() || ctx.flag('T4.stolen')) return;
      const hit = (ev.type === EV.HAZARD && ev.kind === 'marmoset') || (ev.type === EV.BUMP && ev.hazardKind === 'marmoset');
      if (!hit) return;
      ctx.flag('T4.stolen', true);
      ctx.flag('T4.t', ctx.state.time);
      ctx.emit({ type: 'hatStolen', by: 'marmoset' });
      say(ctx, 'marmoset', 'egg.T4.line1');
    },
    tick(ctx) {
      if (ctx.isFound() || !ctx.flag('T4.stolen') || (ctx.state.tick & 7) !== 0) return;
      if (ctx.state.time - ctx.flag('T4.t') < 1.5) return;
      if (npcDist(ctx, 'marmoset') > 2.5 * Math.max(1, ctx.player.size)) return;
      ctx.found();
      ctx.emit({ type: 'hatReturned', by: 'marmoset' });
      ctx.emit({ type: 'bonus', amount: 25, reason: 'T4' });
      say(ctx, 'marmoset', 'egg.T4.line2');
    },
  }), ['egg.T4.line1', 'egg.T4.line2']);

  const T5 = gobbleEgg('T5', 'w3', { type: 'brazilnut', line: 'egg.T5.line' });

  // T6: the giant leaf slide. Everyone gets a whee; belly-sliders get triple distance.
  const T6 = withLines(egg('T6', 'w3', {
    tick(ctx) {
      if (ctx.isFound() || (ctx.state.tick & 3) !== 0) return;
      if (ctx.zone('slideTop').inside) { ctx.flag('T6.t', ctx.state.time); return; }
      const t = ctx.flag('T6.t');
      if (t == null || ctx.state.time - t > 10 || !ctx.zone('slideEnd').inside) return;
      ctx.found();
      const p = ctx.player;
      const sliding = (p.sig && p.sig.active && p.sig.kind === 'bellySlide') || ctx.species.stats.slideSpeed > 1;
      if (sliding) { ctx.buff('speed', 4); say(ctx, 'player', 'egg.T6.line2'); }
      else say(ctx, 'player', 'egg.T6.line1');
    },
  }), ['egg.T6.line1', 'egg.T6.line2']);

  const T7 = zoneEgg('T7', 'w3', {
    zone: 'glade', secs: 3, line: 'egg.T7.line', vars: (ctx) => ({ name: playerName(ctx) }),
    after(ctx) {
      const name = playerName(ctx);
      ctx.flag('T7.spell', name);
      ctx.emit({ type: 'spell', text: name, x: P.glade.x, z: P.glade.z });
    },
  });

  const T8 = withLines(egg('T8', 'w3', {
    onEvent(ev, ctx) {
      if (ctx.isFound()) return;
      const g = ev.type === EV.GOBBLE && ev.itemType === 'router' && near(ev, P.router5g.x, P.router5g.z, 4);
      const b = ev.type === EV.BARK && ctx.dist(P.router5g.x, P.router5g.z) < Math.max(5, ctx.player.size * 2);
      if (!g && !b) return;
      ctx.found();
      say(ctx, 'narrator', 'egg.T8.line');
    },
  }), ['egg.T8.line']);

  const T9 = zoneEgg('T9', 'w3', { zone: 'trailmap', secs: 2, line: 'egg.T9.line' });

  const T10 = withLines(egg('T10', 'w3', {
    tick(ctx) {
      if (ctx.isFound() || (ctx.state.tick & 7) !== 0 || !ctx.zone('jaguar').inside) return;
      const cat = ctx.species.id === 'cat' || ctx.species.id === 'routercat';
      if (cat && ctx.stillTime() >= 1) { ctx.found(); say(ctx, 'player', 'egg.T10.line1'); }
      else if (!cat) sayOnce(ctx, 'narrator', 'egg.T10.line2', null, 40);
    },
  }), ['egg.T10.line1', 'egg.T10.line2']);

  const T11 = npcEgg('T11', 'w3', { npc: 'ze', r: 12, line: 'egg.T11.line' });

  // T12: hop the lily pads from the lowest note to the highest.
  const T12 = withLines(egg('T12', 'w3', {
    tick(ctx) {
      if (ctx.isFound() || (ctx.state.tick & 1) !== 0) return;
      let pad = -1;
      for (let i = 0; i < LILY_ZONES.length; i++) if (ctx.zone(LILY_ZONES[i]).inside) { pad = i; break; }
      const last = ctx.flag('T12.on');
      if (pad === last) return;
      ctx.flag('T12.on', pad);
      if (pad < 0) return;
      ctx.emit({ type: 'note', pitch: pad });
      const want = ctx.flag('T12.next') || 0;
      if (pad === want) ctx.flag('T12.next', want + 1);
      else ctx.flag('T12.next', pad === 0 ? 1 : 0);
      if ((ctx.flag('T12.next') || 0) >= LILY_ZONES.length) {
        ctx.found();
        ctx.spawnItem('lilyflower', P.lilyPrize.x, P.lilyPrize.z, { golden: true });
        say(ctx, 'narrator', 'egg.T12.line');
      }
    },
  }), ['egg.T12.line']);

  // T13: the sloth says one word every 50 s. By the end it has finished a sentence.
  const words = ['egg.T13.word1', 'egg.T13.word2', 'egg.T13.word3', 'egg.T13.word4', 'egg.T13.word5', 'egg.T13.word6'];
  const T13 = withLines(egg('T13', 'w3', {
    tick(ctx) {
      if (ctx.isFound() || (ctx.state.tick & 15) !== 0) return;
      const n = Math.floor(ctx.state.time / 50);
      const said = ctx.flag('T13.n') || 0;
      if (n <= said || said >= words.length) return;
      ctx.flag('T13.n', said + 1);
      say(ctx, 'sloth', words[said]);
      if (said + 1 === words.length && npcDist(ctx, 'sloth') < 60 * Math.max(1, ctx.player.size / 4)) ctx.found();
    },
  }), words);

  const TX1 = zoneEgg('TX1', 'w3', { zone: 'hammock', secs: 6, speaker: 'player', line: 'egg.TX1.line', after(ctx) { ctx.emit({ type: 'nap', x: P.hammock.x, z: P.hammock.z }); } });
  const TX2 = zoneEgg('TX2', 'w3', { zone: 'lookout', secs: 3, line: 'egg.TX2.line' });

  return [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, TX1, TX2, teaTimeEgg('w3'), geraldDisguiseEgg('w3')];
}
