// Native V2 tenant-contract LIFF authentication. No Drive, upload, or signing write path.
const V2_TENANT_LIFF_AUTH_ACTION_ = 'tenant_contract_auth_init';
const V2_TENANT_LIFF_AUTH_STATUS_ACTION_ = 'tenant_contract_auth_status';
const V2_TENANT_LIFF_AUTH_PURPOSE_ = 'tenant_contract_signing';
const V2_TENANT_LIFF_AUTH_TTL_SECONDS_ = 600;
const V2_TENANT_LIFF_EXCHANGE_TTL_SECONDS_ = 60;

function tenantLiffSigningIsAuthRequest_(body) {
  try { return JSON.parse(String(body || '')).action === V2_TENANT_LIFF_AUTH_ACTION_; } catch (_) { return false; }
}

function tenantLiffSigningHandleAuthPost_(body) {
  let request;
  try { request = JSON.parse(String(body || '')); } catch (_) { return tenantLiffSigningError_('INVALID_JSON'); }
  if (!request || request.action !== V2_TENANT_LIFF_AUTH_ACTION_) return tenantLiffSigningError_('INVALID_ACTION');
  const requestId = tenantLiffSigningText_(request.request_id);
  const pollSecret = tenantLiffSigningText_(request.poll_secret);
  if (!tenantLiffSigningText_(request.id_token)) return tenantLiffSigningError_('MISSING_ID_TOKEN');
  if (!/^[A-Za-z0-9_-]{22,}$/.test(requestId) || !/^[A-Za-z0-9_-]{43,}$/.test(pollSecret)) return tenantLiffSigningError_('INVALID_EXCHANGE_CREDENTIAL');
  let exchangeSecret;
  try { exchangeSecret = tenantLiffSigningSessionSecret_(); } catch (_) { return tenantLiffSigningError_('LIFF_SESSION_SECRET_NOT_CONFIGURED'); }
  const result = tenantLiffSigningAuthenticate_(request.id_token);
  CacheService.getScriptCache().put(tenantLiffSigningExchangeKey_(requestId), JSON.stringify({
    poll_hash: tenantLiffSigningHmacHex_(pollSecret, exchangeSecret), result: result
  }), V2_TENANT_LIFF_EXCHANGE_TTL_SECONDS_);
  return { success: true, code: 'EXCHANGE_ACCEPTED' };
}

function tenantLiffSigningReadExchange_(requestId, pollSecret) {
  const raw = CacheService.getScriptCache().get(tenantLiffSigningExchangeKey_(requestId));
  if (!raw) return tenantLiffSigningError_('AUTH_EXCHANGE_NOT_FOUND');
  let entry; try { entry = JSON.parse(raw); } catch (_) { return tenantLiffSigningError_('AUTH_EXCHANGE_INVALID'); }
  let exchangeSecret;
  try { exchangeSecret = tenantLiffSigningSessionSecret_(); } catch (_) { return tenantLiffSigningError_('LIFF_SESSION_SECRET_NOT_CONFIGURED'); }
  if (!tenantLiffSigningConstantEquals_(entry.poll_hash, tenantLiffSigningHmacHex_(pollSecret, exchangeSecret))) return tenantLiffSigningError_('AUTH_EXCHANGE_DENIED');
  CacheService.getScriptCache().remove(tenantLiffSigningExchangeKey_(requestId));
  return entry.result || tenantLiffSigningError_('AUTH_EXCHANGE_INVALID');
}

