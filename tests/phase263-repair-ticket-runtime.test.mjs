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
const workspaceLandlordAccessSource = readFileSync(
  new URL('../apps-script/V2_WORKSPACE_LANDLORD_ACCESS.js', import.meta.url),
  'utf8'
);
const landlordManagementSource = readFileSync(
  new URL('../apps-script/V2_LANDLORD_MANAGEMENT.js', import.meta.url),
  'utf8'
);
const dispatcherSource = readFileSync(
  new URL('../apps-script/程式碼.js', import.meta.url),
  'utf8'
);

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  const nextComment = source.indexOf('\n\n/**', start + 1);
  const nextFunction = source.indexOf('\n\nfunction ', start + 1);
  const end = [nextComment, nextFunction]
    .filter(index => index !== -1)
    .sort((left, right) => left - right)[0];
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${name} must end before the next function comment`);
  return source.slice(start, end);
}

function createSheet(options) {
  const values = [];
  return {
    appendRow(row) {
      if (options && options.beforeAppend) options.beforeAppend(row, values);
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

function createRuntime(options = {}) {
  const sheets = {};
  let uuid = 0;
  const context = {
    Date,
    Error,
    JSON,
    Math,
    Object,
    String,
    LockService: options.LockService || {
      getScriptLock() {
        return { waitLock() {}, releaseLock() {} };
      }
    },
    Utilities: { getUuid: () => `uuid-${++uuid}` },
    runtimeSpreadsheet_() {
      return {
        getSheetByName(name) {
          return sheets[name] || null;
        },
        insertSheet(name) {
          const sheet = createSheet(options);
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
  assert.equal(ownerView.description, '');
});

test('concurrent-style creation cannot append a second source-message ticket', () => {
  let runtime;
  let lockHeld = false;
  let secondAttemptError = null;
  let triggered = false;
  const message = {
    message_id: 'MESSAGE-LOCK',
    tenant_name: '房客 A',
    message_category: 'repair',
    message_title: '冷氣漏水',
    message_body: '臥室冷氣漏水',
    priority: 'normal'
  };
  const identity = {
    workspace_id: 'WS-1', property_id: 'PROPERTY-1', room_id: 'ROOM-101',
    room_name: '101', tenant_id: 'TENANT-A', lease_id: 'LEASE-A'
  };
  const lock = {
    waitLock() {
      if (lockHeld) throw new Error('LOCK_BUSY');
      lockHeld = true;
    },
    releaseLock() { lockHeld = false; }
  };
  runtime = createRuntime({
    LockService: { getScriptLock: () => lock },
    beforeAppend(row) {
      if (!triggered && row[2] === 'MESSAGE-LOCK') {
        triggered = true;
        try {
          runtime.context.repairTicketCreateFromMessage_(message, identity);
        } catch (error) {
          secondAttemptError = error;
        }
      }
    }
  });

  runtime.context.repairTicketCreateFromMessage_(message, identity);

  assert.equal(runtime.sheets.V2_repair_tickets.getLastRow(), 2);
  assert.match(secondAttemptError.message, /LOCK_BUSY/);
});

test('tenant projection derives the latest public event note without internal details', () => {
  const { context } = createRuntime();
  const identity = {
    workspace_id: 'WS-1', property_id: 'PROPERTY-1', room_id: 'ROOM-101',
    room_name: '101', tenant_id: 'TENANT-A', lease_id: 'LEASE-A'
  };
  const ticket = context.repairTicketCreateFromMessage_({
    message_id: 'MESSAGE-PUBLIC-NOTE', tenant_name: '房客 A',
    message_category: 'repair', message_title: '冷氣漏水',
    message_body: '臥室冷氣漏水', priority: 'normal'
  }, identity);
  context.repairTicketAppendEvent_(ticket.repair_ticket_id, {
    event_type: 'reply',
    internal_note: '廠商電話與房客資料僅供內部使用',
    public_note: '師傅將於明日上午到訪'
  }, {
    actor_type: 'landlord', actor_id: 'LANDLORD-1'
  });

  const projection = context.repairTicketToTenantProjection_(ticket, identity);

  assert.equal(projection.public_note, '師傅將於明日上午到訪');
  assert.equal(Object.hasOwn(projection, 'internal_note'), false);
  assert.equal(JSON.stringify(projection).includes('廠商電話'), false);
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

test('tenant repair route derives the owner scope from LINE identity and rejects forged identity filters', () => {
  const ownerTicket = {
    workspace_id: 'WS-1', room_id: 'ROOM-B', tenant_id_snapshot: 'TENANT-B',
    repair_ticket_id: 'TICKET-B', tenant_name_snapshot: '房客 B', description: 'B repair'
  };
  const priorTenantTicket = {
    workspace_id: 'WS-1', room_id: 'ROOM-B', tenant_id_snapshot: 'TENANT-A',
    repair_ticket_id: 'TICKET-A', tenant_name_snapshot: '房客 A', description: 'A repair'
  };
  const context = {
    Object,
    String,
    resolveCanonicalTenantRuntimeByLineUid_(lineUserId) {
      assert.equal(lineUserId, 'TENANT-B-LINE');
      return {
        success: true,
        data: { workspace_id: 'WS-1', room_id: 'ROOM-B', tenant_id: 'TENANT-B' }
      };
    },
    repairTicketEnsureSheets_() { return { tickets: {} }; },
    repairTicketRows_() { return [ownerTicket, priorTenantTicket]; },
    repairTicketToTenantProjection_(ticket, identity) {
      if (ticket.tenant_id_snapshot !== identity.tenant_id) return null;
      return { repair_ticket_id: ticket.repair_ticket_id, description: ticket.description };
    }
  };
  vm.runInNewContext(
    extractFunction(tenantMessageSource, 'getTenantRepairTicketsInitByLineUid'),
    context,
    { filename: 'V2_TENANT_MESSAGES.js' }
  );
  vm.runInNewContext(
    extractFunction(tenantMessageSource, 'getTenantRepairTicketsInitByPrincipal_'),
    context,
    { filename: 'V2_TENANT_MESSAGES.js' }
  );
  vm.runInNewContext(
    extractFunction(tenantMessageSource, 'invokeTenantRepairRoute_'),
    context,
    { filename: 'V2_TENANT_MESSAGES.js' }
  );

  const result = context.getTenantRepairTicketsInitByLineUid('TENANT-B-LINE');
  const forged = context.invokeTenantRepairRoute_({
    principal_line_user_id: 'TENANT-B-LINE',
    canonical: { workspace_id: 'WS-1', room_id: 'ROOM-B', tenant_id: 'TENANT-B' }
  }, {
    tenant_id: 'TENANT-A', room_id: 'ROOM-A', ticket_id: 'TICKET-A'
  });

  assert.deepEqual(result.data.tickets, [{ repair_ticket_id: 'TICKET-B', description: '' }]);
  assert.equal(forged.code, 'TENANT_ACCESS_DENIED');
  assert.equal(JSON.stringify(result.data.tickets).includes('房客'), false);
});

test('landlord repair proxies enforce workspace authorization and strip non-allowlisted update fields', () => {
  const calls = [];
  const context = {
    Object,
    workspaceResult_(success, code, message) { return { success, code, message }; },
    workspaceLandlordProxy_(lineUserId, action, policy, handler) {
      if (lineUserId === 'OTHER-LANDLORD-LINE') {
        return { success: false, code: 'WORKSPACE_ACCESS_DENIED' };
      }
      return handler('LANDLORD-PRINCIPAL-LINE', {
        workspace: { workspace_id: 'WS-1' },
        principal: { landlord_id: 'LANDLORD-1' }
      });
    },
    getLandlordRepairTicketsInitByLineUid_(lineUserId, access, filters) {
      calls.push({ type: 'read', lineUserId, access, filters });
      return { success: true, code: 'OK', data: { tickets: [] } };
    },
    updateLandlordRepairTicketByLineUid_(lineUserId, ticketId, input, access) {
      calls.push({ type: 'update', lineUserId, ticketId, input, access });
      return { success: true, code: 'OK', data: { repair_ticket_id: ticketId } };
    }
  };
  vm.runInNewContext(
    extractFunction(dispatcherSource, 'repairRouteAuthError_'),
    context,
    { filename: '程式碼.js' }
  );
  vm.runInNewContext(
    extractFunction(workspaceLandlordAccessSource, 'getWorkspaceLandlordRepairTicketsInitByLineUid_'),
    context,
    { filename: 'V2_WORKSPACE_LANDLORD_ACCESS.js' }
  );
  vm.runInNewContext(
    extractFunction(workspaceLandlordAccessSource, 'updateWorkspaceLandlordRepairTicketByLineUid_'),
    context,
    { filename: 'V2_WORKSPACE_LANDLORD_ACCESS.js' }
  );

  const allowedRead = context.getWorkspaceLandlordRepairTicketsInitByLineUid_('LANDLORD-LINE', {
    workspace_id: 'FORGED-WS', room_id: 'ROOM-B'
  });
  const deniedRead = context.getWorkspaceLandlordRepairTicketsInitByLineUid_('OTHER-LANDLORD-LINE', {});
  const update = context.updateWorkspaceLandlordRepairTicketByLineUid_(
    'LANDLORD-LINE', 'TICKET-B', {
      status: 'in_progress', public_reply: '已安排處理', responsibility_party: 'landlord',
      actual_cost: '300', workspace_id: 'FORGED-WS', tenant_id: 'TENANT-A', internal_note: 'private'
    }
  );

  assert.equal(allowedRead.success, true);
  assert.equal(deniedRead.code, 'WORKSPACE_ACCESS_DENIED');
  assert.equal(update.success, true);
  assert.equal(JSON.stringify(calls[0].filters), JSON.stringify({ room_id: 'ROOM-B' }));
  assert.equal(JSON.stringify(calls[1].input), JSON.stringify({
    status: 'in_progress', public_reply: '已安排處理', responsibility_party: 'landlord',
    estimated_cost: '', actual_cost: '300'
  }));
  assert.equal(Object.hasOwn(calls[1].input, 'workspace_id'), false);
  assert.equal(Object.hasOwn(calls[1].input, 'internal_note'), false);
});

test('landlord repair update keeps a Workspace boundary and appends a landlord audit event', () => {
  const events = [];
  const writes = [];
  const target = {
    _sheet_row: 7,
    workspace_id: 'WS-1',
    repair_ticket_id: 'TICKET-B',
    status: 'open', tenant_id_snapshot: 'TENANT-B', lease_id_snapshot: 'LEASE-B'
  };
  const context = {
    String,
    lmText_(value) { return String(value || '').trim(); },
    repairTicketIsStatus_(status) { return ['open', 'in_progress'].includes(status); },
    repairTicketFindTicketRow_() { return target; },
    repairTicketAppendEvent_(ticketId, input, actor) {
      events.push({ ticketId, input, actor });
      return { ...target, status: input.to_status };
    },
    repairTicketEnsureSheets_() { return { tickets: {} }; },
    repairTicketSetTicketProjectionValue_(sheet, row, field, value) {
      writes.push({ sheet, row, field, value });
    },
    repairTicketToLandlordProjection_(ticket) { return ticket; }
  };
  vm.runInNewContext(
    extractFunction(landlordManagementSource, 'repairTicketLandlordAllowlistedInput_'),
    context,
    { filename: 'V2_LANDLORD_MANAGEMENT.js' }
  );
  vm.runInNewContext(
    extractFunction(landlordManagementSource, 'repairTicketLandlordHasUpdate_'),
    context,
    { filename: 'V2_LANDLORD_MANAGEMENT.js' }
  );
  vm.runInNewContext(
    extractFunction(landlordManagementSource, 'updateLandlordRepairTicketByLineUid_'),
    context,
    { filename: 'V2_LANDLORD_MANAGEMENT.js' }
  );

  const result = context.updateLandlordRepairTicketByLineUid_(
    'LANDLORD-LINE', 'TICKET-B',
    { status: 'in_progress', public_reply: '已安排處理', actual_cost: '300', tenant_id: 'TENANT-A' },
    {
      workspace: { workspace_id: 'WS-1' },
      principal: { landlord_id: 'LANDLORD-OWNER' },
      line_user_id: 'LANDLORD-MAINTENANCE-LINE',
      user: { user_id: 'USER-MAINTENANCE' }
    }
  );

  assert.equal(result.success, true);
  assert.equal(events.length, 1);
  assert.equal(events[0].actor.actor_id, 'USER-MAINTENANCE');
  assert.equal(events[0].input.internal_note, '');
  assert.deepEqual(writes.map(write => [write.row, write.field, write.value]), [[7, 'actual_cost', '300']]);
  assert.equal(target.tenant_id_snapshot, 'TENANT-B');
  assert.equal(target.lease_id_snapshot, 'LEASE-B');
});

test('repair route auth rejects bare browser UIDs and passes only verified principals to repair handlers', () => {
  const calls = [];
  const context = {
    String,
    resolveLandlordPrincipal_(request) {
      calls.push({ type: 'landlord-auth', request });
      return {
        success: true,
        data: { principal_line_user_id: 'LANDLORD-VERIFIED-LINE' }
      };
    },
    verifyTenantLiffSessionToken_(token) {
      calls.push({ type: 'tenant-session', token });
      return { success: true, data: { line_sub: 'TENANT-VERIFIED-LINE' } };
    },
    resolveCanonicalTenantRuntimeByLineUid_(lineUserId) {
      calls.push({ type: 'tenant-canonical', lineUserId });
      return {
        success: true,
        data: { workspace_id: 'WS-1', room_id: 'ROOM-B', tenant_id: 'TENANT-B' }
      };
    },
    invokeTenantRepairRoute_(principal, query) {
      calls.push({ type: 'tenant-route', principal, query });
      return { success: true, code: 'OK', data: { tickets: [] } };
    },
    getWorkspaceLandlordRepairTicketsInitByLineUid_(lineUserId, filters) {
      calls.push({ type: 'landlord-read', lineUserId, filters });
      return { success: true, code: 'OK', data: { tickets: [] } };
    },
    updateWorkspaceLandlordRepairTicketByLineUid_(lineUserId, ticketId, input) {
      calls.push({ type: 'landlord-update', lineUserId, ticketId, input });
      return { success: true, code: 'OK', data: {} };
    }
  };
  vm.runInNewContext(
    extractFunction(dispatcherSource, 'repairRouteAuthError_'),
    context,
    { filename: '程式碼.js' }
  );
  vm.runInNewContext(
    extractFunction(dispatcherSource, 'resolveTenantRepairRoutePrincipal_'),
    context,
    { filename: '程式碼.js' }
  );
  vm.runInNewContext(
    extractFunction(dispatcherSource, 'dispatchTenantRepairTicketsInit_'),
    context,
    { filename: '程式碼.js' }
  );
  vm.runInNewContext(
    extractFunction(dispatcherSource, 'resolveLandlordRepairRoutePrincipal_'),
    context,
    { filename: '程式碼.js' }
  );
  vm.runInNewContext(
    extractFunction(dispatcherSource, 'dispatchLandlordRepairRoute_'),
    context,
    { filename: '程式碼.js' }
  );

  const bareTenant = context.dispatchTenantRepairTicketsInit_({
    line_user_id: 'TENANT-FORGED-LINE'
  });
  const verifiedTenant = context.dispatchTenantRepairTicketsInit_({
    tenant_session_token: 'verified-session', tenant_id: 'TENANT-A', room_id: 'ROOM-A'
  });
  const bareLandlord = context.dispatchLandlordRepairRoute_(
    'landlord_repair_tickets_init', { line_user_id: 'LANDLORD-FORGED-LINE' }
  );
  const verifiedLandlord = context.dispatchLandlordRepairRoute_(
    'landlord_repair_ticket_update', {
      landlord_session_token: 'verified-session', ticket_id: 'TICKET-B',
      status: 'in_progress', internal_note: 'discard me'
    }
  );

  assert.equal(bareTenant.code, 'AUTH_REQUIRED');
  assert.equal(bareLandlord.code, 'AUTH_REQUIRED');
  assert.equal(verifiedTenant.success, true);
  assert.equal(verifiedLandlord.success, true);
  assert.equal(calls.some(call => call.lineUserId === 'TENANT-FORGED-LINE'), false);
  assert.equal(calls.some(call => call.lineUserId === 'LANDLORD-FORGED-LINE'), false);
  assert.equal(calls.find(call => call.type === 'tenant-route').principal.principal_line_user_id, 'TENANT-VERIFIED-LINE');
  assert.equal(calls.find(call => call.type === 'landlord-update').lineUserId, 'LANDLORD-VERIFIED-LINE');
  assert.equal(Object.hasOwn(calls.find(call => call.type === 'landlord-update').input, 'internal_note'), false);
});

test('tenant repair response suppresses stored raw message bodies even though description remains a stored header', () => {
  const context = {
    String,
    resolveCanonicalTenantRuntimeByLineUid_() {
      return { success: true, data: { workspace_id: 'WS-1', room_id: 'ROOM-B', tenant_id: 'TENANT-B' } };
    },
    repairTicketEnsureSheets_() { return { tickets: {} }; },
    repairTicketRows_() {
      return [{
        workspace_id: 'WS-1', room_id: 'ROOM-B', tenant_id_snapshot: 'TENANT-B',
        repair_ticket_id: 'TICKET-B', description: '原始房客訊息內容不得回傳'
      }];
    },
    repairTicketToTenantProjection_(ticket) {
      return { repair_ticket_id: ticket.repair_ticket_id, description: ticket.description };
    }
  };
  vm.runInNewContext(
    extractFunction(tenantMessageSource, 'getTenantRepairTicketsInitByLineUid'),
    context,
    { filename: 'V2_TENANT_MESSAGES.js' }
  );
  vm.runInNewContext(
    extractFunction(tenantMessageSource, 'getTenantRepairTicketsInitByPrincipal_'),
    context,
    { filename: 'V2_TENANT_MESSAGES.js' }
  );

  const result = context.getTenantRepairTicketsInitByLineUid('TENANT-B-LINE');

  assert.equal(result.success, true);
  assert.equal(result.data.tickets[0].description, '');
  assert.equal(JSON.stringify(result.data).includes('原始房客訊息'), false);
});

test('repair route boundary rejects credential-bearing GET and accepts only verified POST body principals', () => {
  const calls = [];
  const context = {
    repairRouteAuthError_(code, message) { return { success: false, code, message, data: { tickets: [] } }; },
    dispatchTenantRepairTicketsInit_(request) {
      calls.push({ type: 'tenant-post', request });
      return { success: true, code: 'OK', data: { tickets: [] } };
    },
    dispatchLandlordRepairRoute_(action, request) {
      calls.push({ type: 'landlord-post', action, request });
      return { success: true, code: 'OK', data: {} };
    }
  };
  vm.runInNewContext(
    extractFunction(dispatcherSource, 'repairRouteDoGetRejected_'),
    context,
    { filename: '程式碼.js' }
  );
  vm.runInNewContext(
    extractFunction(dispatcherSource, 'dispatchRepairPostRoute_'),
    context,
    { filename: '程式碼.js' }
  );

  const getTenant = context.repairRouteDoGetRejected_('tenant_repair_tickets_init', {
    line_user_id: 'FORGED', tenant_session_token: 'query-secret', id_token: 'query-token'
  });
  const getLandlord = context.repairRouteDoGetRejected_('landlord_repair_ticket_update', {
    line_user_id: 'FORGED', landlord_session_token: 'query-secret'
  });
  const postTenant = context.dispatchRepairPostRoute_('tenant_repair_tickets_init', {
    tenant_session_token: 'body-session', tenant_id: 'FORGED', room_id: 'FORGED'
  });
  const postLandlord = context.dispatchRepairPostRoute_('landlord_repair_tickets_init', {
    landlord_session_token: 'body-session'
  });

  assert.equal(getTenant.code, 'AUTH_METHOD_REQUIRED');
  assert.equal(getLandlord.code, 'AUTH_METHOD_REQUIRED');
  assert.equal(postTenant.success, true);
  assert.equal(postLandlord.success, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].request.tenant_session_token, 'body-session');
  assert.equal(calls[1].request.landlord_session_token, 'body-session');
});

test('repair POST guard parses only raw bodies and cannot inherit query credentials', () => {
  const context = {
    String,
    Object,
    JSON,
    decodeURIComponent,
    repairRouteAuthError_(code, message) {
      return { success: false, code, message, data: { tickets: [] } };
    }
  };
  vm.runInNewContext(
    extractFunction(dispatcherSource, 'repairRouteIsAction_'),
    context,
    { filename: '程式碼.js' }
  );
  vm.runInNewContext(
    extractFunction(dispatcherSource, 'repairRouteDecodeFormBody_'),
    context,
    { filename: '程式碼.js' }
  );
  vm.runInNewContext(
    extractFunction(dispatcherSource, 'repairRouteQueryAction_'),
    context,
    { filename: '程式碼.js' }
  );
  vm.runInNewContext(
    extractFunction(dispatcherSource, 'repairRouteRequestFromPostBody_'),
    context,
    { filename: '程式碼.js' }
  );

  const jsonRequest = context.repairRouteRequestFromPostBody_({
    postData: {
      contents: JSON.stringify({
        v2_action: 'tenant_repair_tickets_init',
        tenant_session_token: 'body-tenant-session'
      })
    },
    queryString: 'tenant_session_token=query-tenant-session',
    parameter: { tenant_session_token: 'parameter-tenant-session' }
  });
  const formRequest = context.repairRouteRequestFromPostBody_({
    postData: {
      contents: 'action=landlord_repair_tickets_init&landlord_session_token=body%2Dlandlord%2Dsession&response_mode=bridge'
    },
    queryString: 'landlord_session_token=query-landlord-session',
    parameter: { landlord_session_token: 'parameter-landlord-session' }
  });
  const queryOnly = context.repairRouteRequestFromPostBody_({
    postData: { contents: '' },
    queryString: 'v2_action=tenant_repair_tickets_init&tenant_session_token=query-tenant-session',
    parameter: {
      v2_action: 'tenant_repair_tickets_init',
      tenant_session_token: 'parameter-tenant-session'
    }
  });

  assert.equal(jsonRequest.handled, true);
  assert.equal(jsonRequest.success, true);
  assert.equal(jsonRequest.request.tenant_session_token, 'body-tenant-session');
  assert.equal(formRequest.handled, true);
  assert.equal(formRequest.success, true);
  assert.equal(formRequest.request.landlord_session_token, 'body-landlord-session');
  assert.equal(formRequest.request.response_mode, 'bridge');
  assert.equal(queryOnly.handled, true);
  assert.equal(queryOnly.success, false);
  assert.equal(queryOnly.code, 'AUTH_METHOD_REQUIRED');
});
