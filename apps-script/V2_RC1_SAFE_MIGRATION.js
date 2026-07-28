/**
 * Additive-only CMWebs V2 RC1 schema migration.
 *
 * The caller owns Spreadsheet selection. This module never resolves a
 * Spreadsheet, reads runtime configuration, or performs transport work.
 */

const CMWEBS_V2_RC1_SCHEMA_VERSION_ = 'CMWEBS_V2_RC1';

// These SHA-256 fingerprints bind the production-only entrypoint without
// storing a Script ID, Spreadsheet ID, or any Script Property value in source.
const CMWEBS_V2_RC1_PRODUCTION_SCRIPT_FINGERPRINT_ =
  '601b2190f15a93eb5bbcbb1ade48922b1352825d32bb01add37c28ca1f8fa985';
const CMWEBS_V2_RC1_PRODUCTION_SPREADSHEET_FINGERPRINT_ =
  '1c1c92cfbeec9dc9be83979985183cc4baa4dc66564d84c8a15a366f0f3a22a6';

const CMWEBS_V2_RC1_METADATA_SCHEMA_ = [
  {
    name: 'V2_rc1_schema_versions',
    headers: ['schema_key', 'schema_version']
  },
  {
    name: 'V2_rc1_migration_ledger',
    headers: ['migration_key', 'schema_version']
  }
];


function migrateCmwebsV2Rc1Spreadsheet_(spreadsheet, options) {
  const result = {
    createdSheets: [],
    addedColumns: [],
    unchangedSheets: [],
    unsafeDeltas: [],
    schemaVersionBefore: '',
    schemaVersionAfter: ''
  };

  if (!spreadsheet || typeof spreadsheet.getSheetByName !== 'function') {
    result.unsafeDeltas.push({
      code: 'UNSAFE_SCHEMA_DELTA',
      reason: 'SPREADSHEET_REQUIRED'
    });
    return result;
  }

  const normalizedOptions = options || {};
  const schemaVersion = rc1MigrationText_(
    normalizedOptions.schemaVersion || CMWEBS_V2_RC1_SCHEMA_VERSION_
  );
  const schema = rc1MigrationBuildSchema_(
    normalizedOptions.requiredSheets
  );

  if (!schemaVersion || schema.errors.length) {
    result.unsafeDeltas = schema.errors.length
      ? schema.errors
      : [{ code: 'UNSAFE_SCHEMA_DELTA', reason: 'SCHEMA_VERSION_REQUIRED' }];
    return result;
  }

  const plans = schema.entries.map(function (definition) {
    return rc1MigrationPlanSheet_(spreadsheet, definition);
  });

  plans.forEach(function (plan) {
    result.unsafeDeltas = result.unsafeDeltas.concat(plan.unsafeDeltas);
  });

  if (result.unsafeDeltas.length) {
    return result;
  }

  const versionPlan = plans.find(function (plan) {
    return plan.definition.name === 'V2_rc1_schema_versions';
  });
  const ledgerPlan = plans.find(function (plan) {
    return plan.definition.name === 'V2_rc1_migration_ledger';
  });
  const versionState = rc1MigrationReadMarker_(
    versionPlan.sheet,
    'schema_key',
    CMWEBS_V2_RC1_SCHEMA_VERSION_
  );
  const ledgerState = rc1MigrationReadMarker_(
    ledgerPlan.sheet,
    'migration_key',
    CMWEBS_V2_RC1_SCHEMA_VERSION_
  );

  result.schemaVersionBefore = versionState.value;

  if (versionState.duplicate || ledgerState.duplicate) {
    result.unsafeDeltas.push({
      code: 'UNSAFE_SCHEMA_DELTA',
      reason: versionState.duplicate
        ? 'DUPLICATE_SCHEMA_VERSION_MARKER'
        : 'DUPLICATE_MIGRATION_MARKER'
    });
    return result;
  }

  if (
    (versionState.value && versionState.value !== schemaVersion) ||
    (ledgerState.value && ledgerState.value !== schemaVersion)
  ) {
    result.unsafeDeltas.push({
      code: 'UNSAFE_SCHEMA_DELTA',
      reason: 'CONFLICTING_SCHEMA_VERSION_MARKER'
    });
    return result;
  }

  plans.forEach(function (plan) {
    let sheet = plan.sheet;

    if (!sheet) {
      sheet = spreadsheet.insertSheet(plan.definition.name);
      sheet.getRange(1, 1, 1, plan.definition.headers.length).setValues([
        plan.definition.headers
      ]);
      plan.sheet = sheet;
      result.createdSheets.push(plan.definition.name);
      return;
    }

    if (plan.columnsToAdd.length) {
      sheet.getRange(
        1,
        plan.headers.length + 1,
        1,
        plan.columnsToAdd.length
      ).setValues([plan.columnsToAdd]);
      result.addedColumns.push({
        sheet: plan.definition.name,
        columns: plan.columnsToAdd.slice()
      });
      return;
    }

    result.unchangedSheets.push(plan.definition.name);
  });

  const appliedVersionSheet = rc1MigrationFindSheet_(
    plans,
    'V2_rc1_schema_versions'
  );
  const appliedLedgerSheet = rc1MigrationFindSheet_(
    plans,
    'V2_rc1_migration_ledger'
  );

  if (!versionState.value) {
    rc1MigrationAppendMarker_(
      appliedVersionSheet,
      CMWEBS_V2_RC1_SCHEMA_VERSION_,
      schemaVersion
    );
  }

  if (!ledgerState.value) {
    rc1MigrationAppendMarker_(
      appliedLedgerSheet,
      CMWEBS_V2_RC1_SCHEMA_VERSION_,
      schemaVersion
    );
  }

  result.schemaVersionAfter = schemaVersion;
  return result;
}


