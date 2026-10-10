(function (global) {
  'use strict';

  const supplied = global.CMWEB_ENV_OVERRIDES || {};

  const config = Object.freeze({
    environment: 'staging',
    apiUrl: supplied.apiUrl,
    liffId: supplied.liffId,
    testLineUserId: supplied.testLineUserId
  });

  function requireStagingValue_(key) {
    const value = String(config[key] || '').trim();

    if (
      config.environment !== 'staging' ||
      !value ||
      value.indexOf('__REQUIRED_') === 0 ||
      value.indexOf('__SET_') === 0
    ) {
      throw new Error('Missing required staging environment setting: ' + key);
    }

    return value;
  }

  function optionalStagingValue_(key) {
    const value = String(config[key] || '').trim();

    if (
      !value ||
      value.indexOf('__REQUIRED_') === 0 ||
      value.indexOf('__SET_') === 0
    ) {
      return '';
    }

    return value;
  }

  global.CMWEB_RUNTIME_CONFIG = Object.freeze({
    environment: 'staging',
    apiUrl: requireStagingValue_('apiUrl'),
    liffId: requireStagingValue_('liffId'),
    testLineUserId: optionalStagingValue_('testLineUserId')
  });
})(window);
