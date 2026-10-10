const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appsRoot = path.join(root, 'apps-script');


function read(name) {
  return fs.readFileSync(path.join(appsRoot, name), 'utf8');
}


function functionSource(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'missing function ' + name);

  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = '';
      }
      continue;
    }

    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }

    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;

    if (depth === 0) {
      return source.slice(start, index + 1);
    }
  }

  throw new Error('unterminated function ' + name);
}


function testBillCreatedTenantNotification() {
  const source = read('V2_NOTIFICATION_SERVICE.js');
  const requests = [];
  const context = {
    notificationServiceText_: value => String(value || '').trim(),
    notificationSendLineText_: options => {
      requests.push(options);
      return {
        success: true,
        code: 'OK',
        data: { receiver_type: options.receiver.receiver_type }
      };
    }
  };

  vm.createContext(context);
  vm.runInContext(
    functionSource(source, 'notificationSendTenantBillCreated_') + '\n' +
      functionSource(source, 'notificationNotifyTenantBillsCreated_'),
    context
  );

  const result = context.notificationNotifyTenantBillsCreated_([
    {
      bill_id: 'BSTG089',
      tenant_id: 'TSTG089',
      bill_month: '2026-08',
      due_date: '2026-08-10',
      total_amount: 1688,
      updated_existing: false
    },
    {
      bill_id: 'BSTG089-EXISTING',
      tenant_id: 'TSTG089',
      bill_month: '2026-07',
      total_amount: 1500,
      updated_existing: true
    }
  ], 'WSTG089');

  assert.strictEqual(requests.length, 1);
  assert.strictEqual(requests[0].receiver.receiver_type, 'tenant');
  assert.strictEqual(requests[0].receiver.receiver_id, 'TSTG089');
  assert.strictEqual(requests[0].receiver.workspace_id, 'WSTG089');
  assert.strictEqual(requests[0].event_type, 'bill_created');
  assert.strictEqual(requests[0].reference_id, 'BSTG089');
  assert.strictEqual(requests[0].template_key, 'bill_created');
  assert.strictEqual(requests[0].variables.amount, '1,688');
  assert.strictEqual(result.attempted_count, 1);
  assert.strictEqual(result.sent_count, 1);
  assert.strictEqual(result.failed_count, 0);
  assert.strictEqual(result.skipped_count, 1);
}


function testBusinessEventWiring() {
  const billing = read('V2_BILLING_MANAGEMENT.js');
  const messages = read('V2_TENANT_MESSAGES.js');
  const workspace = read('V2_WORKSPACE_NOTIFICATIONS.js');

  assert.ok(
    billing.includes('notificationNotifyTenantBillsCreated_('),
    'bill generation must invoke tenant notifications'
  );
  assert.ok(
    billing.includes('tenant_notifications:'),
    'bill result must expose a non-breaking notification summary'
  );
  assert.ok(
    messages.includes("messageRecord.message_category === 'repair'"),
    'repair category must select its own business event'
  );
  assert.ok(
    messages.includes("? 'tenant_repair'"),
    'repair event type must be tenant_repair'
  );
  assert.ok(
    workspace.includes('tenant_repair: {'),
    'workspace notification config must support tenant repair'
  );
  assert.ok(
    workspace.includes("preference_key:\n        'notify_tenant_message'"),
    'repair must retain the existing tenant message preference'
  );
}


testBillCreatedTenantNotification();
testBusinessEventWiring();
console.log('Phase 89 business notification tests: PASS');
