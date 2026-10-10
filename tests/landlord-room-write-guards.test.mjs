import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const backend = readFileSync('apps-script/V2_PROPERTY_ROOM_MANAGEMENT.js', 'utf8');
const frontend = readFileSync('landlord-properties.html', 'utf8');

function extract(source, name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `${name} must exist`);
  let depth = 0;
  for (let index = source.indexOf('{', match.index); index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) return source.slice(match.index, index + 1);
  }
  throw new Error(`${name} is not closed`);
}

const room = {
  room_id: 'R502', property_id: 'P1', room_name: '502',
  room_status: 'occupied', effective_status: 'needs_review',
  needs_occupancy_review: true, has_active_contract: false,
  rent_amount: 7500, management_fee: 0, electricity_fee_rate: 5,
  equipment_fee_rate_summer: 3, equipment_fee_rate_regular: 2,
  payment_day: 10, deposit_amount: 15000, note: 'original'
};

test('editing a review-needed room is held before any editor or write can run', async () => {
  const sheet = { innerHTML: '' };
  const modal = { classList: { add() {} } };
  const writes = [];
  const fields = {
    roomPropertyId: 'P1', roomName: '502', roomRent: '7500',
    roomManagementFee: '0', roomElectricityRate: '5',
    roomEquipmentSummerRate: '3', roomEquipmentRegularRate: '2',
    roomPaymentDay: '10', roomDepositAmount: '15000',
    roomStatus: 'vacant', roomNote: 'changed'
  };
  const context = vm.createContext({
    PAGE_DATA: {
      properties: [{ property_id: 'P1', property_name: 'P', account_status: 'active' }],
      room_statuses: [
        { value: 'vacant', label: '空房' },
        { value: 'occupied', label: '已出租' },
        { value: 'maintenance', label: '維修中' }
      ]
    },
    getProperty: () => ({ property_id: 'P1' }), getRoom: () => room,
    showToast: () => {}, safeHtml: value => String(value ?? ''),
    activePropertyOptions: () => '<option value="P1">P</option>',
    numberField: id => `<input id="${id}">`,
    document: { getElementById: id => id === 'editorSheet' ? sheet : id === 'editorModal' ? modal : { disabled: false, textContent: '' } },
    inputValue: id => fields[id] || '',
    jsonpRequest: async (action, values) => { writes.push({ action, values }); return { success: true }; },
    closeEditor: () => {}, loadData: async () => {},
    setTimeout: () => {}
  });
  vm.runInContext([
    extract(frontend, 'roomStatusOptions'),
    extract(frontend, 'openRoomEditor'),
    extract(frontend, 'saveRoom')
  ].join('\n'), context);
  context.openRoomEditor('P1', 'R502');
  assert.equal(sheet.innerHTML, '', 'unresolved occupancy must not open an edit form');
  await context.saveRoom('R502');
  assert.equal(writes.length, 0, 'unresolved occupancy must not write vacant status');
});

