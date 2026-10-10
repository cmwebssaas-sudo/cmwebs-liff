/** Read-only environment configuration completeness validation. */

const V2_ENVIRONMENT_REQUIRED_KEYS_ = {
  staging: [
    'CMWEBS_ENVIRONMENT',
    'CMWEBS_SPREADSHEET_ID',
    'CMWEBS_LINE_LOGIN_CHANNEL_ID',
    'CMWEB_TENANT_LIFF_URL',
    'CMWEB_TENANT_FRONTEND_BASE_URL',
    'CMWEB_LANDLORD_FRONTEND_BASE_URL',
    'LINE_CHANNEL_ACCESS_TOKEN',
    'CMWEBS_LINE_VERIFY_TIMEOUT_MS',
    'CMWEBS_LINE_VERIFY_MAX_ATTEMPTS',
    'CMWEBS_NOTIFICATION_PROCESSING_TIMEOUT_MINUTES'
  ],
  production: [
    'CMWEBS_ENVIRONMENT',
    'CMWEBS_SPREADSHEET_ID',
    'CMWEBS_LINE_LOGIN_CHANNEL_ID',
    'CMWEB_TENANT_LIFF_URL',
    'CMWEB_TENANT_FRONTEND_BASE_URL',
    'CMWEB_LANDLORD_FRONTEND_BASE_URL',
    'LINE_CHANNEL_ACCESS_TOKEN',
    'CMWEBS_LINE_VERIFY_TIMEOUT_MS',
    'CMWEBS_LINE_VERIFY_MAX_ATTEMPTS',
    'CMWEBS_NOTIFICATION_PROCESSING_TIMEOUT_MINUTES'
  ]
};


function validateRuntimeEnvironmentConfiguration() {
  const environment = runtimeEnvironment_();
  const properties = PropertiesService.getScriptProperties();
  const required = V2_ENVIRONMENT_REQUIRED_KEYS_[environment] || [];
  const featureKeys = Object.keys(V2_RUNTIME_FEATURE_KEYS_).map(function (name) {
    return V2_RUNTIME_FEATURE_KEYS_[name];
  });
  const missing = required.filter(function (key) {
    return !String(properties.getProperty(key) || '').trim();
  });
  const unconfiguredFeatures = featureKeys.filter(function (key) {
    const value = String(properties.getProperty(key) || '').trim().toLowerCase();
    return ['true', 'false', '1', '0', 'enabled', 'disabled', 'on', 'off']
      .indexOf(value) < 0;
  });
  return {
    success: missing.length === 0 && unconfiguredFeatures.length === 0,
    code: missing.length === 0 && unconfiguredFeatures.length === 0
      ? 'ENVIRONMENT_CONFIGURATION_COMPLETE'
      : 'ENVIRONMENT_CONFIGURATION_INCOMPLETE',
    environment: environment,
    required_key_count: required.length,
    feature_key_count: featureKeys.length,
    missing_keys: missing,
    unconfigured_feature_keys: unconfiguredFeatures
  };
}
