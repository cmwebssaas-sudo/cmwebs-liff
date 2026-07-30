import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const sessionSource = readFileSync(new URL('../apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js', import.meta.url), 'utf8');
const source = readFileSync(new URL('../apps-script/V2_CONTRACT_ARTIFACT_STORAGE.js', import.meta.url), 'utf8');
const headers = ['artifact_id', 'workspace_id', 'tenant_id', 'contract_id', 'signing_mode', 'artifact_type', 'drive_file_id', 'mime_type', 'byte_size', 'sha256', 'idempotency_key', 'created_by_user_id', 'created_at', 'status'];

class Sheet {
  constructor(headers = [], rows = []) { this.headers = [...headers]; this.rows = rows.map(row => [...row]); this.failAppend = false; }
  getLastRow() { return this.headers.length ? this.rows.length + 1 : 0; }
  getLastColumn() { return this.headers.length; }
  getDataRange() { return { getValues: () => [this.headers, ...this.rows] }; }
  getRange(row, column, countRows, countColumns) {
    return {
      getDisplayValues: () => [this.headers.slice(column - 1, column - 1 + countColumns)],
      getValues: () => [this.headers.slice(column - 1, column - 1 + countColumns)],
      setValues: values => {
        if (this.failAppend && row > 1) throw new Error('metadata write failed');
        if (row === 1) {
          values[0].forEach((value, index) => { this.headers[column - 1 + index] = value; });
        } else {
          this.rows[row - 2] = values[0];
        }
      }
    };
  }
}

const makePng = (idatLength = 100) => {
  const result = Buffer.alloc(8 + 25 + 12 + idatLength + 12);
  Buffer.from([137,80,78,71,13,10,26,10]).copy(result, 0);
  result.writeUInt32BE(13, 8); result.write('IHDR', 12); result.writeUInt32BE(64, 16); result.writeUInt32BE(64, 20);
  const idat = 33; result.writeUInt32BE(idatLength, idat); result.write('IDAT', idat + 4);
  const iend = idat + 12 + idatLength; result.writeUInt32BE(0, iend); result.write('IEND', iend + 4);
  return result.toString('base64');
};

const makeRuntime = (mode = 'new_tenant') => {
  const state = { props: new Map([['CMWEBS_LINE_LOGIN_CHANNEL_ID', 'channel-1'], ['CMWEBS_LIFF_SESSION_HMAC_SECRET', 'session-secret'], ['CMWEBS_CONTRACT_SIGNING_DRIVE_ROOT_FOLDER_ID', 'root-1']]), cache: new Map(), files: [], rootLookups: 0 };
  state.sheets = {
    V2_users: new Sheet(['user_id','line_user_id','role','status'], [['user-1','Utenant','tenant','active']]),
    V2_tenants: new Sheet(['tenant_id','tenant_user_id','line_user_id','workspace_id','status','room_name'], [['tenant-1','user-1','Utenant','ws-1','active','R1']]),
    V2_contracts: new Sheet(['contract_id','tenant_id','workspace_id','contract_status','signing_mode'], [['contract-1','tenant-1','ws-1','pending_tenant_signature',mode]]),
    V2_contract_artifacts: new Sheet(headers)
  };
  const root = { createFile: blob => { const file = { id: crypto.randomUUID(), trashed: false, sharing: null, blob, getId() { return this.id; }, setTrashed(value) { this.trashed = value; }, setSharing(access, permission) { this.sharing = [access, permission]; } }; state.files.push(file); return file; } };
  const context = {
    JSON, String, Number, Math, Date, RegExp, Error, Array, Object,
    console: { log() {}, warn() {}, error() {} },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: name => state.sheets[name] || null, insertSheet: name => (state.sheets[name] = new Sheet()) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => state.props.get(key) || null }) },
    CacheService: { getScriptCache: () => ({ put: (k,v) => state.cache.set(k,v), get: k => state.cache.get(k) || null, remove: k => state.cache.delete(k) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    DriveApp: { Access: { PRIVATE: 'PRIVATE' }, Permission: { NONE: 'NONE' }, getFolderById: id => { state.rootLookups++; if (id !== 'root-1') throw new Error('missing'); return root; } },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ iss: 'https://access.line.me', aud: 'channel-1', sub: 'Utenant', exp: Math.floor(Date.now()/1000) + 3600, iat: Math.floor(Date.now()/1000) - 1 }) }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      base64EncodeWebSafe: value => Buffer.from(value).toString('base64url'), base64DecodeWebSafe: value => Buffer.from(value, 'base64url'), base64Decode: value => [...Buffer.from(value, 'base64')].map(n => n > 127 ? n - 256 : n),
      newBlob: (bytes, mime, name) => ({ bytes, mime, name, getDataAsString: () => Buffer.from(bytes).toString() }),
      computeHmacSha256Signature: (value, key) => [...crypto.createHmac('sha256', key).update(value).digest()].map(n => n > 127 ? n - 256 : n),
      computeDigest: (_algorithm, bytes) => [...crypto.createHash('sha256').update(Buffer.from(bytes)).digest()].map(n => n > 127 ? n - 256 : n),
      DigestAlgorithm: { SHA_256: 'SHA_256' }
    }
  };
  vm.createContext(context);
  vm.runInContext(sessionSource + '\n' + source + '\nthis.api={tenantLiffSigningAuthenticate_,createTenantLiffSessionToken_,tenantContractArtifactStore_,tenantContractArtifactHandleUploadPost_,tenantContractArtifactReadExchange_,tenantContractArtifactValidatePayload_};', context);
  const auth = context.api.tenantLiffSigningAuthenticate_('mock');
  return { state, api: context.api, sessionToken: auth.data.session_token };
};

