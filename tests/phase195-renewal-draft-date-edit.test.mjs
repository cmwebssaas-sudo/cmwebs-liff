import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const initiatedContracts = readFileSync(
  new URL('../apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js', import.meta.url),
  'utf8'
);
const dispatcher = readFileSync(
  new URL('../apps-script/程式碼.js', import.meta.url),
  'utf8'
);
const requestsPage = readFileSync(
  new URL('../landlord-contract-requests.html', import.meta.url),
  'utf8'
);

assert.match(
  initiatedContracts,
  /function landlordInitiatedContractUpdateRenewalDraft_\(/,
  'renewal draft date update function must exist'
);
assert.match(
  initiatedContracts,
  /landlord_contract_renewal_draft_update/,
  'renewal draft date update action must be routed'
);
assert.match(
  dispatcher,
  /'landlord_contract_renewal_draft_update'/,
  'top-level dispatcher must route the renewal draft update action'
);
assert.match(
  initiatedContracts,
  /CONTRACT_DRAFT_NOT_EDITABLE/,
  'sent or completed drafts must be protected'
);
assert.match(
  initiatedContracts,
  /function landlordInitiatedContractIsIsoDate_\(/,
  'renewal draft dates must use strict ISO date validation'
);
assert.match(requestsPage, /修改續約條件/);
assert.match(requestsPage, /function editRenewalDraft\(/);
assert.match(requestsPage, /已簽署.*更正續約/);

console.log('Phase 195 renewal draft date edit tests passed.');
