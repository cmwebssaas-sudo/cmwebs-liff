import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const createPage = readFileSync(new URL('../landlord-tenant-create.html', import.meta.url), 'utf8');
const propertiesPage = readFileSync(new URL('../landlord-properties.html', import.meta.url), 'utf8');
const onboardingSource = readFileSync(new URL('../apps-script/V2_TENANT_LEASE_ONBOARDING.js', import.meta.url), 'utf8');
const initiatedSource = readFileSync(new URL('../apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js', import.meta.url), 'utf8');

assert.match(createPage, /function resolveRoomLeaseDefaults_/);
assert.match(createPage, /room\.deposit_amount/);
assert.match(createPage, /rent \+ management/);
assert.match(createPage, /'electricityRate',[\s\S]{0,180}'0\.1'/);
assert.match(createPage, /'equipmentRate',[\s\S]{0,180}'0\.1'/);
assert.match(createPage, /\.keyboard-open \.bottom-nav/);
assert.match(createPage, /focusin/);
assert.match(propertiesPage, /roomManagementFee/);
assert.match(propertiesPage, /rent \+ management/);
assert.match(onboardingSource, /equipment_fee_rate_summer/);
assert.match(onboardingSource, /equipment_fee_rate_regular/);
assert.match(onboardingSource, /tenantLeaseCurrentEquipmentRate_/);

const onboardingContext = {
  Date,
  Math,
  Number,
  String,
  Object,
  Array,
  JSON,
  RegExp
};
vm.createContext(onboardingContext);
vm.runInContext(onboardingSource, onboardingContext, { filename: 'V2_TENANT_LEASE_ONBOARDING.js' });
assert.equal(onboardingContext.tenantLeaseRoomDepositMonths_({
  rent_amount: 8500,
  management_fee: 500,
  deposit_amount: 18000,
  deposit_months: 2.12
}), 2);
assert.equal(onboardingContext.tenantLeaseCurrentEquipmentRate_({
  equipment_fee_rate_summer: 3.5,
  equipment_fee_rate_regular: 2.5,
  equipment_fee_rate: 4,
  equipment_summer_months: '6,7,8,9'
}), 3.5);

const context = {
  Date,
  Math,
  Number,
  String,
  Object,
  Array,
  JSON,
  RegExp,
  LockService: {
    getScriptLock: () => ({
      waitLock: () => {},
      releaseLock: () => {}
    })
  },
  Utilities: {
    getUuid: () => 'uuid-1',
    computeDigest: () => [1, 2, 3]
  }
};
vm.createContext(context);
vm.runInContext(initiatedSource, context, { filename: 'V2_LANDLORD_INITIATED_CONTRACTS.js' });

let lockAttempts = 0;
context.LockService.getScriptLock = () => ({
  waitLock: () => {
    lockAttempts += 1;
    if (lockAttempts < 3) throw new Error('temporary contention');
  },
  releaseLock: () => {}
});
const retried = context.landlordInitiatedContractWithScriptLock_(() => ({ success: true, code: 'OK' }));
assert.equal(retried.success, true);
assert.equal(lockAttempts, 3);

context.LockService.getScriptLock = () => ({ waitLock: () => {}, releaseLock: () => {} });
const failedOperation = context.landlordInitiatedContractWithScriptLock_(() => { throw new Error('sheet write failed'); });
assert.equal(failedOperation.success, false);
assert.equal(failedOperation.code, 'CONTRACT_OPERATION_FAILED');

const normalized = context.landlordInitiatedContractNormalizeInput_({
  property_id: 'P1',
  room_id: 'R202',
  start_date: '2026-09-01',
  end_date: '2027-08-31',
  rent_amount: '8500',
  management_fee: '500',
  deposit_months: '2',
  deposit_amount: '18000',
  payment_day: '10',
  electricity_fee_rate: '3',
  equipment_fee_rate: '3.5'
});
assert.equal(normalized.success, true, normalized.message);
assert.equal(normalized.data.deposit_months, 2);
assert.equal(normalized.data.electricity_fee_rate, 3);
assert.equal(normalized.data.equipment_fee_rate, 3.5);

const document = context.landlordInitiatedContractBuildDocument_(
  { user: { name: '房東甲' } },
  { property_name: '幸福公寓', property_address: '台北市測試路 1 號' },
  { room_name: '202' },
  normalized.data,
  ''
);
assert.match(document, /押金月數：2/);
assert.match(document, /每度電費：新臺幣 3 元/);
assert.match(document, /設備耗損費／度：新臺幣 3\.5 元/);

class FakeSheet {
  constructor(headers = []) {
    this.headers = headers.slice();
    this.rows = [];
  }

  getLastColumn() {
    return Math.max(this.headers.length, 1);
  }

  getLastRow() {
    return this.rows.length + 1;
  }

  getDataRange() {
    return { getValues: () => [this.headers.slice(), ...this.rows] };
  }

  getRange(row, column, height = 1, width = 1) {
    if (row === 1) {
      return {
        getDisplayValues: () => [this.headers.slice(column - 1, column - 1 + width)],
        setValues: values => {
          const incoming = values[0] || [];
          incoming.forEach((value, index) => { this.headers[column - 1 + index] = value; });
        }
      };
    }
    return {
      setValue: value => { this.rows[row - 2][column - 1] = value; },
      setValues: values => values.forEach((rowValues, rowIndex) => {
        rowValues.forEach((value, columnIndex) => {
          this.rows[row - 2 + rowIndex][column - 1 + columnIndex] = value;
        });
      }),
      getDisplayValues: () => this.rows.slice(row - 2, row - 2 + height).map(item => item.slice(column - 1, column - 1 + width))
    };
  }

  appendRow(row) {
    this.rows.push(row.slice());
  }
}

const sheets = {
  V2_properties: new FakeSheet(['property_id']),
  V2_rooms: new FakeSheet(['room_id']),
  V2_users: new FakeSheet(['user_id']),
  V2_tenants: new FakeSheet(['tenant_id']),
  V2_contracts: new FakeSheet(['contract_id'])
};
const spreadsheet = {
  getSheetByName: name => sheets[name] || null,
  insertSheet: name => {
    sheets[name] = new FakeSheet([]);
    return sheets[name];
  }
};

const schema = context.landlordInitiatedContractSchema_(spreadsheet);
assert.equal(schema.success, true, schema.message);
assert.deepEqual(sheets.V2_contract_invites.headers, [
  'invite_id', 'workspace_id', 'contract_id', 'room_id', 'landlord_user_id', 'landlord_membership_id',
  'claim_code_hash', 'status', 'expires_at', 'claimed_at', 'claimed_line_user_id', 'cancelled_at', 'created_at', 'updated_at'
]);

console.log('phase162 landlord initiated contract pricing and schema: PASS');
