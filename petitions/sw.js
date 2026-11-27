// All release pointers live in one record. Write the complete body before publishing its pointer.
const root = new URL('./', self.location.href);
const local = path => new URL(path, root).href;
const home = local('index.html');
const bank = 'vr-launch-v2:' + root.pathname;
const metadata = local('__vr/state');
const bodyKey = id => local('__vr/html/' + id);
const staticFiles = ['manifest.json', 'icon-192.png', 'icon-512.png'].map(local);
const releaseSlot = 'const servedRelease = "NETWORK";';
const legacyHash = '7357e03c3ab49e9e33fe8addfacd7039ea88eb18cff3a359914253f8144b4f41';
let queue = Promise.resolve();
let refreshing;
function exclusive(operation) {
  const result = queue.then(operation);
  queue = result.catch(() => {});
  return result;
}
async function state(cache) {
  const record = await cache.match(metadata);
  if (!record) return {};
  try {
    const s = await record.json();
    return s && typeof s === 'object' && !Array.isArray(s) ? s : {};
  } catch (err) {
    if (err.name === 'SyntaxError') return {};
    throw err;
  }
}
async function commit(cache, s) {
  await cache.put(metadata, new Response(JSON.stringify(s)));
}
async function digest(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}
async function stage(download) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 90000);
  try {
    const response = download || await fetch(home, {cache:'no-cache', signal:abort.signal});
    if (response.status !== 200) throw Error('Game download failed');
    const bytes = await response.arrayBuffer();
    const id = await digest(bytes);
    const cache = await caches.open(bank);
    const html = new TextDecoder().decode(bytes);
    if (!html.includes(releaseSlot) || !html.trimEnd().endsWith('</html>')) throw Error('Incomplete or incompatible game');
    await exclusive(async () => {
      const s = await state(cache);
      if (s.blocked === id) {
        const usable = await Promise.all([s.good, s.previous, s.candidate].filter(v => v && v !== id).map(v => cache.match(bodyKey(v))));
        if (usable.some(Boolean)) return;
        delete s.blocked;
      }
      if ([s.good, s.candidate].includes(id) && await cache.match(bodyKey(id))) return;
      const marked = html.replace(releaseSlot, 'const servedRelease = "' + id + '";');
      await cache.put(bodyKey(id), new Response(marked, {headers:{'Content-Type':'text/html; charset=utf-8'}}));
      s.candidate = id;
      delete s.tried;
      await commit(cache, s);
      for (const key of await cache.keys()) {
        if (key.url.startsWith(bodyKey('')) && ![s.good,s.previous,s.candidate,s.lastTrial].some(v => v && key.url === bodyKey(v))) await cache.delete(key);
      }
    });
  } finally { clearTimeout(timer); }
}
function refresh(download) {
  if (!refreshing) refreshing = stage(download).finally(() => { refreshing = null; });
  return refreshing;
}
async function install() {
  const cache = await caches.open(bank);
  await cache.addAll(staticFiles).catch(() => {});
  await refresh();
  // Only import the exact preceding distribution, including an r1 backup left by a partial upgrade.
  const legacy = 'vr-offline-' + root.pathname + '-r1';
  if ((await caches.keys()).includes(legacy)) {
    const old = await caches.open(legacy);
    for (const path of [home, local('__previous_game__')]) {
      const r = await old.match(path);
      if (r && await digest(await r.clone().arrayBuffer()) === legacyHash) {
        await exclusive(async () => {
          const s = await state(cache);
          if (!s.good && !s.previous) {
            await cache.put(bodyKey(legacyHash), r);
            s.previous = legacyHash;
            await commit(cache, s);
          }
        });
        break;
      }
    }
  }
}
self.addEventListener('install', event => event.waitUntil(install().catch(err => console.warn('Offline setup deferred:', err)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
function recoveryPage(status) {
  return new Response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vicarius Regis</title><body style="background:#1b2a22;color:#ead6a5;font:18px Georgia;padding:8vw"><h1>Vicarius Regis</h1><p>The game could not open from this device. ' + (status ? 'The game download returned HTTP ' + Number(status) + '.' : 'The game download also failed.') + '</p><button onclick="location.reload()">Retry</button> <a style="color:inherit" href="./launch.html">Open the online game</a>', {headers:{'Content-Type':'text/html; charset=utf-8'}});
}
async function selectPage(clientId) {
  return exclusive(async () => {
    const c = await caches.open(bank), s = await state(c);
    const otherTrialOpen = s.tried && s.trialClient && s.trialClient !== clientId && await self.clients.get(s.trialClient);
    const canRollBack = s.candidate && s.tried && !otherTrialOpen && (
      (s.good && await c.match(bodyKey(s.good))) ||
      (s.previous && await c.match(bodyKey(s.previous)))
    );
    if (canRollBack) {
      s.blocked = s.candidate;
      delete s.candidate;
      delete s.tried;
      await commit(c,s);
    }
    for (const id of [s.candidate,s.good,s.previous]) {
      if (!id) continue;
      const hit = await c.match(bodyKey(id));
      if (!hit) continue;
      if (id === s.candidate && !otherTrialOpen) {
        s.tried = true;
        s.trialClient = clientId;
        s.lastTrial = id;
        await commit(c,s);
      }
      return hit;
    }
  });
}
self.addEventListener('fetch', event => {
  const r = event.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== root.origin) return;
  if (r.mode === 'navigate' && [root.pathname,new URL(home).pathname].includes(u.pathname)) {
    const selected = selectPage(event.resultingClientId).catch(() => undefined);
    // With an empty or inaccessible cache, deliver the hosted page even if storing it fails.
    const live = selected.then(async hit => {
      if (hit) return null;
      try { return await fetch(home, {cache:'no-store'}); }
      catch { return null; }
    });
    event.waitUntil(Promise.all([selected,live]).then(([hit,response]) => {
      if (hit) return refresh();
      if (response?.ok) return refresh(response.clone());
    }).catch(() => {}));
    event.respondWith(Promise.all([selected,live]).then(([hit,response]) => {
      if (hit) return hit;
      if (response?.ok) return response;
      return recoveryPage(response?.status);
    }));
  } else if (staticFiles.includes(u.href)) {
    event.respondWith(caches.open(bank).then(c => c.match(r)).catch(() => undefined).then(hit => hit || fetch(r)));
  }
});
self.addEventListener('message', event => {
  const port = event.ports[0], msg = event.data;
  if (!port || !['ready','repair'].includes(msg?.type)) return;
  const staged = msg.type === 'ready' && msg.id === 'NETWORK' && refreshing;
  event.waitUntil(Promise.resolve(staged).catch(() => {}).then(() => exclusive(async () => {
    const c = await caches.open(bank), s = await state(c);
    if (msg.type === 'ready') {
      if (msg.id && msg.id === s.lastTrial && msg.id !== s.blocked && await c.match(bodyKey(msg.id))) {
        s.previous = s.good || s.previous;
        s.good = msg.id;
        delete s.lastTrial;
        if (s.candidate === msg.id) {
          delete s.candidate;
          delete s.tried;
        }
        await commit(c,s);
      }
      for (const id of [s.good,s.candidate,s.previous]) {
        if (id && await c.match(bodyKey(id))) return {ok:true};
      }
      throw Error('Game copy unavailable');
    }
    const failed = msg.id === 'NETWORK' ? s.candidate : msg.id;
    const target = [s.good,s.previous].find(id => id && id !== failed);
    if (!target || !await c.match(bodyKey(target))) throw Error('No earlier working copy is available on this device.');
    s.blocked = failed || s.candidate;
    if (target === s.previous) delete s.previous;
    s.good = target;
    delete s.lastTrial;
    delete s.candidate;
    delete s.tried;
    await commit(c,s);
    return {ok:true};
  })).then(result => port.postMessage(result), err => port.postMessage({ok:false,error:String(err.message || err)})));
});
