import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const renewalSource = readFileSync(
  new URL('../apps-script/V2_CONTRACT_RENEWAL_HISTORY.js', import.meta.url),
  'utf8'
);
const apiSource = readFileSync(
  new URL('../apps-script/V2_API.js', import.meta.url),
  'utf8'
);
const dashboardSource = readFileSync(
  new URL('../apps-script/V2_WORKSPACE_DASHBOARD_NATIVE.js', import.meta.url),
  'utf8'
);

const access = {
  success: true,
  line_user_id: 'landlord-line',
  principal_landlord_id: 'L1',
  principal: { landlord_id: 'L1', landlord_name: '房東甲' },
  principals: [{ landlord_id: 'L1', line_user_id: 'landlord-line' }],
  user: { user_id: 'LU1', name: '房東甲' },
  workspace: { workspace_id: 'W1' },
  membership: { membership_id: 'M1', display_name: '房東甲' }
};

const data = {
  properties: [],
  property_id_map: {},
  rooms: [{ room_id: 'R502', room_name: '502', account_status: 'active' }],
  tenants: [{
    tenant_id: 'T000502',
    tenant_user_id: 'U000502',
    tenant_name: '502 房客',
    account_status: 'active'
  }],
  users: [{ user_id: 'U000502', line_user_id: 'tenant-line', name: '502 房客' }],
  bills: [],
  tenant_view_rows: [],
  contracts: [{
    contract_id: 'C000502',
    contract_family_id: 'C000502',
    renewal_sequence: 1,
    workspace_id: 'W1',
    landlord_id: 'L1',
    tenant_id: 'T000502',
    tenant_user_id: 'U000502',
    room_id: 'R502',
    room_name: '502',
    start_date: '2025-09-02',
    end_date: '2026-09-01',
    rent_amount: 18000,
    management_fee: 500,
    deposit_amount: 36000,
    contract_status: 'expired'
  }]
};

const context = {
  Date,
  Math,
  Number,
  String,
  Object,
  Array,
  JSON,
  RegExp,
  Error,
  Utilities: {
    formatDate: value => {
      const date = new Date(value);
      const pad = part => String(part).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }
  },
  v2CanonicalBillIsVoided_: () => false,
  v2CanonicalBillIsOutstanding_: () => false,
  v2CanonicalBillPaymentStatus_: value => String(value || '').toLowerCase()
};

vm.createContext(context);
vm.runInContext(renewalSource, context, {
  filename: 'V2_CONTRACT_RENEWAL_HISTORY.js'
});
vm.runInContext(apiSource, context, {
  filename: 'V2_API.js'
});
vm.runInContext(dashboardSource, context, {
  filename: 'V2_WORKSPACE_DASHBOARD_NATIVE.js'
});

let activeData = data;

context.workspaceDashboardExecute_ = (_lineUserId, action, executor) => {
  assert.equal(action, 'landlord_tenants');
  return executor(null, access, activeData);
};

const result = context.getWorkspaceLandlordTenantsNativeByLineUid_('landlord-line');

assert.equal(result.success, true, result.code);
assert.equal(
  result.data.tenants.length,
  1,
  'an operational tenant with an expired contract must remain visible for manual renewal recovery'
);
assert.equal(result.data.tenants[0].tenant_id, 'T000502');
assert.equal(result.data.tenants[0].current_contract_id, 'C000502');
assert.equal(result.data.tenants[0].current_contract_status, 'expired');
assert.equal(result.data.tenants[0].contract_history[0].contract_id, 'C000502');
assert.equal(result.data.tenants[0].contract_history[0].read_only, true);

activeData = structuredClone(data);
activeData.contracts[0].contract_status = 'active';
activeData.contracts[0].start_date = '2027-09-02';
activeData.contracts[0].end_date = '2028-09-01';

const futureResult = context.getWorkspaceLandlordTenantsNativeByLineUid_('landlord-line');
assert.equal(
  futureResult.data.tenants.length,
  0,
  'a future active contract must not use the expired-contract recovery fallback'
);

console.log('Phase 201 expired tenant renewal recovery runtime tests passed.');
