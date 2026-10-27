// Measures the real WebAudio engine in headless Chromium: unlocks audio,
// plays each music context with voice lines and SFX over it, and reads the
// engine's own K-weighted meters through audio.levels().
//   node tools/build.mjs --out .out/audio.html
//   node test/audio/browser-levels.mjs [.out/audio.html]
// (Not a *.test.js file: it needs Playwright and takes about a minute.)

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const file = path.resolve(root, process.argv[2] || '.out/audio.html');

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + file + '?quality=low&shot=1');
await page.waitForTimeout(2500);

const contexts = (process.env.CONTEXTS || 'title,w1,w2,w3,w4,w5').split(',');
const results = {};
for (const id of contexts) {
  // the game's own engine; its meters average over ~10 s, so each 22 s run
  // is dominated by its own context. The game's render loop calls tick().
  const r = await page.evaluate(async (id) => {
    const audio = window.__gp.app.audio;
    audio.unlock();
    audio.music(id);
    const lines = [['gerald', 'Ball? What ball? Finders keepers, mate.'], ['pru', 'Coffee? In this house? I think not, dear.'], ['kev', 'Code red! Dog overboard!'],
      ['marco', 'Right then, who wants a spare ball?'], ['ze', 'Olha o mate! Olha o biscoito!'], ['packet', 'Recalculating. In two hops, turn left.']];
    const t0 = performance.now();
    let k = 0, last = 0;
    await new Promise((res) => {
      const loop = () => {
        const t = (performance.now() - t0) / 1000;
        if (t > 3 && t - last > 3.2) { last = t; const [s, x] = lines[k++ % lines.length]; audio.say({ speaker: s, text: x, force: true }); audio.sfx('pop', { pitch: 1 + (k % 5) * 0.1 }); }
        if (t > 22) res(); else setTimeout(loop, 33);
      };
      loop();
    });
    const lv = audio.levels();
    const st = audio.stats();
    audio.music(null);
    return { lv, st };
  }, id);
  results[id] = r;
  const l = r.lv;
  const f = (x) => (x == null ? 'n/a' : x.toFixed(1));
  console.log(`${id.padEnd(6)} music ${f(l.musicDb)}  voice ${f(l.voiceDb)}  gap ${f(l.voiceOverMusicDb)}  sfx ${f(l.sfxDb)}  master ${f(l.masterDb)}  peak ${f(l.peakDb.master)} dBFS  voiceComp GR ${f(l.voiceCompReductionDb)}  masterLimit GR ${f(l.masterLimitReductionDb)}  ctx ${r.st.state}`);
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
