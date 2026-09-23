import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bridge = readFileSync('apps-script/V3_Z3HOUSE_LISTING_BRIDGE.js', 'utf8');
const dispatcher = readFileSync('apps-script/程式碼.js', 'utf8');
const apiDocs = readFileSync('docs/04-API-ROUTES.md', 'utf8');
const modelDocs = readFileSync('docs/05-DATA-MODEL.md', 'utf8');

assert.match(bridge, /z3house_listing_event/);
assert.match(bridge, /CMWEBS_Z3HOUSE_BRIDGE_HMAC_SECRET/);
assert.match(bridge, /timestamp/);
assert.match(bridge, /nonce/);
assert.match(bridge, /event_id/);
assert.match(bridge, /V3_listing_integration_events/);
assert.match(bridge, /IDEMPOTENCY_CONFLICT/);
assert.match(bridge, /publication\.hidden/);
assert.match(bridge, /binding\.unbound/);
assert.match(bridge, /propertyRoomGetWorkspaceRooms_/);
assert.match(bridge, /photos_json/);
assert.match(bridge, /management_fee/);
assert.match(bridge, /independent_site_url/);

for (const forbidden of [
  'tenant_name',
  'tenant_phone',
  'tenant_email',
  'contract_id',
  'bill_id',
  'deposit',
  'repair_description',
  'payment_account'
]) {
  assert.doesNotMatch(bridge, new RegExp(forbidden), `bridge must not persist ${forbidden}`);
}

assert.match(dispatcher, /z3houseListingBridgeIsRequest_\(postBody\)/);
assert.match(dispatcher, /handleZ3houseListingBridgePost_/);
assert.match(apiDocs, /z3house_listing_event/);
assert.match(modelDocs, /V3_listing_integration_events/);

console.log('Phase 263 z3House server bridge contract tests passed.');