function tenantLiffSigningAuthenticate_(idToken) {
  const channelId = PropertiesService.getScriptProperties().getProperty('CMWEBS_LINE_LOGIN_CHANNEL_ID');
  if (!channelId) return tenantLiffSigningError_('LINE_LOGIN_CHANNEL_NOT_CONFIGURED');
  let response;
  try {
    response = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', { method: 'post', muteHttpExceptions: true, contentType: 'application/x-www-form-urlencoded', payload: { id_token: String(idToken), client_id: channelId } });
  } catch (_) { return tenantLiffSigningError_('LINE_TOKEN_VERIFY_FAILED'); }
  if (response.getResponseCode() !== 200) return tenantLiffSigningError_('LINE_TOKEN_VERIFY_FAILED');
  let claims; try { claims = JSON.parse(response.getContentText()); } catch (_) { return tenantLiffSigningError_('LINE_TOKEN_VERIFY_FAILED'); }
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== 'https://access.line.me' || claims.aud !== channelId || !tenantLiffSigningText_(claims.sub) || !Number.isFinite(Number(claims.exp)) || Number(claims.exp) <= now || !Number.isFinite(Number(claims.iat)) || Number(claims.iat) > now + 60 || now - Number(claims.iat) > 86400) return tenantLiffSigningError_('LINE_TOKEN_CLAIMS_INVALID');
  const principal = tenantLiffSigningResolvePrincipal_(claims.sub);
  if (!principal.success) return principal;
  const nowIso = new Date().toISOString();
  const expiresAt = now + V2_TENANT_LIFF_AUTH_TTL_SECONDS_;
  const token = createTenantLiffSessionToken_({ version: 1, purpose: V2_TENANT_LIFF_AUTH_PURPOSE_, line_sub: claims.sub, user_id: principal.data.user_id, tenant_id: principal.data.tenant_id, workspace_id: principal.data.workspace_id, contract_id: principal.data.contract_id, issued_at: now, expires_at: expiresAt, jti: Utilities.getUuid() });
  return { success: true, code: 'OK', data: { tenant: principal.data.tenant, contract: principal.data.contract, signing_required: true, signing_status: principal.data.signing_status, artifact_requirements: principal.data.artifact_requirements, artifact_state: principal.data.artifact_state, session_token: token, session_expires_at: new Date(expiresAt * 1000).toISOString(), authenticated_at: nowIso } };
}

function tenantLiffSigningResolvePrincipal_(lineSub) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const users = tenantLiffSigningRows_(ss.getSheetByName('V2_users'));
  const user = users.find(function (row) { return tenantLiffSigningText_(row.line_user_id) === lineSub && tenantLiffSigningText_(row.role).toLowerCase() === 'tenant' && tenantLiffSigningText_(row.status || row.account_status || 'active').toLowerCase() === 'active'; });
  if (!user) return tenantLiffSigningError_('TENANT_USER_NOT_ACTIVE');
  const tenants = tenantLiffSigningRows_(ss.getSheetByName('V2_tenants'));
  const tenant = tenants.find(function (row) { return tenantLiffSigningText_(row.tenant_user_id || row.user_id) === tenantLiffSigningText_(user.user_id) && tenantLiffSigningText_(row.line_user_id || row.tenant_line_user_id) === lineSub && tenantLiffSigningText_(row.status || row.account_status || 'active').toLowerCase() === 'active'; });
  if (!tenant) return tenantLiffSigningError_('TENANT_MAPPING_NOT_FOUND');
  const workspaceId = tenantLiffSigningText_(tenant.workspace_id);
  if (!workspaceId) return tenantLiffSigningError_('WORKSPACE_MEMBERSHIP_INVALID');
  const contracts = tenantLiffSigningRows_(ss.getSheetByName('V2_contracts'));
  const contract = contracts.find(function (row) { return tenantLiffSigningText_(row.tenant_id) === tenantLiffSigningText_(tenant.tenant_id) && tenantLiffSigningText_(row.workspace_id) === workspaceId && ['pending_tenant_signature', 'awaiting_tenant_signature'].indexOf(tenantLiffSigningText_(row.contract_status)) >= 0; });
  if (!contract) return tenantLiffSigningError_('SIGNABLE_CONTRACT_NOT_FOUND');
  const signingMode = tenantLiffSigningText_(contract.signing_mode).toLowerCase();
  if (['new_tenant', 'renewal'].indexOf(signingMode) === -1) return tenantLiffSigningError_('SIGNING_MODE_NOT_READY');
  const artifactState = tenantLiffSigningArtifactState_(ss, contract, signingMode);
  return { success: true, data: { user_id: tenantLiffSigningText_(user.user_id), tenant_id: tenantLiffSigningText_(tenant.tenant_id), workspace_id: workspaceId, contract_id: tenantLiffSigningText_(contract.contract_id), tenant: { tenant_id: tenantLiffSigningText_(tenant.tenant_id), tenant_name: tenantLiffSigningText_(tenant.tenant_name || tenant.name), room_name: tenantLiffSigningText_(tenant.room_name) }, contract: tenantLiffSigningContractView_(contracts, contract, signingMode), signing_status: tenantLiffSigningText_(contract.tenant_signing_submission_status) || 'pending', artifact_requirements: signingMode === 'new_tenant' ? ['identity_front', 'identity_back', 'signature'] : ['signature'], artifact_state: artifactState } };
}

