import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const renewalHistorySource = readFileSync(
  new URL('../apps-script/V2_CONTRACT_RENEWAL_HISTORY.js', import.meta.url),
  'utf8'
);
const renewalFormSource = readFileSync(
  new URL('../landlord-tenant-create.html', import.meta.url),
  'utf8'
);
const onboardingSource = readFileSync(
  new URL('../apps-script/V2_TENANT_LEASE_ONBOARDING.js', import.meta.url),
  'utf8'
);

const context = {
  Date,
  Math,
  Number,
  String,
  Object,
  Array,
  JSON,
  RegExp,
  Utilities: { getUuid: () => 'renewal-date-test-uuid' }
};
vm.createContext(context);
vm.runInContext(renewalHistorySource, context, {
  filename: 'V2_CONTRACT_RENEWAL_HISTORY.js'
});

const defaults = context.contractRenewalHistoryBuildDefaults_({
  contract_id: 'OLD-2026',
  end_date: '2026-09-30',
  contract_status: 'expired'
});

assert.equal(
  defaults.start_date,
  '2026-09-30',
  'renewal start date must equal the predecessor contract end date'
);
assert.equal(
  defaults.end_date,
  '2027-09-29',
  'renewal end date must cover one year from the predecessor end date'
);

const prefillStart = renewalFormSource.match(
  /function applyRenewalSourceToForm_\(previous\)[\s\S]*?function startRenewalFromRoom\(\)/
)?.[0] || '';
assert.match(
  prefillStart,
  /const nextStart = rawText\(previous\.end_date\)\.trim\(\)[\s\S]*?setInputValue\('startDate',\s*nextStart\)/,
  'renewal form must prefill its start date from the predecessor end date'
);
assert.doesNotMatch(
  prefillStart,
  /end\.setDate\(end\.getDate\(\) \+ 1\)/,
  'renewal form must not add an extra day before prefilling the start date'
);
assert.match(
  onboardingSource,
  /end_date:\s*tenantLeaseFormatDate_\(\s*renewalSource\.end_date\s*\|\|\s*renewalSource\.contract_end_date\s*\)/,
  'renewal source end dates must be normalized for an HTML date input'
);

console.log('Phase 200 renewal date prefill tests passed.');
