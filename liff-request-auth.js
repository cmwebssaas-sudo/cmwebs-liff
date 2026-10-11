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
    return sdk && typeof sdk.getIDToken === 'function' ? String(sdk.getIDToken() || '') : '';
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
      return url.href;
    }
  };
})(window);
