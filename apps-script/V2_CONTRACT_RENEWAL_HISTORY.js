// ==================================================
// CMWebs V2 contract renewal history
// Append-only contract versions, renewal defaults, notice offers, and document references.
// ==================================================

const V2_CONTRACT_RENEWAL_HISTORY_CONTRACT_FIELDS_ = [
  'contract_family_id',
  'renewal_sequence',
  'renewed_from_contract_id',
  'renewed_to_contract_id',
  'renewal_request_id',
  'other_fixed_fee_amount',
  'other_fixed_fee_note',
  'monthly_payment_day',
  'terms_snapshot_json',
  'special_offer_enabled',
  'special_offer_notice_days',
  'special_offer_applies_to',
  'special_offer_waiver_type',
  'special_offer_clause',
  'special_offer_decision',
  'special_offer_notice_date',
  'special_offer_days_before_expiry',
  'special_offer_decision_reason',
  'identity_document_mode',
  'electricity_fee_rate',
  'equipment_fee_rate',
  'checkout_status',
  'checkout_source',
  'checkout_requested_at',
  'checkout_completed_at',
  'checkout_move_out_date',
  'checkout_note',
  'checkout_idempotency_key',
  'terminated_at'
];

const V2_CONTRACT_RENEWAL_HISTORY_REQUEST_FIELDS_ = [
  'current_deposit_amount',
  'current_other_fixed_fee_amount',
  'current_other_fixed_fee_note',
  'current_payment_day',
  'current_terms_snapshot_json',
  'requested_deposit_amount',
  'requested_other_fixed_fee_amount',
  'requested_other_fixed_fee_note',
  'requested_payment_day',
  'requested_terms_snapshot_json',
  'approved_deposit_amount',
  'approved_other_fixed_fee_amount',
  'approved_other_fixed_fee_note',
  'approved_payment_day',
  'approved_terms_snapshot_json',
  'requested_special_offer_enabled',
  'requested_special_offer_notice_days',
  'requested_special_offer_clause',
  'approved_special_offer_enabled',
  'approved_special_offer_notice_days',
  'approved_special_offer_clause',
  'special_offer_decision',
  'special_offer_notice_date',
  'special_offer_days_before_expiry',
  'special_offer_decision_reason',
  'identity_document_mode'
];

const V2_CONTRACT_RENEWAL_HISTORY_DOCUMENT_FIELDS_ = [
  'document_origin',
  'source_document_id'
];

const V2_CONTRACT_RENEWAL_HISTORY_DEFAULT_CLAUSE_ =
  '租約期滿如不再續約，提前30個日曆日通知，免收違約金。';

function contractRenewalHistoryText_(value) {
  return String(value == null ? '' : value).trim();
}

function contractRenewalHistoryDateOnly_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = contractRenewalHistoryText_(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return match[1] + '-' + match[2] + '-' + match[3];
  }

  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function contractRenewalHistoryUtcDate_(dateOnly) {
  const normalized = contractRenewalHistoryDateOnly_(dateOnly);
  if (!normalized) return null;
  const parts = normalized.split('-').map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return isNaN(date.getTime()) ? null : date;
}

