import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../apps-script/V2_RUNTIME_SNAPSHOT.js', import.meta.url),
  'utf8'
);

const reads = { count: 0 };
const spreadsheet = { getId: () => 'test-spreadsheet' };
const sheet = {
  getParent: () => spreadsheet,
  getSheetId: () => 1,
  getDataRange: () => ({
    getValues: () => {
      reads.count += 1;
      return [['header'], ['value-' + reads.count]];
    }
  })
};

const context = {
  String,
  Number,
  Math,
  Object,
  JSON,
  Logger: { log() {} },
  SpreadsheetApp: {
    getActiveSpreadsheet: () => spreadsheet,
    openById: () => spreadsheet
  }
};

vm.createContext(context);
vm.runInContext(
  source +
    '\nthis.api={runtimeSnapshotBegin_,runtimeSnapshotGetValues_,runtimeSnapshotFinish_};',
  context
);

context.api.runtimeSnapshotBegin_('landlord_home_bootstrap');
const first = context.api.runtimeSnapshotGetValues_(sheet);
const second = context.api.runtimeSnapshotGetValues_(sheet);
const firstReport = context.api.runtimeSnapshotFinish_();

assert.equal(reads.count, 1);
assert.equal(first, second);
assert.deepEqual(first, [['header'], ['value-1']]);
assert.equal(firstReport.action, 'landlord_home_bootstrap');
assert.equal(firstReport.enabled, true);
assert.equal(firstReport.full_sheet_reads_before, 2);
assert.equal(firstReport.full_sheet_reads_after, 1);
assert.equal(firstReport.full_sheet_reads_saved, 1);

context.api.runtimeSnapshotBegin_('landlord_home_bootstrap');
const nextRequest = context.api.runtimeSnapshotGetValues_(sheet);
const secondReport = context.api.runtimeSnapshotFinish_();

assert.equal(reads.count, 2);
assert.deepEqual(nextRequest, [['header'], ['value-2']]);
assert.equal(secondReport.full_sheet_reads_before, 1);
assert.equal(secondReport.full_sheet_reads_after, 1);
assert.equal(secondReport.full_sheet_reads_saved, 0);

console.log('Phase 137 landlord bootstrap runtime snapshot mocks passed.');
