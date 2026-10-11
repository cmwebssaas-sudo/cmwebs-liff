/** Verified LINE credentials for the normal LIFF request transport. */
function lineRequestAuthRequired_() {
  return { success: false, code: 'AUTH_REQUIRED', message: '請重新登入後再試', data: null };
}

function lineRequestNeedsIdentity_(action) {
  const name = String(action || '');
  return /^landlord_/.test(name) || /^tenant_.*_submit$/.test(name) ||
    ['tenant_contract_request_cancel', 'tenant_contract_renewal_intent'].indexOf(name) >= 0;
}

function lineRequestClaimsValid_(claims, channelId) {
  return !!claims && claims.iss === 'https://access.line.me' && claims.aud === channelId &&
    typeof claims.sub === 'string' && !!claims.sub.trim() &&
    typeof claims.exp === 'number' && Number.isFinite(claims.exp) && claims.exp > Math.floor(Date.now() / 1000);
}

function verifyLandlordLineIdToken_(idToken) {
  const token = typeof idToken === 'string' ? idToken.trim() : '';
  if (!token || token.length > 8192) return lineRequestAuthRequired_();
  try {
    const channelId = PropertiesService.getScriptProperties().getProperty('CMWEBS_LINE_LOGIN_CHANNEL_ID');
    if (!channelId) return lineRequestAuthRequired_();
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, channelId + ':' + token, Utilities.Charset.UTF_8)
      .map(function (byte) { return ('0' + (byte & 255).toString(16)).slice(-2); }).join('');
    const key = 'v2_line_identity:' + digest;
    const cache = CacheService.getScriptCache();
    let claims;
    try { claims = JSON.parse(cache.get(key) || 'null'); } catch (_) { claims = null; }
    if (lineRequestClaimsValid_(claims, channelId)) return { success: true, data: claims };
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
    return { success: true, data: principal };
  } catch (_) {
    return lineRequestAuthRequired_();
  }
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
