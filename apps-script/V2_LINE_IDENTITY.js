/** Verified LINE credentials for the normal LIFF request transport. */
function lineRequestAuthRequired_() {
  return { success: false, code: 'AUTH_REQUIRED', message: '請重新登入後再試', data: null };
}

function lineRequestNeedsIdentity_(action) {
  const name = String(action || '');
  return /^landlord_/.test(name) || /^tenant_.*_submit$/.test(name) ||
    ['tenant_contract_request_cancel', 'tenant_contract_renewal_intent'].indexOf(name) >= 0;
}

// Tenant reads use the verified principal too. test=1 keeps its configured
// test-tenant identity from resolveTenantRequestLineUserId_.
function lineRequestTenantReadNeedsIdentity_(action, parameter) {
  return /^tenant_/.test(String(action || '')) && String((parameter || {}).test || '') !== '1';
}

function lineRequestClaimsValid_(claims, channelId) {
  return !!claims && claims.iss === 'https://access.line.me' && claims.aud === channelId &&
    typeof claims.sub === 'string' && !!claims.sub.trim() &&
    typeof claims.exp === 'number' && Number.isFinite(claims.exp) && claims.exp > Math.floor(Date.now() / 1000);
}

// Set by each successful verification. A blank workspace_id means the
// existing CMWebs channel; otherwise the token belongs to that Workspace.
let LINE_REQUEST_CHANNEL_SCOPE_ = null;

function lineRequestChannelScope_() {
  return LINE_REQUEST_CHANNEL_SCOPE_;
}

// Routing hint only: LINE verifies the token against the chosen client_id.
function lineIdTokenAudience_(idToken) {
  try {
    const part = String(idToken || '').split('.')[1] || '';
    if (!/^[A-Za-z0-9_-]{1,8192}$/.test(part)) return '';
    const padded = part + '===='.slice(0, (4 - part.length % 4) % 4);
    const aud = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(padded)).getDataAsString()).aud;
    return typeof aud === 'string' && /^\d{10}$/.test(aud) ? aud : '';
  } catch (_) {
    return '';
  }
}

let LINE_OWN_CHANNEL_WORKSPACES_ = null;

// The same Script Property routes their LINE pushes through the Worker.
function lineOwnChannelWorkspaces_() {
  if (!LINE_OWN_CHANNEL_WORKSPACES_) {
    LINE_OWN_CHANNEL_WORKSPACES_ = String(PropertiesService.getScriptProperties()
      .getProperty('CMWEBS_LINE_WORKER_WORKSPACES') || '')
      .split(',')
      .map(function (value) { return value.trim().toUpperCase(); })
      .filter(Boolean);
  }
  return LINE_OWN_CHANNEL_WORKSPACES_;
}

// Looks up a landlord's own LINE Login channel in the Worker registry.
// Returns null when the registry cannot answer, so nothing is cached.
function lineRegistryLoginChannel_(channelId) {
  const cache = CacheService.getScriptCache();
  const key = 'v3_line_login_channel:' + channelId;
  try {
    const cached = JSON.parse(cache.get(key) || 'null');
    if (cached) return cached;
  } catch (_) {}
  const request = lineWorkerSignedRequest_('/internal/line-channels',
    { action: 'find_login_channel', line_login_channel_id: channelId });
  const response = UrlFetchApp.fetch(request.url, request);
  const code = response.getResponseCode();
  let found = { workspace_id: '', status: 'missing' };
  if (code === 200) {
    const data = JSON.parse(response.getContentText()).data || {};
    found = { workspace_id: String(data.workspace_id || '').trim().toUpperCase(), status: String(data.status || '') };
  } else if (code !== 404) {
    return null;
  }
  try { cache.put(key, JSON.stringify(found), found.status === 'active' ? 300 : 60); } catch (_) {}
  return found;
}

const LINE_EXISTING_TENANT_LIFF_URL_ = 'https://liff.line.me/2010314940-iJB1D6sN';

// A Workspace that sends through its own channel links tenants to its own
// LIFF app. That app's endpoint is the site root, so the path picks the page.
// Returns '' when the registry cannot name an active LIFF app. List views build
// one link per row, so each Workspace is looked up once per execution.
const LINE_WORKSPACE_LIFF_IDS_ = {};

