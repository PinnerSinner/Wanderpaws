// World-meshes preview: bundles src/worlds/meshes/preview/entry.js and screenshots it.
//   node tools/mesh-preview.mjs --mode items --out shots/meshes/items.png
//   node tools/mesh-preview.mjs --mode items --ids teamug,router --view front --cell 300
//   node tools/mesh-preview.mjs --mode humans --view front|three
//   node tools/mesh-preview.mjs --mode anims --kind marco --t 0.8
//   node tools/mesh-preview.mjs --mode scenery --world w2 --ids terrace,busstop
//   node tools/mesh-preview.mjs --mode world --world w1 --yaw 0.6 --pitch 0.5 --dist 120
// Any --key value pair is passed through as a query parameter.
import * as esbuild from 'esbuild';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) { opts[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : '1'; }
const out = path.resolve(root, opts.out || `shots/meshes/${opts.mode || 'items'}.png`);
delete opts.out;
const wait = Number(opts.wait || 300); delete opts.wait;

const html = path.join(root, '.out/mesh-preview.html');
const res = await esbuild.build({
  entryPoints: [path.join(root, 'src/worlds/meshes/preview/entry.js')],
  bundle: true, format: 'iife', platform: 'browser', target: ['es2020'], write: false, minify: false,
  loader: { '.css': 'text', '.svg': 'text', '.txt': 'text' }, logLevel: 'warning',
});
fs.mkdirSync(path.dirname(html), { recursive: true });
fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><title>Mesh preview</title></head><body><script>${res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`);

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
const qs = new URLSearchParams(opts).toString();
await page.goto('file://' + html + '?' + qs);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 }).catch(() => errors.push('timeout waiting for __ready'));
await page.waitForTimeout(wait);
const size = await page.evaluate(() => [document.body.scrollWidth, document.body.scrollHeight, window.__stats || null]);
await page.setViewportSize({ width: Math.max(200, size[0]), height: Math.max(200, size[1]) });
await page.waitForTimeout(100);
fs.mkdirSync(path.dirname(out), { recursive: true });
await page.screenshot({ path: out, fullPage: true });
console.log(path.relative(root, out), size[2] ? JSON.stringify(size[2]) : '');
for (const e of errors.slice(0, 12)) console.log('  ' + e.split('\n').slice(0, 5).join('\n  '));
await browser.close();
