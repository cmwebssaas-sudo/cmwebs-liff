import { boundedBody, verifySignature } from './sync.js';

const encoder = new TextEncoder();
const secretFields = ['messaging_channel_secret','messaging_access_token','line_login_channel_secret'];
const transitions = {
  draft:['verifying','revoked'], verifying:['draft','active','revoked'],
  active:['suspended','revoked'], suspended:['active','revoked'], revoked:[]
};
const reply = (body, status = 200) => Response.json(body, { status, headers:{ 'cache-control':'no-store' } });
const failure = (code, status) => reply({ success:false, code, message:'LINE channel request failed', data:null }, status);
function stop(code, status = 400) { throw Object.assign(new Error(code), { code, status }); }
const base64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const bytes = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));

async function secretKey(value) {
  let raw; try { raw = bytes(value || ''); } catch { stop('LINE_CHANNEL_NOT_CONFIGURED',503); }
  if (raw.length !== 32) stop('LINE_CHANNEL_NOT_CONFIGURED',503);
  return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
}
const context = workspaceId => ({ name:'AES-GCM', additionalData:encoder.encode('cmwebs-line-channel:v1:'+workspaceId) });

export async function encryptChannelSecrets(secrets, keyValue, workspaceId) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ ...context(workspaceId), iv },await secretKey(keyValue),encoder.encode(JSON.stringify(secrets)));
  return 'v1.'+base64(iv)+'.'+base64(data);
}
export async function decryptChannelSecrets(stored, keyValue, workspaceId) {
  const [version, iv, data] = String(stored || '').split('.');
  if (version !== 'v1' || !iv || !data) stop('LINE_CHANNEL_SECRET_INVALID',500);
  const clear = await crypto.subtle.decrypt({ ...context(workspaceId), iv:bytes(iv) },await secretKey(keyValue),bytes(data));
  return JSON.parse(new TextDecoder().decode(clear));
}

function validWorkspace(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value); }
function validUpsert(input) {
  const keys = ['action','workspace_id','line_login_channel_id','liff_id','messaging_channel_id','secrets'];
  if (Object.keys(input).sort().join() !== [...keys].sort().join() || !validWorkspace(input.workspace_id) ||
      !/^\d{10}$/.test(input.line_login_channel_id) || !/^\d{10}$/.test(input.messaging_channel_id) ||
      !/^\d{10}-[A-Za-z0-9]{8}$/.test(input.liff_id) || input.liff_id.split('-')[0] !== input.line_login_channel_id ||
      !input.secrets || typeof input.secrets !== 'object' ||
      Object.keys(input.secrets).sort().join() !== [...secretFields].sort().join() ||
      secretFields.some(field => typeof input.secrets[field] !== 'string' || !input.secrets[field] || input.secrets[field].length > 2048)) stop('INVALID_LINE_CHANNEL');
}
function publicRecord(row) {
  return { workspace_id:row.workspace_id, line_login_channel_id:row.line_login_channel_id, liff_id:row.liff_id,
    messaging_channel_id:row.messaging_channel_id, webhook_key:row.webhook_key, status:row.status,
    has_secrets:Boolean(row.encrypted_secrets), verified_at:row.verified_at, updated_at:row.updated_at };
}
async function commit(db, nonce, statement) {
  try {
    const consume = [db.prepare('DELETE FROM sync_nonces WHERE expires_at<=?').bind(Date.now()),
      db.prepare('INSERT INTO sync_nonces(nonce,expires_at) VALUES (?,?)').bind(nonce,Date.now()+600000)];
    await db.batch(statement ? [...consume,statement] : consume);
  } catch (error) {
    if (/line_channels/.test(String(error?.message))) stop('LINE_CHANNEL_CONFLICT',409);
    stop('NONCE_REPLAY',409);
  }
}
async function upsert(db, nonce, input, env) {
  validUpsert(input);
  const now = new Date().toISOString();
  const encrypted = await encryptChannelSecrets(input.secrets,env.LINE_CHANNEL_SECRET_KEY,input.workspace_id);
  await commit(db,nonce,db.prepare(`INSERT INTO line_channels(workspace_id,line_login_channel_id,liff_id,messaging_channel_id,
      webhook_key,status,encrypted_secrets,verified_at,updated_at) VALUES (?,?,?,?,?,'draft',?,NULL,?)
    ON CONFLICT(workspace_id) DO UPDATE SET line_login_channel_id=excluded.line_login_channel_id,liff_id=excluded.liff_id,
      messaging_channel_id=excluded.messaging_channel_id,status='draft',encrypted_secrets=excluded.encrypted_secrets,
      verified_at=NULL,updated_at=excluded.updated_at`).bind(input.workspace_id,input.line_login_channel_id,input.liff_id,
    input.messaging_channel_id,crypto.randomUUID().replaceAll('-',''),encrypted,now));
}
async function setStatus(db, nonce, input) {
  if (Object.keys(input).sort().join() !== 'action,status,workspace_id' || !validWorkspace(input.workspace_id) ||
      !Object.hasOwn(transitions,input.status)) stop('INVALID_LINE_CHANNEL');
  const row = await db.prepare('SELECT status,encrypted_secrets FROM line_channels WHERE workspace_id=?').bind(input.workspace_id).first();
  if (!row) stop('LINE_CHANNEL_NOT_FOUND',404);
  if (!transitions[row.status].includes(input.status)) stop('LINE_CHANNEL_INVALID_STATUS',409);
  const now = new Date().toISOString();
  await commit(db,nonce,db.prepare(`UPDATE line_channels SET status=?,encrypted_secrets=?,verified_at=?,updated_at=? WHERE workspace_id=? AND status=?`)
    .bind(input.status,input.status === 'revoked' ? null : row.encrypted_secrets,input.status === 'active' ? now : null,now,input.workspace_id,row.status));
}
// Apps Script signs each call after it has checked the caller's Workspace,
// role and permission. Responses never include secrets.
export async function lineChannels(request, env) {
  if (request.method !== 'POST') return failure('METHOD_NOT_ALLOWED',405);
  if (!env.DB || !env.LINE_REGISTRY_SIGNING_SECRET || !env.LINE_CHANNEL_SECRET_KEY) return failure('LINE_CHANNEL_NOT_CONFIGURED',503);
  try {
    await secretKey(env.LINE_CHANNEL_SECRET_KEY);
    const body = await boundedBody(request);
    const nonce = await verifySignature(request,body,env.LINE_REGISTRY_SIGNING_SECRET);
    let input; try { input = JSON.parse(body); } catch { stop('INVALID_LINE_CHANNEL'); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) stop('INVALID_LINE_CHANNEL');
    const db = env.DB.withSession ? env.DB.withSession('first-primary') : env.DB;
    if (input.action === 'upsert') await upsert(db,nonce,input,env);
    else if (input.action === 'set_status') await setStatus(db,nonce,input);
    else if (input.action === 'get') {
      if (Object.keys(input).sort().join() !== 'action,workspace_id' || !validWorkspace(input.workspace_id)) stop('INVALID_LINE_CHANNEL');
      await commit(db,nonce);
    } else stop('INVALID_LINE_CHANNEL');
    const row = await db.prepare('SELECT * FROM line_channels WHERE workspace_id=?').bind(input.workspace_id).first();
    if (!row) stop('LINE_CHANNEL_NOT_FOUND',404);
    return reply({ success:true, code:'OK', message:'LINE channel ready', data:publicRecord(row) });
  } catch (error) {
    return failure(error.status ? error.code : 'LINE_CHANNEL_UNAVAILABLE',error.status || 503);
  }
}

