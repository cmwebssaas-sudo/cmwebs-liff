import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createWorker } from '../_dev/vendor-work-orders-cloud/src/worker.mjs';
import { createD1StateStore } from '../_dev/vendor-work-orders-cloud/src/d1-state-store.mjs';
import { createAuthStore } from '../_dev/vendor-work-orders-cloud/src/auth-store.mjs';
import { signLineWebhook, verifyLineWebhook } from '../_dev/vendor-work-orders-cloud/src/line-crypto.mjs';
import { createPrivateAttachmentStore } from '../_dev/vendor-work-orders-cloud/src/r2-attachments.mjs';

function memoryD1() {
  const rows = new Map();
  const key = (table, id) => `${table}:${id}`;
  return {
    rows,
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() {
          if (sql.includes('SELECT value FROM vendor_work_orders_meta')) {
            return rows.get(key('meta', args[0])) || null;
          }
          if (sql.includes('SELECT kind, payload_json, expires_at FROM vendor_work_orders_auth')) {
            return rows.get(key('auth', args[0])) || null;
          }
          return null;
        },
        async all() {
          if (sql.includes('SELECT table_name, row_id, payload_json FROM vendor_work_orders_rows')) {
            return { results: [...rows.values()].filter(row => row.table_name).map(row => ({ ...row })) };
          }
          return { results: [] };
        },
        async run() {
          if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX')) return { success: true, meta: {} };
          if (sql.includes('INSERT INTO vendor_work_orders_auth')) {
            rows.set(key('auth', args[0]), { key_hash: args[0], kind: args[1], payload_json: args[2], expires_at: args[3], created_at: args[4] });
            return { success: true, meta: { changes: 1 } };
          }
          if (sql.includes('DELETE FROM vendor_work_orders_auth')) {
            rows.delete(key('auth', args[0]));
            return { success: true, meta: { changes: 1 } };
          }
          if (sql.includes('INSERT INTO vendor_work_orders_meta')) {
            rows.set(key('meta', args[0]), { key: args[0], value: args[1] });
            return { success: true, meta: { changes: 1 } };
          }
          if (sql.includes('DELETE FROM vendor_work_orders_rows')) {
            for (const [rowKey, row] of rows) if (row.table_name) rows.delete(rowKey);
            return { success: true, meta: { changes: 1 } };
          }
          if (sql.includes('INSERT INTO vendor_work_orders_rows')) {
            rows.set(key(args[0], args[1]), { table_name: args[0], row_id: args[1], workspace_id: args[2], payload_json: args[3] });
            return { success: true, meta: { changes: 1 } };
          }
          throw new Error(`Unhandled SQL: ${sql}`);
        },
      };
    },
    async batch(statements) {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    },
  };
}

function memoryR2() {
  const objects = new Map();
  return {
    objects,
    async put(key, body, options) {
      objects.set(key, { body: typeof body === 'string' ? body : new Uint8Array(await new Response(body).arrayBuffer()), options });
      return { key };
    },
    async get(key) {
      const item = objects.get(key);
      return item ? { body: new Response(item.body).body, httpMetadata: item.options?.httpMetadata } : null;
    },
    async delete(key) { objects.delete(key); },
  };
}

test('D1 state store round-trips domain rows and preserves schema version', async () => {
  const db = memoryD1();
  const store = createD1StateStore({ db });
  const initial = await store.read();
  assert.equal(initial.schema_version, 1);
  initial.partners.push({ id: 'partner-1', workspace_id: 'workspace-1', name: 'Vendor', active: true });
  await store.write(initial);
  const loaded = await store.read();
  assert.deepEqual(loaded.partners, initial.partners);
});

test('D1 auth store persists expiring browser transactions by hash', async () => {
  const db = memoryD1();
  let now = 1000;
  const store = createAuthStore({ db, clock: () => now });
  await store.put('line_browser', 'hash-1', { stateHash: 'state-1' }, 2000);
  assert.deepEqual((await store.get('line_browser', 'hash-1')).payload, { stateHash: 'state-1' });
  now = 2001;
  assert.equal(await store.get('line_browser', 'hash-1'), null);
});

test('LINE webhook crypto signs and verifies the exact body', async () => {
  const body = JSON.stringify({ events: [] });
  const signature = await signLineWebhook(body, 'secret');
  assert.equal(await verifyLineWebhook(body, signature, 'secret'), true);
  assert.equal(await verifyLineWebhook(`${body} `, signature, 'secret'), false);
});

test('private R2 attachment store writes, reads and deletes opaque keys', async () => {
  const bucket = memoryR2();
  const attachments = createPrivateAttachmentStore({ bucket });
  const saved = await attachments.put({ id: 'attachment-1', bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png' });
  assert.equal(saved.key, 'attachments/attachment-1');
  assert.ok(await attachments.get('attachment-1'));
  await attachments.delete('attachment-1');
  assert.equal(await attachments.get('attachment-1'), null);
});

test('cloud UI preserves SESSION_REQUIRED from Worker error responses', async () => {
  const app = await readFile(new URL('../_dev/vendor-work-orders-cloud/public/app.js', import.meta.url), 'utf8');
  assert.match(app, /const code = data\.code \|\| data\.error/);
  assert.match(app, /new Error\(code \|\| '無法讀取回應'\)/);
});

test('Worker exposes health and non-secret LINE status', async () => {
  const db = memoryD1();
  const worker = createWorker({
    env: { DB: db, PUBLIC_ORIGIN: 'https://workorders-test.cmwebs.com', LINE_CHANNEL_ID: '2011937202' },
  });
  const health = await worker.fetch(new Request('https://workorders-test.cmwebs.com/health'));
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, service: 'vendor-work-orders' });
  const status = await worker.fetch(new Request('https://workorders-test.cmwebs.com/api/line/status'));
  assert.equal(status.status, 200);
  const data = await status.json();
  assert.equal(data.success, true);
  assert.equal(data.data.public_origin, 'https://workorders-test.cmwebs.com');
  assert.equal(data.data.channel_id, '2011937202');
  assert.equal(Object.hasOwn(data.data, 'channel_secret'), false);
});

test('cloud diagnostic and unknown API routes never expose business state or fall back to HTML', async () => {
  let assetCalls = 0;
  const worker = createWorker({ env: {
    DB: memoryD1(), PUBLIC_ORIGIN: 'https://workorders-test.cmwebs.com',
    ASSETS: { fetch: async () => { assetCalls++; return new Response('<html>app</html>'); } },
  } });
  for (const path of ['/api/cloud/state', '/api/partners', '/auth/unknown']) {
    const response = await worker.fetch(new Request(`https://workorders-test.cmwebs.com${path}`));
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { success: false, error: 'NOT_FOUND' });
  }
  assert.equal(assetCalls, 0);
});
