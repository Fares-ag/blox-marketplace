import { unlinkSync } from 'node:fs';
import path from 'node:path';

const URL_FILE = path.resolve(__dirname, '../../.test-database-url');

export default async function globalTeardown() {
  if (globalThis.__INTEGRATION_PG__) {
    await globalThis.__INTEGRATION_PG__.stop();
    globalThis.__INTEGRATION_PG__ = undefined;
  }
  try {
    unlinkSync(URL_FILE);
  } catch {
    /* ignore */
  }
}
