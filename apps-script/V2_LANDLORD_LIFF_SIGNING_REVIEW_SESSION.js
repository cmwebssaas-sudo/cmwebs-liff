// Server-verified, short-lived principal for native landlord signing review.
const V2_LANDLORD_SIGNING_REVIEW_AUTH_ACTION_ = 'landlord_contract_signing_review_auth_init';
const V2_LANDLORD_SIGNING_REVIEW_AUTH_STATUS_ACTION_ = 'landlord_contract_signing_review_auth_status';
const V2_LANDLORD_SIGNING_REVIEW_AUTH_PURPOSE_ = 'landlord_contract_signing_review';
const V2_LANDLORD_SIGNING_REVIEW_AUTH_TTL_SECONDS_ = 600;
const V2_LANDLORD_SIGNING_REVIEW_EXCHANGE_TTL_SECONDS_ = 60;

function landlordContractSigningReviewIsAuthRequest_(body) {
  try { return JSON.parse(String(body || '')).action === V2_LANDLORD_SIGNING_REVIEW_AUTH_ACTION_; } catch (_) { return false; }
}

function landlordContractSigningReviewHandleAuthPost_(body) {
  let request;
  try { request = JSON.parse(String(body || '')); } catch (_) { return landlordContractSigningReviewSessionError_('INVALID_JSON'); }
  if (!request || request.action !== V2_LANDLORD_SIGNING_REVIEW_AUTH_ACTION_) return landlordContractSigningReviewSessionError_('INVALID_ACTION');
  const requestId = landlordContractSigningReviewSessionText_(request.request_id);
  const pollSecret = landlordContractSigningReviewSessionText_(request.poll_secret);
  if (!landlordContractSigningReviewSessionText_(request.id_token)) return landlordContractSigningReviewSessionError_('MISSING_ID_TOKEN');
  if (!/^[A-Za-z0-9_-]{22,}$/.test(requestId) || !/^[A-Za-z0-9_-]{43,}$/.test(pollSecret)) return landlordContractSigningReviewSessionError_('INVALID_EXCHANGE_CREDENTIAL');
  let secret;
  try { secret = landlordContractSigningReviewSessionSecret_(); } catch (_) { return landlordContractSigningReviewSessionError_('LIFF_SESSION_SECRET_NOT_CONFIGURED'); }
  const result = landlordContractSigningReviewAuthenticate_(request.id_token);
  CacheService.getScriptCache().put(landlordContractSigningReviewExchangeKey_(requestId), JSON.stringify({
    poll_hash: landlordContractSigningReviewHmacHex_(pollSecret, secret), result: result
  }), V2_LANDLORD_SIGNING_REVIEW_EXCHANGE_TTL_SECONDS_);
  return { success: true, code: 'EXCHANGE_ACCEPTED' };
}

function landlordContractSigningReviewReadExchange_(requestId, pollSecret) {
  const raw = CacheService.getScriptCache().get(landlordContractSigningReviewExchangeKey_(requestId));
  if (!raw) return landlordContractSigningReviewSessionError_('AUTH_EXCHANGE_NOT_FOUND');
  let entry;
  try { entry = JSON.parse(raw); } catch (_) { return landlordContractSigningReviewSessionError_('AUTH_EXCHANGE_INVALID'); }
  let secret;
  try { secret = landlordContractSigningReviewSessionSecret_(); } catch (_) { return landlordContractSigningReviewSessionError_('LIFF_SESSION_SECRET_NOT_CONFIGURED'); }
  if (!landlordContractSigningReviewConstantEquals_(entry.poll_hash, landlordContractSigningReviewHmacHex_(pollSecret, secret))) return landlordContractSigningReviewSessionError_('AUTH_EXCHANGE_DENIED');
  CacheService.getScriptCache().remove(landlordContractSigningReviewExchangeKey_(requestId));
  return entry.result || landlordContractSigningReviewSessionError_('AUTH_EXCHANGE_INVALID');
}

function landlordContractSigningReviewAuthenticate_(idToken) {
  const channelId = PropertiesService.getScriptProperties().getProperty('CMWEBS_LINE_LOGIN_CHANNEL_ID');
  if (!channelId) return landlordContractSigningReviewSessionError_('LINE_LOGIN_CHANNEL_NOT_CONFIGURED');
  let response;
  try {
    response = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'post', muteHttpExceptions: true, contentType: 'application/x-www-form-urlencoded',
      payload: { id_token: String(idToken), client_id: channelId }
    });
  } catch (_) { return landlordContractSigningReviewSessionError_('LINE_TOKEN_VERIFY_FAILED'); }
  if (response.getResponseCode() !== 200) return landlordContractSigningReviewSessionError_('LINE_TOKEN_VERIFY_FAILED');
  let claims;
  try { claims = JSON.parse(response.getContentText()); } catch (_) { return landlordContractSigningReviewSessionError_('LINE_TOKEN_VERIFY_FAILED'); }
  const now = Math.floor(Date.now() / 1000);
  if (
    claims.iss !== 'https://access.line.me' || claims.aud !== channelId || !landlordContractSigningReviewSessionText_(claims.sub) ||
    !Number.isFinite(Number(claims.exp)) || Number(claims.exp) <= now ||
    !Number.isFinite(Number(claims.iat)) || Number(claims.iat) > now + 60 || now - Number(claims.iat) > 86400
  ) return landlordContractSigningReviewSessionError_('LINE_TOKEN_CLAIMS_INVALID');
  const principal = landlordContractSigningReviewResolvePrincipal_(claims.sub);
  if (!principal.success) return principal;
  const expiresAt = now + V2_LANDLORD_SIGNING_REVIEW_AUTH_TTL_SECONDS_;
  const token = createLandlordContractSigningReviewSessionToken_({
    version: 1,
    purpose: V2_LANDLORD_SIGNING_REVIEW_AUTH_PURPOSE_,
    line_sub: claims.sub,
    user_id: principal.data.user_id,
    membership_id: principal.data.membership_id,
    workspace_id: principal.data.workspace_id,
    issued_at: now,
    expires_at: expiresAt,
    jti: Utilities.getUuid()
  });
  return {
    success: true,
    code: 'OK',
    data: {
      session_token: token,
      session_expires_at: new Date(expiresAt * 1000).toISOString(),
      workspace_id: principal.data.workspace_id
    }
  };
}

