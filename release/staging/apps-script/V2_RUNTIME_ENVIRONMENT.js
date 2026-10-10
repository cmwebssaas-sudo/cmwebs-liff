/**
 * CMWebs V2 runtime environment configuration.
 *
 * Staging never falls back to production URLs. Values are read lazily so an
 * unrelated Apps Script function can still load when an optional integration
 * has not been configured.
 */
const V2_RUNTIME_ENVIRONMENT_KEYS_ = {
  environment: 'CMWEBS_ENVIRONMENT',
  tenantLiffUrl: 'CMWEB_TENANT_LIFF_URL',
  tenantFrontendBaseUrl: 'CMWEB_TENANT_FRONTEND_BASE_URL',
  landlordFrontendBaseUrl: 'CMWEB_LANDLORD_FRONTEND_BASE_URL',
  lineAddFriendUrl: 'CMWEB_LINE_ADD_FRIEND_URL'
};

const V2_RUNTIME_FEATURE_KEYS_ = {
  ALLOW_TEST_IDENTITY: 'CMWEBS_FEATURE_ALLOW_TEST_IDENTITY',
  SCHEMA_MIGRATIONS: 'CMWEBS_FEATURE_SCHEMA_MIGRATIONS',
  NOTIFICATION_QUEUE: 'CMWEBS_FEATURE_NOTIFICATION_QUEUE',
  REPAIR_WORKFLOW: 'CMWEBS_FEATURE_REPAIR_WORKFLOW',
  LEASE_LIFECYCLE: 'CMWEBS_FEATURE_LEASE_LIFECYCLE',
  BILLING_LIFECYCLE: 'CMWEBS_FEATURE_BILLING_LIFECYCLE',
  MOVE_OUT_SETTLEMENT: 'CMWEBS_FEATURE_MOVE_OUT_SETTLEMENT',
  SECURITY_FAILURE_QUEUE: 'CMWEBS_FEATURE_SECURITY_FAILURE_QUEUE'
};

function runtimeEnvironment_() {
  const value = runtimeEnvironmentProperty_(
    V2_RUNTIME_ENVIRONMENT_KEYS_.environment
  ).toLowerCase();

  if (value === 'staging') {
    return 'staging';
  }

  if (value === 'production' || value === 'prod') {
    return 'production';
  }

  throw runtimeEnvironmentError_(
    'RUNTIME_ENVIRONMENT_NOT_CONFIGURED',
    'Runtime environment is not configured'
  );
}


function runtimeFeatureEnabled_(featureName) {
  const key = V2_RUNTIME_FEATURE_KEYS_[String(featureName || '').toUpperCase()];
  if (!key) return false;
  const value = runtimeEnvironmentProperty_(key).toLowerCase();
  return value === '1' || value === 'true' || value === 'enabled' || value === 'on';
}


function runtimeRequireFeature_(featureName) {
  const normalized = String(featureName || '').toUpperCase();
  if (!runtimeFeatureEnabled_(normalized)) {
    throw runtimeEnvironmentError_(
      'FEATURE_DISABLED',
      'Runtime feature is disabled: ' + normalized
    );
  }
  return true;
}


function runtimeRequireSchemaMigration_() {
  runtimeEnvironment_();
  return runtimeRequireFeature_('SCHEMA_MIGRATIONS');
}