function contractRenewalHistoryAddDays_(dateOnly, days) {
  const date = contractRenewalHistoryUtcDate_(dateOnly);
  if (!date) return '';
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function contractRenewalHistoryAddYearsMinusDay_(dateOnly, years) {
  const date = contractRenewalHistoryUtcDate_(dateOnly);
  if (!date) return '';
  date.setUTCFullYear(date.getUTCFullYear() + Number(years || 1));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function contractRenewalHistoryNumber_(value, fallback) {
  const number = Number(value);
  return isFinite(number) ? number : fallback;
}

function contractRenewalHistoryBoolean_(value, fallback) {
  if (value === true || value === false) return value;
  const text = contractRenewalHistoryText_(value).toLowerCase();
  if (['true', '1', 'yes', 'y', 'on', 'enabled'].indexOf(text) >= 0) return true;
  if (['false', '0', 'no', 'n', 'off', 'disabled'].indexOf(text) >= 0) return false;
  return fallback;
}

function contractRenewalHistoryNormalizeContract_(contract) {
  const row = contract || {};
  return {
    contract_id: contractRenewalHistoryText_(row.contract_id),
    workspace_id: contractRenewalHistoryText_(row.workspace_id),
    tenant_id: contractRenewalHistoryText_(row.tenant_id),
    room_id: contractRenewalHistoryText_(row.room_id),
    start_date: contractRenewalHistoryDateOnly_(row.start_date || row.contract_start_date),
    end_date: contractRenewalHistoryDateOnly_(row.end_date || row.contract_end_date),
    rent_amount: contractRenewalHistoryNumber_(row.rent_amount || row.monthly_rent, 0),
    management_fee: contractRenewalHistoryNumber_(row.management_fee || row.monthly_management_fee, 0),
    deposit_amount: contractRenewalHistoryNumber_(row.deposit_amount, 0),
    electricity_fee_rate: contractRenewalHistoryNumber_(row.electricity_fee_rate, 0),
    equipment_fee_rate: contractRenewalHistoryNumber_(row.equipment_fee_rate, 0),
    other_fixed_fee_amount: contractRenewalHistoryNumber_(row.other_fixed_fee_amount, 0),
    other_fixed_fee_note: contractRenewalHistoryText_(row.other_fixed_fee_note),
    monthly_payment_day: contractRenewalHistoryNumber_(row.monthly_payment_day || row.payment_day, 0),
    terms_snapshot_json: contractRenewalHistoryText_(row.terms_snapshot_json || row.contract_terms_snapshot),
    special_offer_enabled: contractRenewalHistoryBoolean_(row.special_offer_enabled, true),
    special_offer_notice_days: contractRenewalHistoryNumber_(row.special_offer_notice_days, 30),
    special_offer_clause: contractRenewalHistoryText_(row.special_offer_clause) || V2_CONTRACT_RENEWAL_HISTORY_DEFAULT_CLAUSE_,
    contract_family_id: contractRenewalHistoryText_(row.contract_family_id),
    renewal_sequence: contractRenewalHistoryNumber_(row.renewal_sequence, 0),
    renewed_from_contract_id: contractRenewalHistoryText_(row.renewed_from_contract_id || row.previous_contract_id),
    renewed_to_contract_id: contractRenewalHistoryText_(row.renewed_to_contract_id),
    contract_status: contractRenewalHistoryText_(row.contract_status || row.status).toLowerCase(),
    identity_document_mode: contractRenewalHistoryText_(row.identity_document_mode)
  };
}

function contractRenewalHistoryBuildDefaults_(previous, options) {
  const normalized = contractRenewalHistoryNormalizeContract_(previous);
  const startDate = normalized.end_date;
  const endDate = contractRenewalHistoryAddYearsMinusDay_(startDate, 1);
  return {
    start_date: startDate,
    end_date: endDate,
    term_months: 12,
    rent_amount: normalized.rent_amount,
    management_fee: normalized.management_fee,
    deposit_amount: normalized.deposit_amount,
    electricity_fee_rate: normalized.electricity_fee_rate,
    equipment_fee_rate: normalized.equipment_fee_rate,
    other_fixed_fee_amount: normalized.other_fixed_fee_amount,
    other_fixed_fee_note: normalized.other_fixed_fee_note,
    monthly_payment_day: normalized.monthly_payment_day,
    terms_snapshot_json: normalized.terms_snapshot_json,
    special_offer_enabled: true,
    special_offer_notice_days: 30,
    special_offer_applies_to: 'expiry_non_renewal',
    special_offer_waiver_type: 'breach_penalty_waived',
    special_offer_clause: V2_CONTRACT_RENEWAL_HISTORY_DEFAULT_CLAUSE_,
    identity_document_mode: 'optional'
  };
}

function contractRenewalHistoryResolveFamily_(previous, existingRows) {
  const normalized = contractRenewalHistoryNormalizeContract_(previous);
  const rows = Array.isArray(existingRows) ? existingRows : [];
  const familyId = normalized.contract_family_id || normalized.contract_id;
  let sequence = normalized.renewal_sequence > 0 ? normalized.renewal_sequence : 1;

  rows.forEach(function (row) {
    const candidate = contractRenewalHistoryNormalizeContract_(row);
    if (candidate.contract_family_id === familyId) {
      sequence = Math.max(sequence, candidate.renewal_sequence || 1);
    }
  });

  return {
    contract_family_id: familyId,
    renewal_sequence: sequence
  };
}

function contractRenewalHistoryBuildVersionFields_(previous, defaults, options) {
  const normalized = contractRenewalHistoryNormalizeContract_(previous);
  const family = contractRenewalHistoryResolveFamily_(previous, (options || {}).existing_rows || []);
  const optionRow = options || {};
  const source = defaults || {};

  return Object.assign({}, source, {
    contract_id: contractRenewalHistoryText_(optionRow.contract_id),
    contract_family_id: family.contract_family_id,
    renewal_sequence: family.renewal_sequence + 1,
    renewed_from_contract_id: normalized.contract_id,
    renewed_to_contract_id: '',
    renewal_request_id: contractRenewalHistoryText_(optionRow.renewal_request_id),
    special_offer_decision: '',
    special_offer_notice_date: '',
    special_offer_days_before_expiry: '',
    special_offer_decision_reason: '',
    identity_document_mode: 'optional'
  });
}

function contractRenewalHistoryEvaluateNotice_(contract, noticeDate, options) {
  const normalized = contractRenewalHistoryNormalizeContract_(contract);
  const optionRow = options || {};
  const event = contractRenewalHistoryText_(optionRow.event || 'expiry_non_renewal').toLowerCase();
  const normalizedNoticeDate = contractRenewalHistoryDateOnly_(noticeDate);
  const noticeDays = Math.max(0, contractRenewalHistoryNumber_(normalized.special_offer_notice_days, 30));
  const endDate = normalized.end_date;

  if (event === 'early_termination' || !normalized.special_offer_enabled) {
    return {
      applicable: false,
      decision: 'not_applicable',
      notice_date: normalizedNoticeDate,
      contract_end_date: endDate,
      notice_days: noticeDays,
      days_before_expiry: '',
      reason: event === 'early_termination' ? 'EARLY_TERMINATION_NOT_APPLICABLE' : 'OFFER_DISABLED'
    };
  }

  const notice = contractRenewalHistoryUtcDate_(normalizedNoticeDate);
  const expiry = contractRenewalHistoryUtcDate_(endDate);
  const daysBeforeExpiry = notice && expiry
    ? Math.floor((expiry.getTime() - notice.getTime()) / 86400000)
    : -1;
  const decision = daysBeforeExpiry >= noticeDays ? 'waived' : 'landlord_review';

  return {
    applicable: true,
    decision: decision,
    notice_date: normalizedNoticeDate,
    contract_end_date: endDate,
    notice_days: noticeDays,
    days_before_expiry: daysBeforeExpiry,
    reason: decision === 'waived' ? 'NOTICE_PERIOD_MET' : 'NOTICE_PERIOD_NOT_MET'
  };
}

function contractRenewalHistoryList_(rows) {
  const normalizedRows = (Array.isArray(rows) ? rows : []).map(function (row) {
    return Object.assign({}, row, contractRenewalHistoryNormalizeContract_(row), {
      read_only: true,
      is_current: false
    });
  });

  normalizedRows.sort(function (left, right) {
    const sequenceDifference = Number(left.renewal_sequence || 1) - Number(right.renewal_sequence || 1);
    if (sequenceDifference !== 0) return sequenceDifference;
    return contractRenewalHistoryText_(left.start_date).localeCompare(contractRenewalHistoryText_(right.start_date));
  });

  const currentCandidates = normalizedRows.filter(function (row) {
    return ['active', 'current'].indexOf(contractRenewalHistoryText_(row.contract_status || row.status).toLowerCase()) >= 0;
  });
  if (currentCandidates.length) {
    currentCandidates[currentCandidates.length - 1].is_current = true;
  }

  return normalizedRows;
}

function contractRenewalHistoryBuildReadModel_(rows, currentContract) {
  const allRows = Array.isArray(rows) ? rows : [];
  const current = contractRenewalHistoryNormalizeContract_(currentContract);
  const family = contractRenewalHistoryResolveFamily_(currentContract, allRows);
  const candidates = allRows.filter(function (row) {
    const candidate = contractRenewalHistoryNormalizeContract_(row);
    const candidateFamily = candidate.contract_family_id || candidate.contract_id;
    return candidateFamily === family.contract_family_id &&
      (!current.workspace_id || candidate.workspace_id === current.workspace_id) &&
      (!current.tenant_id || candidate.tenant_id === current.tenant_id) &&
      (!current.room_id || !candidate.room_id || candidate.room_id === current.room_id);
  });

  const listed = contractRenewalHistoryList_(candidates);
  const currentId = current.contract_id;
  listed.forEach(function (row) {
    row.is_current = Boolean(currentId && row.contract_id === currentId);
  });

  return listed.map(function (row) {
    return Object.assign({}, row, {
      contract_family_id: row.contract_family_id || family.contract_family_id,
      renewal_sequence: Number(row.renewal_sequence || 1),
      renewed_from_contract_id: row.renewed_from_contract_id || '',
      renewed_to_contract_id: row.renewed_to_contract_id || '',
      read_only: true
    });
  });
}

function contractRenewalHistoryBuildCarriedDocumentReference_(document, newContractId) {
  const source = document || {};
  return {
    contract_id: contractRenewalHistoryText_(newContractId),
    document_type: contractRenewalHistoryText_(source.document_type),
    file_name: contractRenewalHistoryText_(source.file_name),
    mime_type: contractRenewalHistoryText_(source.mime_type),
    sha256: contractRenewalHistoryText_(source.sha256),
    document_origin: 'carried_forward',
    source_document_id: contractRenewalHistoryText_(source.document_id),
    drive_file_id: contractRenewalHistoryText_(source.drive_file_id)
  };
}

function contractRenewalHistoryMissingHeaders_(headers, requiredHeaders) {
  const existing = (Array.isArray(headers) ? headers : []).map(function (header) {
    return contractRenewalHistoryText_(header);
  });
  return (Array.isArray(requiredHeaders) ? requiredHeaders : []).filter(function (header) {
    return existing.indexOf(header) === -1;
  });
}

function contractRenewalHistoryValidateSchema_(headers, requiredHeaders) {
  const missing = contractRenewalHistoryMissingHeaders_(headers, requiredHeaders);
  return {
    success: missing.length === 0,
    code: missing.length ? 'CONTRACT_RENEWAL_HISTORY_SCHEMA_NOT_READY' : 'OK',
    missing_headers: missing
  };
}

function contractRenewalHistoryAdditiveMigrationForTest_(sheet, requiredHeaders) {
  if (!sheet || typeof sheet.getLastColumn !== 'function' || typeof sheet.getRange !== 'function') {
    return {
      success: false,
      code: 'CONTRACT_RENEWAL_HISTORY_SCHEMA_NOT_READY',
      missing_headers: Array.isArray(requiredHeaders) ? requiredHeaders.slice() : []
    };
  }

  const headerWidth = Math.max(1, sheet.getLastColumn());
  const currentHeaders = sheet.getRange(1, 1, 1, headerWidth).getValues()[0];
  const missing = contractRenewalHistoryMissingHeaders_(currentHeaders, requiredHeaders);
  if (missing.length) {
    sheet.getRange(1, headerWidth + 1, 1, missing.length).setValues([missing]);
  }

  return {
    success: true,
    code: 'OK',
    added_headers: missing
  };
}

function contractRenewalHistoryEnsureHeaders_(sheet, requiredHeaders) {
  if (!sheet || typeof sheet.getLastColumn !== 'function' || typeof sheet.getRange !== 'function') {
    return {
      success: false,
      code: 'CONTRACT_RENEWAL_HISTORY_SCHEMA_NOT_READY',
      added_headers: []
    };
  }

  const currentWidth = Math.max(0, Number(sheet.getLastColumn()) || 0);
  const currentHeaders = currentWidth
    ? sheet.getRange(1, 1, 1, currentWidth).getDisplayValues()[0].map(contractRenewalHistoryText_)
    : [];
  const missing = contractRenewalHistoryMissingHeaders_(currentHeaders, requiredHeaders);
  if (missing.length) {
    sheet.getRange(1, currentWidth + 1, 1, missing.length).setValues([missing]);
  }

  return {
    success: true,
    code: 'OK',
    added_headers: missing
  };
}

function migrateV2ContractRenewalHistorySchema_(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const requiredSheets = {
      contracts: 'V2_contracts',
      requests: 'V2_contract_requests',
      documents: 'V2_contract_documents'
    };
    const sheets = {};
    const missingSheets = [];
    Object.keys(requiredSheets).forEach(function (key) {
      const sheet = ss && ss.getSheetByName(requiredSheets[key]);
      if (!sheet) {
        missingSheets.push(requiredSheets[key]);
      } else {
        sheets[key] = sheet;
      }
    });
    if (missingSheets.length) {
      return {
        success: false,
        code: 'CONTRACT_RENEWAL_HISTORY_SCHEMA_NOT_READY',
        data: {
          missing_sheets: missingSheets,
          added_headers: { contracts: [], requests: [], documents: [] }
        }
      };
    }

    const addedHeaders = {};
    const definitions = {
      contracts: V2_CONTRACT_RENEWAL_HISTORY_CONTRACT_FIELDS_,
      requests: V2_CONTRACT_RENEWAL_HISTORY_REQUEST_FIELDS_,
      documents: V2_CONTRACT_RENEWAL_HISTORY_DOCUMENT_FIELDS_
    };
    Object.keys(definitions).forEach(function (key) {
      const result = contractRenewalHistoryEnsureHeaders_(sheets[key], definitions[key]);
      if (!result.success) throw new Error('schema not ready: ' + key);
      addedHeaders[key] = result.added_headers;
    });

    return {
      success: true,
      code: 'OK',
      data: {
        migration: 'contract_renewal_history_additive_v1',
        added_headers: addedHeaders
      }
    };
  } catch (error) {
    return {
      success: false,
      code: 'CONTRACT_RENEWAL_HISTORY_SCHEMA_MIGRATION_FAILED',
      data: {
        added_headers: { contracts: [], requests: [], documents: [] },
        error: contractRenewalHistoryText_(error && error.message)
      }
    };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function contractRenewalHistoryResolveProductionSpreadsheet_() {
  if (typeof PropertiesService === 'undefined' ||
      typeof PropertiesService.getScriptProperties !== 'function' ||
      typeof runtimeSpreadsheet_ !== 'function') {
    throw new Error('PRODUCTION_SPREADSHEET_RESOLVER_REQUIRED');
  }

  const spreadsheetId = contractRenewalHistoryText_(
    PropertiesService.getScriptProperties().getProperty('CMWEBS_SPREADSHEET_ID')
  );
  if (!spreadsheetId) throw new Error('PRODUCTION_SPREADSHEET_REFERENCE_REQUIRED');

  const spreadsheet = runtimeSpreadsheet_(spreadsheetId);
  if (!spreadsheet || typeof spreadsheet.getSheetByName !== 'function') {
    throw new Error('PRODUCTION_SPREADSHEET_REFERENCE_REQUIRED');
  }
  return spreadsheet;
}

function runV2ContractRenewalHistoryProductionMigration() {
  return migrateV2ContractRenewalHistorySchema_(
    contractRenewalHistoryResolveProductionSpreadsheet_()
  );
}
