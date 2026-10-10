/**
 * Request-local runtime snapshot for read-only tenant Web App routes.
 *
 * The state is reset at the beginning of every doGet execution and is never
 * shared through CacheService, PropertiesService or another request.
 */

const V2_RUNTIME_SNAPSHOT_READ_ACTIONS_ = {
  tenant_home: true,
  tenant_bills: true,
  tenant_message_init: true,
  tenant_contract_init: true
};

let V2_REQUEST_RUNTIME_SNAPSHOT_STATE_ = null;


function runtimeSnapshotBegin_(action) {
  action = String(action || '').trim();

  V2_REQUEST_RUNTIME_SNAPSHOT_STATE_ = {
    action: action,
    enabled:
      V2_RUNTIME_SNAPSHOT_READ_ACTIONS_[action] === true,
    spreadsheet_handles: {},
    spreadsheet_handle_created: 0,
    spreadsheet_handle_reused: 0,
    values_by_sheet: {},
    contexts: {},
    full_sheet_reads_before: 0,
    full_sheet_reads_after: 0,
    cache_hits: 0
  };
}


function runtimeSpreadsheet_(spreadsheetId) {
  if (!V2_REQUEST_RUNTIME_SNAPSHOT_STATE_) {
    runtimeSnapshotBegin_(
      'NON_WEBAPP_EXECUTION'
    );
  }

  const state =
    V2_REQUEST_RUNTIME_SNAPSHOT_STATE_;
  const normalizedId =
    String(spreadsheetId || '').trim();
  const key = normalizedId
    ? 'ID:' + normalizedId
    : 'ACTIVE';

  if (
    Object.prototype.hasOwnProperty.call(
      state.spreadsheet_handles,
      key
    )
  ) {
    state.spreadsheet_handle_reused += 1;
    return state.spreadsheet_handles[key];
  }

  const spreadsheet = normalizedId
    ? SpreadsheetApp.openById(normalizedId)
    : SpreadsheetApp.getActiveSpreadsheet();

  state.spreadsheet_handle_created += 1;
  state.spreadsheet_handles[key] = spreadsheet;

  if (spreadsheet) {
    const actualId =
      String(spreadsheet.getId() || '').trim();

    if (actualId) {
      state.spreadsheet_handles[
        'ID:' + actualId
      ] = spreadsheet;
    }
  }

  return spreadsheet;
}


function runtimeSnapshotSheetKey_(sheet) {
  const parent = sheet.getParent();

  return (
    String(parent.getId()) +
    ':' +
    String(sheet.getSheetId())
  );
}


function runtimeSnapshotGetValues_(sheet) {
  const state =
    V2_REQUEST_RUNTIME_SNAPSHOT_STATE_;

  if (!state || state.enabled !== true) {
    return sheet.getDataRange().getValues();
  }

  state.full_sheet_reads_before += 1;

  const key =
    runtimeSnapshotSheetKey_(sheet);

  if (
    Object.prototype.hasOwnProperty.call(
      state.values_by_sheet,
      key
    )
  ) {
    state.cache_hits += 1;
    return state.values_by_sheet[key];
  }

  const values =
    sheet.getDataRange().getValues();

  state.full_sheet_reads_after += 1;
  state.values_by_sheet[key] = values;

  return values;
}


function runtimeSnapshotContextKey_(namespace, key) {
  return (
    String(namespace || '').trim() +
    ':' +
    String(key || '').trim()
  );
}


function runtimeSnapshotGetContext_(namespace, key) {
  const state =
    V2_REQUEST_RUNTIME_SNAPSHOT_STATE_;

  if (!state || state.enabled !== true) {
    return null;
  }

  const contextKey =
    runtimeSnapshotContextKey_(
      namespace,
      key
    );

  return Object.prototype.hasOwnProperty.call(
    state.contexts,
    contextKey
  )
    ? state.contexts[contextKey]
    : null;
}


function runtimeSnapshotSetContext_(
  namespace,
  key,
  value
) {
  const state =
    V2_REQUEST_RUNTIME_SNAPSHOT_STATE_;

  if (!state || state.enabled !== true) {
    return value;
  }

  state.contexts[
    runtimeSnapshotContextKey_(
      namespace,
      key
    )
  ] = value;

  return value;
}


function runtimeSnapshotRecordAvoidedReads_(count) {
  const state =
    V2_REQUEST_RUNTIME_SNAPSHOT_STATE_;

  if (!state || state.enabled !== true) {
    return;
  }

  state.full_sheet_reads_before +=
    Math.max(Number(count) || 0, 0);
  state.cache_hits += 1;
}


function runtimeSnapshotFinish_() {
  const state =
    V2_REQUEST_RUNTIME_SNAPSHOT_STATE_;

  if (!state) {
    return null;
  }

  const report = {
    action: state.action,
    enabled: state.enabled,
    spreadsheet_handle_created:
      state.spreadsheet_handle_created,
    spreadsheet_handle_reused:
      state.spreadsheet_handle_reused,
    full_sheet_reads_before:
      state.full_sheet_reads_before,
    full_sheet_reads_after:
      state.full_sheet_reads_after,
    full_sheet_reads_saved:
      state.full_sheet_reads_before -
      state.full_sheet_reads_after,
    cache_hits: state.cache_hits,
    snapshot_sheet_count:
      Object.keys(
        state.values_by_sheet
      ).length
  };

  V2_REQUEST_RUNTIME_SNAPSHOT_STATE_ = null;

  if (
    report.enabled ||
    report.spreadsheet_handle_created > 0 ||
    report.spreadsheet_handle_reused > 0
  ) {
    try {
      Logger.log(
        '[V2_RUNTIME_SNAPSHOT] ' +
        JSON.stringify(report)
      );
    } catch (error) {
      // Debug logging must never affect the API response.
    }
  }

  return report;
}
