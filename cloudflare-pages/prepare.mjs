import { cpSync, readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
const folder = new URL('./dist/', import.meta.url)
cpSync(new URL('./api-worker.js', import.meta.url), new URL('_worker.js', folder))
writeFileSync(new URL('_routes.json', folder), JSON.stringify({ version: 1, include: ['/api/v1/*'], exclude: [] }, null, 2))
writeFileSync(new URL('_headers', folder), '/sw.js\n  Cache-Control: no-cache\n/repair\n  Cache-Control: no-store\n')
const files = []
function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (/^\.env|^\.git$|^\.wrangler$|^node_modules$|\.(log|pem|key|keystore|map)$/i.test(entry.name)) throw new Error(`Excluded deployment entry: ${entry.name}`)
    const file = path.join(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error('Deployment must not include symbolic links')
    if (entry.isDirectory()) scan(file)
    else { const bytes = statSync(file).size; if (bytes > 25 * 1024 * 1024) throw new Error(`Pages per-file limit exceeded: ${entry.name}`); files.push({ name: path.relative(new URL(folder).pathname, file), bytes }) }
  }
}
scan(path.resolve('cloudflare-pages/dist'))
if (!readFileSync(new URL('sw.js', folder), 'utf8').includes('repairVersion: 3')) throw new Error('Current repair worker must be bundled')
const report = { project: 'memory-library-desktop', directory: path.resolve('cloudflare-pages/dist'), files: files.length, bytes: files.reduce((n, f) => n + f.bytes, 0), largestFileBytes: Math.max(...files.map(f => f.bytes)), perFileLimit: 25 * 1024 * 1024, excludedEntriesFound: false }
writeFileSync(new URL('./build-report.json', import.meta.url), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report))
