import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const pad = value => String(value).padStart(2, '0');

function loadBackend() {
  const context = {
    Utilities: {
      formatDate(date, timezone, format) {
        const month = date.getFullYear() + '-' + pad(date.getMonth() + 1);
        return format === 'yyyy-MM' ? month : month + '-' + pad(date.getDate());
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(read('apps-script/V2_CANONICAL_BILLING_TRUTH.js'), context);
  vm.runInContext(
    read('apps-script/V2_WORKSPACE_DASHBOARD_NATIVE.js') +
      '\nthis.api = { workspacePaymentCalendarBuild_, workspaceDashboardLoadData_ };' +
      // Dates must come from the sandbox realm for its instanceof checks.
      '\nthis.today = new Date(2026, 10, 4);',
    context
  );
  return Object.assign(context.api, { today: context.today });
}

const room = (id, extra) => Object.assign(
  { room_id: id, room_name: id.slice(1), property_id: 'P1', account_status: 'active' },
  extra
);
const bill = (id, roomId, month, extra) => Object.assign(
  {
    bill_id: id, room_id: roomId, room_name: roomId.slice(1), property_id: 'P1',
    bill_month: month, total_amount: 10000, bill_status: 'issued',
    payment_status: 'unpaid', due_date: month + '-10',
    tenant_line_user_id: 'U_SHOULD_NOT_LEAK'
  },
  extra
);

const fixture = {
  properties: [{ property_id: 'P1', property_name: '一館' }],
  tenants: [{ tenant_id: 'T1', tenant_name: '甲' }, { tenant_id: 'T7', tenant_name: '庚' }],
  rooms: [
    room('R201', { current_tenant_id: 'T1', room_status: 'occupied' }),
    room('R202', { room_status: 'vacant' }),
    room('R203'),
    room('R204'),
    room('R205', { account_status: 'inactive' }),
    room('R206'),
    room('R207')
  ],
  contracts: [
    { contract_id: 'C3', room_id: 'R203', start_date: '2026-01-01', end_date: '2026-09-30', contract_status: 'ended' },
    { contract_id: 'C4', room_id: 'R204', start_date: '2026-11-01', end_date: '2027-10-31', contract_status: 'pending_tenant_signature' },
    { contract_id: 'C6', room_id: 'R206', start_date: '2026-01-01', end_date: '2026-12-31', contract_status: 'active', checkout_move_out_date: '2026-10-15' },
    { contract_id: 'C7', room_id: 'R207', tenant_id: 'T7', start_date: '2026-01-01', end_date: '2027-12-31', contract_status: 'active' }
  ],
  bills: [
    bill('B201-09', 'R201', '2026-09', { payment_status: 'paid', tenant_name: '甲' }),
    bill('B201-10', 'R201', '2026-10', { tenant_name: '甲', total_amount: 10300 }),
    bill('B201-11', 'R201', '2026-11', { tenant_name: '甲' }),
    bill('B205-09', 'R205', '2026-09', { tenant_name: '戊', total_amount: 8000 }),
    bill('B207-09', 'R207', '2026-09', { bill_status: 'void' }),
    bill('B207-10', 'R207', '2026-10', { payment_status: 'paid' }),
    bill('B201-07', 'R201', '2026-07')
  ]
};

test('payment calendar marks each room per month with the arrears rules', () => {
  const api = loadBackend();
  const data = JSON.parse(JSON.stringify(
    api.workspacePaymentCalendarBuild_(fixture, api.today)
  ));

  assert.equal(data.current_month, '2026-11');
  assert.equal(data.as_of, '2026-11-04');
  assert.deepEqual(data.months.map(month => month.month), ['2026-09', '2026-10', '2026-11']);

  // Overdue rooms first (longest first), then rooms still to bill, then vacant.
  assert.deepEqual(data.rooms.map(row => row.room_name), ['205', '201', '203', '206', '207', '202', '204']);

  const byName = Object.fromEntries(data.rooms.map(row => [row.room_name, row]));
  const statuses = name => byName[name].cells.map(cell => cell.status);
  assert.deepEqual(statuses('201'), ['paid', 'overdue', 'unpaid']);
  assert.equal(byName['201'].cells[1].days_overdue, 25);
  assert.equal(byName['201'].cells[1].unpaid_amount, 10300);
  assert.equal(byName['201'].tenant_name, '甲');
  // An inactive room still shows while it has an unpaid bill.
  assert.deepEqual(statuses('205'), ['overdue', 'vacant', 'vacant']);
  assert.equal(byName['205'].max_days_overdue, 55);
  // An ended lease still covered its own months; a pending one does not.
  assert.deepEqual(statuses('203'), ['no_bill', 'vacant', 'vacant']);
  assert.deepEqual(statuses('204'), ['vacant', 'vacant', 'vacant']);
  // Move-out date ends the lease early.
  assert.deepEqual(statuses('206'), ['no_bill', 'no_bill', 'vacant']);
  // A voided bill does not count as paid or unpaid.
  assert.deepEqual(statuses('207'), ['no_bill', 'paid', 'no_bill']);
  assert.equal(byName['207'].tenant_name, '庚');
  // The tenant ID lets the landlord open the tenant from the calendar.
  assert.equal(byName['201'].tenant_id, 'T1');
  assert.equal(byName['207'].tenant_id, 'T7');
  assert.equal(byName['202'].tenant_id, '');
  assert.deepEqual(statuses('202'), ['vacant', 'vacant', 'vacant']);

  const november = data.months[2];
  assert.deepEqual(
    [november.room_count, november.billed_count, november.paid_count, november.unpaid_count,
      november.overdue_count, november.no_bill_count, november.vacant_count],
    [7, 1, 0, 1, 0, 1, 5]
  );
  const september = data.months[0];
  assert.deepEqual(
    [september.paid_count, september.overdue_count, september.no_bill_count, september.vacant_count],
    [1, 1, 3, 2]
  );
  assert.equal(september.paid_amount, 10000);
  assert.equal(september.unpaid_amount, 8000);

  assert.doesNotMatch(JSON.stringify(data), /U_SHOULD_NOT_LEAK|line_user_id/);
});

test('payment calendar reads rooms, leases, bills and tenants only', () => {
  const requested = [];
  const sandbox = {
    Utilities: { formatDate: () => '' },
    workspaceGetObjectsWithRow_: target => { requested.push(target.name); return []; }
  };
  vm.createContext(sandbox);
  vm.runInContext(
    read('apps-script/V2_WORKSPACE_DASHBOARD_NATIVE.js') +
      '\nworkspaceDashboardRowsForAccess_ = function (sheet) { return workspaceGetObjectsWithRow_(sheet); };' +
      '\nthis.api = { workspaceDashboardLoadData_ };',
    sandbox
  );
  const ss = { getSheetByName: name => ({ name }) };
  const data = sandbox.api.workspaceDashboardLoadData_(ss, { workspace: {} }, { mode: 'calendar' });

  assert.deepEqual(requested, ['V2_properties', 'V2_rooms', 'V2_contracts', 'V2_bills', 'V2_tenants']);
  assert.equal(data.users.length, 0);
  assert.equal(data.tenant_view_rows.length, 0);
});

test('payment calendar route is a landlord read everywhere it must be listed', () => {
  const dispatcher = read('apps-script/程式碼.js');
  assert.match(dispatcher, /v2Action === 'landlord_payment_calendar'[\s\S]{0,120}getWorkspaceLandlordPaymentCalendarNativeByLineUid_\(lineUserId\)/);
  assert.match(dispatcher, /useBridge && action === 'landlord_payment_calendar'[\s\S]{0,400}principal\.data\.principal_line_user_id/);
  assert.match(read('apps-script/V2_RUNTIME_SNAPSHOT.js'), /landlord_payment_calendar: true/);
  assert.match(read('apps-script/V2_READ_REPLICA_SYNC.js'), /\blandlord_payment_calendar\b/);
  assert.match(read('landlord-auth.js'), /\blandlord_payment_calendar\b/);
  assert.match(read('landlord-api.js'), /landlord_payment_calendar: true/);
  assert.match(read('docs/04-API-ROUTES.md'), /`landlord_payment_calendar`/);
});

function loadPage() {
  const page = read('landlord-arrears.html');
  const start = page.indexOf('    const PAYMENT_CALENDAR_LABELS');
  const end = page.indexOf('    async function loadTestBillArchiveCandidates()');
  assert.ok(start > 0 && end > start);
  const helperStart = page.indexOf('    function rawText(value)');
  const helperEnd = page.indexOf('    function statusText(value)');
  const context = { PAYMENT_CALENDAR: { view: 'month', data: null, error: false } };
  vm.createContext(context);
  vm.runInContext(
    page.slice(helperStart, helperEnd) + page.slice(start, end) +
      '\nthis.render = renderPaymentCalendarSection;',
    context
  );
  return { page, context };
}

test('arrears page shows the month counts and puts owing rooms first', () => {
  const { page, context } = loadPage();
  assert.match(page, /\$\{renderPaymentCalendarSection\(\)\}/);
  assert.match(page, /loadTestBillArchiveCandidates\(\);\n\s+loadPaymentCalendar\(\);/);
  assert.match(page, /landlord_payment_calendar: true/);

  assert.match(context.render(), /繳費月曆載入中/);

  context.PAYMENT_CALENDAR.data = JSON.parse(JSON.stringify(
    (api => api.workspacePaymentCalendarBuild_(fixture, api.today))(loadBackend())
  ));
  const month = context.render();
  assert.match(month, /2026 年 11 月・共 7 間房，已開帳單 1 間/);
  assert.match(month, /未繳<\/div>\s*<div class="pay-cal-stat-value">1<small>戶/);
  assert.match(month, /空房<\/div>\s*<div class="pay-cal-stat-value">5<small>間/);
  const tiles = [...month.matchAll(/pay-cal-room (\w+)"[^>]*>\s*(?:<span class="pay-cal-room-go"[^>]*>›<\/span>\s*)?<div class="pay-cal-room-name">(\d+)/g)]
    .map(match => match[2] + ':' + match[1]);
  assert.deepEqual(tiles.slice(0, 2), ['201:unpaid', '207:no_bill']);
  assert.equal(tiles.at(-1).endsWith(':vacant'), true);

  // Rooms with a tenant open that tenant; rooms without one are not buttons.
  assert.match(month, /<button class="pay-cal-room unpaid" type="button" data-tenant-id="T1" onclick="openTenantDetail\(this\.dataset\.tenantId\)"/);
  assert.match(month, /<div class="pay-cal-room vacant">\s*<div class="pay-cal-room-name">202/);

  context.PAYMENT_CALENDAR.view = 'quarter';
  const quarter = context.render();
  assert.match(quarter, /<button class="pay-cal-row-link" type="button" data-tenant-id="T7" onclick="openTenantDetail\(this\.dataset\.tenantId\)"/);
  assert.match(quarter, /<div class="pay-cal-row-link">\s*<div class="pay-cal-row-room">\s*202/);
  assert.match(quarter, /9 月\s*<small>已繳 1\/2<\/small>/);
  assert.equal((quarter.match(/pay-cal-row-tag">欠繳/g) || []).length, 2);
  const rows = [...quarter.matchAll(/pay-cal-row-room">\s*(\d+)/g)].map(match => match[1]);
  assert.deepEqual(rows, ['205', '201', '203', '206', '207', '202', '204']);
  assert.match(quarter, /! 逾期<\/div>\s*<div class="pay-cal-cell-amount">\$10,300/);

  context.PAYMENT_CALENDAR.data = null;
  context.PAYMENT_CALENDAR.error = true;
  assert.match(context.render(), /繳費月曆暫時無法載入[\s\S]*loadPaymentCalendar\(\)/);
});
