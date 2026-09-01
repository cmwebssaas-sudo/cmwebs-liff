import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(
  new URL('../apps-script/V2_LANDLORD_MANAGEMENT.js', import.meta.url),
  'utf8'
);

let dataRangeReads = 0;
let snapshot = null;
const values = [
  ['landlord_id', 'landlord_name'],
  ['L197', '測試房東']
];
const sheet = {
  getLastRow() {
    return values.length;
  },
  getDataRange() {
    return {
      getValues() {
        dataRangeReads += 1;
        return values;
      }
    };
  }
};

const context = {
  Array,
  Object,
  String,
  Number,
  Math,
  Date,
  JSON,
  runtimeSnapshotGetValues_(target) {
    if (!snapshot) {
      snapshot = target.getDataRange().getValues();
    }
    return snapshot;
  }
};

vm.createContext(context);
vm.runInContext(
  [
    'function lmText_(value) { return value == null ? "" : String(value).trim(); }',
    source.slice(
      source.indexOf('function lmSheetObjects_('),
      source.indexOf('\n\n\nfunction lmFindOwnedRow_(', source.indexOf('function lmSheetObjects_('))
    ),
    'this.api = { lmSheetObjects_ };'
  ].join('\n'),
  context
);

const first = context.api.lmSheetObjects_(sheet);
const second = context.api.lmSheetObjects_(sheet);

assert.deepEqual(JSON.parse(JSON.stringify(first)), [
  { landlord_id: 'L197', landlord_name: '測試房東' }
]);
assert.deepEqual(JSON.parse(JSON.stringify(second)), [
  { landlord_id: 'L197', landlord_name: '測試房東' }
]);
assert.equal(
  dataRangeReads,
  1,
  'landlord bootstrap reads should reuse the request-local snapshot'
);

console.log('Phase 197 landlord bootstrap read cache test passed.');
