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
const cache = new Map();
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

const authenticated = context.landlordContractSigningReviewAuthenticate_('valid-line-id-token');
assert.equal(authenticated.success, true, authenticated.code);
assert.equal(authenticated.data.session_token.split('.').length, 2);
assert.equal(authenticated.data.workspace_id, 'ws-1');

const verified = context.verifyLandlordContractSigningReviewSessionToken_(authenticated.data.session_token);
assert.equal(verified.success, true, verified.code);
assert.equal(verified.data.line_sub, 'landlord-line');
assert.equal(verified.data.user_id, 'landlord-1');
assert.equal(verified.data.membership_id, 'member-1');

assert.equal(
  context.verifyLandlordContractSigningReviewSessionToken_('forged-query-line-user-id').code,
  'LANDLORD_REVIEW_SESSION_INVALID',
  'a raw query value must never be accepted as a landlord review session'
);

console.log('Phase 140 landlord signing-review server-verified session runtime mocks passed.');
