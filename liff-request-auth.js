(function (global) {
  'use strict';
  const exchangeActions = new Set([
    'landlord_contract_initiated_status',
    'landlord_contract_signing_review_auth_status',
    'landlord_contract_signing_reviews_fetch_status',
    'landlord_contract_signing_review_update_status'
  ]);
  const RELOGIN_KEY = 'cmwebs_line_id_token_relogin_at';
  const RELOGIN_GUARD_MS = 120000;
  const EXPIRY_MARGIN_MS = 30000;
  let reloginStarted = false;
  function idTokenExpired() {
    const sdk = global.liff;
    try {
      const decoded = sdk && typeof sdk.getDecodedIDToken === 'function' ? sdk.getDecodedIDToken() : null;
      const exp = Number(decoded && decoded.exp);
      return exp > 0 && exp * 1000 <= Date.now() + EXPIRY_MARGIN_MS;
    } catch (error) {
      return false;
    }
  }
  function currentPageRedirectUri() {
    const url = new URL(global.location.href);
    ['code', 'state', 'liffClientId', 'liffRedirectUri', 'error', 'error_description']
      .forEach(function (key) { url.searchParams.delete(key); });
    return url.href;
  }
  // An external browser keeps LIFF's 30-day access token, so getProfile()
  // still works after the one-hour ID token that Apps Script verifies has
  // expired. Log in again for a fresh one; the LINE app renews it on launch.
  // Returns true once the redirect has started. The guard stops a skewed
  // device clock from looping; the server then decides on the token.
  function reloginIfIdTokenExpired(redirectUri) {
    const sdk = global.liff;
    try {
      if (!sdk || !sdk.isLoggedIn() || sdk.isInClient() || !idTokenExpired()) return false;
      const last = Number(global.sessionStorage.getItem(RELOGIN_KEY)) || 0;
      if (Date.now() - last < RELOGIN_GUARD_MS) return false;
      global.sessionStorage.setItem(RELOGIN_KEY, String(Date.now()));
      reloginStarted = true;
      sdk.logout();
      sdk.login({ redirectUri: redirectUri || currentPageRedirectUri() });
      return true;
    } catch (error) {
      return false;
    }
  }
  function idToken() {
    const sdk = global.liff;
    // While the login redirect runs, send no token rather than the expired one.
    if (reloginStarted || reloginIfIdTokenExpired()) return '';
    // LIFF SDK 2.31+ throws before liff.init(); treat that as no token.
    try {
      return sdk && typeof sdk.getIDToken === 'function' ? String(sdk.getIDToken() || '') : '';
    } catch (error) {
      return '';
    }
  }
  global.CMWebsLiffRequestAuth = {
    getIdToken: idToken,
    idTokenExpired: idTokenExpired,
    reloginIfIdTokenExpired: reloginIfIdTokenExpired,
    withIdToken(input) {
      const url = new URL(input, global.location.href);
      const action = url.searchParams.get('v2_action') || '';
      if (!action || exchangeActions.has(action)) return url.href;
      const token = idToken();
      if (!token && (/^landlord_/.test(action) || /^tenant_.*_submit$/.test(action) ||
        ['tenant_contract_request_cancel', 'tenant_contract_renewal_intent'].includes(action))) {
        throw Object.assign(new Error('AUTH_REQUIRED'), { code: 'AUTH_REQUIRED' });
      }
      url.searchParams.delete('id_token');
      if (token) url.searchParams.set('id_token', token);
      // Legacy pages still share this JSONP transport. Observe only its own
      // existing callback so successful writes protect subsequent page reads.
      const callback = url.searchParams.get('callback') || '';
      if (/^landlord_/.test(action) && /^[A-Za-z_$][\w$]*$/.test(callback) && typeof global[callback] === 'function') {
        const original = global[callback];
        global[callback] = function (result) {
          try {
            if (global.CMWebsLandlordAuth && typeof global.CMWebsLandlordAuth.observeResponse === 'function') {
              global.CMWebsLandlordAuth.observeResponse(action,result);
            }
          } catch (error) {}
          return original.apply(this,arguments);
        };
      }
      return url.href;
    }
  };
})(window);
