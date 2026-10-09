import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorker } from '../_dev/vendor-work-orders-cloud/src/worker.mjs';
import { hashToken, sha256Hex } from '../_dev/vendor-work-orders-cloud/src/line-auth-worker.mjs';
import { signLineWebhook } from '../_dev/vendor-work-orders-cloud/src/line-crypto.mjs';

function authDb() {
  const rows = new Map();
  return {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() {
          if (sql.includes('SELECT kind, payload_json, expires_at FROM vendor_work_orders_auth')) return rows.get(args[0]) || null;
          return null;
        },
        async all() { return { results: [] }; },
        async run() {
          if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX')) return { success: true };
          if (sql.includes('INSERT INTO vendor_work_orders_auth')) {
            rows.set(args[0], { kind: args[1], payload_json: args[2], expires_at: args[3] });
            return { success: true };
          }
          if (sql.includes('DELETE FROM vendor_work_orders_auth')) { rows.delete(args[0]); return { success: true }; }
          if (sql.includes('DELETE FROM vendor_work_orders_rows')) return { success: true };
          if (sql.includes('INSERT INTO vendor_work_orders_meta')) return { success: true };
          if (sql.includes('CREATE')) return { success: true };
          throw new Error(`Unhandled SQL: ${sql}`);
        },
      };
    },
    async batch(statements) { return Promise.all(statements.map(statement => statement.run())); },
  };
}

function cloudDb(initial = []) {
  const auth = new Map();
  const rows = initial.map(({ table_name, row_id, payload_json }) => ({ table_name, row_id, payload_json }));
  return {
    seedAuth(key, value) { auth.set(key, value); },
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() {
          if (sql.includes('SELECT kind, payload_json, expires_at FROM vendor_work_orders_auth')) return auth.get(args[0]) || null;
          return null;
        },
        async all() {
          if (sql.includes('SELECT table_name, row_id, payload_json FROM vendor_work_orders_rows')) return { results: rows };
          return { results: [] };
        },
        async run() {
          if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX')) return { success: true };
          if (sql.includes('INSERT INTO vendor_work_orders_auth')) {
            auth.set(args[0], { kind: args[1], payload_json: args[2], expires_at: args[3] });
            return { success: true };
          }
          if (sql.includes('DELETE FROM vendor_work_orders_auth')) { auth.delete(args[0]); return { success: true }; }
          if (sql.includes('INSERT INTO vendor_work_orders_meta')) return { success: true };
          if (sql.includes('DELETE FROM vendor_work_orders_rows')) { rows.splice(0); return { success: true }; }
          if (sql.includes('INSERT INTO vendor_work_orders_rows')) {
            rows.push({ table_name: args[0], row_id: args[1], payload_json: args[3] });
            return { success: true };
          }
          throw new Error(`Unhandled SQL: ${sql}`);
        },
      };
    },
    async batch(statements) { return Promise.all(statements.map(statement => statement.run())); },
  };
}

test('Worker starts LINE Login with a secure browser transaction cookie', async () => {
  const worker = createWorker({ env: {
    DB: authDb(), PUBLIC_ORIGIN: 'https://workorders-test.cmwebs.com', LINE_CHANNEL_ID: '2011937202',
    LINE_CHANNEL_SECRET: 'secret', LINE_PROVIDER_ID: '1631758156',
  }});
  const response = await worker.fetch(new Request('https://workorders-test.cmwebs.com/auth/line/start'));
  assert.equal(response.status, 302);
  assert.equal(new URL(response.headers.get('location')).origin, 'https://access.line.me');
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /vendor_line_browser=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.doesNotMatch(response.headers.get('location'), /secret/);
});