function lineResult(status) {
  if (status >= 200 && status < 300) return 'OK';
  if (status === 409) return 'LINE_ALREADY_ACCEPTED';
  if (status === 401) return 'LINE_TOKEN_INVALID';
  if (status === 429) return 'LINE_RATE_OR_QUOTA_LIMITED';
  return status >= 500 ? 'LINE_PUSH_FAILED' : 'LINE_PUSH_REJECTED';
}
function validSend(input) {
  const keys = Object.keys(input).sort().join();
  if (!['text,to,workspace_id','retry_key,text,to,workspace_id'].includes(keys) || !validWorkspace(input.workspace_id) ||
      typeof input.to !== 'string' || !/^U[0-9a-f]{32}$/.test(input.to) ||
      typeof input.text !== 'string' || !input.text || input.text.length > 5000 ||
      (input.retry_key !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.retry_key))) stop('INVALID_LINE_SEND');
}
// Apps Script checks the recipient binding before signing. The HTTP status
// mirrors LINE so callers keep handling one set of results.
export async function lineSend(request, env, fetcher = fetch) {
  if (request.method !== 'POST') return failure('METHOD_NOT_ALLOWED',405);
  if (!env.DB || !env.LINE_REGISTRY_SIGNING_SECRET || !env.LINE_CHANNEL_SECRET_KEY) return failure('LINE_CHANNEL_NOT_CONFIGURED',503);
  try {
    await secretKey(env.LINE_CHANNEL_SECRET_KEY);
    const body = await boundedBody(request);
    const nonce = await verifySignature(request,body,env.LINE_REGISTRY_SIGNING_SECRET);
    let input; try { input = JSON.parse(body); } catch { stop('INVALID_LINE_SEND'); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) stop('INVALID_LINE_SEND');
    validSend(input);
    const db = env.DB.withSession ? env.DB.withSession('first-primary') : env.DB;
    await commit(db,nonce);
    const row = await db.prepare('SELECT status,encrypted_secrets FROM line_channels WHERE workspace_id=?').bind(input.workspace_id).first();
    if (!row || row.status !== 'active' || !row.encrypted_secrets) stop('LINE_CHANNEL_NOT_ACTIVE',403);
    const secrets = await decryptChannelSecrets(row.encrypted_secrets,env.LINE_CHANNEL_SECRET_KEY,input.workspace_id);
    const headers = { Authorization:'Bearer '+secrets.messaging_access_token, 'content-type':'application/json' };
    if (input.retry_key) headers['X-Line-Retry-Key'] = input.retry_key;
    let response;
    try {
      response = await fetcher('https://api.line.me/v2/bot/message/push',{ method:'POST', headers, redirect:'manual',
        body:JSON.stringify({ to:input.to, messages:[{ type:'text', text:input.text }] }) });
    } catch { stop('LINE_UNREACHABLE',502); }
    const code = lineResult(response.status);
    return reply({ success:code === 'OK', code, message:'LINE push finished', data:null },response.status >= 200 && response.status < 300 ? 200 : response.status);
  } catch (error) {
    return failure(error.status ? error.code : 'LINE_CHANNEL_UNAVAILABLE',error.status || 503);
  }
}
