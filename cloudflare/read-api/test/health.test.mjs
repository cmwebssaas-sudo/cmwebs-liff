import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import worker from '../src/index.js';

test('health exercises the real local Worker and D1 without changing stored rows', async () => {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: await readFile(new URL('../.wrangler/dry-run/index.js', import.meta.url), 'utf8'),
    compatibilityDate: '2026-10-06',
    d1Databases: { DB: 'local-test-replica' }
  }));
  try {
    const db = await mf.getD1Database('DB');
    await db.exec('CREATE TABLE probe (value TEXT); INSERT INTO probe VALUES (\'synthetic\');');
    const response = await mf.dispatchFetch('https://local.test/health');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, data: { service: 'cmwebs-read-api', database: 'ready' } });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await db.prepare('SELECT value FROM probe').first()).value, 'synthetic');
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const denied = await mf.dispatchFetch('https://local.test/health', { method });
      assert.equal(denied.status, 405);
      assert.equal(denied.headers.get('allow'), 'GET');
    }
    const unknown = await mf.dispatchFetch('https://local.test/landlord_home_bootstrap');
    assert.equal(unknown.status, 404);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM probe').first()).count, 1);
  } finally {
    await mf.dispose();
  }
});

test('unavailable D1 returns a sanitized non-cacheable failure', async () => {
  for (const env of [{}, { DB: { prepare() { throw new Error('private database details'); } } }]) {
    const response = await worker.fetch(new Request('https://local.test/health'), env);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { success: false, error: 'READ_REPLICA_UNAVAILABLE' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});