function lineTenantLiffUrl_(workspaceId, page) {
  const route = lineSendRoute_(workspaceId);
  if (route.transport !== 'worker') return LINE_EXISTING_TENANT_LIFF_URL_;
  if (!Object.prototype.hasOwnProperty.call(LINE_WORKSPACE_LIFF_IDS_, route.workspace_id)) {
    try {
      LINE_WORKSPACE_LIFF_IDS_[route.workspace_id] = lineRegistryWorkspaceLiffId_(route.workspace_id);
    } catch (_) {
      LINE_WORKSPACE_LIFF_IDS_[route.workspace_id] = '';
    }
  }
  const liffId = LINE_WORKSPACE_LIFF_IDS_[route.workspace_id];
  return liffId ? 'https://liff.line.me/' + liffId + '/' + (page || 'tenant-bind.html') : '';
}

function lineRegistryWorkspaceLiffId_(workspaceId) {
  const cache = CacheService.getScriptCache();
  const key = 'v3_line_workspace_liff:' + workspaceId;
  try {
    const cached = JSON.parse(cache.get(key) || 'null');
    if (cached) return cached.liff_id;
  } catch (_) {}
  const request = lineWorkerSignedRequest_('/internal/line-channels', { action: 'get', workspace_id: workspaceId });
  const response = UrlFetchApp.fetch(request.url, request);
  const code = response.getResponseCode();
  if (code !== 200 && code !== 404) return '';
  const data = code === 200 ? JSON.parse(response.getContentText()).data || {} : {};
  const liffId = data.status === 'active' && /^\d{10}-[A-Za-z0-9]{8}$/.test(String(data.liff_id || '')) ? data.liff_id : '';
  try { cache.put(key, JSON.stringify({ liff_id: liffId }), liffId ? 300 : 60); } catch (_) {}
  return liffId;
}

// Picks the LINE Login channel a token must be verified against. A landlord's
// own channel counts only while its registry row is active and its Workspace
// is on the Worker list. Returns null when the token cannot be accepted.
function lineLoginChannelForToken_(token) {
  const legacyChannelId = PropertiesService.getScriptProperties().getProperty('CMWEBS_LINE_LOGIN_CHANNEL_ID');
  if (!legacyChannelId) return null;
  const hinted = lineIdTokenAudience_(token);
  if (!hinted || hinted === legacyChannelId) return { channel_id: legacyChannelId, workspace_id: '' };
  if (!lineOwnChannelWorkspaces_().length) return null;
  const channel = lineRegistryLoginChannel_(hinted);
  if (!channel || channel.status !== 'active' || !channel.workspace_id ||
    lineOwnChannelWorkspaces_().indexOf(channel.workspace_id) < 0) return null;
  return { channel_id: hinted, workspace_id: channel.workspace_id };
}

function lineRequestSetChannelScope_(channel) {
  LINE_REQUEST_CHANNEL_SCOPE_ = { workspace_id: channel.workspace_id };
}

function verifyLandlordLineIdToken_(idToken) {
  const token = typeof idToken === 'string' ? idToken.trim() : '';
  if (!token || token.length > 8192) return lineRequestAuthRequired_();
  try {
    const channel = lineLoginChannelForToken_(token);
    if (!channel) return lineRequestAuthRequired_();
    const channelId = channel.channel_id;
    const channelWorkspaceId = channel.workspace_id;
    const verified = function (principal) {
      lineRequestSetChannelScope_(channel);
      if (!channelWorkspaceId) return { success: true, data: principal };
      return { success: true, data: Object.assign({}, principal, { channel_workspace_id: channelWorkspaceId }) };
    };
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, channelId + ':' + token, Utilities.Charset.UTF_8)
      .map(function (byte) { return ('0' + (byte & 255).toString(16)).slice(-2); }).join('');
    const key = 'v2_line_identity:' + digest;
    const cache = CacheService.getScriptCache();
    let claims;
    try { claims = JSON.parse(cache.get(key) || 'null'); } catch (_) { claims = null; }
    if (lineRequestClaimsValid_(claims, channelId)) return verified(claims);
    const response = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'post', contentType: 'application/x-www-form-urlencoded', muteHttpExceptions: true,
      followRedirects: false, payload: { id_token: token, client_id: channelId }
    });
    if (response.getResponseCode() !== 200) return lineRequestAuthRequired_();
    claims = JSON.parse(response.getContentText());
    if (!lineRequestClaimsValid_(claims, channelId)) return lineRequestAuthRequired_();
    const principal = { iss: claims.iss, aud: claims.aud, sub: claims.sub, exp: claims.exp };
    const ttl = Math.min(3000, Math.floor(claims.exp - Date.now() / 1000));
    if (ttl > 0) {
      try { cache.put(key, JSON.stringify(principal), ttl); } catch (_) {}
    }
    return verified(principal);
  } catch (_) {
    return lineRequestAuthRequired_();
  }
}