test('Worker callback creates a D1-backed session and session endpoint reads it', async () => {
  const subject = 'U' + 'a'.repeat(32);
  const providerId = '1631758156';
  const actorId = `line-${await sha256Hex(JSON.stringify([providerId, subject]))}`;
  const db = cloudDb([{ table_name: 'partner_memberships', row_id: 'membership-1', payload_json: JSON.stringify({
    actor_id: actorId, workspace_id: 'workspace-1', partner_id: 'partner-1', member_role: 'manager', active: true,
  }) }, { table_name: 'partners', row_id: 'partner-1', payload_json: JSON.stringify({ id: 'partner-1', active: true }) },
  { table_name: 'workspace_partners', row_id: 'link-1', payload_json: JSON.stringify({ workspace_id: 'workspace-1', partner_id: 'partner-1', active: true }) }]);
  const now = Math.floor(Date.now() / 1000);
  const worker = createWorker({ env: {
    DB: db, PUBLIC_ORIGIN: 'https://workorders-test.cmwebs.com', LINE_CHANNEL_ID: '2011937202',
    LINE_CHANNEL_SECRET: 'secret', LINE_PROVIDER_ID: providerId,
  }, lineFetchImpl: async (url, options) => ({ ok: true, json: async () => url.endsWith('/token') ? { id_token: 'token' } : {
    iss: 'https://access.line.me', aud: '2011937202', sub: subject,
    nonce: new URLSearchParams(options.body).get('nonce'), exp: now + 600, iat: now,
  } }) });
  const start = await worker.fetch(new Request('https://workorders-test.cmwebs.com/auth/line/start'));
  const startUrl = new URL(start.headers.get('location'));
  const browserCookie = start.headers.get('set-cookie').split(';')[0];
  const callback = await worker.fetch(new Request(`https://workorders-test.cmwebs.com/auth/line/callback?code=code&state=${encodeURIComponent(startUrl.searchParams.get('state'))}`, { headers: { cookie: browserCookie } }));
  assert.equal(callback.status, 303);
  const sessionCookie = callback.headers.get('set-cookie').split(';')[0];
  assert.match(sessionCookie, /^vendor_session=/);
  const session = await worker.fetch(new Request('https://workorders-test.cmwebs.com/api/session', { headers: { cookie: sessionCookie } }));
  assert.equal(session.status, 200);
  assert.equal((await session.json()).data.actor.workspace_id, 'workspace-1');
});

test('Worker verifies LINE webhook signature and deduplicates event IDs in D1', async () => {
  const db = cloudDb();
  const worker = createWorker({ env: {
    DB: db, PUBLIC_ORIGIN: 'https://workorders-test.cmwebs.com', LINE_CHANNEL_ID: '2011937202',
    LINE_CHANNEL_SECRET: 'secret', LINE_PROVIDER_ID: '1631758156',
  }, clock: () => 1000000 });
  const body = JSON.stringify({ events: [{ webhookEventId: 'evt-1', type: 'follow', timestamp: 1000,
    source: { type: 'user', userId: 'U' + 'a'.repeat(32) } }] });
  const signature = await signLineWebhook(body, 'secret');
  const headers = { 'content-type': 'application/json', 'x-line-signature': signature };
  const accepted = await worker.fetch(new Request('https://workorders-test.cmwebs.com/api/line/webhook', { method: 'POST', headers, body }));
  assert.equal(accepted.status, 200);
  const duplicate = await worker.fetch(new Request('https://workorders-test.cmwebs.com/api/line/webhook', { method: 'POST', headers, body }));
  assert.equal(duplicate.status, 200);
  const rejected = await worker.fetch(new Request('https://workorders-test.cmwebs.com/api/line/webhook', { method: 'POST', headers: { ...headers, 'x-line-signature': 'bad' }, body }));
  assert.equal(rejected.status, 401);
});

