import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tenantDetailPage = readFileSync(
  new URL('../landlord-tenant-detail.html', import.meta.url),
  'utf8'
);

assert.match(
  tenantDetailPage,
  /async function fetchStatusJson\(\s*action,\s*params\s*\)/,
  'tenant detail must use a JSON status fetch helper'
);
assert.match(
  tenantDetailPage,
  /credentials:\s*'omit'/,
  'tenant detail status fetch must not send browser credentials'
);
assert.match(
  tenantDetailPage,
  /cache:\s*'no-store'/,
  'tenant detail status fetch must bypass stale API responses'
);
assert.match(
  tenantDetailPage,
  /return response\.json\(\);/,
  'tenant detail status fetch must parse the JSON response'
);
assert.match(
  tenantDetailPage,
  /function jsonpRequest\(action, params\)/,
  'tenant detail document and action flows must retain their JSONP helper'
);

for (const action of [
  'landlord_tenants',
  'landlord_contract_requests_init'
]) {
  assert.match(
    tenantDetailPage,
    new RegExp(`fetchStatusJson\\(\\s*'${action}'`),
    `${action} must use the JSON fetch helper`
  );
  assert.doesNotMatch(
    tenantDetailPage,
    new RegExp(`jsonpRequest\\(\\s*'${action}'`),
    `${action} must not depend on JSONP callback execution`
  );
}

console.log('Phase 171 landlord tenant detail fetch tests passed.');
