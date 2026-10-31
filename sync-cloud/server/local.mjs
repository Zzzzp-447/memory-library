import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './api.mjs';

const root = path.resolve(process.env.SYNC_DATA_DIR || fileURLToPath(new URL('../.local-data/', import.meta.url)));
fs.mkdirSync(root, { recursive: true });
const database = new DatabaseSync(path.join(root, 'sync.sqlite'));
database.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS local_migrations(name TEXT PRIMARY KEY);');
const migrations = fileURLToPath(new URL('../drizzle/', import.meta.url));
for (const file of fs.readdirSync(migrations).filter(file => file.endsWith('.sql')).sort()) {
  if (!database.prepare('SELECT name FROM local_migrations WHERE name=?').get(file)) {
    database.exec('BEGIN IMMEDIATE');
    try { database.exec(fs.readFileSync(path.join(migrations, file), 'utf8')); database.prepare('INSERT INTO local_migrations(name) VALUES(?)').run(file); database.exec('COMMIT'); }
    catch (error) { database.exec('ROLLBACK'); throw error; }
  }
}
class Statement {
  constructor(sql, values = []) { this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.sql, values); }
  async first() { return database.prepare(this.sql).get(...this.values) || null; }
  async all() { return { results: database.prepare(this.sql).all(...this.values) }; }
  async run() { return { success: true, meta: database.prepare(this.sql).run(...this.values) }; }
}
const env = {
  LOCAL_DEV: true,
  DB: {
    prepare(sql) { return new Statement(sql); },
    async batch(statements) {
      database.exec('BEGIN IMMEDIATE');
      try { const result = statements.map(statement => ({ success: true, meta: database.prepare(statement.sql).run(...statement.values) })); database.exec('COMMIT'); return result; }
      catch (error) { database.exec('ROLLBACK'); throw error; }
    },
  },
  BUCKET: {
    async put(key, data) {
      const file = path.join(root, 'objects', key); fs.mkdirSync(path.dirname(file), { recursive: true });
      const temporary = file + '.' + crypto.randomUUID() + '.tmp';
      fs.writeFileSync(temporary, data); fs.renameSync(temporary, file);
    },
    async get(key) {
      try { const data = fs.readFileSync(path.join(root, 'objects', key)); return { body: new Response(data).body }; }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    },
  },
};
const port = Number(process.env.SYNC_PORT || 8787);
const server = createServer(async (incoming, outgoing) => {
  try {
    const chunks = []; let size = 0;
    for await (const chunk of incoming) { size += chunk.length; if (size > 11 * 1024 * 1024) { outgoing.writeHead(413); outgoing.end(); return; } chunks.push(chunk); }
    const request = new Request(`http://127.0.0.1:${port}${incoming.url}`, { method: incoming.method, headers: incoming.headers, ...(size ? { body: Buffer.concat(chunks) } : {}) });
    const response = await handleApi(request, env);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { console.error(error.name); outgoing.writeHead(500); outgoing.end('Local sync error'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Sync API ready: http://127.0.0.1:${port}`));
const close = () => server.close(() => { database.close(); process.exit(0); });
process.on('SIGTERM', close); process.on('SIGINT', close);
