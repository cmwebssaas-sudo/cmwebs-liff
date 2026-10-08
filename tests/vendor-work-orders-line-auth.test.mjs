import test from 'node:test';
import assert from 'node:assert/strict';
import { createLineAuth, createLineIdentityAdapter } from '../_dev/vendor-work-orders/line-auth.mjs';

const config = { channelId: '1234567890', channelSecret: 'synthetic-secret', providerId: 'synthetic-provider',
  messagingProviderId: 'synthetic-provider', publicOrigin: 'https://workorders.example.test',
  redirectUri: 'https://workorders.example.test/auth/line/callback' };
const identity = { provider_id: 'synthetic-provider', subject: 'U' + 'a'.repeat(32) };
function setup() {
  let now = 1000000;
  let count = 0;
  const auth = createLineAuth({ config, clock: () => now, identityAdapter: {
    async exchangeAndVerify(input) {
      count++;
      assert.ok(input.nonce); assert.equal(input.redirectUri, config.redirectUri);
      assert.match(input.codeVerifier, /^[A-Za-z0-9_-]{43}$/);
      return identity;
    },
  } });
  return { auth, expire: () => { now += 600001; }, count: () => count };
}
test('LINE login uses state, nonce and PKCE; verified callback is single use and session-bound', async () => {
  const { auth, count } = setup();
  const start = auth.begin({ inviteToken: 'a'.repeat(43), sessionId: 'browser-a' });
  const url = new URL(start.authorizationUrl);
  assert.equal(url.origin, 'https://access.line.me');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(url.searchParams.get('nonce'));
  assert.equal(url.searchParams.has('client_secret'), false);
  const state = url.searchParams.get('state');
  await assert.rejects(auth.complete({ state, code: 'code-a', sessionId: 'browser-b' }), { code: 'INVALID_AUTH_TRANSACTION' });
  const result = await auth.complete({ state, code: 'code-a', sessionId: 'browser-a' });
  assert.deepEqual(result, { identity, inviteToken: 'a'.repeat(43) });
  await assert.rejects(auth.complete({ state, code: 'code-a', sessionId: 'browser-a' }), { code: 'INVALID_AUTH_TRANSACTION' });
  assert.equal(count(), 1);
});
test('expired transactions and mismatched Provider never authorize', async () => {
  const s = setup(); const start = s.auth.begin({ sessionId: 'browser-a' }); s.expire();
  await assert.rejects(s.auth.complete({ state: new URL(start.authorizationUrl).searchParams.get('state'), code: 'a', sessionId: 'browser-a' }), { code: 'INVALID_AUTH_TRANSACTION' });
  assert.equal(s.count(), 0);
  assert.throws(() => createLineAuth({ config: { ...config, messagingProviderId: 'different' } }), { code: 'LINE_NOT_CONFIGURED' });
  assert.throws(() => createLineAuth({ config: { ...config, redirectUri: 'https://other.test/auth/line/callback' } }), { code: 'LINE_NOT_CONFIGURED' });
});
test('a consumed authorization code cannot be used with a fresh state', async () => {
  const { auth } = setup();
  const first = auth.begin({ sessionId: 'browser-a' });
  await auth.complete({ code: 'used-code', state: new URL(first.authorizationUrl).searchParams.get('state'), sessionId: 'browser-a' });
  const next = auth.begin({ sessionId: 'browser-a' });
  await assert.rejects(auth.complete({ code: 'used-code', state: new URL(next.authorizationUrl).searchParams.get('state'), sessionId: 'browser-a' }), { code: 'INVALID_AUTH_TRANSACTION' });
});
test('official adapter verifies token audience, nonce, issuer and expiry without returning secrets', async () => {
  for (const bad of [null, { aud: 'other' }, { nonce: 'other' }, { iss: 'https://evil.test' }, { exp: 999 }, { sub: 'not-a-line-id' }]) {
    const calls = [];
    const adapter = createLineIdentityAdapter({ config, clock: () => 1000000, fetchImpl: async (url, opts) => {
      calls.push([url, new URLSearchParams(opts.body)]);
      const payload = url.endsWith('/token') ? { id_token: 'synthetic-id-token' } :
        { iss: 'https://access.line.me', sub: identity.subject, aud: config.channelId, exp: 2000, iat: 990, nonce: 'expected', ...bad };
      return { ok: true, json: async () => payload };
    } });
    if (bad === null) {
      assert.deepEqual(await adapter.exchangeAndVerify({ code: 'one-code', nonce: 'expected', codeVerifier: 'a'.repeat(43), redirectUri: config.redirectUri }), identity);
      assert.equal(calls[1][1].get('nonce'), 'expected');
      assert.equal(calls[0][1].get('code_verifier'), 'a'.repeat(43));
    } else await assert.rejects(adapter.exchangeAndVerify({ code: 'one-code', nonce: 'expected', codeVerifier: 'a'.repeat(43), redirectUri: config.redirectUri }), { code: 'LINE_IDENTITY_REJECTED' });
  }
});