test('review-needed room offers neither desktop nor mobile edit/archive actions', () => {
  const context = vm.createContext({
    safeHtml: value => String(value ?? ''),
    money: value => String(value ?? 0),
    roomFinance: () => ''
  });
  vm.runInContext([
    extract(frontend, 'renderRoomTableRow'),
    extract(frontend, 'roomCard')
  ].join('\n'), context);
  const flagged = { ...room, account_status: 'active', effective_status_label: '待核對' };
  const property = { property_id: 'P1' };
  for (const html of [
    context.renderRoomTableRow(flagged, property, true),
    context.roomCard(flagged, property, true)
  ]) {
    assert.match(html, /待核對/);
    assert.doesNotMatch(html, /openRoomEditor\(/);
    assert.doesNotMatch(html, /openArchiveEditor\('room'/);
    assert.doesNotMatch(html, /goTenantCreate\(/);
  }
});

function archiveFixture(kind, roomStatus = 'vacant', tenantStatus = 'active', role = 'owner', activeContract = false) {
  let writes = 0;
  const lock = { waitLock() {}, releaseLock() {} };
  const ss = { getSheetByName: name => name === 'V3_platform_core_workspace_links' ? null : ({ name }) };
  const context = vm.createContext({
    String, Date, Number,
    LockService: { getScriptLock: () => lock },
    SpreadsheetApp: { flush() {} },
    V2_PROPERTY_ROOM_SHEETS_: { properties: 'properties', rooms: 'rooms', contracts: 'contracts' },
    propertyRoomEnsureSchema_: () => {},
    workspaceLandlordResolveAccess_: () => ({ success: true, workspace: { workspace_id: 'W1' }, membership: { role }, principals: [{ landlord_id: 'L1' }] }),
    propertyRoomText_: value => value == null ? '' : String(value).trim(),
    workspaceResult_: (success, code, message) => ({ success, code, message }),
    runtimeSpreadsheet_: () => ss,
    propertyRoomFindWorkspaceTarget_: (sheet) => sheet.name === 'properties'
      ? { property_id: 'P1', __row_number: 2 }
      : { room_id: 'R502', property_id: 'P1', room_status: roomStatus,
          current_tenant_id: 'T502', __row_number: 2 },
    propertyRoomGetWorkspaceRooms_: () => [],
    propertyRoomGetWorkspaceRows_: sheet => sheet.name === 'V2_tenants' && tenantStatus
      ? [{ tenant_id: 'T502', account_status: tenantStatus, workspace_id: 'W1' }]
      : [],
    propertyRoomHasActiveContract_: () => activeContract,
    V2_ROOM_MANUAL_STATUSES_: ['vacant', 'maintenance', 'unavailable'],
    propertyRoomMoney_: value => Number(value) || 0,
    propertyRoomRate_: value => Number(value) || 0,
    propertyRoomNumber_: value => Number(value) || 0,
    propertyRoomEquipmentRateForMonth_: () => 2,
    propertyRoomActor_: () => ({ user_id: 'U1', membership_id: 'M1' }),
    propertyRoomSetValues_: () => { writes += 1; },
    propertyRoomAudit_: () => {}
  });
  vm.runInContext([
    extract(backend, 'propertyRoomCanWrite_'),
    extract(backend, 'propertyRoomRequireWrite_'),
    extract(backend, 'propertyRoomHasActiveTenantLink_'),
    extract(backend, 'propertyRoomPlatformCorePrepare_'),
    extract(backend, 'propertyRoomPlatformCoreAssert_'),
    extract(backend, 'saveLandlordRoomByLineUid_'),
    extract(backend, kind === 'property'
      ? 'archiveLandlordPropertyByLineUid_' : 'archiveLandlordRoomByLineUid_')
  ].join('\n'), context);
  return { context, get writes() { return writes; } };
}

test('property archive resolves the bound spreadsheet before reading it', () => {
  const fixture = archiveFixture('property');
  const result = fixture.context.archiveLandlordPropertyByLineUid_('L1', 'P1', 'reviewed');
  assert.equal(result.code, 'PROPERTY_ARCHIVED');
  assert.equal(fixture.writes, 1);
});

test('room archive rejects unresolved active tenant linkage despite stored vacant status', () => {
  const fixture = archiveFixture('room');
  const result = fixture.context.archiveLandlordRoomByLineUid_('L1', 'R502', 'mistake');
  assert.equal(result.success, false);
  assert.equal(result.code, 'ROOM_TENANT_REVIEW_REQUIRED');
  assert.equal(fixture.writes, 0);
});

test('room archive rejects a dangling tenant pointer rather than deleting its room', () => {
  const fixture = archiveFixture('room', 'vacant', null);
  const result = fixture.context.archiveLandlordRoomByLineUid_('L1', 'R502', 'mistake');
  assert.equal(result.code, 'ROOM_TENANT_REVIEW_REQUIRED');
  assert.equal(fixture.writes, 0);
});

test('room archive permits a historical archived tenant when there is no active lease', () => {
  const fixture = archiveFixture('room', 'vacant', 'archived');
  const result = fixture.context.archiveLandlordRoomByLineUid_('L1', 'R502', 'reviewed');
  assert.equal(result.code, 'ROOM_ARCHIVED');
  assert.equal(fixture.writes, 1);
});

test('room archive denies a read-only Workspace role before touching data', () => {
  const fixture = archiveFixture('room', 'vacant', 'archived', 'viewer');
  const result = fixture.context.archiveLandlordRoomByLineUid_('L1', 'R502', 'test');
  assert.equal(result.code, 'PERMISSION_DENIED');
  assert.equal(fixture.writes, 0);
});

test('room lookup cannot resolve a row explicitly owned by a different Workspace', () => {
  const context = vm.createContext({
    propertyRoomText_: value => value == null ? '' : String(value).trim(),
    workspaceGetObjectsWithRow_: sheet => sheet.rows
  });
  vm.runInContext([
    extract(backend, 'propertyRoomGetWorkspaceRows_'),
    extract(backend, 'propertyRoomFindWorkspaceTarget_')
  ].join('\n'), context);
  const access = { workspace: { workspace_id: 'W1' }, principals: [{ landlord_id: 'L1' }] };
  const sheet = { rows: [
    { room_id: 'R502', workspace_id: 'W2', landlord_id: 'L1' }
  ] };
  assert.equal(context.propertyRoomFindWorkspaceTarget_(sheet, access, 'room_id', 'R502'), null);
  sheet.rows[0].workspace_id = 'W1';
  assert.equal(context.propertyRoomFindWorkspaceTarget_(sheet, access, 'room_id', 'R502').room_id, 'R502');
});

test('direct room save cannot turn an active tenant-linked room into vacant', () => {
  const fixture = archiveFixture('room', 'occupied');
  const result = fixture.context.saveLandlordRoomByLineUid_(
    'L1', 'R502', 'P1', '502', 7500, 0, 5, 0, 3, 2, 10, '', 15000, 'vacant', 'changed'
  );
  assert.equal(result.code, 'ROOM_TENANT_REVIEW_REQUIRED');
  assert.equal(fixture.writes, 0);
});

test('ordinary active lease room can still update rent or note', () => {
  const fixture = archiveFixture('room', 'occupied', 'active', 'owner', true);
  const result = fixture.context.saveLandlordRoomByLineUid_(
    'L1', 'R502', 'P1', '502', 7600, 0, 5, 0, 3, 2, 10, '', 15200, 'vacant', 'updated'
  );
  assert.equal(result.code, 'ROOM_UPDATED');
  assert.equal(fixture.writes, 1);
});
