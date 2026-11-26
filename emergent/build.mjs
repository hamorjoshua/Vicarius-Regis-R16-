// Builds the screen into one file. `play.html` is the page as an Artifact wants it (no document
// skeleton); `index.html` is the same page as a document that opens from disk and runs offline.

import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const out = await build({ entryPoints: [new URL('ui/main.ts', here).pathname], bundle: true, minify: true, write: false, format: 'iife', target: 'es2022', legalComments: 'none' });
const js = out.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const page = readFileSync(new URL('ui/page.html', here), 'utf8') + `<script>${js}</script>\n`;
const head = '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>body{margin:0}[hidden]{display:none!important}</style>';
writeFileSync(new URL('play.html', here), page);
writeFileSync(new URL('index.html', here), `<!doctype html>\n<html lang="en"><head>${head}</head><body>\n${page}</body></html>\n`);
console.log(`play.html and index.html, ${(page.length / 1024).toFixed(0)} KB`);
