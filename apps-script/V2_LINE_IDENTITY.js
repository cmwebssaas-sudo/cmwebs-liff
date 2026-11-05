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

function verifyLandlordLineIdToken_(idToken) {
  const token = typeof idToken === 'string' ? idToken.trim() : '';
  if (!token || token.length > 8192) return lineRequestAuthRequired_();
  try {
    const legacyChannelId = PropertiesService.getScriptProperties().getProperty('CMWEBS_LINE_LOGIN_CHANNEL_ID');
    if (!legacyChannelId) return lineRequestAuthRequired_();
    // A landlord's own channel counts only while its registry row is active
    // and its Workspace is on the Worker list.
    const hinted = lineIdTokenAudience_(token);
    let channelId = legacyChannelId;
    let channelWorkspaceId = '';
    if (hinted && hinted !== legacyChannelId) {
      const channel = lineRegistryLoginChannel_(hinted);
      if (!channel || channel.status !== 'active' || !channel.workspace_id ||
        lineOwnChannelWorkspaces_().indexOf(channel.workspace_id) < 0) return lineRequestAuthRequired_();
      channelId = hinted;
      channelWorkspaceId = channel.workspace_id;
    }
    const verified = function (principal) {
      LINE_REQUEST_CHANNEL_SCOPE_ = { workspace_id: channelWorkspaceId };
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

// Tenant pages are not yet split by channel, so tokens from a landlord's own
// channel are refused there instead of reaching shared tenant lookups.
function lineRequestChannelGate_(action, parameter) {
  if (/^landlord_/.test(String(action || ''))) return null;
  const hinted = lineIdTokenAudience_(parameter && parameter.id_token);
  if (!hinted) return null;
  const legacyChannelId = PropertiesService.getScriptProperties().getProperty('CMWEBS_LINE_LOGIN_CHANNEL_ID');
  if (hinted === legacyChannelId) return null;
  return lineChannelTenantNotReady_();
}

function lineChannelTenantNotReady_() {
  return { success: false, code: 'LINE_CHANNEL_TENANT_NOT_READY', message: '這個 LINE 官方帳號尚未開放房客功能', data: null };
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
