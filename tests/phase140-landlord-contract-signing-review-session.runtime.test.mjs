import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { existsSync, readFileSync } from 'node:fs';

const sessionUrl = new URL('../apps-script/V2_LANDLORD_LIFF_SIGNING_REVIEW_SESSION.js', import.meta.url);
assert.equal(
  existsSync(sessionUrl),
  true,
  'native landlord review must verify a LINE identity before issuing a review session'
);

const source = readFileSync(sessionUrl, 'utf8');
const reviewSource = readFileSync(new URL('../apps-script/V2_TENANT_CONTRACT_SIGNING_REVIEW.js', import.meta.url), 'utf8');
const dispatcherSource = readFileSync(new URL('../apps-script/程式碼.js', import.meta.url), 'utf8');
const cache = new Map();
const lockState = { waits: 0, releases: 0 };
const nowSeconds = Math.floor(Date.now() / 1000);
const context = {
  JSON, String, Number, Math, Date, RegExp, Error, Object, Array,
  Utilities: {
    getUuid: () => 'review-jti',
    base64EncodeWebSafe: value => Buffer.from(String(value)).toString('base64url'),
    base64DecodeWebSafe: value => Buffer.from(String(value), 'base64url'),
    newBlob: bytes => ({ getDataAsString: () => Buffer.from(bytes).toString() }),
    computeHmacSha256Signature: (value, key) => Array.from(crypto.createHmac('sha256', String(key)).update(String(value)).digest()).map(byte => byte > 127 ? byte - 256 : byte)
  },
  PropertiesService: { getScriptProperties: () => ({ getProperty: key => key === 'CMWEBS_LINE_LOGIN_CHANNEL_ID' ? 'line-channel' : key === 'CMWEBS_LIFF_SESSION_HMAC_SECRET' ? 'session-secret' : '' }) },
  UrlFetchApp: { fetch: () => ({
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify({ iss: 'https://access.line.me', aud: 'line-channel', sub: 'landlord-line', exp: nowSeconds + 300, iat: nowSeconds })
  }) },
  LockService: { getScriptLock: () => ({
    waitLock: () => { lockState.waits += 1; },
    releaseLock: () => { lockState.releases += 1; }
  }) },
  CacheService: { getScriptCache: () => ({ put: (key, value) => cache.set(key, value), get: key => cache.get(key) || null, remove: key => cache.delete(key) }) },
  workspaceLandlordResolveAccess_: lineUserId => lineUserId === 'landlord-line'
    ? {
        success: true,
        user: { user_id: 'landlord-1' },
        workspace: { workspace_id: 'ws-1' },
        membership: { membership_id: 'member-1' }
      }
    : { success: false, code: 'WORKSPACE_ACCESS_DENIED' }
};
vm.createContext(context);
vm.runInContext(source, context);
vm.runInContext(reviewSource, context);

assert.equal(typeof context.landlordContractSigningReviewReadAuthExchange_, 'function');
assert.equal(typeof context.landlordContractSigningReviewReadResultExchange_, 'function');
assert.equal(dispatcherSource.includes('landlordContractSigningReviewReadAuthExchange_('), true);
assert.equal(dispatcherSource.includes("landlordContractSigningReviewReadResultExchange_(\n        'list'"), true);

const functionNames = [source, reviewSource]
  .flatMap(moduleSource => [...moduleSource.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map(match => match[1]));
assert.equal(
  new Set(functionNames).size,
  functionNames.length,
  'native signing-review modules must not declare duplicate Apps Script top-level functions'
);

const authenticated = context.landlordContractSigningReviewAuthenticate_('valid-line-id-token');
assert.equal(authenticated.success, true, authenticated.code);
assert.equal(authenticated.data.session_token.split('.').length, 2);
assert.equal(authenticated.data.workspace_id, 'ws-1');

const verified = context.verifyLandlordContractSigningReviewSessionToken_(authenticated.data.session_token);
assert.equal(verified.success, true, verified.code);
assert.equal(verified.data.line_sub, 'landlord-line');
assert.equal(verified.data.user_id, 'landlord-1');
assert.equal(verified.data.membership_id, 'member-1');

const exchangeRequestId = 'review-auth-request-id-123';
const exchangePollSecret = 'review-auth-poll-secret-12345678901234567890';
assert.equal(
  context.landlordContractSigningReviewHandleAuthPost_(JSON.stringify({
    action: 'landlord_contract_signing_review_auth_init',
    id_token: 'valid-line-id-token',
    request_id: exchangeRequestId,
    poll_secret: exchangePollSecret
  })).code,
  'EXCHANGE_ACCEPTED'
);
const locksBeforeAuthRedemption = lockState.waits;
const authExchange = context.landlordContractSigningReviewReadAuthExchange_(exchangeRequestId, exchangePollSecret);
assert.equal(authExchange.success, true, authExchange.code);
assert.equal(authExchange.data.session_token.split('.').length, 2);
assert.equal(lockState.waits, locksBeforeAuthRedemption + 1);
assert.equal(lockState.releases, locksBeforeAuthRedemption + 1);
assert.equal(
  context.landlordContractSigningReviewReadAuthExchange_(exchangeRequestId, exchangePollSecret).code,
  'AUTH_EXCHANGE_NOT_FOUND',
  'an auth exchange must not be redeemable twice'
);

assert.equal(
  context.verifyLandlordContractSigningReviewSessionToken_('forged-query-line-user-id').code,
  'LANDLORD_REVIEW_SESSION_INVALID',
  'a raw query value must never be accepted as a landlord review session'
);

console.log('Phase 140 landlord signing-review server-verified session runtime mocks passed.');
