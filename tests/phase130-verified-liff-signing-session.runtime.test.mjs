import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js', import.meta.url), 'utf8');
const now = Math.floor(Date.now() / 1000);
const makeRows = (headers, rows) => ({ getLastRow: () => rows.length + 1, getDataRange: () => ({ getValues: () => [headers, ...rows] }) });
const makeRuntime = () => {
  const state = { props: new Map([['CMWEBS_LINE_LOGIN_CHANNEL_ID', 'channel-1'], ['CMWEBS_LIFF_SESSION_HMAC_SECRET', 'session-secret']]), cache: new Map(), verify: { code: 200, body: { iss: 'https://access.line.me', aud: 'channel-1', sub: 'Utenant', exp: now + 3600, iat: now - 10 } } };
  const sheets = () => ({
    V2_users: makeRows(['user_id','line_user_id','role','status'], [['user-1','Utenant','tenant','active']]),
    V2_tenants: makeRows(['tenant_id','tenant_user_id','line_user_id','workspace_id','status','room_name'], [['tenant-1','user-1','Utenant','ws-1','active','R1']]),
    V2_contracts: makeRows(['contract_id','tenant_id','workspace_id','contract_status','signing_mode'], [['contract-1','tenant-1','ws-1','pending_tenant_signature','new_tenant']])
  });
  state.sheetMap = sheets();
  const context = { JSON, String, Number, Math, Date, RegExp, Error, console: { log() {}, warn() {}, error() {} }, SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => state.sheetMap[n] || null }) }, PropertiesService: { getScriptProperties: () => ({ getProperty: k => state.props.get(k) || null }) }, CacheService: { getScriptCache: () => ({ put: (k,v) => state.cache.set(k,v), get: k => state.cache.get(k) || null, remove: k => state.cache.delete(k) }) }, UrlFetchApp: { fetch: () => ({ getResponseCode: () => state.verify.code, getContentText: () => typeof state.verify.body === 'string' ? state.verify.body : JSON.stringify(state.verify.body) }) }, Utilities: { getUuid: () => crypto.randomUUID(), computeHmacSha256Signature: (v,k) => [...crypto.createHmac('sha256', k).update(v).digest()].map(x => x > 127 ? x - 256 : x), base64EncodeWebSafe: v => Buffer.from(v).toString('base64url'), base64DecodeWebSafe: v => Buffer.from(v, 'base64url'), newBlob: v => ({ getDataAsString: () => Buffer.from(v).toString() }) } };
  vm.createContext(context);
  vm.runInContext(source + '\nthis.api={tenantLiffSigningAuthenticate_,tenantLiffSigningHandleAuthPost_,tenantLiffSigningReadExchange_,verifyTenantLiffSessionToken_,createTenantLiffSessionToken_};', context);
  return { state, api: context.api };
};
const validRequest = () => ({ action: 'tenant_contract_auth_init', id_token: 'mock-id-token', request_id: 'a'.repeat(22), poll_secret: 'b'.repeat(43) });

{ const { api } = makeRuntime(); const result = api.tenantLiffSigningAuthenticate_('token'); assert.equal(result.success, true); assert.equal(result.data.session_token.split('.').length, 2); assert.ok(Date.parse(result.data.session_expires_at) - Date.now() <= 600_000); assert.equal(api.verifyTenantLiffSessionToken_(result.data.session_token).success, true); assert.equal(api.verifyTenantLiffSessionToken_(result.data.session_token + 'x').code, 'SESSION_TOKEN_INVALID'); }
for (const mutate of [s => s.verify.code = 401, s => s.verify.body = '{', s => s.verify.body.iss = 'bad', s => s.verify.body.aud = 'bad', s => s.verify.body.sub = '', s => s.verify.body.exp = now - 1, s => s.verify.body.iat = now + 120, s => s.verify.body.iat = now - 90000]) { const { state, api } = makeRuntime(); mutate(state); assert.equal(api.tenantLiffSigningAuthenticate_('token').success, false); }
{ const { state, api } = makeRuntime(); state.props.delete('CMWEBS_LINE_LOGIN_CHANNEL_ID'); assert.equal(api.tenantLiffSigningAuthenticate_('token').code, 'LINE_LOGIN_CHANNEL_NOT_CONFIGURED'); state.props.set('CMWEBS_LINE_LOGIN_CHANNEL_ID','channel-1'); state.props.delete('CMWEBS_LIFF_SESSION_HMAC_SECRET'); assert.equal(api.tenantLiffSigningHandleAuthPost_(JSON.stringify(validRequest())).code, 'LIFF_SESSION_SECRET_NOT_CONFIGURED'); }
for (const alter of [s => s.sheetMap.V2_users = makeRows(['user_id'], []), s => s.sheetMap.V2_tenants = makeRows(['tenant_id'], []), s => s.sheetMap.V2_tenants = makeRows(['tenant_id','tenant_user_id','line_user_id','workspace_id','status'], [['tenant-1','user-1','Utenant','','active']]), s => s.sheetMap.V2_contracts = makeRows(['contract_id'], [])]) { const { state, api } = makeRuntime(); alter(state); assert.equal(api.tenantLiffSigningAuthenticate_('token').success, false); }
{ const { state, api } = makeRuntime(); const req = validRequest(); assert.equal(api.tenantLiffSigningHandleAuthPost_(JSON.stringify(req)).success, true); assert.equal(api.tenantLiffSigningReadExchange_(req.request_id, 'wrong'.repeat(11)).code, 'AUTH_EXCHANGE_DENIED'); const result = api.tenantLiffSigningReadExchange_(req.request_id, req.poll_secret); assert.equal(result.success, true); assert.equal(JSON.stringify(result).includes('mock-id-token'), false); assert.equal(api.tenantLiffSigningReadExchange_(req.request_id, req.poll_secret).code, 'AUTH_EXCHANGE_NOT_FOUND'); assert.equal(api.tenantLiffSigningHandleAuthPost_(JSON.stringify({ ...req, request_id: 'short' })).code, 'INVALID_EXCHANGE_CREDENTIAL'); state.cache.clear(); assert.equal(api.tenantLiffSigningReadExchange_(req.request_id, req.poll_secret).code, 'AUTH_EXCHANGE_NOT_FOUND'); const token = result.data.session_token; state.sheetMap.V2_contracts = makeRows(['contract_id'], []); assert.equal(api.verifyTenantLiffSessionToken_(token).code, 'SESSION_PRINCIPAL_INVALID'); }
console.log('Phase 130 LIFF signing-session runtime mocks passed.');
