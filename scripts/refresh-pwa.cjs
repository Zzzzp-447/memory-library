// Refresh only the generated service worker when app bundles are unchanged.
;(async () => { const { buildPwa } = await import('./pwa-build.ts'); buildPwa(require('node:path').resolve('dist')); console.log('Refreshed service worker from the current build') })().catch(error => { console.error(error); process.exitCode = 1 })
