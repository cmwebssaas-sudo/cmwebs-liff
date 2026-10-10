'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'apps-script', 'V2_REPAIR_TICKETS.js'),
  'utf8'
);

function createSheet(headers) {
  const values = [headers.slice()];
  return {
    values,
    getLastRow: () => values.length,
    getLastColumn: () => values[0].length,
    appendRow: row => values.push(row.slice()),
    getRange(row, column, rowCount, columnCount) {
      return {
        getValues() {
          return values.slice(row - 1, row - 1 + rowCount).map(item =>
            item.slice(column - 1, column - 1 + columnCount)
          );
        },
        setValues(rows) {
          rows.forEach((input, rowOffset) => {
            if (!values[row - 1 + rowOffset]) values[row - 1 + rowOffset] = [];
            input.forEach((value, columnOffset) => {
              values[row - 1 + rowOffset][column - 1 + columnOffset] = value;
            });
          });
        },
        setValue(value) {
          if (!values[row - 1]) values[row - 1] = [];
          values[row - 1][column - 1] = value;
        }
      };
    }
  };
}

function createContext() {
  const headers = [
    'ticket_id', 'created_at', 'updated_at', 'workspace_id',
    'landlord_id', 'tenant_id', 'tenant_user_id', 'tenant_name', 'contract_id',
    'property_id', 'room_id', 'room_no', 'source_message_id',
    'category', 'priority', 'title', 'description',
    'preferred_contact_time', 'status', 'assigned_user_id',
    'landlord_note', 'acknowledged_at', 'started_at', 'completed_at',
    'closed_at', 'created_by', 'updated_by',
    'landlord_notification_queue_id', 'tenant_notification_queue_id'
  ];
  const sheet = createSheet(headers);
  const queued = [];
  const context = {
    console,
    Date,
    Object,
    Utilities: {
      formatDate: () => '20260722190000',
      getUuid: () => '12345678-abcd',
    },
    Session: { getScriptTimeZone: () => 'Asia/Taipei' },
    runtimeSpreadsheet_: () => ({ getSheetByName: name =>
      name === 'V2_REPAIR_TICKETS' ? sheet : null
    }),
    workspaceGetObjectsWithRow_: input => input.values.slice(1).map((row, index) => {
      const object = { __row_number: index + 2 };
      input.values[0].forEach((header, column) => { object[header] = row[column]; });
      return object;
    }),
    workspaceAppendObject_: (input, record) => input.appendRow(
      input.values[0].map(header => record[header] === undefined ? '' : record[header])
    ),
    resolveCanonicalTenantRuntimeByLineUid_: () => ({
      success: true,
      data: {
        workspace_id: 'W91', landlord_id: 'L91', tenant_id: 'T91',
        tenant_user_id: 'U91', contract_id: 'C91', property_id: 'P91',
        room_id: 'R91', room_no: '91', landlord_tenant_link_row: {}
      }
    }),
    tenantMessageResolveLandlordRecipient_: () => ({
      workspace_id: 'W91', landlord_id: 'L91',
      landlord_line_user_id: 'Ulandlord', tenant_name: 'Tenant 91'
    }),
    workspaceLandlordResolveAccess_: () => ({
      success: true,
      workspace: { workspace_id: 'W91' },
      user: { user_id: 'UL91' }
    }),
    notificationQueueEnqueue_: options => {
      queued.push(options);
      return {
        success: true,
        code: 'NOTIFICATION_QUEUED',
        data: { queue_id: `Q${queued.length}`, status: 'pending' }
      };
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, sheet, queued };
}

function testTenantCreatesRepairAndLandlordIsQueued() {
  const { context, sheet, queued } = createContext();
  const result = context.createTenantRepairTicketByLineUid_(
    'Utenant', '漏水', '浴室漏水', 'urgent', '晚上', 'MSG91'
  );
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.data.ticket.status, 'open');
  assert.strictEqual(sheet.values.length, 2);
  assert.strictEqual(queued.length, 1);
  assert.strictEqual(queued[0].event_type, 'tenant_repair');
  assert.strictEqual(queued[0].receiver.receiver_type, 'landlord');
  assert.strictEqual(queued[0].receiver.workspace_id, 'W91');
}

function testLandlordWorkflowAndTenantCompletionQueue() {
  const { context, queued } = createContext();
  const created = context.createTenantRepairTicketByLineUid_(
    'Utenant', '漏水', '浴室漏水', 'normal', '', ''
  );
  const ticketId = created.data.ticket.ticket_id;

  assert.strictEqual(
    context.updateLandlordRepairTicketByLineUid_(
      'Ulandlord', ticketId, 'in_progress', '已派員'
    ).success,
    true
  );
  const completed = context.updateLandlordRepairTicketByLineUid_(
    'Ulandlord', ticketId, 'completed', '已修復'
  );
  assert.strictEqual(completed.success, true);
  assert.strictEqual(completed.data.ticket.status, 'completed');
  assert.strictEqual(queued.length, 2);
  assert.strictEqual(queued[1].event_type, 'repair_completed');
  assert.strictEqual(queued[1].receiver.receiver_type, 'tenant');

  const closed = context.updateLandlordRepairTicketByLineUid_(
    'Ulandlord', ticketId, 'closed', '結案'
  );
  assert.strictEqual(closed.success, true);
  assert.strictEqual(closed.data.ticket.status, 'closed');
  assert.strictEqual(queued.length, 2, 'closing a completed ticket must not notify twice');
}

function testIsolationAndInvalidTransition() {
  const fixture = createContext();
  const created = fixture.context.createTenantRepairTicketByLineUid_(
    'Utenant', '漏水', '浴室漏水', 'normal', '', ''
  );
  const ticketId = created.data.ticket.ticket_id;
  const invalid = fixture.context.updateLandlordRepairTicketByLineUid_(
    'Ulandlord', ticketId, 'completed', '不可跳階'
  );
  assert.strictEqual(invalid.success, false);
  assert.strictEqual(invalid.code, 'INVALID_REPAIR_STATUS_TRANSITION');

  fixture.context.workspaceLandlordResolveAccess_ = () => ({
    success: true,
    workspace: { workspace_id: 'OTHER' },
    user: { user_id: 'UL91' }
  });
  const isolated = fixture.context.updateLandlordRepairTicketByLineUid_(
    'Ulandlord', ticketId, 'in_progress', ''
  );
  assert.strictEqual(isolated.success, false);
  assert.strictEqual(isolated.code, 'REPAIR_TICKET_NOT_FOUND');
}

function testNoDirectLineTransport() {
  assert.ok(!/UrlFetchApp\s*\./.test(source));
  assert.ok(!/pushLineTextMessage_\s*\(/.test(source));
  assert.ok(source.includes('notificationQueueEnqueue_'));
  assert.ok(source.includes("runtimeRequireFeature_('REPAIR_WORKFLOW')"));
  assert.ok(source.includes('runtimeRequireSchemaMigration_()'));
  assert.ok(source.includes("'TEST_TENANT_LINE_UID'"));
}

testTenantCreatesRepairAndLandlordIsQueued();
testLandlordWorkflowAndTenantCompletionQueue();
testIsolationAndInvalidTransition();
testNoDirectLineTransport();

console.log('Phase 91 repair workflow tests: PASS');
