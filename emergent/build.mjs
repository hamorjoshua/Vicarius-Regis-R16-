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
// The site's front page. The site already has a service worker, written for the earlier game, that keeps a copy
// of the front page for offline play. It accepts a new page only if it carries the line below and ends with the
// closing tag, and keeps it only if the page reports that it opened. Without both, returning visitors would go on
// being shown the earlier game.
const boot = `<script>
  const servedRelease = "NETWORK";
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
    const report = () => {
      const worker = navigator.serviceWorker.controller;
      if (!worker || !document.getElementById('app')?.firstChild) return;
      const ch = new MessageChannel();
      ch.port1.onmessage = () => ch.port1.close();
      worker.postMessage({ type: 'ready', id: servedRelease }, [ch.port2]);
    };
    window.addEventListener('load', () => { setTimeout(report, 1500); setTimeout(report, 6000); });
  }
</script>`;
const front = '<link rel="manifest" href="./manifest.json"><link rel="icon" href="./icon-192.png"><meta name="theme-color" content="#111a18">';
writeFileSync(new URL('../index.html', here), `<!doctype html>\n<html lang="en"><head>${head}${front}</head><body>\n${page}${boot}\n</body></html>\n`);
console.log(`play.html and index.html, ${(page.length / 1024).toFixed(0)} KB`);