/**
 * Executes the additive-only RC1 migration against the approved production
 * spreadsheet. This entrypoint never exposes the runtime property or IDs.
 */
function runCmwebsV2Rc1ProductionMigration() {
  const scriptId = typeof ScriptApp !== 'undefined' &&
    typeof ScriptApp.getScriptId === 'function'
    ? ScriptApp.getScriptId()
    : '';

  if (
    rc1MigrationSha256_(scriptId) !==
    CMWEBS_V2_RC1_PRODUCTION_SCRIPT_FINGERPRINT_
  ) {
    throw new Error('PRODUCTION_SCRIPT_IDENTITY_MISMATCH');
  }

  const spreadsheet = rc1MigrationResolveProductionSpreadsheet_();

  if (
    rc1MigrationSha256_(spreadsheet.getId()) !==
    CMWEBS_V2_RC1_PRODUCTION_SPREADSHEET_FINGERPRINT_
  ) {
    throw new Error('PRODUCTION_SPREADSHEET_IDENTITY_MISMATCH');
  }

  const result = migrateCmwebsV2Rc1Spreadsheet_(spreadsheet, {
    schemaVersion: CMWEBS_V2_RC1_SCHEMA_VERSION_
  });

  if (result.unsafeDeltas.length) {
    throw new Error('UNSAFE_SCHEMA_DELTA');
  }

  return result;
}


function rc1MigrationResolveProductionSpreadsheet_() {
  if (
    typeof PropertiesService === 'undefined' ||
    typeof PropertiesService.getScriptProperties !== 'function' ||
    typeof runtimeSpreadsheet_ !== 'function'
  ) {
    throw new Error('PRODUCTION_SPREADSHEET_RESOLVER_REQUIRED');
  }

  const spreadsheetId = String(
    PropertiesService
      .getScriptProperties()
      .getProperty('CMWEBS_SPREADSHEET_ID') || ''
  ).trim();

  if (!spreadsheetId) {
    throw new Error('PRODUCTION_SPREADSHEET_REFERENCE_REQUIRED');
  }

  const spreadsheet = runtimeSpreadsheet_(spreadsheetId);

  if (!spreadsheet || typeof spreadsheet.getId !== 'function') {
    throw new Error('PRODUCTION_SPREADSHEET_REFERENCE_REQUIRED');
  }

  return spreadsheet;
}