function landlordContractSigningReviewResolvePrincipal_(lineUserId) {
  if (typeof workspaceLandlordResolveAccess_ !== 'function') return landlordContractSigningReviewSessionError_('WORKSPACE_ACCESS_MODULE_REQUIRED');
  const access = workspaceLandlordResolveAccess_(lineUserId, {
    skip_schema_ensure: true,
    skip_legacy_context_creation: true
  });
  if (!access || access.success !== true || !access.user || !access.workspace || !access.membership) {
    return landlordContractSigningReviewSessionError_((access && access.code) || 'WORKSPACE_ACCESS_DENIED');
  }
  return {
    success: true,
    data: {
      user_id: landlordContractSigningReviewSessionText_(access.user.user_id),
      membership_id: landlordContractSigningReviewSessionText_(access.membership.membership_id),
      workspace_id: landlordContractSigningReviewSessionText_(access.workspace.workspace_id)
    }
  };
}

function createLandlordContractSigningReviewSessionToken_(claims) {
  const payload = Utilities.base64EncodeWebSafe(JSON.stringify(claims)).replace(/=+$/g, '');
  return payload + '.' + landlordContractSigningReviewHmacHex_(payload, landlordContractSigningReviewSessionSecret_());
}

function verifyLandlordContractSigningReviewSessionToken_(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return landlordContractSigningReviewSessionError_('LANDLORD_REVIEW_SESSION_INVALID');
  let secret;
  try { secret = landlordContractSigningReviewSessionSecret_(); } catch (_) { return landlordContractSigningReviewSessionError_('LIFF_SESSION_SECRET_NOT_CONFIGURED'); }
  if (!landlordContractSigningReviewConstantEquals_(parts[1], landlordContractSigningReviewHmacHex_(parts[0], secret))) return landlordContractSigningReviewSessionError_('LANDLORD_REVIEW_SESSION_INVALID');
  let claims;
  try { claims = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()); } catch (_) { return landlordContractSigningReviewSessionError_('LANDLORD_REVIEW_SESSION_INVALID'); }
  if (claims.purpose !== V2_LANDLORD_SIGNING_REVIEW_AUTH_PURPOSE_ || Number(claims.expires_at) <= Math.floor(Date.now() / 1000)) return landlordContractSigningReviewSessionError_('LANDLORD_REVIEW_SESSION_EXPIRED');
  const principal = landlordContractSigningReviewResolvePrincipal_(claims.line_sub);
  if (!principal.success || principal.data.user_id !== claims.user_id || principal.data.membership_id !== claims.membership_id || principal.data.workspace_id !== claims.workspace_id) {
    return landlordContractSigningReviewSessionError_('LANDLORD_REVIEW_SESSION_PRINCIPAL_INVALID');
  }
  return { success: true, code: 'OK', data: claims };
}

function landlordContractSigningReviewSessionSecret_() {
  const secret = PropertiesService.getScriptProperties().getProperty('CMWEBS_LIFF_SESSION_HMAC_SECRET');
  if (!secret) throw new Error('CMWEBS_LIFF_SESSION_HMAC_SECRET is not configured');
  return secret;
}

function landlordContractSigningReviewHmacHex_(value, key) {
  return Utilities.computeHmacSha256Signature(String(value), String(key)).map(function (byte) {
    return ('0' + (byte < 0 ? byte + 256 : byte).toString(16)).slice(-2);
  }).join('');
}

function landlordContractSigningReviewExchangeKey_(requestId) { return 'landlord_signing_review_auth:' + String(requestId || ''); }
function landlordContractSigningReviewSessionText_(value) { return String(value == null ? '' : value).trim(); }
function landlordContractSigningReviewConstantEquals_(left, right) { left = String(left || ''); right = String(right || ''); let difference = left.length ^ right.length; for (let index = 0; index < Math.max(left.length, right.length); index += 1) difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0); return difference === 0; }
function landlordContractSigningReviewSessionError_(code) { return { success: false, code: code, message: '房東審核身分驗證失敗' }; }
