// Animal preview: bundles src/animals/view/preview/entry.js into a page and
// screenshots contact sheets with Playwright (Chromium + SwiftShader).
//
//   node tools/animal-preview.mjs                          -> every species grid into shots/animals/
//   node tools/animal-preview.mjs --species oli,cat        -> just those
//   node tools/animal-preview.mjs --species oli --layout hero --sc trot --angle side --t 1.3
//   node tools/animal-preview.mjs --layout lineup          -> all 13 side by side
//   node tools/animal-preview.mjs --layout critters        -> every critter
//   node tools/animal-preview.mjs --species oli --layout presets
// Extra page params pass straight through: --cells "trot:side,sprint:side" --look blacklab --acc head:bowler,neck:bandanared
// Prints draw calls and triangles per cell, plus any page errors.

import * as esbuild from 'esbuild';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argVal = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const outDir = path.resolve(root, argVal('--out', 'shots/animals'));
const layout = argVal('--layout', 'grid');
const { SPECIES_ORDER } = await import(path.join(root, 'src/animals/species.js'));
const species = (argVal('--species', layout === 'grid' || layout === 'presets' ? SPECIES_ORDER.join(',') : 'oli')).split(',');
const PASS = ['--t', '--sc', '--angle', '--cells', '--look', '--acc', '--q', '--cols', '--w', '--h', '--kinds'];

const html = path.join(root, '.out/animal-preview.html');
async function bundle() {
  const r = await esbuild.build({
    entryPoints: [path.join(root, 'src/animals/view/preview/entry.js')],
    bundle: true, format: 'iife', platform: 'browser', target: ['es2020'], write: false, minify: false,
    loader: { '.css': 'text', '.svg': 'text', '.txt': 'text' }, logLevel: 'warning',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  fs.mkdirSync(path.dirname(html), { recursive: true });
  fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><title>Animal preview</title></head><body><script>${js}</script></body></html>`);
}

await bundle();
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
fs.mkdirSync(outDir, { recursive: true });
let bad = 0;
const ids = layout === 'lineup' || layout === 'critters' ? [layout] : species;
for (const id of ids) {
  const q = new URLSearchParams({ species: id, layout });
  for (const k of PASS) { const v = argVal(k, null); if (v !== null) q.set(k.slice(2), v); }
  const page = await browser.newPage({ viewport: { width: 1700, height: 1300 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + html + '?' + q.toString());
  await page.waitForFunction(() => window.__preview && window.__preview.ready, null, { timeout: 120000 }).catch(() => {});
  const name = argVal('--name', null) ? (ids.length > 1 ? `${id}-${argVal('--name')}` : argVal('--name')) : (layout === 'grid' ? id : `${id}-${layout}${argVal('--sc', '') ? '-' + argVal('--sc') : ''}`);
  const out = path.join(outDir, name + '.png');
  const el = await page.$('canvas');
  if (el) await el.screenshot({ path: out }); else await page.screenshot({ path: out });
  const stats = await page.evaluate(() => (window.__preview ? window.__preview.stats : null)).catch(() => null);
  const s0 = stats && stats[0];
  console.log(`${path.relative(root, out)}${s0 ? `  calls=${s0.drawCalls} tris=${s0.triangles}` : ''}${errors.length ? '  ERRORS:' : ''}`);
  for (const e of errors.slice(0, 5)) console.log('   ' + e.split('\n').slice(0, 5).join('\n   '));
  if (errors.some((e) => e.startsWith('pageerror'))) bad++;
  await page.close();
}
await browser.close();
if (bad) process.exitCode = 2;
