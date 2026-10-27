// Builds the whole game into ONE self-contained HTML file.
//   node tools/build.mjs                 -> dist/index.html
//   node tools/build.mjs --out .out/x.html
//   node tools/build.mjs --watch
//   node tools/build.mjs --no-minify
// User assets in assets/user/** are embedded as data URIs (window.__ASSETS__).

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argVal = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const outFile = path.resolve(root, argVal('--out', 'dist/index.html'));
const watch = args.includes('--watch');
const minify = !args.includes('--no-minify');

const { GAME } = await import(path.join(root, 'src/core/game.js'));

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.json': 'application/json', '.txt': 'text/plain',
};
const SKIP_DIRS = new Set(['originals', '_scratch']);

function collectAssets() {
  const dir = path.join(root, 'assets/user');
  const out = {};
  const meta = {};
  let bytes = 0;
  if (!fs.existsSync(dir)) return { out, meta, bytes };
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) { if (!SKIP_DIRS.has(ent.name)) walk(full); continue; }
      if (ent.name.startsWith('.') || ent.name.toLowerCase() === 'readme.md') continue;
      const ext = path.extname(ent.name).toLowerCase();
      const mime = MIME[ext];
      if (!mime) { console.warn(`[build] skipping unknown asset type: ${path.relative(root, full)}`); continue; }
      const buf = fs.readFileSync(full);
      bytes += buf.length;
      const key = path.relative(dir, full).split(path.sep).join('/');
      out[key] = `data:${mime};base64,${buf.toString('base64')}`;
      meta[key] = { bytes: buf.length };
      // Optional sidecar metadata, e.g. voice/gerald-01.mp3.json { "gainDb": -3.2, "text": "..." }
      const side = full + '.json';
      if (fs.existsSync(side)) {
        try { Object.assign(meta[key], JSON.parse(fs.readFileSync(side, 'utf8'))); } catch (e) { console.warn(`[build] bad sidecar ${side}: ${e.message}`); }
      }
    }
  };
  walk(dir);
  return { out, meta, bytes };
}

const safeJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

async function buildOnce() {
  const t0 = Date.now();
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'src/main.js')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    minify,
    write: false,
    legalComments: 'none',
    loader: { '.css': 'text', '.svg': 'text', '.txt': 'text' },
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'warning',
  });
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const { out: assets, meta, bytes } = collectAssets();
  const tpl = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
  const html = tpl
    .replace(/%%NAME%%/g, () => GAME.name)
    .replace(/%%TAGLINE%%/g, () => GAME.tagline)
    .replace('%%ASSETS%%', () => safeJson(assets))
    .replace('%%ASSETS_META%%', () => safeJson(meta))
    .replace('%%SCRIPT%%', () => js);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html);
  const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
  console.log(`[build] ${path.relative(root, outFile)}  ${mb(html.length)} (js ${mb(js.length)}, assets ${Object.keys(assets).length} files ${mb(bytes)})  ${Date.now() - t0} ms`);
  if (html.length > 25 * 1048576) { console.error('[build] over the 25 MB limit!'); process.exitCode = 1; }
  else if (html.length > 16 * 1048576) console.warn('[build] over 16 MB: too big for an Artifact preview');
}

if (watch) {
  await buildOnce().catch((e) => console.error(e.message));
  let timer = null;
  fs.watch(path.join(root, 'src'), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => buildOnce().catch((e) => console.error(e.message)), 150);
  });
  console.log('[build] watching src/ ...');
} else {
  try { await buildOnce(); } catch (e) { console.error(e.message || e); process.exit(1); }
}
