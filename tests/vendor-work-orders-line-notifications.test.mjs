import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInitialState } from '../_dev/vendor-work-orders/domain.mjs';
import { verifyWebhook, applyWebhookEvents } from '../_dev/vendor-work-orders/line-webhook.mjs';
import { dispatchLineNotification } from '../_dev/vendor-work-orders/line-notifications.mjs';
import { createVendorWorkOrderServer } from '../_dev/vendor-work-orders/server.mjs';

const secret = 'synthetic-channel-secret';
const at = '2026-10-08T04:00:00.000Z';
const signature = body => createHmac('sha256', secret).update(body).digest('base64');
const event = (id, type, timestamp, subject = 'U' + 'a'.repeat(32)) => ({
  webhookEventId: id, type, timestamp, provider_id: 'provider-test', source: { type: 'user', userId: subject },
});

function stateWithLineTables() {
  const state = createInitialState();
  state.line_presence.push({ provider_id: 'provider-test', subject: 'U' + 'a'.repeat(32), following: true,
    event_timestamp: 100, event_id: 'follow-1', updated_at: at });
  return state;
}

function approvedLineMember(state, subject = 'U' + 'a'.repeat(32)) {
  state.partners.push({ id: 'company-a', type: 'company', name: 'Synthetic Repair Company A', active: true });
  state.workspace_partners.push({ workspace_id: 'ws-a', partner_id: 'company-a', active: true });
  state.partner_memberships.push({ actor_id: `line-${createHash('sha256').update(JSON.stringify(['provider-test', subject])).digest('hex')}`,
    workspace_id: 'ws-a', partner_id: 'company-a', member_role: 'worker', active: true });
}

test('webhook_signature_uses_raw_body_and_rejects_forgery', () => {
  const body = '{"events":[{"type":"follow"}]}';
  assert.equal(verifyWebhook(body, signature(body), secret), true);
  assert.equal(verifyWebhook(body, signature(body + ' '), secret), false);
  assert.equal(verifyWebhook(body, signature(body), 'wrong-secret'), false);
  assert.equal(verifyWebhook(Buffer.from(body), signature(body), secret), false);
});

test('webhook_events_are_deduplicated_follow_does_not_grant_membership_and_old_events_do_not_override', () => {
  const state = stateWithLineTables();
  const newer = event('unfollow-2', 'unfollow', 200);
  const older = event('follow-0', 'follow', 150);
  const next = applyWebhookEvents(state, [newer, newer, older], 300);
  assert.equal(next.line_webhook_events.length, 2);
  assert.equal(next.line_presence[0].following, false);
  assert.equal(next.line_presence[0].event_timestamp, 200);
  assert.equal(next.partner_memberships.length, 0);
  const replay = applyWebhookEvents(next, [event('follow-3', 'follow', 150)], 301);
  assert.equal(replay.line_presence[0].following, false);
  assert.equal(replay.line_webhook_events.length, 3);
});

test('notification_requires_enabled_allowlisted_following_active_membership', async () => {
  const subject = 'U' + 'a'.repeat(32);
  const state = stateWithLineTables(); approvedLineMember(state, subject);
  const entry = { id: 'notice-1', workspace_id: 'ws-a', partner_id: 'company-a', work_order_id: 'wo-1', event_id: 'event-1',
    recipient_type: 'line_subject', recipient_id: subject, provider_id: 'provider-test', message: 'Work order repair: update available.' };
  const calls = [];
  const transport = { async push(input) { calls.push(input); return { accepted: true }; } };
  const base = { enabled: true, providerId: 'provider-test', allowlistedSubjects: [subject], publicOrigin: 'https://workorders.example.test' };
  assert.equal((await dispatchLineNotification({ entry, state, config: { ...base, enabled: false }, transport })).status, 'disabled');
  assert.equal((await dispatchLineNotification({ entry, state, config: { ...base, allowlistedSubjects: [] }, transport })).status, 'skipped');
  state.line_presence[0].following = false;
  assert.equal((await dispatchLineNotification({ entry, state, config: base, transport })).status, 'skipped');
  state.line_presence[0].following = true;
  state.partner_memberships[0].active = false;
  assert.equal((await dispatchLineNotification({ entry, state, config: base, transport })).status, 'skipped');
  assert.equal(calls.length, 0);
});

test('notification_timeout_is_unknown_and_reuses_stable_retry_key', async () => {
  const subject = 'U' + 'a'.repeat(32);
  const state = stateWithLineTables(); approvedLineMember(state, subject);
  const entry = { id: 'notice-timeout', workspace_id: 'ws-a', partner_id: 'company-a', work_order_id: 'wo-1', event_id: 'event-1',
    recipient_type: 'line_subject', recipient_id: subject, provider_id: 'provider-test', message: 'Work order cleaning: update available.' };
  const calls = [];
  const transport = { async push(input) { calls.push(input); throw Object.assign(new Error('timeout'), { code: 'TIMEOUT' }); } };
  const config = { enabled: true, providerId: 'provider-test', allowlistedSubjects: [subject], publicOrigin: 'https://workorders.example.test' };
  const first = await dispatchLineNotification({ entry, state, config, transport });
  const second = await dispatchLineNotification({ entry, state, config, transport });
  assert.equal(first.status, 'unknown');
  assert.equal(second.status, 'unknown');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].retryKey, calls[1].retryKey);
  assert.equal(calls[0].retryKey, 'line:notice-timeout');
  assert.equal(calls[0].message.includes('wo-1'), false);
});

test('server_verifies_raw_webhook_before_persisting_events_and_deduplicates', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'vendor-line-webhook-'));
  const server = createVendorWorkOrderServer({ dataFile: join(dir, 'state.json'), developmentMode: true,
    lineWebhookConfig: { channelSecret: secret, providerId: 'provider-test' } });
  await server.start();
  t.after(async () => { await server.close(); await rm(dir, { recursive: true }); });
  const body = JSON.stringify({ events: [event('route-follow-1', 'follow', 500)] });
  let response = await fetch(`http://127.0.0.1:${server.address().port}/api/line/webhook`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-line-signature': signature(body) }, body,
  });
  assert.equal(response.status, 200);
  response = await fetch(`http://127.0.0.1:${server.address().port}/api/line/webhook`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-line-signature': signature(body + 'x') }, body,
  });
  assert.equal(response.status, 401);
  const saved = await server.store.readSnapshot();
  assert.equal(saved.line_webhook_events.length, 1);
  assert.equal(saved.line_presence[0].following, true);
});
