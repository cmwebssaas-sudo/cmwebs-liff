import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadBillingGenerationResultFormatter() {
  const source = fs.readFileSync('landlord-billing.html', 'utf8');
  const start = source.indexOf('function formatBillingGenerationResult(');
  const end = source.indexOf('\n    async function generateBills()', start);

  assert.notEqual(start, -1, 'formatBillingGenerationResult must exist in the billing page');
  assert.notEqual(end, -1, 'formatBillingGenerationResult must precede generateBills');

  const context = {};
  vm.runInNewContext(source.slice(start, end), context);
  return context.formatBillingGenerationResult;
}

{
  const formatBillingGenerationResult = loadBillingGenerationResultFormatter();

  assert.equal(
    formatBillingGenerationResult({
      code: 'BILLS_ALREADY_CREATED_LOCKED',
      data: { generated_count: 0, skipped_count: 18, error_count: 0 }
    }),
    '所選帳單均已建立，未修改任何資料'
  );

  assert.equal(
    formatBillingGenerationResult({
      code: 'BILLS_CREATED',
      data: { generated_count: 2, skipped_count: 1, error_count: 0 }
    }),
    '已建立 2 筆帳單，略過 1 筆已建立帳單'
  );

  assert.equal(
    formatBillingGenerationResult({
      code: 'BILLS_CREATED_WITH_ERRORS',
      data: { generated_count: 2, skipped_count: 1, error_count: 3 }
    }),
    '已建立 2 筆帳單，另有 3 筆失敗，略過 1 筆已建立帳單'
  );
}

function createRuntime(existingBills) {
  const fixtures = {
    billWrites: 0,
    roomMeterWrites: 0,
    roomMeterWriteRoomIds: []
  };
  const sheets = {
    V2_properties: { name: 'V2_properties', rows: [] },
    V2_rooms: {
      name: 'V2_rooms',
      rows: [
        { room_id: 'R001', room_name: '101', __row_number: 2 },
        { room_id: 'R002', room_name: '102', __row_number: 3 }
      ]
    },
    V2_contracts: { name: 'V2_contracts', rows: [] },
    V2_tenants: { name: 'V2_tenants', rows: [] },
    V2_bills: { name: 'V2_bills', rows: existingBills },
    V2_tenant_bill_view: { name: 'V2_tenant_bill_view', rows: [] }
  };
  const context = {
    JSON,
    Date,
    Error,
    Object,
    Boolean,
    LockService: {
      getScriptLock: () => ({ waitLock() {}, releaseLock() {} })
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (name) => sheets[name]
      }),
      flush() {}
    },
    billingEnsureSchema_() {},
    workspaceLandlordResolveAccess_() {
      return {
        success: true,
        workspace: { workspace_id: 'workspace-a' },
        principal_landlord_id: 'landlord-a'
      };
    },
    billingRequireGenerate_() { return { success: true }; },
    billingNormalizeBillMonth_(value) { return value === '2026-08' ? value : ''; },
    billingParseItemsJson_(value) { return JSON.parse(value); },
    billingText_(value) { return value == null ? '' : String(value); },
    billingGetWorkspaceRows_(sheet) { return sheet.rows; },
    billingGetWorkspaceRoomRows_(_ss, _access, _propertyMap) { return sheets.V2_rooms.rows; },
    billingMonthStart_() { return new Date('2026-08-01T00:00:00Z'); },
    billingMonthEnd_() { return new Date('2026-08-31T00:00:00Z'); },
    billingActor_() { return { user_id: 'user-a', membership_id: 'membership-a' }; },
    billingResolveRoomContractForMonth_(_contracts, roomId) {
      return { tenant_id: roomId === 'R001' ? 'T001' : 'T002' };
    },
    billingIsPaidStatus_() { return false; },
    billingMergeReferenceBills_(bills) { return bills; },
    billingResolvePreviousBill_() { return null; },
    billingCalculateBill_(room, contract, tenant, _existing, _previous, billMonth, item) {
      return {
        room_id: room.room_id,
        room_name: room.room_name,
        tenant_id: contract.tenant_id,
        tenant_name: tenant.tenant_name || '',
        bill_month: billMonth,
        due_date: new Date('2026-08-10T00:00:00Z'),
        current_meter_reading: item.current_meter_reading,
        electricity_usage: 1,
        electricity_fee_rate: 3,
        equipment_fee_rate: 2.5,
        total_amount: 100
      };
    },
    workspaceNextId_() { return 'B0000001'; },
    workspaceAppendObject_(sheet, record) {
      fixtures.billWrites += 1;
      sheet.rows.push({ ...record, __row_number: sheet.rows.length + 2 });
    },
    billingSetValues_(sheet, rowNumber) {
      if (sheet.name === 'V2_bills') fixtures.billWrites += 1;
      if (sheet.name === 'V2_rooms') {
        fixtures.roomMeterWrites += 1;
        fixtures.roomMeterWriteRoomIds.push(
          sheet.rows.find((room) => room.__row_number === rowNumber).room_id
        );
      }
    },
    billingSyncBillViews_() {},
    billingRefreshWorkspaceSummaries_() {},
    billingFormatDate_() { return '2026-08-10'; },
    billingNumber_(value) { return Number(value) || 0; },
    workspaceResult_(success, code, message, data) { return { success, code, message, data }; },
    billingAudit_() {}
  };
  const source = fs.readFileSync('apps-script/V2_BILLING_MANAGEMENT.js', 'utf8');
  const start = source.indexOf('function generateLandlordBillsByLineUid_(');
  const end = source.indexOf('// ==================================================\n// Billing calculations', start);
  vm.runInNewContext(
    "const V2_BILLING_SHEETS_ = { bills: 'V2_bills', tenantBillView: 'V2_tenant_bill_view', properties: 'V2_properties', rooms: 'V2_rooms', contracts: 'V2_contracts', tenants: 'V2_tenants' };\n" + source.slice(start, end),
    context
  );
  return { fixtures, generate: context.generateLandlordBillsByLineUid_ };
}

