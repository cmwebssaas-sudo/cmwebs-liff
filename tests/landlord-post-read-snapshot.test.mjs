import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = name => readFileSync(new URL('../apps-script/' + name, import.meta.url), 'utf8');
const dispatcher = read('程式碼.js');
const logs = [];
let reads = 0;
const sheet = {
  getParent: () => ({ getId: () => 'test' }), getSheetId: () => 1,
  getDataRange: () => ({ getValues: () => { reads++; return [['fresh', reads]]; } })
};
const context = vm.createContext({
  Logger: { log: value => logs.push(value) },
  landlordEmailAuthPostRequires_: () => null,
  resolveLandlordPrincipal_: () => ({ success: true, data: { principal_line_user_id: 'fixture' } }),
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: value => ({ setMimeType: () => value }) }
});
vm.runInContext(read('V2_RUNTIME_SNAPSHOT.js'), context);
context.getWorkspaceLandlordHomeBootstrapByLineUid_ = () => {
  const a = context.runtimeSnapshotGetValues_(sheet);
  const b = context.runtimeSnapshotGetValues_(sheet);
  assert.equal(a, b, 'POST read route must share one sheet snapshot');
  return { success: true };
};
context.htmlBridgeOutput_ = value => { context.runtimeSnapshotFinish_(); return value; };
vm.runInContext(dispatcher.slice(dispatcher.indexOf('function doPost(e)')), context);
const request = { action: 'landlord_home_bootstrap', response_mode: 'bridge', landlord_session_token: 'fixture', request_id: 'fixture' };
for (let i = 0; i < 2; i++) {
  assert.equal(context.doPost({ postData: { contents: JSON.stringify(request) } }).success, true);
}
assert.equal(reads, 2, 'each separate POST gets fresh data, but reads once within it');
context.runtimeSnapshotBegin_('landlord_manual_settlement');
context.runtimeSnapshotGetValues_(sheet);
context.runtimeSnapshotGetValues_(sheet);
assert.equal(reads, 4, 'write operations never reuse stale sheet values');
context.runtimeSnapshotFinish_();
assert.ok(logs.length >= 2);
console.log('POST read snapshot isolation passed');
