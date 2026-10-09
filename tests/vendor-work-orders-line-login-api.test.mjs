import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createVendorWorkOrderServer } from '../_dev/vendor-work-orders/server.mjs';
import { createBindingInvite, approveBinding } from '../_dev/vendor-work-orders/line-binding.mjs';

const config = { channelId: '1234567890', channelSecret: 'synthetic-secret', providerId: 'provider-test',
  messagingProviderId: 'provider-test', publicOrigin: 'https://workorders.example.test',
  redirectUri: 'https://workorders.example.test/auth/line/callback' };
test('verified LINE callback requires explicit binding confirmation and landlord approval before accessing orders', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'vendor-line-login-'));
  const s = createVendorWorkOrderServer({ developmentMode: true, dataFile: join(dir, 'state.json'), lineConfig: config,
    lineIdentityAdapter: { async exchangeAndVerify() { return { provider_id: 'provider-test', subject: 'U' + 'b'.repeat(32) }; } } });
  await s.start(); t.after(async () => { await s.close(); await rm(dir, { recursive: true }); });
  const origin = `http://127.0.0.1:${s.address().port}`;
  let token;
  await s.store.transact(state => {
    const result = createBindingInvite(state, { role: 'landlord', workspace_id: 'ws-a', actor_id: 'landlord-a' },
      { partner_id: 'company-a', member_role: 'worker' }, Date.now()); token = result.token; return result.state;
  });
  const start = await fetch(`${origin}/auth/line/start?invite=${token}`, { redirect: 'manual' });
  assert.equal(start.status, 302);
  const cookie = start.headers.get('set-cookie').split(';')[0];
  assert.match(start.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax/);
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const dev = await fetch(`${origin}/api/dev/session`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'login-conflict' }, body: JSON.stringify({ principal: 'landlord_a' }) });
  const devCookie = dev.headers.get('set-cookie').split(';')[0];
  const mismatch = await fetch(`${origin}/auth/line/callback?state=${state}&code=synthetic-code`, { redirect: 'manual', headers: { Cookie: `${cookie}; ${devCookie}` } });
  assert.equal(mismatch.status, 403, 'an existing logged-in identity cannot be replaced by a binding callback');
  const cb = await fetch(`${origin}/auth/line/callback?state=${state}&code=synthetic-code`, { redirect: 'manual', headers: { Cookie: cookie } });
  assert.equal(cb.status, 303);
  assert.equal((await s.store.readSnapshot()).line_binding_requests.length, 0);
  assert.equal((await fetch(`${origin}/api/work-orders`, { headers: { Cookie: cookie } })).status, 401);
  const pending = await (await fetch(`${origin}/api/line/pending`, { headers: { Cookie: cookie } })).json();
  assert.equal(pending.data.partner_name, 'Synthetic Repair Company A');
  assert.equal(JSON.stringify(pending).includes('U' + 'b'.repeat(32)), false);
  const denied = await fetch(`${origin}/api/line/confirm`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ csrf: 'forged' }) });
  assert.equal(denied.status, 403);
  const confirm = () => fetch(`${origin}/api/line/confirm`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ csrf: pending.data.csrf }) });
  assert.equal((await confirm()).status, 200);
  assert.equal((await confirm()).status, 200);
  let saved = await s.store.readSnapshot();
  assert.equal(saved.line_binding_requests.length, 1);
  assert.equal(saved.partner_memberships.some(m => m.actor_id.startsWith('line-')), false);
  await s.store.transact(state => approveBinding(state, { role: 'landlord', workspace_id: 'ws-a', actor_id: 'landlord-a' }, saved.line_binding_requests[0].id, Date.now()).state);
  const again = await fetch(`${origin}/auth/line/start`, { redirect: 'manual' });
  const newCookie = again.headers.get('set-cookie').split(';')[0];
  const newState = new URL(again.headers.get('location')).searchParams.get('state');
  const accepted = await fetch(`${origin}/auth/line/callback?state=${newState}&code=second-code`, { redirect: 'manual', headers: { Cookie: newCookie } });
  assert.equal(accepted.status, 303);
  const sessionCookie = accepted.headers.get('set-cookie').split(';')[0];
  const session = await (await fetch(`${origin}/api/session`, { headers: { Cookie: sessionCookie } })).json();
  assert.equal(session.data.actor.member_role, 'worker');
  assert.equal(session.data.actor.partner_id, 'company-a');
});
test('unconfigured LINE entry fails closed instead of pretending to log in', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'vendor-line-off-'));
  const s = createVendorWorkOrderServer({ dataFile: join(dir, 'state.json') }); await s.start();
  t.after(async () => { await s.close(); await rm(dir, { recursive: true }); });
  const r = await fetch(`http://127.0.0.1:${s.address().port}/auth/line/start`, { redirect: 'manual' });
  assert.equal(r.status, 503); assert.equal((await r.json()).code, 'LINE_NOT_CONFIGURED');
});