const requestFor = (token, overrides = {}) => ({ session_token: token, artifact_type: 'identity_front', idempotency_key: 'k'.repeat(22), file: { mime_type: 'image/png', base64: makePng() }, ...overrides });

{ const { state, api, sessionToken } = makeRuntime(); const result = api.tenantContractArtifactStore_(requestFor(sessionToken)); assert.equal(result.success, true); assert.equal(state.files.length, 1); assert.deepEqual(state.files[0].sharing, ['PRIVATE', 'NONE']); assert.equal(state.sheets.V2_contract_artifacts.rows.length, 1); assert.equal(JSON.stringify(result).includes('drive_file_id'), false); assert.equal(JSON.stringify(result).includes('root-1'), false); assert.equal(state.sheets.V2_contracts.rows[0][3], 'pending_tenant_signature'); const repeat = api.tenantContractArtifactStore_(requestFor(sessionToken)); assert.equal(repeat.code, 'IDEMPOTENT'); assert.equal(repeat.data.idempotent, true); assert.equal(state.files.length, 1); }
{ const { api, sessionToken } = makeRuntime(); assert.equal(api.tenantContractArtifactStore_(requestFor('')).code, 'SESSION_TOKEN_INVALID'); assert.equal(api.tenantContractArtifactStore_(requestFor(sessionToken + 'x')).code, 'SESSION_TOKEN_INVALID'); const expired = api.createTenantLiffSessionToken_({ version: 1, purpose: 'tenant_contract_signing', line_sub: 'Utenant', user_id: 'user-1', tenant_id: 'tenant-1', workspace_id: 'ws-1', contract_id: 'contract-1', issued_at: 1, expires_at: 1, jti: 'expired' }); assert.equal(api.tenantContractArtifactStore_(requestFor(expired)).code, 'SESSION_TOKEN_EXPIRED'); assert.equal(api.tenantContractArtifactStore_(requestFor(sessionToken, { file: { mime_type: 'image/png', base64: 'bad' } })).code, 'INVALID_BASE64'); assert.equal(api.tenantContractArtifactStore_(requestFor(sessionToken, { file: { mime_type: 'image/jpeg', base64: makePng() } })).code, 'ARTIFACT_MIME_INVALID'); assert.equal(api.tenantContractArtifactStore_(requestFor(sessionToken, { file: { mime_type: 'image/png', base64: Buffer.from('not-an-image').toString('base64') } })).code, 'ARTIFACT_MAGIC_BYTES_INVALID'); assert.equal(api.tenantContractArtifactStore_(requestFor(sessionToken, { file: { mime_type: 'image/png', base64: Buffer.alloc(3 * 1024 * 1024 + 1).toString('base64') } })).code, 'ARTIFACT_TOO_LARGE'); assert.equal(api.tenantContractArtifactStore_(requestFor(sessionToken, { artifact_type: 'signature', file: { mime_type: 'image/png', base64: makePng(10) } })).code, 'SIGNATURE_BLANK'); }
{ const { state, api, sessionToken } = makeRuntime('renewal'); assert.equal(api.tenantContractArtifactStore_(requestFor(sessionToken)).code, 'ARTIFACT_TYPE_NOT_ALLOWED'); assert.equal(state.files.length, 0); const signature = api.tenantContractArtifactStore_(requestFor(sessionToken, { artifact_type: 'signature' })); assert.equal(signature.success, true, signature.code); }
{ const { state, api, sessionToken } = makeRuntime(); state.props.delete('CMWEBS_CONTRACT_SIGNING_DRIVE_ROOT_FOLDER_ID'); assert.equal(api.tenantContractArtifactStore_(requestFor(sessionToken)).code, 'CONTRACT_SIGNING_DRIVE_ROOT_NOT_CONFIGURED'); assert.equal(state.files.length, 0); }
{ const { state, api, sessionToken } = makeRuntime(); state.sheets.V2_contract_artifacts.failAppend = true; assert.equal(api.tenantContractArtifactStore_(requestFor(sessionToken)).code, 'ARTIFACT_METADATA_WRITE_FAILED'); assert.equal(state.files.length, 1); assert.equal(state.files[0].trashed, true); }
{ const { api, sessionToken } = makeRuntime(); const first = api.tenantContractArtifactStore_(requestFor(sessionToken)); assert.equal(first.success, true); assert.equal(api.tenantContractArtifactStore_(requestFor(sessionToken, { file: { mime_type: 'image/png', base64: makePng(120) } })).code, 'IDEMPOTENCY_CONFLICT'); }
{ const { state, api, sessionToken } = makeRuntime(); state.sheets.V2_contracts.rows[0][1] = 'other-tenant'; assert.equal(api.tenantContractArtifactStore_(requestFor(sessionToken)).code, 'SESSION_PRINCIPAL_INVALID'); }
{ const { state, api, sessionToken } = makeRuntime(); state.sheets.V2_contracts.rows[0][2] = 'other-workspace'; assert.equal(api.tenantContractArtifactStore_(requestFor(sessionToken)).code, 'SESSION_PRINCIPAL_INVALID'); }
{ const { api, sessionToken } = makeRuntime(); const post = { action: 'tenant_contract_artifact_upload_submit', request_id: 'a'.repeat(22), poll_secret: 'b'.repeat(43), ...requestFor(sessionToken) }; assert.equal(api.tenantContractArtifactHandleUploadPost_(JSON.stringify(post)).success, true); const result = api.tenantContractArtifactReadExchange_(post.request_id, post.poll_secret); assert.equal(result.success, true); assert.equal(api.tenantContractArtifactReadExchange_(post.request_id, post.poll_secret).code, 'ARTIFACT_EXCHANGE_NOT_FOUND'); }

console.log('Phase 131 contract-artifact storage runtime mocks passed.');
