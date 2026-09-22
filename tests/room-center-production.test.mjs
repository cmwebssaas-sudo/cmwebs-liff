import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const backend = readFileSync('apps-script/V2_LANDLORD_ROOM_CENTER.js', 'utf8');
const dispatcher = readFileSync('apps-script/程式碼.js', 'utf8');
const api = readFileSync('landlord-api.js', 'utf8');
const page = readFileSync('landlord-rooms.html', 'utf8');
const more = readFileSync('landlord-more.html', 'utf8');

assert.match(backend, /function getLandlordRoomCenterInitByLineUid_\(/);
assert.match(backend, /room_id/);
assert.match(backend, /property_name/);
assert.match(backend, /rent_amount/);
assert.match(backend, /management_fee/);
assert.doesNotMatch(backend, /current_tenant_name/);
assert.doesNotMatch(backend, /tenant_name/);
assert.doesNotMatch(backend, /bill_id/);
assert.doesNotMatch(backend, /contract_id/);
assert.match(dispatcher, /landlord_room_center_init/);
assert.match(api, /landlord_room_center_init: true/);
assert.match(page, /landlord_room_center_init/);
assert.match(page, /房間清單/);
assert.match(page, /所有房間/);
assert.match(more, /landlord-rooms\.html/);

console.log('Production room center contract tests passed.');
