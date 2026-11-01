/**
 * Runs a real PostgreSQL server from npm-distributed binaries so the project
 * works on machines without Docker. Data persists in apps/api/.pgdata.
 */
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import path from 'node:path';

const port = Number(process.env.LOCAL_PG_PORT ?? 5433);
const databaseDir = path.resolve(process.cwd(), '.pgdata');
const databases = ['recruitflow', 'recruitflow_test'];

const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: true,
  onLog: () => {},
});

async function main() {
  if (!fs.existsSync(path.join(databaseDir, 'PG_VERSION'))) {
    console.log('[db] Initialising new local PostgreSQL cluster…');
    await pg.initialise();
  }
  await pg.start();
  for (const name of databases) {
    try {
      await pg.createDatabase(name);
      console.log(`[db] Created database "${name}"`);
    } catch {
      // already exists
    }
  }
  console.log(`[db] PostgreSQL ready on postgresql://postgres:postgres@localhost:${port}/recruitflow`);
}

async function shutdown() {
  console.log('[db] Stopping PostgreSQL…');
  await pg.stop().catch(() => {});
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch(async (err) => {
  console.error('[db] Failed to start PostgreSQL', err);
  await pg.stop().catch(() => {});
  process.exit(1);
});

setInterval(() => {}, 1 << 30);
