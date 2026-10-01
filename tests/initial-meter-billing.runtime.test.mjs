import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../apps-script/V2_BILLING_MANAGEMENT.js', import.meta.url), 'utf8');

const contract = {
  workspace_id: 'W1', landlord_id: 'L1', contract_id: 'C1', tenant_id: 'T1',
  room_id: 'R1', property_id: 'P1', tenant_name: '新房客',
  contract_status: 'active', start_date: '2026-09-15', end_date: '2027-09-14',
  rent_amount: 9000
};
const checkin = {
  workspace_id: 'W1', contract_id: 'C1', tenant_id: 'T1', room_id: 'R1',
  first_meter_reading: 100, updated_at: '2026-09-15'
};
const priorBill = {
  workspace_id: 'W1', landlord_id: 'L1', contract_id: 'C1', tenant_id: 'T1',
  room_id: 'R1', bill_id: 'B1', bill_month: '2026-09',
  current_meter_reading: 150, payment_status: 'paid'
};

// Only Apps Script services/persistence are doubled; both API entry points,
// Workspace filters, meter resolution and billing arithmetic run real code.
function createRuntime(options = {}) {
  const sheets = {};
  const rows = {
    V2_properties: [{ workspace_id: 'W1', property_id: 'P1', property_name: '測試物件' }],
    V2_rooms: [{
      workspace_id: 'W1', landlord_id: 'L1', room_id: 'R1', room_name: '101',
      property_id: 'P1', property_name: '測試物件', current_tenant_id: 'T1',
      rent_amount: 9000, electricity_fee_rate: 3,
      equipment_fee_rate_regular: 2, equipment_fee_rate_summer: 2,
      ...options.room
    }],
    V2_contracts: [{ ...contract, ...options.contract }],
    V2_tenants: [{ workspace_id: 'W1', tenant_id: 'T1', tenant_name: '新房客', user_id: 'GLOBAL-USER' }],
    V2_bills: options.bills || [],
    V2_tenant_bill_view: options.viewBills || [],
    V2_tenant_checkins: options.checkins || []
  };
  for (const [name, data] of Object.entries(rows)) {
    sheets[name] = {
      rows: data.map((row, index) => ({ ...row, __row_number: index + 2 })),
      getName: () => name
    };
  }
  if (options.missingCheckinSheet) delete sheets.V2_tenant_checkins;
  const writes = [];
  const settings = options.noMeterFees ? {
    default_payment_day: 10, default_electricity_fee_rate: 0,
    summer_equipment_fee_rate: 0, regular_equipment_fee_rate: 0,
    default_management_fee: 0, summer_months: [6, 7, 8, 9]
  } : {
    default_payment_day: 10, default_electricity_fee_rate: 3,
    summer_equipment_fee_rate: 2, regular_equipment_fee_rate: 2,
    default_management_fee: 0, summer_months: [6, 7, 8, 9]
  };
  const access = {
    success: true, workspace: { workspace_id: 'W1' },
    // Global users do not belong to the tenant's Workspace.
    user: { user_id: 'GLOBAL-USER', workspace_id: 'OTHER' },
    membership: { membership_id: 'M1', role: 'owner' },
    principals: [{ landlord_id: 'L1' }], principal_landlord_id: 'L1'
  };
  const context = vm.createContext({
    Date, console,
    runtimeSpreadsheet_: () => ({ getSheetByName: name => sheets[name] || null }),
    workspaceLandlordResolveAccess_: () => access,
    workspaceGetObjectsWithRow_: sheet => sheet.rows.map(row => ({ ...row })),
    settingsIntegrationGetWorkspaceSettings_: () => settings,
    workspaceBuildWorkspaceView_: value => value,
    workspaceBuildUserView_: value => value,
    workspaceBuildMembershipView_: value => value,
    workspaceRequirePermission_: () => ({ success: true }),
    workspaceResult_: (success, code, message, data) => ({ success, code, message, data }),
    workspaceNextId_: () => 'B-NEW',
    workspaceAppendObject_: (sheet, value) => {
      writes.push({ sheet: sheet.getName(), value: { ...value } });
      sheet.rows.push({ ...value, __row_number: sheet.rows.length + 2 });
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: { flush() {} },
    Utilities: {
      formatDate(date, _timezone, pattern) {
        const yyyy = String(date.getFullYear());
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return pattern === 'yyyy-MM' ? `${yyyy}-${mm}` : `${yyyy}-${mm}-${dd}`;
      }
    },
    tenantCheckinEnsureSchema_() { throw new Error('checkin schema writes are forbidden'); }
  });
  vm.runInContext(source, context, { filename: 'V2_BILLING_MANAGEMENT.js' });
  Object.assign(context, {
    billingEnsureSchema_() {},
    billingAudit_() {},
    billingSyncBillViews_() {},
    billingRefreshWorkspaceSummaries_() {},
    billingSetValues_(sheet, rowNumber, value) {
      writes.push({ sheet: sheet.getName(), value: { ...value } });
      Object.assign(sheet.rows.find(row => row.__row_number === rowNumber), value);
    }
  });
  return {
    context, sheets, writes,
    init(month = '2026-09') {
      const result = context.getLandlordBillingInitByLineUid_('owner', month, '');
      assert.equal(result.success, true, result.message);
      assert.equal(result.data.items.length, 1);
      return result.data.items[0];
    },
    submit(input = {}, month = '2026-09') {
      return context.generateLandlordBillsByLineUid_('owner', month, JSON.stringify([{
        room_id: 'R1', selected: true, current_meter_reading: 120,
        due_date: `${month}-28`, ...input
      }]));
    },
    newBill() { return sheets.V2_bills.rows.find(row => row.bill_id === 'B-NEW'); }
  };
}

function assertRequired(runtime, input = {}, month = '2026-09') {
  const item = runtime.init(month);
  assert.equal(item.previous_meter, '', 'missing baseline must render blank, never zero');
  assert.match(item.previous_meter_source_label, /房客資料.*初始電[表錶]/);
  const result = runtime.submit(input, month);
  assert.equal(result.success, false, 'missing baseline must stop generation');
  assert.equal(result.data.generated_count, 0);
  assert.equal(result.data.errors[0].code, 'INITIAL_METER_READING_REQUIRED');
  assert.match(result.data.errors[0].message, /房客資料.*初始電[表錶]/);
  assert.equal(runtime.writes.length, 0, 'no bill/room persistence after failure');
}

for (const value of [undefined, null, '', '   ', -1, 'garbage', 'Infinity', 'NaN', true, ',']) {
  test(`missing/invalid checkin baseline ${String(value)} cannot become zero`, () => {
    assertRequired(createRuntime({ checkins: [{ ...checkin, first_meter_reading: value }] }));
  });
}

test('absent checkin sheet does not create schema or assume zero', () => {
  assertRequired(createRuntime({ missingCheckinSheet: true }));
});

for (const value of [0, '0', 100, '100.5']) {
  test(`init and submit both use explicit checkin baseline ${value}`, () => {
    const runtime = createRuntime({ checkins: [{ ...checkin, first_meter_reading: value }] });
    assert.equal(runtime.init().previous_meter, Number(value));
    const result = runtime.submit({ previous_meter: 999 });
    assert.equal(result.success, true, result.message);
    assert.equal(runtime.newBill().previous_meter, Number(value), 'saved checkin baseline stays authoritative');
    assert.equal(runtime.newBill().electricity_usage, 120 - Number(value));
    assert.equal(runtime.sheets.V2_tenant_checkins.rows[0].first_meter_reading, value);
    assert.ok(runtime.writes.every(write => ['V2_bills', 'V2_rooms'].includes(write.sheet)));
  });
}

for (const field of ['workspace_id', 'contract_id', 'tenant_id', 'room_id']) {
  test(`checkin with different ${field} is not a lease baseline`, () => {
    assertRequired(createRuntime({ checkins: [{ ...checkin, [field]: 'OTHER' }] }));
  });
  test(`checkin with missing ${field} cannot match by room or global user`, () => {
    assertRequired(createRuntime({ checkins: [{ ...checkin, [field]: '', user_id: 'GLOBAL-USER' }] }));
  });
}

for (const readings of [[100, 100], [0, 0], [100, 110]]) {
  test(`duplicate checkins ${JSON.stringify(readings)} cannot choose a latest baseline`, () => {
    assertRequired(createRuntime({ checkins: [
      { ...checkin, first_meter_reading: readings[0], updated_at: '2026-09-15' },
      { ...checkin, first_meter_reading: readings[1], updated_at: '2026-09-16' }
    ] }));
  });
}

for (const scenario of [
  { workspace: '', canonicalReading: 100 },
  { workspace: '   ', canonicalReading: 100 },
  { workspace: undefined, canonicalReading: 100 },
  { workspace: '', canonicalReading: 0 }
]) {
  test(`legacy zero checkin ${JSON.stringify(scenario)} blocks the canonical same-contract baseline`, () => {
    assertRequired(createRuntime({ checkins: [
      { ...checkin, workspace_id: scenario.workspace, first_meter_reading: 0, updated_at: '2026-09-14' },
      { ...checkin, first_meter_reading: scenario.canonicalReading, updated_at: '2026-09-16' }
    ] }));
  });
}

test('legacy zero checkin with conflicting tenant and room still blocks the canonical same-contract row', () => {
  assertRequired(createRuntime({ checkins: [
    { ...checkin, workspace_id: '', tenant_id: 'OTHER', room_id: 'OTHER', first_meter_reading: 0 },
    checkin
  ] }));
});

test('a unique legacy zero checkin remains missing without migration or appending a baseline', () => {
  const runtime = createRuntime({ checkins: [{ ...checkin, workspace_id: '', first_meter_reading: 0 }] });
  const before = JSON.stringify(runtime.sheets.V2_tenant_checkins.rows);
  assertRequired(runtime);
  assert.equal(JSON.stringify(runtime.sheets.V2_tenant_checkins.rows), before);
});

test('a unique legacy zero checkin still permits explicit manual zero without changing checkins', () => {
  const runtime = createRuntime({ checkins: [{ ...checkin, workspace_id: '', first_meter_reading: 0 }] });
  const before = JSON.stringify(runtime.sheets.V2_tenant_checkins.rows);
  assert.equal(runtime.init().previous_meter, '');
  assert.equal(runtime.submit({ previous_meter: 0 }).success, true);
  assert.equal(runtime.newBill().previous_meter, 0);
  assert.equal(runtime.newBill().electricity_usage, 120);
  assert.equal(JSON.stringify(runtime.sheets.V2_tenant_checkins.rows), before);
});

test('legacy zero checkin alongside canonical still permits the existing explicit manual rule', () => {
  const runtime = createRuntime({ checkins: [checkin, { ...checkin, workspace_id: '', first_meter_reading: 0 }] });
  const before = JSON.stringify(runtime.sheets.V2_tenant_checkins.rows);
  assert.equal(runtime.init().previous_meter, '');
  assert.equal(runtime.submit({ previous_meter: 0 }).success, true);
  assert.equal(runtime.newBill().previous_meter, 0);
  assert.equal(JSON.stringify(runtime.sheets.V2_tenant_checkins.rows), before);
});

test('legacy zero checkin inserted after init is rejected by submit without a manual baseline', () => {
  const runtime = createRuntime({ checkins: [checkin] });
  assert.equal(runtime.init().previous_meter, 100);
  runtime.sheets.V2_tenant_checkins.rows.push({ ...checkin, workspace_id: '', first_meter_reading: 0, __row_number: 3 });
  const result = runtime.submit();
  assert.equal(result.success, false);
  assert.equal(result.data.errors[0].code, 'INITIAL_METER_READING_REQUIRED');
  assert.equal(runtime.writes.length, 0);
});

test('legacy checkin for another contract does not block the canonical baseline', () => {
  const runtime = createRuntime({ checkins: [checkin, { ...checkin, workspace_id: '', contract_id: 'OTHER', first_meter_reading: 0 }] });
  assert.equal(runtime.init().previous_meter, 100);
  assert.equal(runtime.submit().success, true);
  assert.equal(runtime.newBill().electricity_usage, 20);
});

for (const overrides of [
  { tenant_id: 'OTHER' }, { room_id: 'OTHER' }, { tenant_id: '' }, { room_id: '' }
]) {
  test(`conflicting identity ${JSON.stringify(overrides)} blocks the matching checkin baseline`, () => {
    assertRequired(createRuntime({ checkins: [
      { ...checkin, ...overrides, updated_at: '2026-09-14' },
      { ...checkin, updated_at: '2026-09-16' }
    ] }));
  });
}

for (const previousMeter of [0, 100]) {
  test(`ambiguous checkin baseline still permits explicit manual previous_meter ${previousMeter}`, () => {
    const runtime = createRuntime({ checkins: [
      checkin,
      { ...checkin, tenant_id: 'OTHER', updated_at: '2026-09-16' }
    ] });
    const before = JSON.stringify(runtime.sheets.V2_tenant_checkins.rows);
    assert.equal(runtime.init().previous_meter, '');
    assert.equal(runtime.submit({ previous_meter: previousMeter }).success, true);
    assert.equal(runtime.newBill().previous_meter, previousMeter);
    assert.equal(runtime.newBill().electricity_usage, 120 - previousMeter);
    assert.equal(JSON.stringify(runtime.sheets.V2_tenant_checkins.rows), before);
  });
}

test('duplicate checkin inserted after init is rejected on direct submit without a manual baseline', () => {
  const runtime = createRuntime({ checkins: [checkin] });
  assert.equal(runtime.init().previous_meter, 100);
  runtime.sheets.V2_tenant_checkins.rows.push({ ...checkin, updated_at: '2026-09-16', __row_number: 3 });
  const result = runtime.submit();
  assert.equal(result.success, false);
  assert.equal(result.data.errors[0].code, 'INITIAL_METER_READING_REQUIRED');
  assert.equal(runtime.writes.length, 0);
});

test('same contract ID in another workspace or a different contract does not create ambiguity', () => {
  const runtime = createRuntime({ checkins: [
    checkin,
    { ...checkin, workspace_id: 'OTHER', first_meter_reading: 900 },
    { ...checkin, contract_id: 'OTHER', first_meter_reading: 900 }
  ] });
  assert.equal(runtime.init().previous_meter, 100);
  assert.equal(runtime.submit().success, true);
  assert.equal(runtime.newBill().electricity_usage, 20);
});

test('ambiguous checkins do not change the reliable same-lease prior reading path', () => {
  const runtime = createRuntime({ bills: [priorBill], checkins: [checkin, checkin] });
  assert.equal(runtime.init('2026-10').previous_meter, 150);
  assert.equal(runtime.submit({ current_meter_reading: 170 }, '2026-10').success, true);
  assert.equal(runtime.newBill().electricity_usage, 20);
});

test('a new tenant first bill uses checkin, never the old tenant bill or room latest', () => {
  const runtime = createRuntime({
    checkins: [checkin],
    bills: [{ ...priorBill, tenant_id: 'OLD', contract_id: 'OLD', bill_month: '2026-08', current_meter_reading: 9500 }],
    room: { latest_meter_bill_month: '2026-08', latest_meter_reading: 9999 }
  });
  assert.equal(runtime.init().previous_meter, 100);
  assert.equal(runtime.submit().success, true);
  assert.equal(runtime.newBill().electricity_usage, 20);
  assert.equal(runtime.newBill().electricity_amount, 60);
});

test('missing first baseline cannot inherit an old tenant bill or room latest', () => {
  assertRequired(createRuntime({
    bills: [{ ...priorBill, tenant_id: 'OLD', contract_id: 'OLD', bill_month: '2026-08' }],
    room: { latest_meter_bill_month: '2026-08', latest_meter_reading: 100 }
  }));
});

test('a prior row predating lease start cannot replace the first baseline even with the same IDs', () => {
  const runtime = createRuntime({
    checkins: [checkin], bills: [{ ...priorBill, bill_month: '2026-08', current_meter_reading: 9500 }]
  });
  assert.equal(runtime.init().previous_meter, 100);
  assert.equal(runtime.submit().success, true);
  assert.equal(runtime.newBill().previous_meter, 100);
});

test('later month uses same-lease prior current reading ahead of the initial baseline', () => {
  const runtime = createRuntime({ checkins: [checkin], bills: [priorBill] });
  assert.equal(runtime.init('2026-10').previous_meter, 150);
  assert.equal(runtime.submit({ current_meter_reading: 170 }, '2026-10').success, true);
  assert.equal(runtime.newBill().previous_meter, 150);
  assert.equal(runtime.newBill().electricity_usage, 20);
});

test('later same-lease zero current reading is a reliable source even without checkin', () => {
  const runtime = createRuntime({ bills: [{ ...priorBill, current_meter_reading: 0 }] });
  assert.equal(runtime.init('2026-10').previous_meter, 0);
  assert.equal(runtime.submit({ current_meter_reading: 5 }, '2026-10').success, true);
  assert.equal(runtime.newBill().electricity_usage, 5);
});

test('a more recent unrelated room bill cannot hide a reliable same-lease prior bill', () => {
  const runtime = createRuntime({
    bills: [priorBill, { ...priorBill, bill_id: 'OTHER', contract_id: 'OTHER', tenant_id: 'OTHER', bill_month: '2026-10', current_meter_reading: 8000 }]
  });
  assert.equal(runtime.init('2026-11').previous_meter, 150);
  assert.equal(runtime.submit({ current_meter_reading: 170 }, '2026-11').success, true);
  assert.equal(runtime.newBill().electricity_usage, 20);
});

test('same-tenant legacy bill with no contract ID inside this lease remains compatible', () => {
  const runtime = createRuntime({
    contract: { start_date: '2026-09-01' },
    viewBills: [{ ...priorBill, contract_id: '', current_meter_reading: 150 }]
  });
  assert.equal(runtime.init('2026-10').previous_meter, 150);
  assert.equal(runtime.submit({ current_meter_reading: 170 }, '2026-10').success, true);
  assert.equal(runtime.newBill().electricity_usage, 20);
});

test('legacy landlord-scoped prior bill is compatible when tenant and lease dates prove scope', () => {
  const runtime = createRuntime({
    contract: { start_date: '2026-09-01' },
    bills: [{ ...priorBill, workspace_id: '', contract_id: '' }]
  });
  assert.equal(runtime.init('2026-10').previous_meter, 150);
  assert.equal(runtime.submit({ current_meter_reading: 170 }, '2026-10').success, true);
  assert.equal(runtime.newBill().electricity_usage, 20);
});

test('legacy bill without contract ID in a partial start month cannot prove it belongs to this lease', () => {
  assertRequired(createRuntime({ bills: [{ ...priorBill, contract_id: '' }] }), {}, '2026-10');
});

for (const overrides of [
  { tenant_id: 'OTHER' }, { contract_id: 'OTHER' },
  { workspace_id: 'OTHER' }, { tenant_id: '', contract_id: '' },
  { current_meter_reading: 'garbage' }, { current_meter_reading: 'Infinity' },
  { current_meter_reading: '' }, { bill_status: 'voided' }
]) {
  test(`unreliable prior reading ${JSON.stringify(overrides)} cannot authorize a new bill`, () => {
    assertRequired(createRuntime({ bills: [{ ...priorBill, ...overrides }] }), { current_meter_reading: 170 }, '2026-10');
  });
}

for (const value of [0, '0', 100]) {
  test(`explicit manual previous_meter ${value} may supply a missing baseline`, () => {
    const runtime = createRuntime();
    assert.equal(runtime.submit({ previous_meter: value }).success, true);
    assert.equal(runtime.newBill().previous_meter, Number(value));
    assert.equal(runtime.newBill().electricity_usage, 120 - Number(value));
  });
}

for (const value of ['', '   ', null, -1, 'garbage', 'Infinity', true]) {
  test(`manual previous_meter ${String(value)} cannot bypass baseline validation`, () => {
    assertRequired(createRuntime(), { previous_meter: value });
  });
}

for (const status of ['unpaid', 'paid']) {
  test(`existing ${status} bill and its snapshot stay locked without an initial baseline`, () => {
    const bill = {
      ...priorBill, bill_month: '2026-09', previous_meter: 55, current_meter_reading: 75,
      electricity_usage: 20, electricity_amount: 60, total_amount: 9100,
      payment_status: status, rent_amount: 9000, note: '原快照'
    };
    const runtime = createRuntime({ bills: [bill], checkins: [{ ...checkin, first_meter_reading: 9999 }] });
    const before = JSON.stringify(runtime.sheets.V2_bills.rows);
    const item = runtime.init();
    assert.equal(item.previous_meter, 55);
    assert.equal(item.current_meter_reading, 75);
    assert.equal(item.existing_bill.total_amount, 9100);
    const result = runtime.submit({ previous_meter: 999, current_meter_reading: 999 });
    assert.equal(result.code, 'BILLS_ALREADY_CREATED_LOCKED');
    assert.equal(JSON.stringify(runtime.sheets.V2_bills.rows), before);
    assert.equal(runtime.writes.length, 0);
  });
}

test('existing historical zero baseline retains the legacy prior-current display fallback', () => {
  const runtime = createRuntime({
    bills: [priorBill, { ...priorBill, contract_id: '', bill_id: 'EXISTING', bill_month: '2026-10', previous_meter: 0, current_meter_reading: 170 }]
  });
  const before = JSON.stringify(runtime.sheets.V2_bills.rows);
  assert.equal(runtime.init('2026-10').previous_meter, 150);
  assert.equal(runtime.submit({}, '2026-10').code, 'BILLS_ALREADY_CREATED_LOCKED');
  assert.equal(JSON.stringify(runtime.sheets.V2_bills.rows), before);
});

for (const status of ['unpaid', 'paid']) {
  test(`existing ${status} complete bill snapshot preserves explicit zero even with prior and checkin readings`, () => {
    const runtime = createRuntime({
      checkins: [checkin],
      bills: [priorBill, {
        ...priorBill, bill_id: 'EXISTING', bill_month: '2026-10', previous_meter: 0,
        current_meter_reading: 20, electricity_usage: 20, electricity_amount: 60,
        equipment_amount: 40, total_amount: 9100, payment_status: status
      }]
    });
    const before = JSON.stringify(runtime.sheets.V2_bills.rows);
    const item = runtime.init('2026-10');
    assert.equal(item.previous_meter, 0);
    assert.equal(item.previous_meter_locked, true);
    assert.equal(item.existing_bill.previous_meter, 0);
    assert.equal(item.existing_bill.current_meter_reading, 20);
    assert.equal(item.existing_bill.total_amount, 9100);
    assert.equal(runtime.submit({}, '2026-10').code, 'BILLS_ALREADY_CREATED_LOCKED');
    assert.equal(JSON.stringify(runtime.sheets.V2_bills.rows), before);
    assert.equal(runtime.writes.length, 0);
  });
}

test('September 11 checkin pending supplies the first October bill without reusing September old lease', () => {
  const runtime = createRuntime({
    contract: { start_date: '2026-09-11' },
    checkins: [{ ...checkin, checkin_status: 'pending', first_meter_reading: 100 }],
    bills: [{ ...priorBill, contract_id: 'OLD', bill_month: '2026-09', current_meter_reading: 8000 }],
    room: { latest_meter_bill_month: '2026-09', latest_meter_reading: 8000 }
  });
  assert.equal(runtime.init('2026-10').previous_meter, 100);
  assert.equal(runtime.submit({ current_meter_reading: 120 }, '2026-10').success, true);
  assert.equal(runtime.newBill().electricity_usage, 20);
  assert.equal(runtime.sheets.V2_tenant_checkins.rows[0].checkin_status, 'pending');
  assert.equal(runtime.sheets.V2_contracts.rows[0].start_date, '2026-09-11');
  assert.equal(runtime.sheets.V2_contracts.rows[0].__billing_initial_meter_reading, undefined);
});

test('submit reloads this lease baseline after init without trusting the earlier client value', () => {
  const runtime = createRuntime({ checkins: [checkin] });
  assert.equal(runtime.init().previous_meter, 100);
  runtime.sheets.V2_tenant_checkins.rows[0].first_meter_reading = 0;
  assert.equal(runtime.submit({ previous_meter: 100, current_meter_reading: 5 }).success, true);
  assert.equal(runtime.newBill().previous_meter, 0);
  assert.equal(runtime.newBill().electricity_usage, 5);
});

test('missing baseline also fails closed on direct submit without running init', () => {
  const runtime = createRuntime();
  const result = runtime.submit();
  assert.equal(result.success, false);
  assert.equal(result.data.errors[0].code, 'INITIAL_METER_READING_REQUIRED');
  assert.equal(runtime.writes.length, 0);
});

test('no-meter-fee bill still generates without an initial reading', () => {
  const runtime = createRuntime({
    noMeterFees: true,
    room: { electricity_fee_rate: 0, equipment_fee_rate_regular: 0, equipment_fee_rate_summer: 0 }
  });
  assert.equal(runtime.init().requires_meter, false);
  assert.equal(runtime.submit({ current_meter_reading: '' }).success, true);
  assert.equal(runtime.newBill().electricity_usage, 0);
  assert.equal(runtime.newBill().total_amount, 4800);
});
