// Builds the game into one static file, realm/index.html, that runs offline when opened in a browser.

import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const out = await build({
  entryPoints: [new URL('ui/main.tsx', here).pathname],
  bundle: true, minify: true, write: false, format: 'iife', target: 'es2022',
  jsx: 'automatic', jsxImportSource: 'preact', legalComments: 'none',
});
const js = out.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const css = readFileSync(new URL('ui/styles.css', here), 'utf8');
const html = readFileSync(new URL('ui/index.template.html', here), 'utf8').replace('/*CSS*/', () => css).replace('/*JS*/', () => js);
writeFileSync(new URL('index.html', here), html);
console.log(`realm/index.html ${(html.length / 1024).toFixed(0)} KB`);
