import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../apps-script/V2_LANDLORD_PAPER_CONTRACT_BACKFILL.js', import.meta.url), 'utf8');

class FakeSheet {
  constructor(headers, rows = []) {
    this.headers = headers.slice();
    this.rows = rows.map(row => row.slice());
  }

  getLastColumn() { return this.headers.length; }

  getRange(row, column, numRows = 1, numColumns = this.headers.length) {
    return {
      getValues: () => row === 1
        ? [this.headers.slice(column - 1, column - 1 + numColumns)]
        : this.rows.slice(row - 2, row - 2 + numRows).map(item => item.slice(column - 1, column - 1 + numColumns)),
      getDisplayValues: () => row === 1
        ? [this.headers.slice(column - 1, column - 1 + numColumns).map(String)]
        : [],
      setValues: values => {
        if (row !== 1) throw new Error('migration may only write the header row');
        if (column !== this.headers.length + 1) throw new Error('migration must append headers');
        this.headers.push(...values[0]);
      }
    };
  }
}

function makeRuntime(headers = ['contract_id', 'workspace_id']) {
  const sheet = new FakeSheet(headers, [['contract-1', 'W1']]);
  const spreadsheet = {
    getSheetByName: name => name === 'V2_contracts' ? sheet : null
  };
  const lock = {
    waitLock: () => {},
    releaseLock: () => {}
  };
  const context = {
    Array, Boolean, Date, JSON, Math, Number, Object, RegExp, String, isFinite,
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
    LockService: { getScriptLock: () => lock }
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'V2_LANDLORD_PAPER_CONTRACT_BACKFILL.js' });
  return { context, sheet };
}

{
  const runtime = makeRuntime();
  const beforeRows = runtime.sheet.rows.map(row => row.slice());
  const result = runtime.context.migrateV2LandlordPaperContractBackfillSchema_();

  assert.equal(result.success, true, result.message || result.code);
  assert.deepEqual(Array.from(result.data.added_headers.contracts), [
    'paper_backfill_idempotency_key',
    'paper_backfill_payload_hash'
  ]);
  assert.deepEqual(Array.from(runtime.sheet.headers), [
    'contract_id',
    'workspace_id',
    'paper_backfill_idempotency_key',
    'paper_backfill_payload_hash'
  ]);
  assert.deepEqual(runtime.sheet.rows, beforeRows);
}

{
  const runtime = makeRuntime([
    'contract_id',
    'workspace_id',
    'paper_backfill_idempotency_key',
    'paper_backfill_payload_hash'
  ]);
  const result = runtime.context.migrateV2LandlordPaperContractBackfillSchema_();

  assert.equal(result.success, true, result.message || result.code);
  assert.deepEqual(Array.from(result.data.added_headers.contracts), []);
  assert.equal(runtime.sheet.headers.length, 4);
}

{
  const runtime = makeRuntime();
  const result = runtime.context.migrateV2LandlordPaperContractBackfillSchema_({ getSheetByName: () => null });

  assert.equal(result.success, false);
  assert.equal(result.code, 'PAPER_BACKFILL_SCHEMA_MIGRATION_NOT_READY');
  assert.deepEqual(Array.from(result.data.added_headers.contracts), []);
}

console.log('Phase 212 paper contract backfill migration tests passed.');
