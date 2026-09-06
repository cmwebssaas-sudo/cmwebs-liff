import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function extractNamedFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `must expose ${name}`);

  const bodyStart = source.indexOf('{', start);
  let depth = 0;

  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  throw new Error(`could not extract ${name}`);
}

const source = fs.readFileSync('apps-script/V2_WORKSPACES.js', 'utf8');
const context = {
  runtimeSnapshotGetValues_() {
    return [
      ['tenant_id', '__row_number', 'workspace_id'],
      ['T-505', '', 'W-88']
    ];
  },
  workspaceText_(value) {
    return value == null ? '' : String(value).trim();
  }
};

vm.runInNewContext(
  extractNamedFunction(source, 'workspaceGetObjectsWithRow_'),
  context
);

const rows = context.workspaceGetObjectsWithRow_({
  getLastRow() { return 2; },
  getLastColumn() { return 3; }
});

assert.equal(rows.length, 1);
assert.equal(rows[0].tenant_id, 'T-505');
assert.equal(rows[0].workspace_id, 'W-88');
assert.equal(
  rows[0].__row_number,
  2,
  'a blank spreadsheet __row_number cell must not overwrite the internal row index used by billing view writes'
);
