// Builds the render harness into .out/render-harness.html using the game's HTML shell.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const r = await esbuild.build({ entryPoints: [path.join(here, 'harness.js')], bundle: true, format: 'iife', write: false, target: ['es2020'], logLevel: 'error' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8')
  .replace(/%%NAME%%/g, 'Render harness').replace(/%%TAGLINE%%/g, '').replace('%%ASSETS%%', '{}').replace('%%ASSETS_META%%', '{}')
  .replace('%%SCRIPT%%', () => js + ';document.body.classList.add("ready");');
fs.mkdirSync(path.join(root, '.out'), { recursive: true });
fs.writeFileSync(path.join(root, '.out/render-harness.html'), tpl);
console.log('[harness] .out/render-harness.html', (tpl.length / 1048576).toFixed(2), 'MB');
