# Cloudflare Pages deployment

Project: `memory-library-desktop`; production branch: `main`.
Production URL: https://memory-library-desktop.pages.dev
Deploy **only** `cloudflare-pages/dist` from the app directory.

Build in PowerShell:

```powershell
node node_modules/typescript/bin/tsc -b
$env:VITE_SYNC_URL = '/'
node node_modules/vite/bin/vite.js build --outDir cloudflare-pages/dist
Remove-Item Env:VITE_SYNC_URL
node cloudflare-pages/prepare.mjs
```

Check every command exits successfully before continuing. `prepare.mjs` checks
excluded files, symlinks and the Pages 25 MiB per-file limit; its report stays
outside the deployment folder. No R2 bucket is used.

Authenticate with Wrangler OAuth (`login` only when needed), then deploy:

```powershell
node sync-cloud/node_modules/wrangler/bin/wrangler.js whoami
node sync-cloud/node_modules/wrangler/bin/wrangler.js pages deploy cloudflare-pages/dist --project-name memory-library-desktop --branch main --commit-dirty=true
node cloudflare-pages/verify.cjs https://memory-library-desktop.pages.dev
```

`api-worker.js` proxies only `/api/v1/*` to the existing account backend. It
rejects foreign browser origins and forwards bearer authentication. Existing
cloud accounts, database and private images remain in the original backend.
Guest/local unsynced storage is origin-specific: synchronize it on the old site
before expecting it to appear after login on the Pages origin.

First production deployment: `3743f484-8d09-4afa-a2bb-5dc453c5219d`.
Browser evidence: `output/playwright/cloudflare-report.json` and screenshots.
Tests use isolated guest data; no real user credentials are used.
