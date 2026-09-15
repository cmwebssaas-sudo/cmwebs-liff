import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const repairTicketSource = readFileSync(
  new URL('../apps-script/V2_REPAIR_TICKETS.js', import.meta.url),
  'utf8'
);

const MESSAGE_HEADERS = [
  'workspace_id', 'property_id', 'room_id', 'room_name', 'tenant_id', 'lease_id',
  'tenant_name', 'message_id', 'repair_ticket_id', 'message_category',
  'message_title', 'message_body', 'priority'
];

function createSheet(rows, writes) {
  const values = rows.map(row => row.slice());
  return {
    appendRow(row) {
      writes.push({ type: 'appendRow' });
      values.push(row.slice());
    },
    getDataRange() {
      return { getValues: () => values.map(row => row.slice()) };
    },
    getLastColumn() {
      return values[0] ? values[0].length : 0;
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
          writes.push({ type: 'setValue' });
          while (values.length < row) values.push([]);
          while (values[row - 1].length < column) values[row - 1].push('');
          values[row - 1][column - 1] = value;
        },
        setValues(sourceRows) {
          writes.push({ type: 'setValues' });
          sourceRows.forEach((source, rowIndex) => {
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

function messageRow(overrides = {}) {
  const record = {
    workspace_id: 'WS-1',
    property_id: 'PROPERTY-1',
    room_id: 'ROOM-101',
    room_name: '101',
    tenant_id: 'TENANT-A',
    lease_id: 'LEASE-A',
    tenant_name: '原始房客 A',
    message_id: 'MESSAGE-1',
    repair_ticket_id: '',
    message_category: 'repair',
    message_title: '冷氣漏水',
    message_body: '原始報修內容',
    priority: 'urgent',
    ...overrides
  };
  return MESSAGE_HEADERS.map(header => record[header]);
}

function createRuntime(messageRows, options = {}) {
  const writes = [];
  const sheets = {
    V2_tenant_messages: createSheet([MESSAGE_HEADERS, ...messageRows], writes)
  };
  let uuid = 0;
  const context = {
    Date,
    Error,
    Math,
    Object,
    String,
    LockService: options.LockService || {
      getScriptLock: () => ({ waitLock() {}, releaseLock() {} })
    },
    Utilities: { getUuid: () => `uuid-${++uuid}` },
    runtimeSpreadsheet_() {
      return {
        getSheetByName(name) {
          if (options.onGetSheet) options.onGetSheet(name);
          return sheets[name] || null;
        },
        insertSheet(name) {
          const sheet = createSheet([], writes);
          sheets[name] = sheet;
          return sheet;
        }
      };
    }
  };
  vm.runInNewContext(repairTicketSource, context, {
    filename: 'V2_REPAIR_TICKETS.js'
  });
  return { context, sheets, writes };
}

test('repair-ticket backfill preview is no-write and reports only eligible repair rows', () => {
  const { context, sheets, writes } = createRuntime([
    messageRow(),
    messageRow({ message_id: 'MESSAGE-NO-ROOM', room_id: '', room_name: '' }),
    messageRow({ message_id: 'MESSAGE-LINKED', repair_ticket_id: 'repair-existing' }),
    messageRow({ message_id: 'MESSAGE-GENERAL', message_category: 'general' })
  ]);

  const preview = context.repairTicketBackfillLegacyMessages_({ mode: 'preview', limit: 100 });

  assert.equal(preview.writes, 0);
  assert.equal(preview.repair_message_count, 3);
  assert.equal(preview.candidate_count, 1);
  assert.deepEqual(Array.from(preview.created_candidates), ['MESSAGE-1']);
  assert.deepEqual(Array.from(preview.unresolved_source_message_ids), ['MESSAGE-NO-ROOM']);
  assert.equal(preview.missing_room_count, 1);
  assert.equal(preview.existing_link_count, 1);
  assert.equal(preview.non_repair_count, 1);
  assert.deepEqual(writes, []);
  assert.equal(sheets.V2_repair_tickets, undefined);
});

test('repair-ticket backfill apply preserves legacy snapshots and reports every first-run sheet mutation', () => {
  const { context, sheets, writes } = createRuntime([messageRow()]);

  const first = context.repairTicketBackfillLegacyMessages_({ mode: 'apply', limit: 100 });
  const second = context.repairTicketBackfillLegacyMessages_({ mode: 'apply', limit: 100 });
  const ticket = context.repairTicketFindBySourceMessageId_('MESSAGE-1');
  const eventRows = sheets.V2_repair_events.getDataRange().getValues();
  const sourceRows = sheets.V2_tenant_messages.getDataRange().getValues();
  const repairTicketColumn = MESSAGE_HEADERS.indexOf('repair_ticket_id');

  assert.equal(first.created_count, 1);
  assert.equal(first.writes, writes.length);
  assert.equal(first.writes, 7);
  assert.deepEqual(Array.from(first.created_ids), [ticket.repair_ticket_id]);
  assert.equal(second.created_count, 0);
  assert.equal(second.writes, 0);
  assert.equal(second.writes, writes.length - first.writes);
  assert.equal(sheets.V2_repair_tickets.getLastRow(), 2);
  assert.equal(ticket.tenant_id_snapshot, 'TENANT-A');
  assert.equal(ticket.lease_id_snapshot, 'LEASE-A');
  assert.equal(ticket.tenant_name_snapshot, '原始房客 A');
  assert.equal(ticket.title, '冷氣漏水');
  assert.equal(ticket.description, '原始報修內容');
  assert.equal(ticket.priority, 'urgent');
  assert.equal(sourceRows[1][repairTicketColumn], ticket.repair_ticket_id);
  assert.equal(eventRows.filter(row => row[3] === 'legacy_backfill').length, 1);
});

test('repair-ticket backfill leaves linked, missing-room, and non-repair messages untouched', () => {
  const { context, sheets } = createRuntime([
    messageRow({ message_id: 'MESSAGE-NO-ROOM', room_id: '', room_name: '' }),
    messageRow({ message_id: 'MESSAGE-LINKED', repair_ticket_id: 'repair-existing' }),
    messageRow({ message_id: 'MESSAGE-GENERAL', message_category: 'general' })
  ]);

  const result = context.repairTicketBackfillLegacyMessages_({ mode: 'apply', limit: 100 });
  const sourceRows = sheets.V2_tenant_messages.getDataRange().getValues();

  assert.equal(result.created_count, 0);
  assert.deepEqual(Array.from(result.unresolved_source_message_ids), ['MESSAGE-NO-ROOM']);
  assert.equal(result.missing_room_count, 1);
  assert.equal(sheets.V2_repair_tickets, undefined);
  assert.deepEqual(sourceRows.slice(1), [
    messageRow({ message_id: 'MESSAGE-NO-ROOM', room_id: '', room_name: '' }),
    messageRow({ message_id: 'MESSAGE-LINKED', repair_ticket_id: 'repair-existing' }),
    messageRow({ message_id: 'MESSAGE-GENERAL', message_category: 'general' })
  ]);
});

test('repair-ticket backfill accepts only exact preview and apply modes', () => {
  const { context } = createRuntime([messageRow()]);

  assert.throws(
    () => context.repairTicketBackfillLegacyMessages_({ mode: 'PREVIEW', limit: 1 }),
    /REPAIR_TICKET_BACKFILL_MODE_INVALID/
  );
  assert.throws(
    () => context.repairTicketBackfillLegacyMessages_({ mode: 'preview ' , limit: 1 }),
    /REPAIR_TICKET_BACKFILL_MODE_INVALID/
  );
});

test('repair-ticket backfill limit bounds candidates without hiding manual-review rows', () => {
  const { context } = createRuntime([
    messageRow({ message_id: 'MESSAGE-1' }),
    messageRow({ message_id: 'MESSAGE-NO-ROOM', room_id: '', room_name: '' }),
    messageRow({ message_id: 'MESSAGE-2' })
  ]);

  const preview = context.repairTicketBackfillLegacyMessages_({ mode: 'preview', limit: 1 });

  assert.equal(preview.repair_message_count, 3);
  assert.deepEqual(Array.from(preview.created_candidates), ['MESSAGE-1']);
  assert.equal(preview.missing_room_count, 1);
  assert.deepEqual(Array.from(preview.unresolved_source_message_ids), ['MESSAGE-NO-ROOM']);
});

test('repair-ticket backfill reconciles an unlinked existing source ticket without another event', () => {
  const { context, sheets, writes } = createRuntime([messageRow()]);
  const existingTicket = context.repairTicketCreateFromMessage_(
    {
      message_id: 'MESSAGE-1',
      message_category: 'repair',
      message_title: '冷氣漏水',
      message_body: '原始報修內容',
      priority: 'urgent'
    },
    {
      workspace_id: 'WS-1', property_id: 'PROPERTY-1', room_id: 'ROOM-101',
      room_name: '101', tenant_id: 'TENANT-A', lease_id: 'LEASE-A',
      tenant_name: '原始房客 A'
    }
  );
  writes.length = 0;

  const preview = context.repairTicketBackfillLegacyMessages_({ mode: 'preview', limit: 100 });
  const writesBeforeFirst = writes.length;
  const first = context.repairTicketBackfillLegacyMessages_({ mode: 'apply', limit: 100 });
  const writesBeforeSecond = writes.length;
  const second = context.repairTicketBackfillLegacyMessages_({ mode: 'apply', limit: 100 });
  const sourceRows = sheets.V2_tenant_messages.getDataRange().getValues();
  const eventRows = sheets.V2_repair_events.getDataRange().getValues();

  assert.equal(preview.writes, 0);
  assert.equal(preview.created_count, 0);
  assert.equal(preview.link_reconciliation_count, 1);
  assert.deepEqual(
    Array.from(preview.link_reconciliation_source_message_ids),
    ['MESSAGE-1']
  );
  assert.equal(first.created_count, 0);
  assert.equal(first.reconciled_link_count, 1);
  assert.equal(first.writes, writesBeforeSecond - writesBeforeFirst);
  assert.equal(second.reconciled_link_count, 0);
  assert.equal(second.writes, writes.length - writesBeforeSecond);
  assert.equal(sourceRows[1][MESSAGE_HEADERS.indexOf('repair_ticket_id')], existingTicket.repair_ticket_id);
  assert.equal(eventRows.filter(row => row[3] === 'legacy_backfill').length, 0);
  assert.equal(sheets.V2_repair_tickets.getLastRow(), 2);
});

test('repair-ticket backfill holds one migration lock across scan and apply retries', () => {
  const lockState = { held: false, maxActive: 0, scanOutsideLock: false, nestedError: null };
  const LockService = {
    getScriptLock() {
      return {
        waitLock() {
          if (lockState.held) throw new Error('LOCK_BUSY');
          lockState.held = true;
          lockState.maxActive = Math.max(lockState.maxActive, 1);
          if (!lockState.attemptedNested) {
            lockState.attemptedNested = true;
            try {
              lockState.runNested();
            } catch (error) {
              lockState.nestedError = error;
            }
          }
        },
        releaseLock() {
          lockState.held = false;
        }
      };
    }
  };
  const runtime = createRuntime([messageRow()], {
    LockService,
    onGetSheet() {
      if (!lockState.held) lockState.scanOutsideLock = true;
    }
  });
  lockState.runNested = () => runtime.context.repairTicketBackfillLegacyMessages_(
    { mode: 'apply', limit: 100 }
  );

  const first = runtime.context.repairTicketBackfillLegacyMessages_({ mode: 'apply', limit: 100 });
  const retry = runtime.context.repairTicketBackfillLegacyMessages_({ mode: 'apply', limit: 100 });
  const events = runtime.sheets.V2_repair_events.getDataRange().getValues();

  assert.match(lockState.nestedError.message, /LOCK_BUSY/);
  assert.equal(lockState.scanOutsideLock, false);
  assert.equal(lockState.maxActive, 1);
  assert.equal(first.created_count, 1);
  assert.equal(retry.created_count, 0);
  assert.equal(runtime.sheets.V2_repair_tickets.getLastRow(), 2);
  assert.equal(events.filter(row => row[3] === 'legacy_backfill').length, 1);
});

test('repair-ticket backfill deduplicates same-batch source IDs without duplicate events', () => {
  const { context, sheets, writes } = createRuntime([
    messageRow({ message_id: 'MESSAGE-DUP' }),
    messageRow({ message_id: ' MESSAGE-DUP ' })
  ]);

  const preview = context.repairTicketBackfillLegacyMessages_({ mode: 'preview', limit: 100 });
  const result = context.repairTicketBackfillLegacyMessages_({ mode: 'apply', limit: 100 });
  const sourceRows = sheets.V2_tenant_messages.getDataRange().getValues();
  const events = sheets.V2_repair_events.getDataRange().getValues();
  const ticket = context.repairTicketFindBySourceMessageId_('MESSAGE-DUP');
  const repairTicketColumn = MESSAGE_HEADERS.indexOf('repair_ticket_id');

  assert.deepEqual(Array.from(preview.created_candidates), ['MESSAGE-DUP']);
  assert.deepEqual(Array.from(preview.duplicate_source_message_ids), ['MESSAGE-DUP']);
  assert.equal(result.created_count, 1);
  assert.deepEqual(Array.from(result.created_ids), [ticket.repair_ticket_id]);
  assert.equal(result.reconciled_link_count, 1);
  assert.deepEqual(Array.from(result.reconciled_source_message_ids), ['MESSAGE-DUP']);
  assert.equal(result.writes, writes.length);
  assert.equal(sheets.V2_repair_tickets.getLastRow(), 2);
  assert.equal(events.filter(row => row[3] === 'legacy_backfill').length, 1);
  assert.equal(sourceRows[1][repairTicketColumn], ticket.repair_ticket_id);
  assert.equal(sourceRows[2][repairTicketColumn], ticket.repair_ticket_id);
});