// Tenant actions verify the token and then stay inside its channel's
// Workspaces. Other non-landlord actions are not split by channel yet, so
// they refuse tokens from a landlord's own channel.
function lineRequestChannelGate_(action, parameter) {
  const name = String(action || '');
  if (/^landlord_/.test(name)) return null;
  if (/^tenant_/.test(name) && String((parameter || {}).test || '') !== '1') return null;
  const hinted = lineIdTokenAudience_(parameter && parameter.id_token);
  if (!hinted) return null;
  const legacyChannelId = PropertiesService.getScriptProperties().getProperty('CMWEBS_LINE_LOGIN_CHANNEL_ID');
  if (hinted === legacyChannelId) return null;
  return lineChannelTenantNotReady_();
}

function lineChannelTenantNotReady_() {
  return { success: false, code: 'LINE_CHANNEL_TENANT_NOT_READY', message: '這個 LINE 官方帳號尚未開放房客功能', data: null };
}

function lineTenantChannelConflict_() {
  return { success: false, code: 'LINE_CHANNEL_TENANT_CONFLICT', message: '這個 LINE 帳號已綁定其他房東的租屋資料，請聯絡房東', data: null };
}

// Every tenant row the LINE account is bound to must belong to the verified
// channel. Nothing is read while no Workspace uses its own channel.
function lineTenantChannelDenied_(lineUserId) {
  const scope = LINE_REQUEST_CHANNEL_SCOPE_;
  if (!scope || (!scope.workspace_id && !lineOwnChannelWorkspaces_().length)) return null;
  const sub = String(lineUserId || '').trim();
  const sheet = runtimeSpreadsheet_().getSheetByName('V2_tenants');
  if (!sub || !sheet) return null;
  const values = runtimeSnapshotGetValues_(sheet);
  const headers = (values[0] || []).map(function (value) { return String(value || '').trim(); });
  const column = function (name) { return headers.indexOf(name); };
  const workspace = column('workspace_id');
  const lineColumns = [column('tenant_line_user_id'), column('line_user_id'), column('tenant_line_uid')]
    .filter(function (index) { return index >= 0; });
  for (let row = 1; row < values.length; row++) {
    const bound = lineColumns.some(function (index) { return String(values[row][index] || '').trim() === sub; });
    if (bound && lineRequestChannelDenied_(workspace >= 0 ? values[row][workspace] : '')) return lineTenantChannelConflict_();
  }
  return null;
}

// Tenant binding only matches tenant rows inside the verified channel.
function lineTenantRowInChannel_(row) {
  return !lineRequestChannelDenied_(row && row.workspace_id);
}

// Returns a denial when the verified LINE channel does not match the Workspace.
function lineRequestChannelDenied_(workspaceId) {
  const scope = LINE_REQUEST_CHANNEL_SCOPE_;
  if (!scope) return null;
  const id = String(workspaceId || '').trim().toUpperCase();
  const allowed = scope.workspace_id ? id === scope.workspace_id : lineOwnChannelWorkspaces_().indexOf(id) < 0;
  return allowed ? null : { success: false, code: 'WORKSPACE_FORBIDDEN', message: '這個 LINE 帳號不能使用目前的管理團隊', data: null };
}

function resolveVerifiedLineRequestIdentity_(parameter) {
  const params = parameter || {};
  if (String(params.test || '') === '1') return lineRequestAuthRequired_();
  const verified = verifyLandlordLineIdToken_(params.id_token);
  if (!verified.success) return verified;
  const requested = String(params.line_user_id || '').trim();
  if (requested && requested !== verified.data.sub) return lineRequestAuthRequired_();
  return verified;
}
