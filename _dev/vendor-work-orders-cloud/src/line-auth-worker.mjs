const encoder = new TextEncoder();
const subjectPattern = /^U[0-9a-f]{32}$/;

function fail(code) { throw Object.assign(new Error(code), { code }); }

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

export function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function hashToken(value) { return sha256Base64Url(value); }

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function checkedConfig(config) {
  try {
    const origin = new URL(config.publicOrigin);
    if (origin.protocol !== 'https:' || origin.origin !== config.publicOrigin || origin.username || origin.password ||
        !/^\d{5,20}$/u.test(config.channelId) || typeof config.channelSecret !== 'string' || !config.channelSecret ||
        typeof config.providerId !== 'string' || !config.providerId) throw new Error();
    return { ...config, redirectUri: `${origin.origin}/auth/line/callback` };
  } catch { fail('LINE_NOT_CONFIGURED'); }
}

export function createLineLogin(config) {
  const checked = checkedConfig(config);
  return {
    async begin({ browserToken, inviteToken } = {}) {
      if (typeof browserToken !== 'string' || !browserToken || browserToken.length > 256 ||
          inviteToken !== undefined && !/^[A-Za-z0-9_-]{43}$/u.test(inviteToken)) fail('INVALID_AUTH_TRANSACTION');
      const state = randomToken();
      const nonce = randomToken();
      const codeVerifier = randomToken();
      const authorization = new URL('https://access.line.me/oauth2/v2.1/authorize');
      authorization.search = new URLSearchParams({ response_type: 'code', client_id: checked.channelId,
        redirect_uri: checked.redirectUri, state, scope: 'openid', nonce,
        code_challenge: await sha256Base64Url(codeVerifier), code_challenge_method: 'S256' }).toString();
      return { authorizationUrl: authorization.href, browserToken, stateHash: await sha256Base64Url(state), nonce, codeVerifier, inviteToken };
    },
    async complete({ transaction, code, state, fetchImpl = fetch, now = Date.now } = {}) {
      if (!transaction || typeof transaction.stateHash !== 'string' || typeof transaction.nonce !== 'string' ||
          typeof transaction.codeVerifier !== 'string' || typeof code !== 'string' || !code || code.length > 2048) {
        fail('INVALID_AUTH_TRANSACTION');
      }
      if (state !== undefined && await sha256Base64Url(state) !== transaction.stateHash) fail('INVALID_AUTH_TRANSACTION');
      async function post(endpoint, fields) {
        let response;
        try {
          response = await fetchImpl(`https://api.line.me/oauth2/v2.1/${endpoint}`, {
            method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(fields).toString(),
          });
        } catch {
          console.error('LINE API request failed', endpoint);
          fail('LINE_IDENTITY_REJECTED');
        }
        if (!response?.ok) {
          let apiError = 'unknown';
          try {
            const payload = await response.json();
            if (typeof payload?.error === 'string' && payload.error.length <= 64) apiError = payload.error;
          } catch { /* Keep provider response details out of the client and logs when unavailable. */ }
          console.error('LINE API rejected', endpoint, response.status, apiError);
          fail('LINE_IDENTITY_REJECTED');
        }
        try { return await response.json(); } catch { fail('LINE_IDENTITY_REJECTED'); }
      }
      const tokens = await post('token', { grant_type: 'authorization_code', code, redirect_uri: checked.redirectUri,
        client_id: checked.channelId, client_secret: checked.channelSecret, code_verifier: transaction.codeVerifier });
      if (typeof tokens?.id_token !== 'string' || !tokens.id_token || tokens.id_token.length > 16384) fail('LINE_IDENTITY_REJECTED');
      const claims = await post('verify', { id_token: tokens.id_token, client_id: checked.channelId, nonce: transaction.nonce });
      const seconds = Math.floor(Number(now()) / 1000);
      if (claims?.iss !== 'https://access.line.me' || claims.aud !== checked.channelId || claims.nonce !== transaction.nonce ||
          !subjectPattern.test(claims.sub) || !Number.isSafeInteger(claims.exp) || claims.exp <= seconds ||
          !Number.isSafeInteger(claims.iat) || claims.iat > seconds + 60 || claims.iat > claims.exp) fail('LINE_IDENTITY_REJECTED');
      return { identity: { provider_id: checked.providerId, subject: claims.sub }, inviteToken: transaction.inviteToken };
    },
  };
}
