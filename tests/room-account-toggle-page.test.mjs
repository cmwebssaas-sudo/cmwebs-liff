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
assert.match(
  source,
  /function showToast\(message, isError, durationMs\)/,
  'toast duration must be configurable for slow LIFF refreshes'
);
assert.match(
  source,
  /await loadPage\(false\);\s*\n\s*showToast\(/s,
  'success feedback must be shown after the post-write refresh'
);
assert.match(
  source,
  /<div\s+id="toast"\s+class="toast"\s+role="status"\s+aria-live="polite"\s*><\/div>/s,
  'toast must expose a live status for mobile accessibility'
);

console.log('Room account toggle page tests passed.');
