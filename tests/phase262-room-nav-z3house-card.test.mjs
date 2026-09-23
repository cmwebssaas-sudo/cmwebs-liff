import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const landlordPages = [
  'landlord-home.html',
  'landlord-more.html',
  'landlord-tenants.html',
  'landlord-properties.html',
  'landlord-contract-requests.html',
  'landlord-arrears.html',
  'landlord-billing.html',
  'landlord-tenant-detail.html',
  'landlord-rooms.html'
];

const sources = Object.fromEntries(
  landlordPages.map((name) => [name, readFileSync(name, 'utf8')])
);
const backend = readFileSync('apps-script/V2_LANDLORD_ROOM_CENTER.js', 'utf8');

for (const [name, source] of Object.entries(sources)) {
  assert.match(source, /landlord-rooms\.html/, `${name} must expose the room navigation target`);
  assert.match(source, /<span>房間<\/span>/, `${name} must label the room navigation item`);
  assert.match(
    source,
    /grid-template-columns:\s*repeat\(5,\s*1fr\)/,
    `${name} must reserve a fifth mobile navigation slot for rooms`
  );
}

assert.match(backend, /z3house/, 'room center must expose the safe external listing projection');
assert.match(backend, /thumbnail_url/, 'room center must expose an optional public thumbnail');
assert.match(backend, /independent_site_url/, 'room center must expose an optional independent-site URL');
assert.doesNotMatch(backend, /tenant_name|tenant_phone|tenant_email|contract_id|bill_id/);

const roomPage = sources['landlord-rooms.html'];
assert.match(roomPage, /class="z3house-card"/);
assert.match(roomPage, /建立新房間/);
assert.match(roomPage, /thumbnail_url/);
assert.match(roomPage, /independent_site_url/);
assert.match(roomPage, /尚未連結 z3House/);
assert.match(roomPage, /rel="noopener noreferrer"/);
assert.doesNotMatch(roomPage, /fetch\([^)]*z3house/i);
assert.doesNotMatch(roomPage, /https?:\/\/[^'" ]*z3house\.com/i);

console.log('Phase 262 room navigation and z3House card contract tests passed.');
