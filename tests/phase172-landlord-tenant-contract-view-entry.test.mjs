import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tenantDetailSource = readFileSync(
  new URL('../landlord-tenant-detail.html', import.meta.url),
  'utf8'
);
const contractRequestsSource = readFileSync(
  new URL('../landlord-contract-requests.html', import.meta.url),
  'utf8'
);

assert.match(
  tenantDetailSource,
  /房客合約/,
  'tenant detail must expose a dedicated contract section'
);
assert.match(
  tenantDetailSource,
  /查看完整合約與簽名/,
  'tenant detail must expose an explicit contract-view action'
);
assert.match(
  tenantDetailSource,
  /native-signing-reviews/,
  'tenant detail contract action must target the native contract review section'
);
assert.match(
  tenantDetailSource,
  /goContractRequests\(true\)/,
  'tenant detail contract action must request the focused contract view'
);
assert.match(
  contractRequestsSource,
  /id="native-signing-reviews"/,
  'contract request page must provide a stable contract-view anchor'
);
assert.match(
  contractRequestsSource,
  /檢視完整合約/,
  'contract request page must retain the full contract view'
);
assert.match(
  contractRequestsSource,
  /function focusNativeSigningReviews\(\)/,
  'contract request page must handle the focused contract-view entry'
);
assert.match(
  contractRequestsSource,
  /scrollIntoView\(/,
  'contract request page must scroll to the contract-view section'
);

console.log('Phase 172 landlord tenant contract view entry tests passed.');
