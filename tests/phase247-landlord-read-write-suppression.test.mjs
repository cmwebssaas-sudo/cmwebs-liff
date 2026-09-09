import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(
  new URL('../apps-script/' + name, import.meta.url),
  'utf8'
);

const workspaceSource = read('V2_WORKSPACES.js');
const activityStart = workspaceSource.indexOf('function workspaceWriteActivityLog_(');
const activityEnd = workspaceSource.indexOf('\n\n\nfunction workspaceLogAccess_(', activityStart);
assert.ok(activityStart >= 0 && activityEnd > activityStart);

let activityWrites = 0;
const activityContext = {
  Object,
  String,
  Date,
  runtimeSnapshotIsReadEnabled_: () => true,
  runtimeSpreadsheet_: () => ({
    getSheetByName() { return null; }
  }),
  workspaceEnsureSheet_() { activityWrites += 1; },
  workspaceAppendObject_() { activityWrites += 1; },
  workspaceMakeId_() { return 'WLOG-TEST'; }
};
vm.createContext(activityContext);
vm.runInContext(
  workspaceSource.slice(activityStart, activityEnd) +
    '\nthis.api = { workspaceWriteActivityLog_ };',
  activityContext
);
activityContext.api.workspaceWriteActivityLog_({ action: 'workspace_landlord_arrears' });
assert.equal(activityWrites, 0, 'read-only requests must not append workspace activity logs');

const apiSource = read('V2_API.js');
const liffLogStart = apiSource.indexOf('function logLiffAccess_(params)');
const liffLogEnd = apiSource.indexOf('\n\n\n// ==================================================\n// Date Helpers', liffLogStart);
assert.ok(liffLogStart >= 0 && liffLogEnd > liffLogStart);

let liffWrites = 0;
const liffContext = {
  Object,
  String,
  Date,
  runtimeSnapshotIsReadEnabled_: () => true,
  runtimeSpreadsheet_: () => {
    liffWrites += 1;
    return { getSheetByName() { return null; } };
  }
};
vm.createContext(liffContext);
vm.runInContext(
  apiSource.slice(liffLogStart, liffLogEnd) +
    '\nthis.api = { logLiffAccess_ };',
  liffContext
);
liffContext.api.logLiffAccess_({ action: 'landlord_arrears' });
assert.equal(liffWrites, 0, 'read-only requests must not append LINE access logs');

const emailSource = read('V2_LANDLORD_EMAIL_AUTH.js');
const sessionStart = emailSource.indexOf('function resolveLandlordEmailSession_(');
const sessionEnd = emailSource.indexOf('\n\nfunction landlordEmailAuthIssueChallenge_(', sessionStart);
assert.ok(sessionStart >= 0 && sessionEnd > sessionStart);

const touches = [];
const sessionContext = {
  runtimeSnapshotIsReadEnabled_: () => true,
  landlordEmailAuthResolveSession_: (...args) => {
    touches.push(args[2]);
    return { success: true };
  }
};
vm.createContext(sessionContext);
vm.runInContext(
  emailSource.slice(sessionStart, sessionEnd) +
    '\nthis.api = { resolveLandlordEmailSession_ };',
  sessionContext
);
sessionContext.api.resolveLandlordEmailSession_('session-fixture', 'request-fixture');
assert.deepEqual(JSON.parse(JSON.stringify(touches)), [false]);

sessionContext.runtimeSnapshotIsReadEnabled_ = () => false;
sessionContext.api.resolveLandlordEmailSession_('session-fixture', 'request-write');
assert.deepEqual(JSON.parse(JSON.stringify(touches)), [false, true]);

console.log('Phase 247 landlord read write suppression regression test passed.');