function runtimeRequireRouteFeature_(action) {
  const route = String(action || '').trim();
  const routeFeatures = {
    tenant_repairs_init: 'REPAIR_WORKFLOW',
    tenant_repair_create: 'REPAIR_WORKFLOW',
    landlord_repairs_init: 'REPAIR_WORKFLOW',
    landlord_repair_update: 'REPAIR_WORKFLOW',
    landlord_contracts_init: 'LEASE_LIFECYCLE',
    landlord_contract_create: 'LEASE_LIFECYCLE',
    landlord_contract_update: 'LEASE_LIFECYCLE',
    landlord_contract_activate: 'LEASE_LIFECYCLE',
    landlord_contract_status_update: 'LEASE_LIFECYCLE',
    landlord_contract_delete: 'LEASE_LIFECYCLE',
    landlord_billing_lifecycle_init: 'BILLING_LIFECYCLE',
    landlord_contract_bill_generate: 'BILLING_LIFECYCLE',
    landlord_bill_payment_confirm: 'BILLING_LIFECYCLE',
    tenant_move_out_requests_init: 'MOVE_OUT_SETTLEMENT',
    tenant_move_out_request_create: 'MOVE_OUT_SETTLEMENT',
    landlord_move_out_requests_init: 'MOVE_OUT_SETTLEMENT',
    landlord_move_out_inspection_schedule: 'MOVE_OUT_SETTLEMENT',
    landlord_move_out_inspection_complete: 'MOVE_OUT_SETTLEMENT',
    landlord_deposit_refund_confirm: 'MOVE_OUT_SETTLEMENT'
  };
  if (routeFeatures[route]) runtimeRequireFeature_(routeFeatures[route]);
  return true;
}


function runtimeTenantLiffUrl_(parameters) {
  const environment = runtimeEnvironment_();
  const configuredUrl = runtimeEnvironmentProperty_(
    V2_RUNTIME_ENVIRONMENT_KEYS_.tenantLiffUrl
  );

  if (!configuredUrl) {
    throw runtimeEnvironmentError_(
      environment === 'staging'
        ? 'STAGING_LIFF_NOT_CONFIGURED'
        : 'RUNTIME_LIFF_NOT_CONFIGURED',
      'Tenant LIFF URL is not configured'
    );
  }

  if (!runtimeLiffUrlIsValid_(configuredUrl)) {
    throw runtimeEnvironmentError_(
      environment === 'staging'
        ? 'STAGING_LIFF_INVALID'
        : 'RUNTIME_LIFF_INVALID',
      'Tenant LIFF URL is invalid'
    );
  }

  return runtimeAppendUrlParameters_(configuredUrl, parameters);
}


function runtimeLiffUrl_(parameters) {
  return runtimeTenantLiffUrl_(parameters);
}


function runtimeTenantFrontendBaseUrl_() {
  const environment = runtimeEnvironment_();
  return runtimeRequiredBaseUrl_(
    V2_RUNTIME_ENVIRONMENT_KEYS_.tenantFrontendBaseUrl,
    environment === 'staging'
      ? 'STAGING_TENANT_FRONTEND_NOT_CONFIGURED'
      : 'RUNTIME_TENANT_FRONTEND_NOT_CONFIGURED',
    environment === 'staging'
      ? 'STAGING_TENANT_FRONTEND_INVALID'
      : 'RUNTIME_TENANT_FRONTEND_INVALID',
    'Tenant frontend URL is not configured',
    'Tenant frontend URL is invalid'
  );
}


function runtimeLandlordFrontendBaseUrl_() {
  const environment = runtimeEnvironment_();

  return runtimeRequiredBaseUrl_(
    V2_RUNTIME_ENVIRONMENT_KEYS_.landlordFrontendBaseUrl,
    environment === 'staging'
      ? 'STAGING_LANDLORD_FRONTEND_NOT_CONFIGURED'
      : 'RUNTIME_LANDLORD_FRONTEND_NOT_CONFIGURED',
    environment === 'staging'
      ? 'STAGING_LANDLORD_FRONTEND_INVALID'
      : 'RUNTIME_LANDLORD_FRONTEND_INVALID',
    'Landlord frontend URL is not configured',
    'Landlord frontend URL is invalid'
  );
}


