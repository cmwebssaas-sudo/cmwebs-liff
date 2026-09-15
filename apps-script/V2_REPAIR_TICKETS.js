/**
 * Canonical room-scoped repair ticket storage.
 *
 * This module preserves the original tenant and lease snapshots.  Later event
 * appends may update only the current ticket projection fields.
 */

const V2_REPAIR_TICKET_SHEETS_ = {
  tickets: 'V2_repair_tickets',
  events: 'V2_repair_events'
};

const V2_REPAIR_TICKET_HEADERS_ = [
  'workspace_id', 'repair_ticket_id', 'source_message_id', 'property_id',
  'room_id', 'room_name_snapshot', 'tenant_id_snapshot', 'lease_id_snapshot',
  'tenant_name_snapshot', 'category', 'title', 'description', 'priority',
  'status', 'responsibility_party', 'estimated_cost', 'actual_cost',
  'created_at', 'closed_at'
];

const V2_REPAIR_EVENT_HEADERS_ = [
  'workspace_id', 'repair_ticket_id', 'event_id', 'event_type', 'from_status',
  'to_status', 'actor_type', 'actor_id', 'internal_note', 'public_note',
  'created_at'
];

const V2_REPAIR_TICKET_TENANT_ALLOWED_FIELDS_ = [
  'repair_ticket_id', 'property_id', 'room_id', 'room_name_snapshot',
  'category', 'title', 'description', 'priority', 'status', 'created_at',
  'closed_at', 'public_note'
];

function repairTicketEnsureSheets_() {
  const spreadsheet = runtimeSpreadsheet_();
  return {
    tickets: repairTicketEnsureSheet_(
      spreadsheet,
      V2_REPAIR_TICKET_SHEETS_.tickets,
      V2_REPAIR_TICKET_HEADERS_
    ),
    events: repairTicketEnsureSheet_(
      spreadsheet,
      V2_REPAIR_TICKET_SHEETS_.events,
      V2_REPAIR_EVENT_HEADERS_
    )
  };
}

function repairTicketCreateFromMessage_(messageRecord, canonicalIdentity) {
  const message = messageRecord || {};
  const identity = canonicalIdentity || {};
  const workspaceId = repairTicketText_(identity.workspace_id);
  const roomId = repairTicketText_(identity.room_id);
  const tenantId = repairTicketText_(identity.tenant_id);
  const sourceMessageId = repairTicketText_(message.message_id);

  if (!workspaceId || !roomId || !tenantId || !sourceMessageId) {
    throw new Error('REPAIR_TICKET_IDENTITY_REQUIRED');
  }

  const existing = repairTicketFindBySourceMessageId_(sourceMessageId);
  if (existing) return existing;

  const sheets = repairTicketEnsureSheets_();
  const now = new Date();
  const ticket = {
    workspace_id: workspaceId,
    repair_ticket_id: repairTicketMakeId_(workspaceId, roomId),
    source_message_id: sourceMessageId,
    property_id: repairTicketText_(identity.property_id || message.property_id),
    room_id: roomId,
    room_name_snapshot: repairTicketText_(identity.room_name || message.room_name),
    tenant_id_snapshot: tenantId,
    lease_id_snapshot: repairTicketText_(identity.lease_id || identity.contract_id),
    tenant_name_snapshot: repairTicketText_(identity.tenant_name || message.tenant_name),
    category: repairTicketText_(message.message_category || 'repair'),
    title: repairTicketText_(message.message_title),
    description: repairTicketText_(message.message_body),
    priority: repairTicketText_(message.priority || 'normal'),
    status: 'open',
    responsibility_party: '',
    estimated_cost: '',
    actual_cost: '',
    created_at: now,
    closed_at: ''
  };

  repairTicketAppendRow_(sheets.tickets, ticket);
  repairTicketAppendEventRow_(sheets.events, {
    workspace_id: ticket.workspace_id,
    repair_ticket_id: ticket.repair_ticket_id,
    event_id: repairTicketMakeEventId_(),
    event_type: 'created',
    from_status: '',
    to_status: ticket.status,
    actor_type: 'tenant',
    actor_id: ticket.tenant_id_snapshot,
    internal_note: '',
    public_note: '',
    created_at: now
  });
  return ticket;
}

