import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(
  new URL('../apps-script/' + name, import.meta.url),
  'utf8'
);

const workspaceSource = read('V2_WORKSPACES.js');
const rowsStart = workspaceSource.indexOf('function workspaceGetObjectsWithRow_(');
const rowsEnd = workspaceSource.indexOf('\n\n\nfunction workspaceAppendObject_(', rowsStart);
const rowContext = {
  Array,
  Object,
  String,
  runtimeSnapshotGetValues_: sheet => sheet.getDataRange().getValues(),
  workspaceText_: value => value == null ? '' : String(value).trim()
};
vm.createContext(rowContext);
vm.runInContext(
  workspaceSource.slice(rowsStart, rowsEnd) + '\nthis.api = { workspaceGetObjectsWithRow_ };',
  rowContext
);

let metadataCalls = 0;
const rows = rowContext.api.workspaceGetObjectsWithRow_({
  getLastRow() {
    metadataCalls += 1;
    throw new Error('row metadata should not be read before the snapshot');
  },
  getLastColumn() {
    metadataCalls += 1;
    throw new Error('column metadata should not be read before the snapshot');
  },
  getDataRange() {
    return {
      getValues() {
        return [
          ['user_id', 'name'],
          ['U-1', '測試']
        ];
      }
    };
  }
});

assert.deepEqual(JSON.parse(JSON.stringify(rows)), [
  { __row_number: 2, user_id: 'U-1', name: '測試' }
]);
assert.equal(metadataCalls, 0);

const emailSource = read('V2_LANDLORD_EMAIL_AUTH.js');
const emailStart = emailSource.indexOf('function landlordEmailAuthRows_(');
const emailEnd = emailSource.indexOf('\n\nfunction landlordEmailAuthAppendObject_(', emailStart);
let emailReads = 0;
const emailContext = {
  Array,
  Object,
  String,
  landlordEmailAuthText_: value => value == null ? '' : String(value).trim(),
  runtimeSnapshotGetValues_: () => {
    emailReads += 1;
    return [
      ['user_id', 'email'],
      ['U-1', 'owner@example.com']
    ];
  }
};
vm.createContext(emailContext);
vm.runInContext(
  emailSource.slice(emailStart, emailEnd) + '\nthis.api = { landlordEmailAuthRows_ };',
  emailContext
);

const firstEmailRows = emailContext.api.landlordEmailAuthRows_({});
const secondEmailRows = emailContext.api.landlordEmailAuthRows_({});
assert.deepEqual(JSON.parse(JSON.stringify(firstEmailRows)), [
  { __row_number: 2, user_id: 'U-1', email: 'owner@example.com' }
]);
assert.deepEqual(JSON.parse(JSON.stringify(secondEmailRows)), [
  { __row_number: 2, user_id: 'U-1', email: 'owner@example.com' }
]);
assert.equal(emailReads, 2, 'the runtime snapshot owns cross-helper caching');

assert.match(
  workspaceSource,
  /function workspaceEnsureSchema_\(\) \{[\s\S]*runtimeSnapshotIsReadEnabled_\(\)/,
  'read-only Web App requests must not run schema mutation checks'
);
assert.match(
  read('V2_WORKSPACE_LANDLORD_ACCESS.js'),
  /workspace_access[\s\S]*runtimeSnapshotSetContext_/,
  'Workspace access must be cached within one request'
);

console.log('Phase 243 landlord request cache regression test passed.');
