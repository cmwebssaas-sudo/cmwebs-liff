/** Sanitized operational evidence for terminal LINE identity provider failures. */

const V2_SECURITY_FAILURE_QUEUE_SHEET_ = 'V2_SECURITY_FAILURE_QUEUE';
const V2_SECURITY_FAILURE_QUEUE_HEADERS_ = [
  'failure_id',
  'category',
  'action',
  'error_code',
  'status',
  'attempt_count',
  'provider_status',
  'provider_error',
  'created_at',
  'resolved_at'
];


function migrateSecurityFailureQueue() {
  runtimeRequireSchemaMigration_();
  runtimeRequireFeature_('SECURITY_FAILURE_QUEUE');
  const sheet = securityFailureQueueEnsureSheet_(true);
  return securityFailureQueueValidateSheet_(sheet);
}


function validateSecurityFailureQueueSchema() {
  runtimeRequireFeature_('SECURITY_FAILURE_QUEUE');
  return securityFailureQueueValidateSheet_(
    securityFailureQueueEnsureSheet_(false)
  );
}


function securityFailureQueueRecord_(failure) {
  if (!runtimeFeatureEnabled_('SECURITY_FAILURE_QUEUE')) {
    return { success: false, code: 'SECURITY_FAILURE_QUEUE_DISABLED' };
  }
  try {
    const sheet = securityFailureQueueEnsureSheet_(false);
    const record = {
      failure_id: 'SFQ-' + Utilities.getUuid().toUpperCase(),
      category: 'line_identity_provider',
      action: securityFailureQueueText_(failure && failure.action),
      error_code: securityFailureQueueText_(failure && failure.error_code),
      status: 'failed',
      attempt_count: Number(failure && failure.attempt_count) || 0,
      provider_status: Number(failure && failure.provider_status) || 0,
      provider_error: securityFailureQueueText_(
        failure && failure.provider_error
      ).slice(0, 120),
      created_at: new Date(),
      resolved_at: ''
    };
    sheet.appendRow(V2_SECURITY_FAILURE_QUEUE_HEADERS_.map(function (header) {
      return record[header] !== undefined ? record[header] : '';
    }));
    return { success: true, code: 'SECURITY_FAILURE_RECORDED' };
  } catch (error) {
    return { success: false, code: 'SECURITY_FAILURE_RECORD_FAILED' };
  }
}


function securityFailureQueueEnsureSheet_(allowCreate) {
  const ss = runtimeSpreadsheet_();
  let sheet = ss.getSheetByName(V2_SECURITY_FAILURE_QUEUE_SHEET_);
  if (!sheet && allowCreate === true) {
    sheet = ss.insertSheet(V2_SECURITY_FAILURE_QUEUE_SHEET_);
    sheet.appendRow(V2_SECURITY_FAILURE_QUEUE_HEADERS_);
  }
  if (!sheet) throw new Error('SECURITY_FAILURE_QUEUE_NOT_CONFIGURED');
  const validation = securityFailureQueueValidateSheet_(sheet);
  if (!validation.success) throw new Error(validation.code);
  return sheet;
}


function securityFailureQueueValidateSheet_(sheet) {
  const headers = sheet && sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(securityFailureQueueText_)
    : [];
  const missing = V2_SECURITY_FAILURE_QUEUE_HEADERS_.filter(function (header) {
    return headers.indexOf(header) < 0;
  });
  return {
    success: missing.length === 0,
    code: missing.length === 0 ? 'SECURITY_FAILURE_QUEUE_SCHEMA_OK' :
      'SECURITY_FAILURE_QUEUE_SCHEMA_INVALID',
    sheet: V2_SECURITY_FAILURE_QUEUE_SHEET_,
    header_count: headers.length,
    missing_headers: missing
  };
}


function securityFailureQueueText_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}
