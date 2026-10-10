/** Idempotent transaction journal and compensating rollback for settlement writes. */

const V2_SETTLEMENT_LEDGER_SHEET_ = 'V2_SETTLEMENT_LEDGER';
const V2_SETTLEMENT_LEDGER_HEADERS_ = [
  'ledger_id',
  'idempotency_key',
  'operation',
  'status',
  'created_at',
  'updated_at',
  'workspace_id',
  'actor_user_id',
  'request_id',
  'settlement_id',
  'before_json',
  'result_json',
  'error_code',
  'error_message',
  'committed_at',
  'rolled_back_at'
];


function migrateSettlementLedgerSchema() {
  runtimeRequireSchemaMigration_();
  runtimeRequireFeature_('MOVE_OUT_SETTLEMENT');
  const sheet = settlementTransactionEnsureLedger_(true);
  return settlementTransactionValidateLedger_(sheet);
}


function validateSettlementLedgerSchema() {
  runtimeRequireFeature_('MOVE_OUT_SETTLEMENT');
  return settlementTransactionValidateLedger_(
    settlementTransactionEnsureLedger_(false)
  );
}


function settlementTransactionValidateLedger_(sheet) {
  const headers = sheet && sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(function (value) { return String(value || '').trim(); })
    : [];
  const missing = V2_SETTLEMENT_LEDGER_HEADERS_.filter(function (header) {
    return headers.indexOf(header) < 0;
  });
  const rows = missing.length === 0 ? workspaceGetObjectsWithRow_(sheet) : [];
  const keyCounts = {};
  const invalidStatuses = [];
  rows.forEach(function (row) {
    const compoundKey = [
      String(row.workspace_id || ''),
      String(row.operation || ''),
      String(row.idempotency_key || '')
    ].join('|');
    keyCounts[compoundKey] = (keyCounts[compoundKey] || 0) + 1;
    if (
      ['processing', 'committed', 'rolled_back', 'rollback_failed']
        .indexOf(String(row.status || '')) < 0
    ) {
      invalidStatuses.push(String(row.ledger_id || ''));
    }
  });
  const duplicateKeys = Object.keys(keyCounts).filter(function (key) {
    return keyCounts[key] > 1;
  });
  const success = missing.length === 0 &&
    duplicateKeys.length === 0 && invalidStatuses.length === 0;
  return {
    success: success,
    code: success ? 'SETTLEMENT_LEDGER_SCHEMA_OK' :
      'SETTLEMENT_LEDGER_SCHEMA_INVALID',
    sheet: V2_SETTLEMENT_LEDGER_SHEET_,
    header_count: headers.length,
    row_count: rows.length,
    missing_headers: missing,
    duplicate_key_count: duplicateKeys.length,
    invalid_status_count: invalidStatuses.length,
    rollback_protection_ready: success
  };
}


