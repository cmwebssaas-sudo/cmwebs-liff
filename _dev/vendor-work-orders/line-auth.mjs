import { randomBytes, createHash } from 'node:crypto';
const fail = code => { throw Object.assign(new Error(code), { code }); };
const random = () => randomBytes(32).toString('base64url');
const sha = value => createHash('sha256').update(value).digest('base64url');
const subjectPattern = /^U[0-9a-f]{32}$/;
function checkedConfig(config) {
  try {
    const origin = new URL(config.publicOrigin), callback = new URL(config.redirectUri);
    if (origin.protocol !== 'https:' || origin.origin !== config.publicOrigin || origin.username || origin.password ||
        callback.href !== `${origin.origin}/auth/line/callback` || !/^\d{5,20}$/.test(config.channelId) ||
        typeof config.channelSecret !== 'string' || !config.channelSecret ||
        typeof config.providerId !== 'string' || !config.providerId || config.providerId !== config.messagingProviderId) throw new Error();
    return { ...config };
  } catch { fail('LINE_NOT_CONFIGURED'); }
}
/** Secrets and ID tokens stay in this server adapter; only verified identity leaves it.
 * Provider pairing is a deployment check: LINE's token payload has no Provider ID. */
export function createLineIdentityAdapter({ config, fetchImpl = fetch, clock = Date.now }) {
  const c = checkedConfig(config);
  async function post(endpoint, fields) {
    try {
      const r = await fetchImpl(`https://api.line.me/oauth2/v2.1/${endpoint}`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString(),
      });
      if (!r.ok) fail('LINE_IDENTITY_REJECTED');
      return await r.json();
    } catch { fail('LINE_IDENTITY_REJECTED'); }
  }
  return {
    async exchangeAndVerify({ code, nonce, codeVerifier, redirectUri }) {
      if (redirectUri !== c.redirectUri || typeof code !== 'string' || !code || code.length > 2048 ||
          typeof nonce !== 'string' || !nonce || !/^[A-Za-z0-9_-]{43}$/.test(codeVerifier)) fail('LINE_IDENTITY_REJECTED');
      const tokens = await post('token', { grant_type: 'authorization_code', code, redirect_uri: c.redirectUri,
        client_id: c.channelId, client_secret: c.channelSecret, code_verifier: codeVerifier });
      if (typeof tokens?.id_token !== 'string' || !tokens.id_token || tokens.id_token.length > 16384) fail('LINE_IDENTITY_REJECTED');
      const claims = await post('verify', { id_token: tokens.id_token, client_id: c.channelId, nonce });
      const seconds = Math.floor(clock() / 1000);
      if (claims?.iss !== 'https://access.line.me' || claims.aud !== c.channelId || claims.nonce !== nonce ||
          !subjectPattern.test(claims.sub) || !Number.isSafeInteger(claims.exp) || claims.exp <= seconds ||
          !Number.isSafeInteger(claims.iat) || claims.iat > seconds + 60 || claims.iat > claims.exp) fail('LINE_IDENTITY_REJECTED');
      return { provider_id: c.providerId, subject: claims.sub };
    },
  };
}
/** Short-lived, browser-bound state; restarts invalidate outstanding transactions. */
export function createLineAuth({ config, identityAdapter, clock = Date.now }) {
  const c = checkedConfig(config);
  const adapter = identityAdapter || createLineIdentityAdapter({ config: c, clock });
  const transactions = new Map();
  const usedCodes = new Map();
  function cleanup() {
    for (const [key, value] of transactions) if (value.expiresAt <= clock()) transactions.delete(key);
    for (const [key, expiry] of usedCodes) if (expiry <= clock()) usedCodes.delete(key);
  }
  return {
    begin({ inviteToken, sessionId }) {
      cleanup();
      if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 256 ||
          inviteToken !== undefined && !/^[A-Za-z0-9_-]{43}$/.test(inviteToken)) fail('INVALID_AUTH_TRANSACTION');
      if (transactions.size >= 1000) fail('AUTH_BUSY');
      const state = random(), nonce = random(), verifier = random();
      transactions.set(sha(state), { nonce, verifier, sessionHash: sha(sessionId), inviteToken, expiresAt: clock() + 600000 });
      const url = new URL('https://access.line.me/oauth2/v2.1/authorize');
      url.search = new URLSearchParams({ response_type: 'code', client_id: c.channelId,
        redirect_uri: c.redirectUri, state, scope: 'openid', nonce,
        code_challenge: sha(verifier), code_challenge_method: 'S256' }).toString();
      return { authorizationUrl: url.href };
    },
    async complete({ code, state, sessionId }) {
      cleanup();
      if (typeof state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(state) ||
          typeof sessionId !== 'string' || !sessionId || typeof code !== 'string' || !code || code.length > 2048) fail('INVALID_AUTH_TRANSACTION');
      const key = sha(state), tx = transactions.get(key);
      if (!tx || tx.sessionHash !== sha(sessionId)) fail('INVALID_AUTH_TRANSACTION');
      if (usedCodes.has(sha(code))) fail('INVALID_AUTH_TRANSACTION');
      if (usedCodes.size >= 1000) fail('AUTH_BUSY');
      // Consume before network IO: parallel callbacks and unknown exchanges cannot replay.
      transactions.delete(key);
      usedCodes.set(sha(code), clock() + 600000);
      const identity = await adapter.exchangeAndVerify({ code, nonce: tx.nonce, codeVerifier: tx.verifier, redirectUri: c.redirectUri });
      if (identity?.provider_id !== c.providerId || !subjectPattern.test(identity.subject)) fail('LINE_IDENTITY_REJECTED');
      return { identity: { provider_id: identity.provider_id, subject: identity.subject }, inviteToken: tx.inviteToken };
    },
  };
}
