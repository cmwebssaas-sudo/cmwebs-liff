import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const repairTicketSource = readFileSync(
  new URL('../apps-script/V2_REPAIR_TICKETS.js', import.meta.url),
  'utf8'
);
const tenantMessageSource = readFileSync(
  new URL('../apps-script/V2_TENANT_MESSAGES.js', import.meta.url),
  'utf8'
);

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\n\n/**', start);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${name} must end before the next function comment`);
  return source.slice(start, end);
}

function createSheet() {
  const values = [];
  return {
    appendRow(row) {
      values.push(row.slice());
    },
    getDataRange() {
      return { getValues: () => values.length ? values.map(row => row.slice()) : [[]] };
    },
    getLastColumn() {
      return values.length ? values[0].length : 0;
    },
    getLastRow() {
      return values.length;
    },
    getRange(row, column, height = 1, width = 1) {
      return {
        getValues() {
          return values.slice(row - 1, row - 1 + height).map(source => {
            const copy = source.slice(column - 1, column - 1 + width);
            while (copy.length < width) copy.push('');
            return copy;
          });
        },
        setValue(value) {
          while (values.length < row) values.push([]);
          while (values[row - 1].length < column) values[row - 1].push('');
          values[row - 1][column - 1] = value;
        },
        setValues(rows) {
          rows.forEach((source, rowIndex) => {
            while (values.length < row + rowIndex) values.push([]);
            while (values[row - 1 + rowIndex].length < column - 1 + source.length) {
              values[row - 1 + rowIndex].push('');
            }
            source.forEach((value, columnIndex) => {
              values[row - 1 + rowIndex][column - 1 + columnIndex] = value;
            });
          });
        }
      };
    }
  };
}

function createRuntime() {
  const sheets = {};
  let uuid = 0;
  const context = {
    Date,
    Error,
    JSON,
    Math,
    Object,
    String,
    Utilities: { getUuid: () => `uuid-${++uuid}` },
    runtimeSpreadsheet_() {
      return {
        getSheetByName(name) {
          return sheets[name] || null;
        },
        insertSheet(name) {
          const sheet = createSheet();
          sheets[name] = sheet;
          return sheet;
        }
      };
    }
  };
  vm.runInNewContext(repairTicketSource, context, {
    filename: 'V2_REPAIR_TICKETS.js'
  });
  return { context, sheets };
}

test('repair ticket creation preserves the original tenant and lease after events', () => {
  const { context, sheets } = createRuntime();
  const message = {
    message_id: 'MESSAGE-101',
    tenant_name: '房客 A',
    message_category: 'repair',
    message_title: '冷氣漏水',
    message_body: '臥室冷氣漏水',
    priority: 'urgent'
  };
  const identity = {
    workspace_id: 'WS-1',
    property_id: 'PROPERTY-1',
    room_id: 'ROOM-101',
    room_name: '101',
    tenant_id: 'TENANT-A',
    lease_id: 'LEASE-A'
  };

  const ticket = context.repairTicketCreateFromMessage_(message, identity);

  assert.equal(ticket.room_id, 'ROOM-101');
  assert.equal(ticket.tenant_id_snapshot, 'TENANT-A');
  assert.equal(ticket.lease_id_snapshot, 'LEASE-A');
  assert.match(ticket.repair_ticket_id, /^repair-WS-1-ROOM-101-/);

  context.repairTicketAppendEvent_(ticket.repair_ticket_id, {
    event_type: 'status_changed',
    to_status: 'in_progress',
    internal_note: '聯絡廠商中',
    public_note: '已安排處理'
  }, {
    actor_type: 'landlord',
    actor_id: 'LANDLORD-1'
  });

  const storedTicket = context.repairTicketFindBySourceMessageId_('MESSAGE-101');
  assert.equal(storedTicket.tenant_id_snapshot, 'TENANT-A');
  assert.equal(storedTicket.lease_id_snapshot, 'LEASE-A');
  assert.equal(storedTicket.tenant_name_snapshot, '房客 A');
  assert.equal(storedTicket.status, 'in_progress');
  assert.equal(sheets.V2_repair_events.getLastRow(), 3);
});

test('repair ticket source message is idempotent and tenant projection excludes another tenant', () => {
  const { context, sheets } = createRuntime();
  const message = {
    message_id: 'MESSAGE-101',
    tenant_name: '房客 A',
    message_category: 'repair',
    message_title: '冷氣漏水',
    message_body: '臥室冷氣漏水',
    priority: 'urgent'
  };
  const identity = {
    workspace_id: 'WS-1',
    property_id: 'PROPERTY-1',
    room_id: 'ROOM-101',
    room_name: '101',
    tenant_id: 'TENANT-A',
    lease_id: 'LEASE-A'
  };
  const ticket = context.repairTicketCreateFromMessage_(message, identity);
  const duplicate = context.repairTicketCreateFromMessage_(message, identity);

  assert.equal(duplicate.repair_ticket_id, ticket.repair_ticket_id);
  assert.equal(sheets.V2_repair_tickets.getLastRow(), 2);

  const currentTenantB = {
    tenant_id: 'TENANT-B',
    workspace_id: 'WS-1',
    room_id: 'ROOM-101'
  };
  assert.equal(context.repairTicketToTenantProjection_(ticket, currentTenantB), null);

  const landlordView = context.repairTicketToLandlordProjection_(ticket);
  assert.equal(landlordView.tenant_name_snapshot, '房客 A');

  const ownerView = context.repairTicketToTenantProjection_(ticket, identity);
  assert.deepEqual(Object.keys(ownerView).sort(), [
    'category', 'closed_at', 'created_at', 'description', 'priority', 'property_id',
    'public_note', 'repair_ticket_id', 'room_id', 'room_name_snapshot', 'status', 'title'
  ]);
  assert.equal(Object.hasOwn(ownerView, 'tenant_name_snapshot'), false);
  assert.equal(Object.hasOwn(ownerView, 'internal_note'), false);
});

test('repair message intake links its post-create ticket while other message categories do not', () => {
  const appended = [];
  const ticketCalls = [];
  const ticketLinks = [];
  const context = {
    Boolean,
    Date,
    Error,
    String,
    appendTenantMessage_(record) { appended.push({ ...record }); },
    buildTenantMessageNoticeText_() { return 'notice'; },
    logLiffAccess_() {},
    repairTicketCreateFromMessage_(record, identity) {
      ticketCalls.push({ record, identity });
      return { repair_ticket_id: 'repair-WS-1-ROOM-101-uuid-1' };
    },
    tenantMessageMakeId_() { return `MESSAGE-${appended.length + 1}`; },
    tenantMessageResolveLandlordRecipient_() {
      return { landlord_id: 'LANDLORD-1', landlord_line_user_id: 'line-landlord', workspace_id: 'WS-1' };
    },
    tenantMessageSetRepairTicketId_(messageId, ticketId) { ticketLinks.push({ messageId, ticketId }); },
    tenantRuntimeHomeData_() {
      return { tenant_id: 'TENANT-A', user_id: 'USER-A', tenant_name: '房客 A', room_list: '101' };
    },
    resolveCanonicalTenantRuntimeByLineUid_() {
      return {
        success: true,
        data: {
          workspace_id: 'WS-1', property_id: 'PROPERTY-1', room_id: 'ROOM-101', room_name: '101',
          tenant_id: 'TENANT-A', contract_id: 'LEASE-A', tenant_home_rows: [{}], landlord_tenant_link_row: {}
        }
      };
    },
    workspaceNotifyTeam_() { return { success: true, data: { sent_count: 1 } }; }
  };
  vm.runInNewContext(
    extractFunction(tenantMessageSource, 'submitTenantMessageByLineUid_'),
    context,
    { filename: 'V2_TENANT_MESSAGES.js' }
  );

  const repairResult = context.submitTenantMessageByLineUid_(
    'line-tenant', 'repair', '冷氣漏水', '臥室冷氣漏水', 'urgent', ''
  );
  const generalResult = context.submitTenantMessageByLineUid_(
    'line-tenant', 'general', '一般問題', '請問垃圾車時間', 'normal', ''
  );

  assert.equal(repairResult.success, true);
  assert.equal(generalResult.success, true);
  assert.equal(ticketCalls.length, 1);
  assert.equal(ticketCalls[0].record.message_id, 'MESSAGE-1');
  assert.equal(ticketCalls[0].identity.lease_id, 'LEASE-A');
  assert.deepEqual(ticketLinks, [{
    messageId: 'MESSAGE-1',
    ticketId: 'repair-WS-1-ROOM-101-uuid-1'
  }]);
  assert.equal(appended.length, 2);
});