function settlementTransactionExecute_(options, executor) {
  options = options || {};
  const key = String(options.idempotency_key || '').trim();
  const operation = String(options.operation || '').trim();
  const workspaceId = String(options.workspace_id || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(key)) {
    return settlementTransactionFailure_(
      'IDEMPOTENCY_KEY_INVALID',
      'Idempotency key must contain 8-128 safe characters'
    );
  }
  if (!operation || !workspaceId || typeof executor !== 'function') {
    return settlementTransactionFailure_(
      'SETTLEMENT_TRANSACTION_INVALID',
      'Settlement transaction scope is incomplete'
    );
  }

  const lock = LockService.getScriptLock();
  let locked = false;
  let ledgerSheet;
  let ledger;
  const snapshots = [];
  const appends = [];

  try {
    if (!lock.tryLock(15000)) {
      return settlementTransactionFailure_(
        'SETTLEMENT_TRANSACTION_BUSY',
        'Settlement operation is busy; retry with the same idempotency key'
      );
    }
    locked = true;
    ledgerSheet = settlementTransactionEnsureLedger_();
    const matches = workspaceGetObjectsWithRow_(ledgerSheet).filter(function (row) {
      return String(row.workspace_id || '') === workspaceId &&
        String(row.operation || '') === operation &&
        String(row.idempotency_key || '') === key;
    });
    if (matches.length > 1) {
      return settlementTransactionFailure_('SETTLEMENT_LEDGER_CONFLICT', 'Duplicate ledger key');
    }
    if (matches.length === 1) {
      if (String(matches[0].status || '') === 'committed') {
        const prior = settlementTransactionJson_(matches[0].result_json);
        prior.duplicate = true;
        prior.idempotent_replay = true;
        return prior;
      }
      return settlementTransactionFailure_(
        'IDEMPOTENCY_KEY_ALREADY_USED',
        'Idempotency key has a non-committed prior attempt'
      );
    }

    ledger = {
      ledger_id: 'SLG-' + Utilities.getUuid().toUpperCase(),
      idempotency_key: key,
      operation: operation,
      status: 'processing',
      created_at: new Date(),
      updated_at: new Date(),
      workspace_id: workspaceId,
      actor_user_id: String(options.actor_user_id || ''),
      request_id: String(options.request_id || ''),
      settlement_id: String(options.settlement_id || ''),
      before_json: '',
      result_json: '',
      error_code: '',
      error_message: '',
      committed_at: '',
      rolled_back_at: ''
    };
    workspaceAppendObject_(ledgerSheet, ledger);
    ledger = workspaceGetObjectsWithRow_(ledgerSheet).filter(function (row) {
      return String(row.ledger_id || '') === ledger.ledger_id;
    })[0] || ledger;

    const transaction = {
      idempotency_key: key,
      captureRow: function (sheet, rowNumber) {
        if (!sheet || !rowNumber) return;
        const width = sheet.getLastColumn();
        snapshots.push({
          sheet: sheet,
          row: Number(rowNumber),
          values: sheet.getRange(Number(rowNumber), 1, 1, width).getValues()[0]
        });
      },
      captureAppend: function (sheet) {
        if (!sheet) return;
        appends.push({ sheet: sheet, last_row: sheet.getLastRow() });
      },
      captureByKey: function (sheet, keyName, keyValue) {
        const rows = workspaceGetObjectsWithRow_(sheet).filter(function (row) {
          return String(row[keyName] || '') === String(keyValue || '');
        });
        if (rows.length !== 1) {
          throw new Error('TRANSACTION_SNAPSHOT_CONFLICT:' + keyName);
        }
        this.captureRow(sheet, rows[0].__row_number);
      }
    };

    const result = executor(transaction);
    if (!result || result.success !== true) {
      settlementTransactionRollback_(snapshots, appends);
      settlementTransactionUpdateLedger_(ledgerSheet, ledger, {
        status: 'rolled_back',
        updated_at: new Date(),
        error_code: result && result.code || 'SETTLEMENT_OPERATION_FAILED',
        error_message: result && result.message || 'Settlement operation failed',
        rolled_back_at: new Date()
      });
      return result || settlementTransactionFailure_(
        'SETTLEMENT_OPERATION_FAILED',
        'Settlement operation failed'
      );
    }

    settlementTransactionUpdateLedger_(ledgerSheet, ledger, {
      status: 'committed',
      updated_at: new Date(),
      before_json: JSON.stringify({ rows: snapshots.length, appends: appends.length }),
      result_json: JSON.stringify(result),
      committed_at: new Date()
    });
    return result;
  } catch (error) {
    try {
      settlementTransactionRollback_(snapshots, appends);
      if (ledgerSheet && ledger) {
        settlementTransactionUpdateLedger_(ledgerSheet, ledger, {
          status: 'rolled_back',
          updated_at: new Date(),
          error_code: 'SETTLEMENT_TRANSACTION_EXCEPTION',
          error_message: String(error && error.message || 'Settlement transaction exception').slice(0, 500),
          rolled_back_at: new Date()
        });
      }
    } catch (rollbackError) {
      if (ledgerSheet && ledger) {
        settlementTransactionUpdateLedger_(ledgerSheet, ledger, {
          status: 'rollback_failed',
          updated_at: new Date(),
          error_code: 'SETTLEMENT_ROLLBACK_FAILED',
          error_message: String(rollbackError && rollbackError.message || '').slice(0, 500)
        });
      }
    }
    return settlementTransactionFailure_(
      'SETTLEMENT_TRANSACTION_EXCEPTION',
      'Settlement transaction failed and was rolled back'
    );
  } finally {
    if (locked) lock.releaseLock();
  }
}


function settlementTransactionRollback_(snapshots, appends) {
  snapshots.slice().reverse().forEach(function (snapshot) {
    snapshot.sheet.getRange(snapshot.row, 1, 1, snapshot.values.length)
      .setValues([snapshot.values]);
  });
  appends.slice().reverse().forEach(function (append) {
    while (append.sheet.getLastRow() > append.last_row) {
      append.sheet.deleteRow(append.sheet.getLastRow());
    }
  });
  SpreadsheetApp.flush();
}


function settlementTransactionEnsureLedger_(allowCreate) {
  const ss = runtimeSpreadsheet_();
  let sheet = ss.getSheetByName(V2_SETTLEMENT_LEDGER_SHEET_);
  if (!sheet && allowCreate === true) {
    sheet = ss.insertSheet(V2_SETTLEMENT_LEDGER_SHEET_);
  }
  if (!sheet) throw new Error('SETTLEMENT_LEDGER_NOT_CONFIGURED');
  const current = sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String)
    : [];
  const missing = V2_SETTLEMENT_LEDGER_HEADERS_.filter(function (header) {
    return current.indexOf(header) < 0;
  });
  if (current.length === 0 && allowCreate === true) {
    sheet.getRange(1, 1, 1, V2_SETTLEMENT_LEDGER_HEADERS_.length)
      .setValues([V2_SETTLEMENT_LEDGER_HEADERS_]);
  } else if (missing.length > 0 && allowCreate === true) {
    sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  } else if (missing.length > 0) {
    throw new Error('SETTLEMENT_LEDGER_SCHEMA_INVALID');
  }
  return sheet;
}


function settlementTransactionUpdateLedger_(sheet, ledger, updates) {
  const row = Number(ledger.__row_number) || workspaceGetObjectsWithRow_(sheet)
    .filter(function (item) { return item.ledger_id === ledger.ledger_id; })[0].__row_number;
  moveOutUpdate_(sheet, row, updates);
}


function settlementTransactionJson_(value) {
  try { return JSON.parse(String(value || '{}')); } catch (error) { return {}; }
}


function settlementTransactionFailure_(code, message) {
  return { success: false, code: code, message: message, data: null };
}
