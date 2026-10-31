import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export function buildPwa(directory: string) {
  const files: string[] = []
  const walk = (folder: string) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name)
      if (entry.isDirectory()) walk(file)
      else if (entry.name !== 'sw.js') files.push(file)
    }
  }
  walk(directory); files.sort()
  const hash = createHash('sha256').update('shell-v3-immediate-repair')
  for (const file of files) hash.update(path.relative(directory, file)).update(readFileSync(file))
  const urls = files.map(file => '/' + path.relative(directory, file).split(path.sep).map(encodeURIComponent).join('/'))
  writeFileSync(path.join(directory, 'sw.js'), `// Generated from the exact application build. Personal data and APIs are never cached here.
const CACHE = 'memory-library-shell-${hash.digest('hex').slice(0, 20)}';
const FILES = ${JSON.stringify(urls)};
// Asset hosting may redirect /index.html to /. A redirected cached response is
// rejected by Chromium for document navigations (ERR_FAILED). Store plain
// responses, with decoded-body headers, rather than caching redirect metadata.
function plainResponse(response) {
  const headers = new Headers(response.headers);
  headers.delete('content-encoding'); headers.delete('content-length');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  // A failed optional asset must never keep a broken old worker in control.
  const response = await fetch(new Request('/index.html', { cache: 'reload' }));
  if (!response.ok) throw new Error('Application shell failed');
  await cache.put('/index.html', plainResponse(response));
  await self.skipWaiting();
})()));
let warming;
function prepareOffline() {
  if (warming) return warming;
  warming = (async () => {
    const cache = await caches.open(CACHE);
    let complete = true;
    for (let i = 0; i < FILES.length; i += 8) await Promise.all(FILES.slice(i, i + 8).map(async url => {
      if (await cache.match(url)) return;
      try {
        const response = await fetch(new Request(url, { cache: 'reload' }));
        if (!response.ok) throw new Error('Offline resource failed');
        await cache.put(url, plainResponse(response));
      } catch { complete = false; }
    }));
    const message = { type: 'memory-library-offline-status', status: complete ? 'ready' : 'error' };
    for (const client of await self.clients.matchAll()) client.postMessage(message);
    return message;
  })().finally(() => { warming = undefined; });
  return warming;
}
self.addEventListener('activate', event => event.waitUntil((async () => {
  // Retain previous shells during this repair for already-open offline pages.
  // Account data lives in IndexedDB and is never altered by this worker.
  await self.clients.claim();
})()));
self.addEventListener('message', event => {
  if (event.data?.type === 'memory-library-health') event.ports[0]?.postMessage({ repairVersion: 3 });
  if (event.data?.type === 'memory-library-prepare') event.waitUntil(prepareOffline());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate' && /^(\\/|\\/install|\\/login|\\/library|\\/create|\\/mindmap-style|\\/subjects(?:\\/[^/]+){1,3})$/.test(url.pathname)) {
    event.respondWith((async () => { const response = (await (await caches.open(CACHE)).match('/index.html')) || await fetch(request); return plainResponse(response); })());
  } else if (FILES.includes(url.pathname) || url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => (await (await caches.open(CACHE)).match(url.pathname)) || (await caches.match(request)) || fetch(request))());
  }
});
`)
}
