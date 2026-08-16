import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('apps-script/V2_PROPERTY_ROOM_MANAGEMENT.js', 'utf8');

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract ${name}`);
}

const context = { String };
vm.runInNewContext(
  [
    extractFunction('propertyRoomNormalizeAccountToggleEnabled_'),
    extractFunction('propertyRoomAccountStatusFromToggle_')
  ].join('\n'),
  context
);

assert.equal(context.propertyRoomNormalizeAccountToggleEnabled_(true), true);
assert.equal(context.propertyRoomNormalizeAccountToggleEnabled_('true'), true);
assert.equal(context.propertyRoomNormalizeAccountToggleEnabled_('1'), true);
assert.equal(context.propertyRoomNormalizeAccountToggleEnabled_('on'), true);
assert.equal(context.propertyRoomNormalizeAccountToggleEnabled_('active'), true);
assert.equal(context.propertyRoomNormalizeAccountToggleEnabled_(false), false);
assert.equal(context.propertyRoomNormalizeAccountToggleEnabled_('false'), false);
assert.equal(context.propertyRoomNormalizeAccountToggleEnabled_('0'), false);
assert.equal(context.propertyRoomNormalizeAccountToggleEnabled_('off'), false);
assert.equal(context.propertyRoomNormalizeAccountToggleEnabled_('inactive'), false);

assert.equal(context.propertyRoomAccountStatusFromToggle_(true), 'active');
assert.equal(context.propertyRoomAccountStatusFromToggle_('on'), 'active');
assert.equal(context.propertyRoomAccountStatusFromToggle_(false), 'inactive');
assert.equal(context.propertyRoomAccountStatusFromToggle_('off'), 'inactive');

const dispatcher = readFileSync('apps-script/程式碼.js', 'utf8');
const landlordProperties = readFileSync('landlord-properties.html', 'utf8');
assert.match(dispatcher, /landlord_room_account_toggle/);
assert.match(landlordProperties, /toggleRoomAccount/);

console.log('Room account toggle tests passed.');
