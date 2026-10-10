/**
 * Server-verified LINE identity boundary.
 *
 * The caller never chooses the runtime LINE UID. The LIFF ID token is verified
 * by LINE and the verified `sub` claim becomes the only request identity.
 */

const V2_LINE_IDENTITY_CHANNEL_PROPERTY_ = 'CMWEBS_LINE_LOGIN_CHANNEL_ID';
const V2_LINE_VERIFY_TIMEOUT_PROPERTY_ = 'CMWEBS_LINE_VERIFY_TIMEOUT_MS';
const V2_LINE_VERIFY_ATTEMPTS_PROPERTY_ = 'CMWEBS_LINE_VERIFY_MAX_ATTEMPTS';
const V2_LINE_VERIFY_ENDPOINT_ = 'https://api.line.me/oauth2/v2.1/verify';


function securityResolveVerifiedLineIdentity_(request, action) {
  const parameter = request && request.parameter ? request.parameter : {};
  const method = String(request && request.__httpMethod || 'GET').toUpperCase();

  if (method !== 'POST') {
    return securityIdentityFailure_(
      'AUTH_POST_REQUIRED',
      'Authenticated API requests must use POST'
    );
  }

  if (
    String(parameter.test || '') === '1' &&
    runtimeFeatureEnabled_('ALLOW_TEST_IDENTITY')
  ) {
    const testUid = String(
      PropertiesService.getScriptProperties().getProperty('TEST_TENANT_LINE_UID') || ''
    ).trim();
    if (!/^U[0-9a-f]{32}$/i.test(testUid)) {
      return securityIdentityFailure_(
        'TEST_IDENTITY_NOT_CONFIGURED',
        'Server-side test identity is not configured'
      );
    }
    return {
      success: true,
      line_user_id: testUid,
      source: 'script_property',
      action: String(action || '')
    };
  }

  const idToken = String(parameter.id_token || '').trim();
  if (!idToken || idToken.length > 4096) {
    return securityIdentityFailure_(
      'LINE_ID_TOKEN_REQUIRED',
      'A valid LINE ID token is required'
    );
  }

  const channelId = String(
    PropertiesService.getScriptProperties()
      .getProperty(V2_LINE_IDENTITY_CHANNEL_PROPERTY_) || ''
  ).trim();
  if (!/^\d+$/.test(channelId)) {
    return securityIdentityFailure_(
      'LINE_LOGIN_CHANNEL_NOT_CONFIGURED',
      'LINE Login channel is not configured'
    );
  }

  const verification = securityVerifyLineIdToken_(idToken, channelId, action);
  if (!verification.success) return verification;

  const status = verification.status;
  const response = verification.response;
  let payload = {};
  try {
    payload = JSON.parse(String(response.getContentText() || '{}'));
  } catch (error) {
    payload = {};
  }

  const subject = String(payload.sub || '').trim();
  const audience = String(payload.aud || '').trim();
  const expiresAt = Number(payload.exp) || 0;
  if (
    status !== 200 ||
    !/^U[0-9a-f]{32}$/i.test(subject) ||
    audience !== channelId ||
    expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    return securityIdentityFailure_(
      'LINE_ID_TOKEN_INVALID',
      'LINE identity verification failed'
    );
  }

  return {
    success: true,
    line_user_id: subject,
    source: 'line_id_token',
    action: String(action || '')
  };
}


function securityVerifyLineIdToken_(idToken, channelId, action) {
  const timeoutMs = securityLineVerifyTimeoutMs_();
  const maxAttempts = securityLineVerifyMaxAttempts_();
  const startedAt = Date.now();
  let lastStatus = 0;
  let lastError = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response;
    try {
      response = UrlFetchApp.fetch(V2_LINE_VERIFY_ENDPOINT_, {
        method: 'post',
        contentType: 'application/x-www-form-urlencoded',
        payload: {
          id_token: idToken,
          client_id: channelId
        },
        muteHttpExceptions: true
      });
      lastStatus = Number(response.getResponseCode()) || 0;
      if (Date.now() - startedAt > timeoutMs) {
        return securityLineVerifyProviderFailure_(
          'LINE_IDENTITY_PROVIDER_TIMEOUT',
          'LINE identity verification timed out',
          action,
          attempt,
          lastStatus
        );
      }
      if (lastStatus < 500 && lastStatus !== 429) {
        return { success: true, response: response, status: lastStatus };
      }
      lastError = 'HTTP_' + lastStatus;
    } catch (error) {
      lastError = String(error && error.message || 'FETCH_FAILED').slice(0, 120);
    }

    if (attempt < maxAttempts && Date.now() - startedAt < timeoutMs) {
      Utilities.sleep(Math.min(250 * attempt, 500));
    }
  }

  return securityLineVerifyProviderFailure_(
    'LINE_IDENTITY_PROVIDER_UNAVAILABLE',
    'LINE identity verification is temporarily unavailable',
    action,
    maxAttempts,
    lastStatus,
    lastError
  );
}


function securityLineVerifyProviderFailure_(
  code,
  message,
  action,
  attempts,
  providerStatus,
  providerError
) {
  if (typeof securityFailureQueueRecord_ === 'function') {
    securityFailureQueueRecord_({
      action: String(action || ''),
      error_code: code,
      attempt_count: Number(attempts) || 0,
      provider_status: Number(providerStatus) || 0,
      provider_error: String(providerError || '').slice(0, 120)
    });
  }
  return securityIdentityFailure_(code, message);
}


function securityLineVerifyTimeoutMs_() {
  const value = Number(
    PropertiesService.getScriptProperties()
      .getProperty(V2_LINE_VERIFY_TIMEOUT_PROPERTY_)
  );
  return Math.max(1000, Math.min(value || 5000, 10000));
}


function securityLineVerifyMaxAttempts_() {
  const value = Number(
    PropertiesService.getScriptProperties()
      .getProperty(V2_LINE_VERIFY_ATTEMPTS_PROPERTY_)
  );
  return Math.max(1, Math.min(value || 2, 3));
}


function securityIdentityFailure_(code, message) {
  return {
    success: false,
    code: String(code || 'AUTH_FAILED'),
    message: String(message || 'Authentication failed'),
    data: null
  };
}