function runtimeLandlordFrontendUrl_(pagePath, parameters) {
  const path = String(pagePath || '').trim();

  if (!/^\/?[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/.test(path)) {
    throw runtimeEnvironmentError_(
      'RUNTIME_FRONTEND_PATH_INVALID',
      'Frontend path is invalid'
    );
  }

  return runtimeAppendUrlParameters_(
    runtimeLandlordFrontendBaseUrl_() +
      '/' +
      path.replace(/^\/+/, ''),
    parameters
  );
}


function runtimeLandlordActionUrl_(pagePath, parameters) {
  try {
    return runtimeLandlordFrontendUrl_(pagePath, parameters);
  } catch (error) {
    if (
      error &&
      (
        error.code === 'STAGING_LANDLORD_FRONTEND_NOT_CONFIGURED' ||
        error.code === 'RUNTIME_LANDLORD_FRONTEND_NOT_CONFIGURED'
      )
    ) {
      return '';
    }

    throw error;
  }
}


function runtimeLineAddFriendUrl_() {
  const environment = runtimeEnvironment_();
  const configuredUrl = runtimeEnvironmentProperty_(
    V2_RUNTIME_ENVIRONMENT_KEYS_.lineAddFriendUrl
  );

  if (!configuredUrl) {
    throw runtimeEnvironmentError_(
      environment === 'staging'
        ? 'STAGING_LINE_ADD_FRIEND_NOT_CONFIGURED'
        : 'RUNTIME_LINE_ADD_FRIEND_NOT_CONFIGURED',
      'LINE add-friend URL is not configured'
    );
  }

  const parsed = runtimeParseHttpsUrl_(configuredUrl);

  if (
    !parsed ||
    parsed.host !== 'line.me' ||
    !/^\/R\/ti\/p\/[A-Za-z0-9@._~-]+$/.test(parsed.path) ||
    parsed.query ||
    parsed.hash
  ) {
    throw runtimeEnvironmentError_(
      environment === 'staging'
        ? 'STAGING_LINE_ADD_FRIEND_INVALID'
        : 'RUNTIME_LINE_ADD_FRIEND_INVALID',
      'LINE add-friend URL is invalid'
    );
  }

  return configuredUrl;
}


function runtimeRequiredBaseUrl_(
  propertyKey,
  missingCode,
  invalidCode,
  missingMessage,
  invalidMessage
) {
  const configuredUrl = runtimeEnvironmentProperty_(propertyKey);

  if (!configuredUrl) {
    throw runtimeEnvironmentError_(missingCode, missingMessage);
  }

  const parsed = runtimeParseHttpsUrl_(configuredUrl);

  if (
    !parsed ||
    parsed.query ||
    parsed.hash ||
    parsed.path === '/' ||
    /\/$/.test(configuredUrl)
  ) {
    throw runtimeEnvironmentError_(invalidCode, invalidMessage);
  }

  return configuredUrl;
}


function runtimeLiffUrlIsValid_(value) {
  const parsed = runtimeParseHttpsUrl_(value);

  return Boolean(
    parsed &&
    parsed.host === 'liff.line.me' &&
    /^\/[0-9]+-[A-Za-z0-9]+$/.test(parsed.path) &&
    !parsed.query &&
    !parsed.hash
  );
}


function runtimeParseHttpsUrl_(value) {
  const text = String(value || '').trim();
  const match = text.match(
    /^(https):\/\/([A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?)(\/[A-Za-z0-9._~!$&'()*+,;=:@%\/-]*)?(\?[^#]*)?(#.*)?$/
  );

  if (!match) {
    return null;
  }

  if (
    match[2].indexOf('..') >= 0 ||
    match[2].indexOf('.') < 0
  ) {
    return null;
  }

  return {
    scheme: match[1].toLowerCase(),
    host: match[2].toLowerCase(),
    path: match[3] || '',
    query: match[4] || '',
    hash: match[5] || ''
  };
}


function runtimeAppendUrlParameters_(baseUrl, parameters) {
  const pairs = [];

  Object.keys(parameters || {})
    .sort()
    .forEach(function (key) {
      const value = parameters[key];

      if (value === undefined || value === null || value === '') {
        return;
      }

      pairs.push(
        encodeURIComponent(String(key)) +
        '=' +
        encodeURIComponent(String(value))
      );
    });

  if (pairs.length === 0) {
    return baseUrl;
  }

  return (
    baseUrl +
    (baseUrl.indexOf('?') >= 0 ? '&' : '?') +
    pairs.join('&')
  );
}


function runtimeEnvironmentProperty_(key) {
  return String(
    PropertiesService
      .getScriptProperties()
      .getProperty(key) || ''
  ).trim();
}


function runtimeEnvironmentError_(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
