(function (global) {
  'use strict';
  const exchangeActions = new Set([
    'landlord_contract_initiated_status',
    'landlord_contract_signing_review_auth_status',
    'landlord_contract_signing_reviews_fetch_status',
    'landlord_contract_signing_review_update_status'
  ]);
  function idToken() {
    const sdk = global.liff;
    // LIFF SDK 2.31+ throws before liff.init(); treat that as no token.
    try {
      return sdk && typeof sdk.getIDToken === 'function' ? String(sdk.getIDToken() || '') : '';
    } catch (error) {
      return '';
    }
  }
  global.CMWebsLiffRequestAuth = {
    getIdToken: idToken,
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
