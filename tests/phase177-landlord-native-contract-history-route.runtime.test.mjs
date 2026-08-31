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
  principal: {
    landlord_id: 'L1',
    landlord_name: '房東甲'
  },
  principals: [{ landlord_id: 'L1', line_user_id: 'landlord-line' }],
  user: {
    user_id: 'LU1',
    name: '房東甲'
  },
  workspace: {
    workspace_id: 'W1'
  },
  membership: {
    membership_id: 'M1',
    display_name: '房東甲'
  }
};

const data = {
  properties: [],
  property_id_map: {},
  rooms: [{
    room_id: 'R603',
    room_name: '603',
    account_status: 'active'
  }],
  tenants: [{
    tenant_id: 'T000020',
    tenant_user_id: 'U000022',
    tenant_name: '測試人員',
    account_status: 'active'
  }],
  users: [{
    user_id: 'U000022',
    line_user_id: 'tenant-line',
    name: '測試人員'
  }],
  bills: [],
  tenant_view_rows: [],
  contracts: [
    {
      contract_id: 'C000019',
      contract_family_id: 'C000019',
      renewal_sequence: 1,
      workspace_id: 'W1',
      landlord_id: 'L1',
      tenant_id: 'T000020',
      tenant_user_id: 'U000022',
      room_id: 'R603',
      room_name: '603',
      start_date: '2025-10-01',
      end_date: '2026-09-30',
      rent_amount: 24000,
      management_fee: 500,
      contract_status: 'renewed'
    },
    {
      contract_id: 'C000020',
      contract_family_id: 'C000019',
      renewal_sequence: 2,
      renewed_from_contract_id: 'C000019',
      workspace_id: 'W1',
      landlord_id: 'L1',
      tenant_id: 'T000020',
      tenant_user_id: 'U000022',
      room_id: 'R603',
      room_name: '603',
      start_date: '2026-10-01',
      end_date: '2027-09-30',
      rent_amount: 24000,
      management_fee: 500,
      contract_status: 'active'
    }
  ]
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

context.workspaceDashboardExecute_ = (_lineUserId, action, executor) => {
  assert.equal(action, 'landlord_tenants');
  return executor(null, access, data);
};

const result = context.getWorkspaceLandlordTenantsNativeByLineUid_(
  'landlord-line'
);

assert.equal(result.success, true, result.code);
assert.equal(result.data.tenants.length, 1);
assert.equal(result.data.tenants[0].current_contract_id, 'C000019');
assert.equal(
  result.data.tenants[0].contract_end_date,
  '2026-09-30',
  'the production landlord_tenants route must expose the current contract expiry date'
);
assert.deepEqual(
  JSON.parse(JSON.stringify(
    result.data.tenants[0].contract_history.map(item => item.contract_id)
  )),
  ['C000019', 'C000020'],
  'the production landlord_tenants route must keep the original contract visible with its renewal'
);
assert.equal(
  result.data.tenants[0].contract_history.find(
    item => item.contract_id === 'C000019'
  ).is_current,
  true
);
assert.equal(
  result.data.tenants[0].contract_history.every(item => item.read_only === true),
  true
);

console.log('Phase 177 native landlord contract-history route tests passed.');