function tenantLiffSigningContractView_(contracts, contract, signingMode) {
  const previousId = tenantLiffSigningText_(contract.previous_contract_id || contract.renewed_from_contract_id);
  const previous = previousId ? contracts.find(function (row) { return tenantLiffSigningText_(row.contract_id) === previousId && tenantLiffSigningText_(row.tenant_id) === tenantLiffSigningText_(contract.tenant_id) && tenantLiffSigningText_(row.workspace_id) === tenantLiffSigningText_(contract.workspace_id); }) : null;
  const terms = tenantLiffSigningTermsDocument_(contract);
  return {
    contract_id: tenantLiffSigningText_(contract.contract_id),
    contract_status: tenantLiffSigningText_(contract.contract_status),
    signing_mode: signingMode,
    room_name: tenantLiffSigningText_(contract.room_name),
    start_date: contract.start_date || contract.contract_start_date || '',
    end_date: contract.end_date || contract.contract_end_date || '',
    rent_amount: contract.rent_amount || contract.monthly_rent || '',
    management_fee: contract.management_fee || contract.monthly_management_fee || '',
    deposit_amount: contract.deposit_amount || '',
    monthly_payment_day: contract.monthly_payment_day || contract.payment_day || '',
    landlord_note: tenantLiffSigningText_(contract.landlord_note || contract.signing_note || contract.renewal_landlord_note),
    terms_document: terms,
    renewal_comparison: tenantLiffSigningRenewalComparison_(previous, contract, signingMode)
  };
}

function tenantLiffSigningTermsDocument_(contract) {
  const content = tenantLiffSigningText_(contract.contract_content || contract.contract_text || contract.contract_terms || contract.terms_text);
  return content ? { available: true, content: content } : { available: false, message: '完整合約內容尚未提供，請聯絡房東確認。' };
}

function tenantLiffSigningRenewalComparison_(previous, contract, signingMode) {
  if (signingMode !== 'renewal') return { available: false, items: [] };
  if (!previous) return { available: false, message: '續約前一份合約關聯尚未提供。', items: [] };
  const fields = [
    ['租期', 'start_date', 'end_date'],
    ['月租', 'rent_amount', 'monthly_rent'],
    ['管理費', 'management_fee', 'monthly_management_fee'],
    ['押金', 'deposit_amount', 'deposit_amount'],
    ['繳款日', 'monthly_payment_day', 'payment_day']
  ];
  const items = fields.map(function (field) {
    const oldValue = field[0] === '租期' ? tenantLiffSigningText_(previous.start_date || previous.contract_start_date) + ' → ' + tenantLiffSigningText_(previous.end_date || previous.contract_end_date) : tenantLiffSigningText_(previous[field[1]] || previous[field[2]]);
    const newValue = field[0] === '租期' ? tenantLiffSigningText_(contract.start_date || contract.contract_start_date) + ' → ' + tenantLiffSigningText_(contract.end_date || contract.contract_end_date) : tenantLiffSigningText_(contract[field[1]] || contract[field[2]]);
    return { label: field[0], old_value: oldValue, new_value: newValue, changed: oldValue !== newValue };
  });
  return { available: true, items: items };
}

