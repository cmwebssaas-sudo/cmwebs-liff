import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const propertySource = readFileSync(new URL('../apps-script/V2_PROPERTY_ROOM_MANAGEMENT.js', import.meta.url), 'utf8');
const propertiesPage = readFileSync(new URL('../landlord-properties.html', import.meta.url), 'utf8');
const createPage = readFileSync(new URL('../landlord-tenant-create.html', import.meta.url), 'utf8');

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = propertySource.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = propertySource.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < propertySource.length; index += 1) {
    if (propertySource[index] === '{') depth += 1;
    if (propertySource[index] === '}') {
      depth -= 1;
      if (depth === 0) return propertySource.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract ${name}`);
}

const context = {
  String,
  propertyRoomText_: value => value === undefined || value === null ? '' : String(value).trim(),
  propertyRoomNumber_: value => Number(value) || 0,
  propertyRoomRoomStatusLabel_: value => String(value || ''),
  propertyRoomFallbackMoney_: () => 0,
  propertyRoomResolvePaymentDay_: () => 0,
  propertyRoomResolveDepositMonths_: () => 0,
  propertyRoomResolveDepositAmount_: () => 0,
  propertyRoomResolvePositiveRate_: () => 0,
  propertyRoomResolveEquipmentSeasonRate_: () => 0,
  propertyRoomEquipmentRateForMonth_: () => 0,
  propertyRoomIsSummerMonth_: () => false,
  propertyRoomPaymentDaySource_: () => 'test',
  propertyRoomDepositMonthsSource_: () => 'test',
  propertyRoomDepositAmountSource_: () => 'test',
  settingsIntegrationParseMonths_: () => [],
  settingsIntegrationSummerMonthsLabel_: () => '6–9 月'
};
vm.createContext(context);
vm.runInContext([
  extractFunction('propertyRoomLegacyPendingPaperBackfillEligible_'),
  extractFunction('propertyRoomBuildRoomView_')
].join('\n'), context);

assert.equal(context.propertyRoomLegacyPendingPaperBackfillEligible_({
  contract_id: 'LEGACY-202',
  tenant_id: 'T202',
  contract_status: 'pending_tenant_signature',
  contract_origin: '',
  invite_id: '',
  tenant_line_user_id: ''
}), true);

assert.equal(context.propertyRoomLegacyPendingPaperBackfillEligible_({
  contract_id: 'E202',
  tenant_id: 'T202',
  contract_status: 'pending_tenant_signature',
  contract_origin: 'landlord_initiated',
  invite_id: 'I202',
  tenant_line_user_id: ''
}), false);

assert.equal(context.propertyRoomLegacyPendingPaperBackfillEligible_({
  contract_id: 'ACTIVE-202',
  tenant_id: 'T202',
  contract_status: 'active',
  contract_origin: '',
  invite_id: '',
  tenant_line_user_id: ''
}), false);

const legacyView = context.propertyRoomBuildRoomView_({
  room_id: 'R202', property_id: 'P1', property_name: '測試公寓', room_name: '202',
  room_status: 'occupied', account_status: 'active'
}, {
  R202: {
    contract_id: 'LEGACY-202', tenant_id: 'T202', tenant_name: '五先生',
    contract_status: 'pending_tenant_signature', contract_origin: '', invite_id: '', tenant_line_user_id: '',
    start_date: '2026-09-01', end_date: '2027-08-31'
  }
}, {}, {}, { T202: true });
assert.equal(legacyView.paper_backfill_legacy_pending_replacement_eligible, true);
assert.equal(legacyView.paper_backfill_legacy_pending_replacement_contract_id, 'LEGACY-202');
assert.equal(legacyView.paper_backfill_legacy_pending_replacement_tenant_id, 'T202');
assert.equal(legacyView.paper_backfill_orphan_replacement_eligible, false);

assert.match(propertiesPage, /paper_backfill_legacy_pending_replacement_eligible/);
assert.match(propertiesPage, /legacy_pending_recovery/);
assert.match(createPage, /LEGACY_PENDING_RECOVERY_MODE/);

console.log('Phase 215 legacy pending paper backfill entry tests passed.');
