import test from 'node:test';
import assert from 'node:assert/strict';

import { createLineLogin } from '../_dev/vendor-work-orders-cloud/src/line-auth-worker.mjs';

const config = {
  channelId: '2011937202',
  publicOrigin: 'https://workorders-test.cmwebs.com',
  providerId: '1631758156',
};

test('cloud LINE login creates PKCE transaction data without exposing the secret', async () => {
  const login = createLineLogin({ ...config, channelSecret: 'secret' });
  const transaction = await login.begin({ browserToken: 'browser-token' });
  const url = new URL(transaction.authorizationUrl);
  assert.equal(url.origin, 'https://access.line.me');
  assert.equal(url.searchParams.get('client_id'), config.channelId);
  assert.equal(url.searchParams.get('redirect_uri'), `${config.publicOrigin}/auth/line/callback`);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.has('client_secret'), false);
  assert.ok(transaction.stateHash);
  assert.ok(transaction.nonce);
  assert.ok(transaction.codeVerifier);
  assert.equal(JSON.stringify(transaction).includes('secret'), false);
});

test('cloud LINE login exchanges and verifies token claims', async () => {
  const login = createLineLogin({ ...config, channelSecret: 'secret' });
  const transaction = await login.begin({ browserToken: 'browser-token' });
  const calls = [];
  const identity = await login.complete({ transaction, code: 'code', fetchImpl: async (url, options) => {
    calls.push([url, options]);
    return { ok: true, json: async () => url.endsWith('/token')
      ? { id_token: 'synthetic-token' }
      : { iss: 'https://access.line.me', aud: config.channelId, sub: 'U' + 'a'.repeat(32), nonce: transaction.nonce,
          exp: Math.floor(Date.now() / 1000) + 600, iat: Math.floor(Date.now() / 1000) - 5 } };
  } });
  assert.deepEqual(identity.identity, { provider_id: config.providerId, subject: 'U' + 'a'.repeat(32) });
  assert.equal(calls.length, 2);
  assert.match(calls[0][1].body, /client_secret=secret/);
});
