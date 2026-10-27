// Headless screenshots with Chromium + SwiftShader.
//   node tools/screenshots.mjs                         -> the standard set from dist/index.html into shots/
//   node tools/screenshots.mjs --file .out/ui.html --q "screen=journal" --size 2000x747 --out shots/journal.png --wait 4000
//   node tools/screenshots.mjs --sizes all --q "screen=title" --name title
// Prints console errors from the page so they can't hide. Exit code 2 if any page threw.

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Playwright is pre-installed globally in the dev container; ESM can't see NODE_PATH, so require it.
const { chromium } = createRequire(import.meta.url)('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argVal = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

export const SIZES = { ultrawide: [2000, 747], uw2560: [2560, 1080], fhd: [1920, 1080], hd: [1280, 720], phone: [812, 375] };

const file = path.resolve(root, argVal('--file', 'dist/index.html'));
const outDir = path.resolve(root, argVal('--dir', 'shots'));
const wait = Number(argVal('--wait', 3500));
const baseQ = 'quality=low&shot=1';

function parseSize(s) {
  if (SIZES[s]) return SIZES[s];
  const m = /^(\d+)x(\d+)$/.exec(s || '');
  return m ? [Number(m[1]), Number(m[2])] : SIZES.ultrawide;
}

async function shoot(browser, { q = '', size = 'ultrawide', out, waitMs = wait, script = null }) {
  const [w, h] = parseSize(size);
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const url = 'file://' + file + '?' + [baseQ, q].filter(Boolean).join('&');
  await page.goto(url);
  await page.waitForTimeout(waitMs);
  if (script) { await page.evaluate(script); await page.waitForTimeout(800); }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  const fps = await page.evaluate(() => (window.__gp ? window.__gp.fps : 0)).catch(() => 0);
  const stats = await page.evaluate(() => (window.__gp?.renderer?.stats ? window.__gp.renderer.stats() : null)).catch(() => null);
  await page.close();
  return { out, errors, fps, stats };
}

async function main() {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const jobs = [];
  const single = argVal('--q', null);
  const sizesArg = argVal('--sizes', null);
  if (single !== null || argVal('--out', null)) {
    const sizes = sizesArg === 'all' ? Object.keys(SIZES) : [argVal('--size', 'ultrawide')];
    for (const s of sizes) {
      const name = argVal('--name', 'shot');
      jobs.push({ q: single || '', size: s, out: argVal('--out', null) && sizes.length === 1 ? path.resolve(root, argVal('--out')) : path.join(outDir, `${name}-${s}.png`) });
    }
  } else {
    // Standard set: every screen at every size, plus each world and animal at ultrawide.
    const screens = ['title', 'worlds', 'animals', 'dressing', 'journal', 'settings', 'shop', 'achievements', 'stats', 'species'];
    for (const sc of screens) for (const s of Object.keys(SIZES)) jobs.push({ q: `screen=${sc}`, size: s, out: path.join(outDir, `screen-${sc}-${s}.png`) });
    for (const wld of ['w1', 'w2', 'w3', 'w4', 'w5']) for (const s of ['ultrawide', 'phone']) jobs.push({ q: `world=${wld}&species=oli&seed=7`, size: s, out: path.join(outDir, `world-${wld}-${s}.png`), waitMs: wait + 2500 });
  }
  let bad = 0;
  for (const j of jobs) {
    const r = await shoot(browser, j);
    const st = r.stats ? ` calls=${r.stats.drawCalls} tris=${r.stats.triangles}` : '';
    console.log(`${path.relative(root, r.out)}  fps~${(r.fps || 0).toFixed(1)}${st}${r.errors.length ? '  ERRORS:' : ''}`);
    for (const e of r.errors.slice(0, 6)) console.log('   ' + e.split('\n').slice(0, 4).join('\n   '));
    if (r.errors.some((e) => e.startsWith('pageerror'))) bad++;
  }
  await browser.close();
  if (bad) process.exitCode = 2;
}

main().catch((e) => { console.error(e); process.exit(1); });