test('Worker reads a workspace-scoped assigned work order for a vendor session', async () => {
  const actorId = 'line-' + 'b'.repeat(64);
  const db = cloudDb([
    { table_name: 'partners', row_id: 'partner-1', payload_json: JSON.stringify({ id: 'partner-1', active: true, type: 'company', name: 'Vendor' }) },
    { table_name: 'workspace_partners', row_id: 'link-1', payload_json: JSON.stringify({ workspace_id: 'workspace-1', partner_id: 'partner-1', active: true }) },
    { table_name: 'partner_memberships', row_id: 'member-1', payload_json: JSON.stringify({ actor_id: actorId, workspace_id: 'workspace-1', partner_id: 'partner-1', member_role: 'manager', active: true }) },
    { table_name: 'work_orders', row_id: 'order-1', payload_json: JSON.stringify({ id: 'order-1', workspace_id: 'workspace-1', title: 'Fix sink', trade: 'repair', trade_name: '', area: 'kitchen', location: 'A', instructions: '', status: 'assigned', version: 1, created_at: '2026-10-10T00:00:00.000Z', updated_at: '2026-10-10T00:00:00.000Z' }) },
    { table_name: 'assignments', row_id: 'assignment-1', payload_json: JSON.stringify({ id: 'assignment-1', workspace_id: 'workspace-1', work_order_id: 'order-1', partner_id: 'partner-1', assigned_actor_id: actorId, status: 'assigned', approved_amount_twd: 1000 }) },
  ]);
  const token = 'session-token';
  db.seedAuth(await hashToken(token), { kind: 'vendor_session', payload_json: JSON.stringify({ actor: { role: 'vendor', actor_id: actorId, workspace_id: 'workspace-1', partner_id: 'partner-1' } }), expires_at: Date.now() + 100000 });
  const worker = createWorker({ env: { DB: db, PUBLIC_ORIGIN: 'https://workorders-test.cmwebs.com' } });
  const response = await worker.fetch(new Request('https://workorders-test.cmwebs.com/api/work-orders/order-1', { headers: { cookie: `vendor_session=${token}` } }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.id, 'order-1');
});

test('Worker applies vendor assignment actions with D1 idempotency replay', async () => {
  const actorId = 'line-' + 'c'.repeat(64);
  const db = cloudDb([
    { table_name: 'partners', row_id: 'partner-1', payload_json: JSON.stringify({ id: 'partner-1', active: true, type: 'company', name: 'Vendor' }) },
    { table_name: 'workspace_partners', row_id: 'link-1', payload_json: JSON.stringify({ workspace_id: 'workspace-1', partner_id: 'partner-1', active: true }) },
    { table_name: 'partner_memberships', row_id: 'member-1', payload_json: JSON.stringify({ actor_id: actorId, workspace_id: 'workspace-1', partner_id: 'partner-1', member_role: 'manager', active: true }) },
    { table_name: 'work_orders', row_id: 'order-1', payload_json: JSON.stringify({ id: 'order-1', workspace_id: 'workspace-1', title: 'Fix sink', trade: 'repair', trade_name: '', area: 'kitchen', location: 'A', instructions: '', status: 'assigned', version: 1, created_at: '2026-10-10T00:00:00.000Z', updated_at: '2026-10-10T00:00:00.000Z' }) },
    { table_name: 'assignments', row_id: 'assignment-1', payload_json: JSON.stringify({ id: 'assignment-1', workspace_id: 'workspace-1', work_order_id: 'order-1', partner_id: 'partner-1', assigned_actor_id: actorId, status: 'assigned', approved_amount_twd: 1000 }) },
  ]);
  const token = 'session-token';
  db.seedAuth(await hashToken(token), { kind: 'vendor_session', payload_json: JSON.stringify({ actor: { role: 'vendor', actor_id: actorId, workspace_id: 'workspace-1', partner_id: 'partner-1' } }), expires_at: Date.now() + 100000 });
  const worker = createWorker({ env: { DB: db, PUBLIC_ORIGIN: 'https://workorders-test.cmwebs.com' } });
  const request = () => new Request('https://workorders-test.cmwebs.com/api/assignments/assignment-1/start', { method: 'POST', headers: {
    cookie: `vendor_session=${token}`, 'content-type': 'application/json', 'idempotency-key': 'start-1',
  }, body: JSON.stringify({ expected_version: 1 }) });
  const first = await worker.fetch(request());
  assert.equal(first.status, 200);
  assert.equal((await first.json()).data.status, 'in_progress');
  const replay = await worker.fetch(request());
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).data.status, 'in_progress');
});