{
  const { fixtures, generate } = createRuntime([
    { bill_id: 'B0000009', room_id: 'R001', bill_month: '2026-08', payment_status: 'unpaid', __row_number: 2 }
  ]);
  const result = generate(
    'landlord-a',
    '2026-08',
    JSON.stringify([{ selected: true, room_id: 'R001', current_meter_reading: 999 }])
  );

  assert.equal(result.success, true);
  assert.equal(result.code, 'BILLS_ALREADY_CREATED_LOCKED');
  assert.equal(result.data.generated_count, 0);
  assert.equal(result.data.skipped[0].code, 'BILL_ALREADY_CREATED_LOCKED');
  assert.equal(fixtures.billWrites, 0);
  assert.equal(fixtures.roomMeterWrites, 0);
}

{
  const { fixtures, generate } = createRuntime([
    { bill_id: 'B0000009', room_id: 'R001', bill_month: '2026-08', payment_status: 'unpaid', __row_number: 2 }
  ]);
  const result = generate(
    'landlord-a',
    '2026-08',
    JSON.stringify([
      { selected: true, room_id: 'R001', current_meter_reading: 999 },
      { selected: true, room_id: 'R002', current_meter_reading: 888 }
    ])
  );

  assert.equal(result.success, true);
  assert.equal(result.data.generated_count, 1);
  assert.equal(result.data.skipped.length, 1);
  assert.equal(result.data.skipped[0].code, 'BILL_ALREADY_CREATED_LOCKED');
  assert.equal(fixtures.billWrites, 1);
  assert.equal(fixtures.roomMeterWriteRoomIds.includes('R001'), false);
}

function loadNotificationInitLine({ getProfile }) {
  const source = fs.readFileSync('landlord-bill-notifications.html', 'utf8');
  const start = source.indexOf('function buildLandlordLoginRedirectUri()');
  const end = source.indexOf('\n    function currentMonth()', start);

  assert.notEqual(start, -1, 'notification login redirect helper must exist');
  assert.notEqual(end, -1, 'initLine must precede currentMonth');

  const storage = new Map();
  const calls = { logout: 0, login: [] };
  const context = {
    URL,
    location: {
      href: 'https://example.test/landlord-bill-notifications.html?bill_month=2026-08',
      search: '?bill_month=2026-08'
    },
    sessionStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key)
    },
    LANDLORD_ENTRY_URL: 'https://example.test/landlord-entry.html',
    LIFF_ACCESS_TOKEN_RENEWAL_KEY:
      'cmwebs_landlord_bill_notifications_liff_renewal_attempted',
    TEST_MODE: false,
    LIFF_ID: 'liff-test',
    LINE_USER_ID: '',
    liff: {
      init: async () => {},
      isLoggedIn: () => true,
      getProfile,
      logout: () => { calls.logout += 1; },
      login: (options) => { calls.login.push(options); }
    }
  };

  vm.runInNewContext(source.slice(start, end), context);
  return { calls, context, storage };
}

{
  const runtime = loadNotificationInitLine({
    getProfile: async () => { throw new Error('The access token expired'); }
  });

  const result = await runtime.context.initLine();

  assert.equal(result, false);
  assert.equal(runtime.calls.logout, 1);
  assert.equal(runtime.calls.login.length, 1);
  assert.equal(
    new URL(runtime.calls.login[0].redirectUri).pathname.slice(1) +
      new URL(runtime.calls.login[0].redirectUri).search,
    'landlord-entry.html?return_to=landlord-bill-notifications.html%3Fbill_month%3D2026-08'
  );
}

{
  const runtime = loadNotificationInitLine({
    getProfile: async () => { throw new Error('Network unavailable'); }
  });

  await assert.rejects(
    runtime.context.initLine(),
    /Network unavailable/
  );
  assert.equal(runtime.calls.logout, 0);
  assert.equal(runtime.calls.login.length, 0);
}
