import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const backend = readFileSync('apps-script/V2_PROPERTY_ROOM_MANAGEMENT.js', 'utf8');
const frontend = readFileSync('landlord-properties.html', 'utf8');

function extract(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0;
  for (let index = source.indexOf('{', start); index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} is not closed`);
}

const context = vm.createContext({
  String,
  Number,
  Date,
  propertyRoomText_: value => value == null ? '' : String(value).trim(),
  propertyRoomNumber_: value => Number(value) || 0,
  propertyRoomDate_: value => value ? new Date(value) : null,
  propertyRoomFallbackMoney_: () => 0,
  propertyRoomResolvePaymentDay_: () => 10,
  propertyRoomResolveDepositMonths_: () => 2,
  propertyRoomResolveDepositAmount_: () => 15000,
  propertyRoomResolvePositiveRate_: () => 0,
  propertyRoomResolveEquipmentSeasonRate_: () => 0,
  propertyRoomEquipmentRateForMonth_: () => 0,
  propertyRoomIsSummerMonth_: () => false,
  propertyRoomPaymentDaySource_: () => 'room',
  propertyRoomDepositMonthsSource_: () => 'room',
  propertyRoomDepositAmountSource_: () => 'room',
  propertyRoomLegacyPendingPaperBackfillEligible_: () => false,
  settingsIntegrationParseMonths_: () => [],
  settingsIntegrationSummerMonthsLabel_: () => '6–9 月'
});
vm.runInContext([
  extract(backend, 'propertyRoomRoomStatusLabel_'),
  extract(backend, 'propertyRoomBuildRoomView_')
].join('\n'), context);

const room = {
  room_id: 'R502', property_id: 'P1', room_name: '502',
  room_status: 'occupied', account_status: 'active',
  current_tenant_id: 'T502', current_tenant_name: '房客'
};
const expired = {
  contract_id: 'C502', tenant_id: 'T502', tenant_name: '房客',
  contract_status: 'expired', start_date: '2025-01-01', end_date: '2026-01-01'
};
const view = context.propertyRoomBuildRoomView_(room, {}, { R502: expired }, {}, { T502: true }, { T502: true });
assert.equal(view.has_active_contract, false);
assert.equal(view.effective_status, 'needs_review',
  'an expired contract with a linked active tenant is not proof of a vacant room');
assert.equal(view.effective_status_label, '待核對');
assert.equal(view.needs_occupancy_review, true);

const staleActive = context.propertyRoomBuildRoomView_(room, {}, {
  R502: { ...expired, contract_status: 'active' }
}, {}, { T502: true }, { T502: true });
assert.equal(staleActive.effective_status, 'needs_review',
  'an active label with a past end date still needs occupancy reconciliation');

for (const status of ['signed', 'approved', 'current', 'effective']) {
  const pastEnd = context.propertyRoomBuildRoomView_(room, {}, {
    R502: { ...expired, contract_status: status }
  }, {}, { T502: true }, { T502: true });
  assert.equal(pastEnd.effective_status, 'needs_review',
    `${status} with a past end date and active linked tenant needs review`);
}

const newerDraft = context.propertyRoomBuildRoomView_(room, {}, {
  R502: { ...expired, contract_status: 'draft', tenant_id: 'T_OTHER' }
}, {}, { T502: true, T_OTHER: true }, { T502: true, T_OTHER: true });
assert.equal(newerDraft.effective_status, 'needs_review',
  'a newer draft must not hide an occupied room with an active linked tenant');

const trulyVacant = context.propertyRoomBuildRoomView_(
  { ...room, room_status: 'vacant', current_tenant_id: '' },
  {}, { R502: expired }, {}, {}, {}
);
assert.equal(trulyVacant.effective_status, 'vacant',
  'a historical contract without an active tenant must not block a vacant room');

const ended = context.propertyRoomBuildRoomView_(room, {}, {
  R502: { ...expired, contract_status: 'ended' }
}, {}, { T502: true }, { T502: true });
assert.equal(ended.effective_status, 'needs_review',
  'an ended lease still needs review when the room links an active tenant');

const endedUnlinked = context.propertyRoomBuildRoomView_(
  { ...room, room_status: 'vacant', current_tenant_id: '' },
  {}, { R502: { ...expired, contract_status: 'ended' } },
  {}, { T502: true }, { T502: true }
);
assert.equal(endedUnlinked.effective_status, 'vacant',
  'an ended lease with no current room tenant link can remain vacant');

const archivedTenant = context.propertyRoomBuildRoomView_(room, {}, {
  R502: expired
}, {}, { T502: true }, {});
assert.equal(archivedTenant.effective_status, 'vacant',
  'a historical tenant row without an active tenant account must not block a vacant room');

const missingTenant = context.propertyRoomBuildRoomView_(room, {}, {
  R502: expired
}, {}, {}, {});
assert.equal(missingTenant.effective_status, 'needs_review',
  'a dangling current tenant pointer must not silently become vacant');

const cardContext = vm.createContext({
  safeHtml: value => String(value ?? ''),
  roomFinance: () => '',
  money: value => String(value ?? 0)
});
vm.runInContext(extract(frontend, 'roomCard'), cardContext);
const card = cardContext.roomCard(view, { property_id: 'P1' }, true);
assert.match(card, /待核對/);
assert.doesNotMatch(card, /建立房客|手動補登紙本合約/);
assert.doesNotMatch(card, /onclick="openArchiveEditor\('room'/,
  'an unresolved tenant must not be archived from the room card');
