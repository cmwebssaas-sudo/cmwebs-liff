import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const archiveSource = readFileSync(
  new URL('../apps-script/V2_TEST_BILL_ARCHIVE.js', import.meta.url),
  'utf8'
);

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];

    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }

    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }

    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }

  throw new Error(`unterminated ${name}`);
}

const context = { String, Array, Boolean };
vm.runInNewContext(
  [
    extractFunction(archiveSource, 'landlordTestBillArchiveText_'),
    extractFunction(archiveSource, 'landlordTestBillArchiveIsClosedRoom_'),
    extractFunction(archiveSource, 'landlordTestBillArchiveIsUnpaid_')
  ].join('\n'),
  context
);

assert.equal(
  context.landlordTestBillArchiveIsClosedRoom_({ account_status: 'inactive' }),
  true
);
assert.equal(
  context.landlordTestBillArchiveIsClosedRoom_({ account_status: 'closed' }),
  true
);
assert.equal(
  context.landlordTestBillArchiveIsClosedRoom_({ account_status: 'active' }),
  false
);
assert.equal(
  context.landlordTestBillArchiveIsClosedRoom_({ account_status: 'active', room_status: 'closed' }),
  false,
  'room_status must not override an active room account'
);

assert.equal(
  context.landlordTestBillArchiveIsUnpaid_({
    bill_status: 'issued',
    payment_status: 'unpaid',
    payment_id: ''
  }),
  true
);
assert.equal(
  context.landlordTestBillArchiveIsUnpaid_({
    bill_status: 'issued',
    payment_status: 'paid',
    payment_id: ''
  }),
  false
);
assert.equal(
  context.landlordTestBillArchiveIsUnpaid_({
    bill_status: 'voided',
    payment_status: 'unpaid',
    payment_id: ''
  }),
  false
);
assert.equal(
  context.landlordTestBillArchiveIsUnpaid_({
    bill_status: 'issued',
    payment_status: 'unpaid',
    payment_id: 'PAY-1'
  }),
  false,
  'a bill with a payment record is not eligible for test archival'
);

const dispatcher = readFileSync(
  new URL('../apps-script/程式碼.js', import.meta.url),
  'utf8'
);
const accessProxy = readFileSync(
  new URL('../apps-script/V2_WORKSPACE_LANDLORD_ACCESS.js', import.meta.url),
  'utf8'
);
const arrearsPage = readFileSync(
  new URL('../landlord-arrears.html', import.meta.url),
  'utf8'
);

assert.match(archiveSource, /function archiveTestLandlordBillByLineUid_/);
assert.match(archiveSource, /cancelV2BillForAccess_/);
assert.match(archiveSource, /require_closed_room_account/);
assert.match(archiveSource, /workspaceRecordOperationActor_/);
assert.match(accessProxy, /landlord_bill_test_archive/);
assert.match(accessProxy, /landlord_bill_test_archive_candidates/);
assert.match(dispatcher, /landlord_bill_test_archive/);
assert.match(dispatcher, /landlord_bill_test_archive_candidates/);
assert.match(arrearsPage, /archiveTestBill/);
assert.match(arrearsPage, /作廢測試帳單/);
assert.match(arrearsPage, /archiveSuccessNotice/);
assert.match(arrearsPage, /作廢成功/);
assert.match(arrearsPage, /aria-live="polite"/);

console.log('Test bill archive tests passed.');