function repairTicketAppendEvent_(ticketId, eventInput, actor) {
  const target = repairTicketFindTicketRow_(ticketId);
  if (!target) throw new Error('REPAIR_TICKET_NOT_FOUND');

  const event = eventInput || {};
  const eventActor = actor || {};
  const nextStatus = repairTicketText_(event.to_status) || target.status;
  if (!repairTicketIsStatus_(nextStatus)) {
    throw new Error('REPAIR_TICKET_STATUS_INVALID');
  }

  const sheets = repairTicketEnsureSheets_();
  const now = new Date();
  repairTicketAppendEventRow_(sheets.events, {
    workspace_id: target.workspace_id,
    repair_ticket_id: target.repair_ticket_id,
    event_id: repairTicketMakeEventId_(),
    event_type: repairTicketText_(event.event_type || 'updated'),
    from_status: target.status,
    to_status: nextStatus,
    actor_type: repairTicketText_(eventActor.actor_type),
    actor_id: repairTicketText_(eventActor.actor_id),
    internal_note: repairTicketText_(event.internal_note),
    public_note: repairTicketText_(event.public_note),
    created_at: now
  });

  repairTicketSetTicketProjectionValue_(
    sheets.tickets,
    target._sheet_row,
    'status',
    nextStatus
  );
  if (nextStatus === 'closed') {
    repairTicketSetTicketProjectionValue_(
      sheets.tickets,
      target._sheet_row,
      'closed_at',
      now
    );
  }
  return repairTicketFindTicketById_(ticketId);
}

function repairTicketFindBySourceMessageId_(sourceMessageId) {
  const sheets = repairTicketEnsureSheets_();
  const target = repairTicketRows_(sheets.tickets).find(function(row) {
    return repairTicketText_(row.source_message_id) === repairTicketText_(sourceMessageId);
  });
  return target ? repairTicketPublicRow_(target) : null;
}

function repairTicketToLandlordProjection_(ticket) {
  return repairTicketPublicRow_(ticket || {});
}

function repairTicketToTenantProjection_(ticket, currentTenant) {
  const source = ticket || {};
  const tenant = currentTenant || {};
  if (
    repairTicketText_(source.workspace_id) !== repairTicketText_(tenant.workspace_id) ||
    repairTicketText_(source.room_id) !== repairTicketText_(tenant.room_id) ||
    repairTicketText_(source.tenant_id_snapshot) !== repairTicketText_(tenant.tenant_id)
  ) {
    return null;
  }
  const projection = {};
  V2_REPAIR_TICKET_TENANT_ALLOWED_FIELDS_.forEach(function(field) {
    projection[field] = field === 'public_note'
      ? repairTicketText_(source.public_note)
      : source[field] === undefined ? '' : source[field];
  });
  return projection;
}

function repairTicketEnsureSheet_(spreadsheet, sheetName, headers) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.appendRow(headers);
    return sheet;
  }
  const width = Math.max(sheet.getLastColumn(), 1);
  const currentHeaders = sheet.getRange(1, 1, 1, width).getValues()[0]
    .map(repairTicketText_);
  if (currentHeaders.every(function(header) { return header === ''; })) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }
  const missing = headers.filter(function(header) {
    return currentHeaders.indexOf(header) === -1;
  });
  if (missing.length) {
    sheet.getRange(1, currentHeaders.length + 1, 1, missing.length).setValues([missing]);
  }
  return sheet;
}

function repairTicketRows_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(repairTicketText_);
  return values.slice(1).map(function(row, index) {
    const record = { _sheet_row: index + 2 };
    headers.forEach(function(header, column) { record[header] = row[column]; });
    return record;
  });
}

function repairTicketFindTicketRow_(ticketId) {
  const sheets = repairTicketEnsureSheets_();
  return repairTicketRows_(sheets.tickets).find(function(row) {
    return repairTicketText_(row.repair_ticket_id) === repairTicketText_(ticketId);
  }) || null;
}

function repairTicketFindTicketById_(ticketId) {
  const row = repairTicketFindTicketRow_(ticketId);
  return row ? repairTicketPublicRow_(row) : null;
}

function repairTicketAppendRow_(sheet, record) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(repairTicketText_);
  sheet.appendRow(headers.map(function(header) {
    return record[header] === undefined ? '' : record[header];
  }));
}

function repairTicketAppendEventRow_(sheet, record) {
  repairTicketAppendRow_(sheet, record);
}

function repairTicketSetTicketProjectionValue_(sheet, row, header, value) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(repairTicketText_);
  const column = headers.indexOf(header) + 1;
  if (column > 0) sheet.getRange(row, column).setValue(value);
}

function repairTicketMakeId_(workspaceId, roomId) {
  return 'repair-' + repairTicketIdPart_(workspaceId) + '-' +
    repairTicketIdPart_(roomId) + '-' + Utilities.getUuid();
}

function repairTicketMakeEventId_() {
  return 'repair-event-' + Utilities.getUuid();
}

function repairTicketIdPart_(value) {
  return repairTicketText_(value).replace(/[^A-Za-z0-9_-]/g, '_');
}

function repairTicketIsStatus_(status) {
  return ['open', 'in_progress', 'awaiting_confirmation', 'completed', 'closed']
    .indexOf(status) !== -1;
}

function repairTicketPublicRow_(row) {
  const result = {};
  Object.keys(row || {}).forEach(function(key) {
    if (key !== '_sheet_row') result[key] = row[key];
  });
  return result;
}

function repairTicketText_(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}
