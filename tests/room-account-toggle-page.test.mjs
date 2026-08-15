import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('landlord-properties.html', 'utf8');

assert.match(source, /toggleRoomAccount/);
assert.match(source, /landlord_room_account_toggle/);
assert.match(source, /關閉房間帳號/);
assert.match(source, /重新啟用房間帳號/);
assert.match(
  source,
  /租約、帳單與付款紀錄不會被刪除/,
  'the toggle must state that financial history is preserved'
);

console.log('Room account toggle page tests passed.');
