import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(
  new URL('../apps-script/V2_RUNTIME_SNAPSHOT.js', import.meta.url),
  'utf8'
);
const landlordApiSource = fs.readFileSync(
  new URL('../landlord-api.js', import.meta.url),
  'utf8'
);

const context = {
  Date,
  Math,
  Object,
  String,
  Number,
  Boolean,
  SpreadsheetApp: {
    getActiveSpreadsheet() {
      return { getId: () => 'test-spreadsheet' };
    },
    openById() {
      return { getId: () => 'test-spreadsheet' };
    }
  }
};

vm.createContext(context);
vm.runInContext(
  source + '\nthis.api = { runtimeSnapshotBegin_, runtimeSnapshotIsReadEnabled_, runtimeSnapshotGetValues_ };',
  context
);

const readActions = [
  'landlord_arrears',
  'landlord_bill_manual_settlement_status',
  'landlord_billing_init',
  'landlord_contract_requests_init',
  'landlord_home_bootstrap',
  'landlord_notifications_init',
  'landlord_payment_reports_init',
  'landlord_properties_init',
  'landlord_revenue_dashboard_init',
  'landlord_settings_init',
  'landlord_tenants',
  'landlord_workspace_context'
];

for (const action of readActions) {
  context.api.runtimeSnapshotBegin_(action);
  assert.equal(
    context.api.runtimeSnapshotIsReadEnabled_(),
    true,
    `${action} must use the request-local read snapshot`
  );
}

context.api.runtimeSnapshotBegin_('landlord_properties_init');
let dataRangeReads = 0;
const sheet = {
  getParent() {
    return { getId: () => 'test-spreadsheet' };
  },
  getSheetId() {
    return 42;
  },
  getDataRange() {
    dataRangeReads += 1;
    return {
      getValues() {
        return [['property_id'], ['P-1']];
      }
    };
  }
};

context.api.runtimeSnapshotGetValues_(sheet);
context.api.runtimeSnapshotGetValues_(sheet);
assert.equal(
  dataRangeReads,
  1,
  'allowlisted landlord reads must reuse the same sheet snapshot'
);

assert.match(
  landlordApiSource,
  /landlord_properties_init:\s*true/,
  'properties init must use the shared read retry and dedupe client'
);
assert.match(
  landlordApiSource,
  /landlord_bill_manual_settlement_status:\s*true/,
  'manual settlement status must use the shared read retry and dedupe client'
);

console.log('Phase 245 landlord read snapshot action regression test passed.');