function rc1MigrationSha256_(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value || ''),
    Utilities.Charset.UTF_8
  );

  return bytes.map(function (byte) {
    const normalized = byte < 0 ? byte + 256 : byte;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('');
}


function rc1MigrationBuildSchema_(requiredSheets) {
  const entries = CMWEBS_V2_RC1_METADATA_SCHEMA_.map(function (definition) {
    return {
      name: definition.name,
      headers: definition.headers.slice()
    };
  });
  const errors = [];
  const additional = Array.isArray(requiredSheets) ? requiredSheets : [];

  additional.forEach(function (definition) {
    const name = rc1MigrationText_(definition && definition.name);
    const headers = Array.isArray(definition && definition.headers)
      ? definition.headers.map(rc1MigrationText_)
      : [];

    if (!name || !headers.length || headers.some(function (header) {
      return !header;
    })) {
      errors.push({
        code: 'UNSAFE_SCHEMA_DELTA',
        reason: 'INVALID_REQUIRED_SHEET'
      });
      return;
    }

    if (entries.some(function (entry) {
      return entry.name === name;
    })) {
      errors.push({
        code: 'UNSAFE_SCHEMA_DELTA',
        reason: 'DUPLICATE_REQUIRED_SHEET'
      });
      return;
    }

    if (new Set(headers).size !== headers.length) {
      errors.push({
        code: 'UNSAFE_SCHEMA_DELTA',
        reason: 'DUPLICATE_REQUIRED_HEADER'
      });
      return;
    }

    entries.push({ name: name, headers: headers });
  });

  return { entries: entries, errors: errors };
}


function rc1MigrationPlanSheet_(spreadsheet, definition) {
  const sheet = spreadsheet.getSheetByName(definition.name);
  const unsafeDeltas = [];

  if (!sheet) {
    return {
      definition: definition,
      sheet: null,
      headers: [],
      columnsToAdd: [],
      unsafeDeltas: unsafeDeltas
    };
  }

  const headers = rc1MigrationReadHeaders_(sheet);
  const lastRow = Number(sheet.getLastRow() || 0);

  if (new Set(headers).size !== headers.length) {
    unsafeDeltas.push({
      code: 'UNSAFE_SCHEMA_DELTA',
      sheet: definition.name,
      reason: 'DUPLICATE_EXISTING_HEADER'
    });
  }

  if (!headers.length && lastRow > 1) {
    unsafeDeltas.push({
      code: 'UNSAFE_SCHEMA_DELTA',
      sheet: definition.name,
      reason: 'MISSING_HEADER_WITH_EXISTING_ROWS'
    });
  }

  const comparableLength = Math.min(headers.length, definition.headers.length);
  for (let index = 0; index < comparableLength; index += 1) {
    if (headers[index] !== definition.headers[index]) {
      unsafeDeltas.push({
        code: 'UNSAFE_SCHEMA_DELTA',
        sheet: definition.name,
        reason: 'HEADER_RENAME_OR_ORDER_CONFLICT'
      });
      break;
    }
  }

  if (headers.length > definition.headers.length) {
    unsafeDeltas.push({
      code: 'UNSAFE_SCHEMA_DELTA',
      sheet: definition.name,
      reason: 'EXTRA_HEADER_REQUIRES_REVIEW'
    });
  }

  return {
    definition: definition,
    sheet: sheet,
    headers: headers,
    columnsToAdd: unsafeDeltas.length
      ? []
      : definition.headers.slice(headers.length),
    unsafeDeltas: unsafeDeltas
  };
}


function rc1MigrationReadHeaders_(sheet) {
  const width = Number(sheet.getLastColumn() || 0);

  if (!width) {
    return [];
  }

  const row = sheet.getRange(1, 1, 1, width).getValues()[0] || [];
  const headers = row.map(rc1MigrationText_);
  const lastHeaderIndex = headers.reduce(function (lastIndex, header, index) {
    return header ? index : lastIndex;
  }, -1);

  return lastHeaderIndex < 0
    ? []
    : headers.slice(0, lastHeaderIndex + 1);
}


function rc1MigrationReadMarker_(sheet, markerHeader, markerKey) {
  if (!sheet) {
    return { value: '', duplicate: false };
  }

  const headers = rc1MigrationReadHeaders_(sheet);
  const markerIndex = headers.indexOf(markerHeader);
  const versionIndex = headers.indexOf('schema_version');
  const lastRow = Number(sheet.getLastRow() || 0);

  if (markerIndex < 0 || versionIndex < 0 || lastRow < 2) {
    return { value: '', duplicate: false };
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const matches = rows.filter(function (row) {
    return rc1MigrationText_(row[markerIndex]) === markerKey;
  });

  return {
    value: matches.length ? rc1MigrationText_(matches[0][versionIndex]) : '',
    duplicate: matches.length > 1
  };
}


function rc1MigrationAppendMarker_(sheet, markerKey, schemaVersion) {
  const nextRow = Number(sheet.getLastRow() || 0) + 1;
  sheet.getRange(nextRow, 1, 1, 2).setValues([[markerKey, schemaVersion]]);
}


function rc1MigrationFindSheet_(plans, name) {
  const plan = plans.find(function (item) {
    return item.definition.name === name;
  });

  return plan && plan.sheet;
}


function rc1MigrationText_(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}