function tenantLiffSigningArtifactState_(ss, contract, signingMode) {
  const rows = tenantLiffSigningRows_(ss.getSheetByName('V2_contract_artifacts'));
  const required = signingMode === 'new_tenant' ? ['identity_front', 'identity_back', 'signature'] : ['signature'];
  const stored = {};
  rows.forEach(function (row) {
    if (tenantLiffSigningText_(row.contract_id) === tenantLiffSigningText_(contract.contract_id) && tenantLiffSigningText_(row.workspace_id) === tenantLiffSigningText_(contract.workspace_id) && tenantLiffSigningText_(row.tenant_id) === tenantLiffSigningText_(contract.tenant_id) && tenantLiffSigningText_(row.status) === 'stored') stored[tenantLiffSigningText_(row.artifact_type)] = true;
  });
  return required.reduce(function (result, type) { result[type] = stored[type] === true; return result; }, {});
}

function createTenantLiffSessionToken_(claims) { const payload = Utilities.base64EncodeWebSafe(JSON.stringify(claims)).replace(/=+$/g, ''); return payload + '.' + tenantLiffSigningHmacHex_(payload, tenantLiffSigningSessionSecret_()); }
function verifyTenantLiffSessionToken_(token) { const parts = String(token || '').split('.'); if (parts.length !== 2 || !tenantLiffSigningConstantEquals_(parts[1], tenantLiffSigningHmacHex_(parts[0], tenantLiffSigningSessionSecret_()))) return tenantLiffSigningError_('SESSION_TOKEN_INVALID'); let claims; try { claims = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()); } catch (_) { return tenantLiffSigningError_('SESSION_TOKEN_INVALID'); } if (claims.purpose !== V2_TENANT_LIFF_AUTH_PURPOSE_ || Number(claims.expires_at) <= Math.floor(Date.now()/1000)) return tenantLiffSigningError_('SESSION_TOKEN_EXPIRED'); const principal = tenantLiffSigningResolvePrincipal_(claims.line_sub); if (!principal.success || principal.data.user_id !== claims.user_id || principal.data.tenant_id !== claims.tenant_id || principal.data.workspace_id !== claims.workspace_id || principal.data.contract_id !== claims.contract_id) return tenantLiffSigningError_('SESSION_PRINCIPAL_INVALID'); return { success: true, data: claims }; }
function tenantLiffSigningSessionSecret_() { const secret = PropertiesService.getScriptProperties().getProperty('CMWEBS_LIFF_SESSION_HMAC_SECRET'); if (!secret) throw new Error('CMWEBS_LIFF_SESSION_HMAC_SECRET is not configured'); return secret; }
function tenantLiffSigningHmacHex_(value, key) { return Utilities.computeHmacSha256Signature(String(value), String(key)).map(function (b) { return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2); }).join(''); }
function tenantLiffSigningRows_(sheet) { if (!sheet || sheet.getLastRow() < 2) return []; const values = sheet.getDataRange().getValues(); const headers = values.shift().map(tenantLiffSigningText_); return values.map(function (row, index) { const obj = { _sheet_row: index + 2 }; headers.forEach(function (h, i) { obj[h] = row[i]; }); return obj; }); }
function tenantLiffSigningExchangeKey_(id) { return 'tenant_liff_auth:' + String(id || ''); }
function tenantLiffSigningText_(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function tenantLiffSigningConstantEquals_(a, b) { a = String(a || ''); b = String(b || ''); let d = a.length ^ b.length; for (let i=0; i<Math.max(a.length,b.length); i++) d |= (a.charCodeAt(i)||0) ^ (b.charCodeAt(i)||0); return d === 0; }
function tenantLiffSigningError_(code) { return { success: false, code: code, message: '房客簽署身分驗證失敗' }; }
