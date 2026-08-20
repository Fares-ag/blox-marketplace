import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

const API_ROOT = path.resolve(__dirname, '../..');
const URL_FILE = path.join(API_ROOT, '.test-database-url');

declare global {
  // eslint-disable-next-line no-var
  var __INTEGRATION_PG__: StartedPostgreSqlContainer | undefined;
}

export default async function globalSetup() {
  let databaseUrl = process.env.TEST_DATABASE_URL?.trim();

  if (!databaseUrl) {
    const container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('blox_test')
      .withUsername('blox')
      .withPassword('blox')
      .start();
    globalThis.__INTEGRATION_PG__ = container;
    databaseUrl = container.getConnectionUri();
  }

  process.env.DATABASE_URL = databaseUrl;
  writeFileSync(URL_FILE, databaseUrl, 'utf8');

  execSync('npx prisma migrate deploy', {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
}
