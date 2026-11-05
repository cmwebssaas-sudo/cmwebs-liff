import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const properties = read('landlord-properties.html');
const billing = read('landlord-billing.html');

function loadRecovery(pageData) {
  const start = properties.indexOf('    function savedRoomMatches(values)');
  const end = properties.indexOf('    function openArchiveEditor(');
  assert.ok(start > 0 && end > start);
  const calls = { toasts: [], closed: 0, loads: 0 };
  const context = vm.createContext({
    PAGE_DATA: {},
    calls,
    showToast: (message, isError) => calls.toasts.push([message, Boolean(isError)]),
    closeEditor: () => { calls.closed += 1; },
    loadPage: async () => { calls.loads += 1; context.PAGE_DATA = pageData; }
  });
  vm.runInContext(properties.slice(start, end), context);
  return { context, calls };
}

const saved = {
  properties: [{
    property_id: 'P1',
    rooms: [{ room_id: 'R501', room_name: '501', rent_amount: 19570, management_fee: 0, deposit_amount: 39140 }]
  }]
};
const values = {
  room_id: 'R501', property_id: 'P1', room_name: '501',
  rent_amount: '19570', management_fee: '0', deposit_amount: '39140'
};

test('a timed-out room save that did reach the sheet is confirmed, not resent', async () => {
  const { context, calls } = loadRecovery(saved);
  const button = { disabled: true, textContent: '儲存中...' };
  await context.recoverRoomSaveTimeout(values, button);

  assert.equal(calls.loads, 1);
  assert.equal(calls.closed, 1);
  assert.deepEqual(calls.toasts.at(-1), ['已確認：房間資料已存進去。', false]);
});

test('a timed-out room save that is not visible yet tells the landlord to check first', async () => {
  const { context, calls } = loadRecovery(saved);
  const button = { disabled: true, textContent: '儲存中...' };
  await context.recoverRoomSaveTimeout(Object.assign({}, values, { rent_amount: '20000' }), button);

  assert.equal(calls.closed, 0);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, '儲存房間');
  assert.match(calls.toasts.at(-1)[0], /還不能確定是否已存進去/);
});

test('a new room is matched by property and name', () => {
  const { context } = loadRecovery(saved);
  context.PAGE_DATA = saved;
  assert.equal(context.savedRoomMatches(Object.assign({}, values, { room_id: '' })), true);
  assert.equal(context.savedRoomMatches(Object.assign({}, values, { room_id: '', room_name: '502' })), false);
});

test('room save waits longer, and only the page read is ever retried', () => {
  assert.match(properties, /timeoutMs: action === 'landlord_room_save' \? 90000 : undefined/);
  assert.match(properties, /action === 'landlord_properties_init' &&\s*Number\(\s*retryCount \|\| 0\s*\) < 1/);
  assert.match(properties, /error\.code === 'API_TIMEOUT'\) \{\s*await recoverRoomSaveTimeout\(values, button\);/);
});

test('bill save says it is saved while the page is still refreshing', () => {
  assert.match(billing, /button\.textContent = '已儲存，正在更新畫面\.\.\.';[\s\S]{0,200}const refresh = await loadPage\(false, \{ suppressError: true \}\);/);
  assert.match(billing, /button\.textContent = '正在確認是否已儲存\.\.\.';[\s\S]{0,200}const refresh = await loadPage\(false, \{ suppressError: true \}\);/);
});
