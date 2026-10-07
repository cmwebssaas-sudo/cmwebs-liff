/** Pure local V3 candidate contract. Actors must come from a trusted server session.
 * Authority is checked against state memberships, never actor permission labels.
 * All successful transitions return a new snapshot; rejected transitions mutate nothing.
 */
import { createHash } from 'node:crypto';

const tables = ['partners', 'partner_memberships', 'workspace_memberships', 'workspace_partners',
  'partner_skills', 'priority_rules', 'service_agreements', 'work_orders', 'invitations',
  'quotes', 'quote_revisions', 'assignments', 'completion_reports', 'acceptances',
  'work_order_events', 'private_attachments', 'notification_outbox', 'idempotency_records'];
const permissions = { create: 'work_order_dispatch', source: 'work_order_dispatch',
  assign: 'work_order_approve', start: null, complete: null, accept: 'work_order_accept',
  rework: 'work_order_accept', cancel: 'work_order_dispatch',
  'request-supplement': null, 'approve-supplement': 'work_order_approve' };

function fail(code) { const error = new Error(code); error.code = code; throw error; }
// Deterministic within a pure transition; the server-generated order ID provides opacity.
function opaqueId(...parts) { return createHash('sha256').update(JSON.stringify(parts)).digest('hex'); }
function text(value, code) {
  if (typeof value !== 'string' || !value.trim()) fail(code);
  return value.trim();
}
function amount(value) {
  if (!Number.isSafeInteger(value) || value < 0) fail('INVALID_AMOUNT');
  return value;
}
function timestamp(value, code = 'INVALID_TIME') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) fail(code);
  return new Date(value).toISOString();
}

export function createInitialState() {
  return { schema_version: 1, ...Object.fromEntries(tables.map(name => [name, []])) };
}

export function normalizeActor(actor) {
  if (!actor || !['landlord', 'vendor'].includes(actor.role)) fail('INVALID_ACTOR');
  const normalized = { actor_id: text(actor.actor_id, 'INVALID_ACTOR'),
    workspace_id: text(actor.workspace_id, 'INVALID_ACTOR'), role: actor.role };
  if (actor.role === 'vendor') normalized.partner_id = text(actor.partner_id, 'INVALID_ACTOR');
  return normalized;
}

export function validatePartnerInput(input) {
  if (!input || !['company', 'individual'].includes(input.type)) fail('INVALID_PARTNER');
  return { type: input.type, name: text(input.name, 'INVALID_PARTNER') };
}

/** Canonical membership identity must fit a single decoded URL path segment.
 * Percent is rejected so double encoding cannot become a second decoding step. */
export function normalizeMemberId(value) {
  const id = text(value, 'INVALID_MEMBER');
  if (id === '.' || id === '..' || /[/\\%?#\u0000-\u001f\u007f]/u.test(id)) fail('INVALID_MEMBER');
  try { encodeURIComponent(id); } // Reject unpaired surrogates that cannot round-trip through a URL.
  catch { fail('INVALID_MEMBER'); }
  return id;
}

export function validateQuoteInput(input) {
  if (!input) fail('INVALID_QUOTE');
  const labor_twd = amount(input.labor_twd);
  const materials_twd = amount(input.materials_twd);
  const tax_twd = amount(input.tax_twd);
  const total_twd = amount(labor_twd + materials_twd + tax_twd);
  if (!Number.isSafeInteger(input.estimated_days) || input.estimated_days < 1) fail('INVALID_QUOTE');
  return { currency: 'TWD', labor_twd, materials_twd, tax_twd, total_twd,
    expires_at: timestamp(input.expires_at, 'INVALID_QUOTE'), estimated_days: input.estimated_days };
}

function landlordAllowed(state, actor, permission) {
  return actor.role === 'landlord' && state.workspace_memberships.some(m =>
    m.actor_id === actor.actor_id && m.workspace_id === actor.workspace_id &&
    m.active === true && m.permissions.includes(permission));
}
function partnerActive(state, workspaceId, partnerId) {
  return state.partners.some(p => p.id === partnerId && p.active === true) &&
    state.workspace_partners.some(p => p.workspace_id === workspaceId && p.partner_id === partnerId && p.active === true);
}
function vendorAllowed(state, actor) {
  return actor.role === 'vendor' && partnerActive(state, actor.workspace_id, actor.partner_id) &&
    state.partner_memberships.some(m => m.workspace_id === actor.workspace_id &&
      m.actor_id === actor.actor_id && m.partner_id === actor.partner_id && m.active === true);
}
function findOrder(state, actor, id) {
  const order = state.work_orders.find(w => w.id === id && w.workspace_id === actor.workspace_id);
  if (!order) fail('NOT_FOUND');
  return order;
}
function assignmentFor(state, order) {
  return state.assignments.find(a => a.work_order_id === order.id && a.workspace_id === order.workspace_id && a.status !== 'cancelled');
}
function belongs(row, order) { return row.work_order_id === order.id && row.workspace_id === order.workspace_id; }

/** Action contract: create, source, assign, start, complete, accept, rework, cancel.
 * Existing-order actions require work_order_id + expected_version.
 * assign requires an approved quote for repairs; other trades may use a valid fixed-price agreement.
 * invite, quote, approve-quote, decline, accept-assignment use the Task 4 sourcing contract below.
 */
export function transitionWorkOrder(state, actor, action, input, now) {
  if (['invite', 'quote', 'approve-quote', 'decline', 'accept-assignment'].includes(action)) {
    return sourcingTransition(state, actor, action, input, now);
  }
  const principal = normalizeActor(actor);
  const at = timestamp(now);
  if (!Object.hasOwn(permissions, action)) fail('INVALID_ACTION');
  if (!input || typeof input !== 'object') fail('INVALID_INPUT');
  if (permissions[action] && !landlordAllowed(state, principal, permissions[action])) fail('FORBIDDEN');
  const next = structuredClone(state);
  let order;
  let from = null;
  if (action === 'create') {
    const id = text(input.id, 'INVALID_INPUT');
    if (next.work_orders.some(w => w.id === id)) fail('ALREADY_EXISTS');
    if (!['repair', 'cleaning', 'other'].includes(input.trade)) fail('INVALID_INPUT');
    order = { id, workspace_id: principal.workspace_id, title: text(input.title, 'INVALID_INPUT'),
      trade: input.trade, area: text(input.area, 'INVALID_INPUT'),
      location: typeof input.location === 'string' ? input.location.trim() : '',
      instructions: typeof input.instructions === 'string' ? input.instructions.trim() : '',
      status: 'draft', version: 1, created_at: at, updated_at: at };
    if (input.property_id !== undefined) order.property_id = text(input.property_id, 'INVALID_INPUT');
    next.work_orders.push(order);
  } else {
    order = findOrder(next, principal, input.work_order_id);
    if (['completed', 'cancelled'].includes(order.status)) fail('INVALID_TRANSITION');
    if (['start', 'complete', 'request-supplement', 'accept', 'rework', 'approve-supplement'].includes(action)) {
      authorizeWorkOrderAction(state, principal, action, input);
    }
    if (!Number.isSafeInteger(input.expected_version) || input.expected_version !== order.version) fail('VERSION_CONFLICT');
    from = order.status;
    const assignment = assignmentFor(next, order);
    if (['start', 'complete', 'request-supplement'].includes(action) &&
        (!vendorAllowed(next, principal) || !assignment || assignment.partner_id !== principal.partner_id)) fail('FORBIDDEN');
    switch (action) {
      case 'source':
        if (order.status !== 'draft') fail('INVALID_TRANSITION');
        order.status = 'sourcing';
        break;
      case 'assign': {
        if (!['sourcing', 'awaiting_approval'].includes(order.status) || assignment) fail('INVALID_TRANSITION');
        if (!partnerActive(next, principal.workspace_id, input.partner_id)) fail('FORBIDDEN');
        const row = { id: `assignment-${order.id}`, workspace_id: order.workspace_id,
          work_order_id: order.id, partner_id: input.partner_id, status: 'assigned', created_at: at };
        if (input.agreement_id && order.trade !== 'repair') {
          const agreement = latestAgreement(next, order.workspace_id, input.agreement_id);
          if (!agreement || agreement.active !== true || !Number.isSafeInteger(agreement.version) || agreement.version < 1 ||
              agreement.partner_id !== input.partner_id || agreement.trade !== order.trade ||
              (agreement.property_id && agreement.property_id !== order.property_id) ||
              timestamp(agreement.starts_at, 'INVALID_AGREEMENT') > at || timestamp(agreement.ends_at, 'INVALID_AGREEMENT') < at) fail('INVALID_AGREEMENT');
          row.agreement_snapshot = { id: agreement.id, version: agreement.version, title: agreement.title,
            price_twd: amount(agreement.price_twd), currency: 'TWD', starts_at: agreement.starts_at, ends_at: agreement.ends_at };
          row.approved_amount_twd = row.agreement_snapshot.price_twd;
        } else {
          if (!input.quote_id) fail('QUOTE_REQUIRED');
          const quote = next.quotes.find(q => q.id === input.quote_id && belongs(q, order) && q.partner_id === input.partner_id);
          if (!quote || quote.status !== 'approved') fail('QUOTE_NOT_APPROVED');
          if (timestamp(quote.expires_at, 'INVALID_QUOTE') <= at) fail('QUOTE_EXPIRED');
          if (!Number.isSafeInteger(quote.version) || quote.version < 1) fail('INVALID_QUOTE');
          row.quote_id = quote.id;
          row.quote_version = quote.version;
          row.approved_amount_twd = amount(quote.total_twd);
        }
        next.assignments.push(row);
        order.status = 'assigned';
        break;
      }
      case 'start':
        if (order.status !== 'assigned') fail('INVALID_TRANSITION');
        assignment.status = 'in_progress';
        order.status = 'in_progress';
        break;
      case 'complete': {
        if (order.status !== 'in_progress') fail('INVALID_TRANSITION');
        const actual = amount(input.actual_amount_twd);
        if (actual > approvedLimit(next, order, assignment)) fail('SUPPLEMENT_REQUIRED');
        const attachment_ids = input.attachment_ids === undefined ? [] : strings(input.attachment_ids, 'INVALID_ATTACHMENT');
        for (const id of attachment_ids) {
          if (!next.private_attachments.some(a => a.id === id && belongs(a, order))) fail('INVALID_ATTACHMENT');
        }
        next.completion_reports.push({ id: `completion-${order.id}-${order.version + 1}`, workspace_id: order.workspace_id,
          work_order_id: order.id, assignment_id: assignment.id, actor: principal, at,
          version: order.version + 1, attachment_ids,
          description: text(input.description, 'INVALID_COMPLETION'), actual_amount_twd: actual });
        order.status = 'awaiting_acceptance';
        assignment.status = 'awaiting_acceptance';
        break;
      }
      case 'accept':
      case 'rework':
        if (order.status !== 'awaiting_acceptance' || !assignment) fail('INVALID_TRANSITION');
        next.acceptances.push({ id: `acceptance-${order.id}-${order.version + 1}`, workspace_id: order.workspace_id,
          work_order_id: order.id, actor: principal, at, version: order.version + 1, decision: action,
          reason: action === 'rework' ? text(input.reason, 'INVALID_ACCEPTANCE') : '' });
        order.status = action === 'accept' ? 'completed' : 'in_progress';
        assignment.status = order.status;
        break;
      case 'request-supplement': {
        if (order.status !== 'in_progress') fail('INVALID_TRANSITION');
        const quote = validateQuoteInput(input);
        if (quote.expires_at <= at) fail('QUOTE_EXPIRED');
        next.quote_revisions.push({ id: opaqueId(order.id, order.version + 1, 'supplement'),
          quote_id: opaqueId(order.id, order.version + 1, 'supplement'),
          kind: 'supplement', workspace_id: order.workspace_id, work_order_id: order.id,
          assignment_id: assignment.id, partner_id: assignment.partner_id, version: 1,
          ...quote, reason: text(input.reason, 'INVALID_QUOTE'), actor: principal, at });
        break;
      }
      case 'approve-supplement': {
        if (order.status !== 'in_progress' || !assignment) fail('INVALID_TRANSITION');
        const supplement = next.quote_revisions.find(q => q.id === input.supplement_id && q.kind === 'supplement' &&
          belongs(q, order) && q.assignment_id === assignment.id && q.partner_id === assignment.partner_id);
        if (!supplement) fail('NOT_FOUND');
        if (supplement.version !== input.supplement_version) fail('VERSION_CONFLICT');
        if (supplement.expires_at <= at) fail('QUOTE_EXPIRED');
        if (next.work_order_events.some(e => belongs(e, order) && e.action === 'approve-supplement' && e.supplement_id === supplement.id)) fail('INVALID_TRANSITION');
        amount(approvedLimit(next, order, assignment) + amount(supplement.total_twd));
        break;
      }
      case 'cancel':
        order.status = 'cancelled';
        if (assignment) assignment.status = 'cancelled';
        break;
    }
    order.version += 1;
    order.updated_at = at;
  }
  const event = { id: `event-${order.id}-${order.version}`, workspace_id: order.workspace_id,
    work_order_id: order.id, actor: principal, action, at, from, to: order.status,
    version: order.version, visibility: ['start', 'complete', 'accept', 'rework'].includes(action) ? 'public' : 'internal' };
  if (action === 'approve-supplement') {
    const supplement = next.quote_revisions.find(q => q.id === input.supplement_id && belongs(q, order));
    Object.assign(event, { supplement_id: supplement.id, supplement_version: supplement.version,
      assignment_id: supplement.assignment_id, approved_extra_twd: supplement.total_twd });
  }
  next.work_order_events.push(event);
  const assignment = assignmentFor(next, order);
  const recipients = ['start', 'complete', 'request-supplement'].includes(action) ? [{ type: 'workspace', id: order.workspace_id }]
    : ['accept', 'rework', 'approve-supplement'].includes(action) ? [{ type: 'partner', id: assignment.partner_id }] : [];
  appendNotices(next, order, event, recipients);
  return { state: next, events: [structuredClone(event)], notifications: next.notification_outbox.filter(n => n.event_id === event.id) };
}

function approvedLimit(state, order, assignment) {
  return state.work_order_events.filter(e => belongs(e, order) && e.action === 'approve-supplement' && e.assignment_id === assignment.id)
    .reduce((sum, e) => amount(sum + amount(e.approved_extra_twd)), amount(assignment.approved_amount_twd));
}
function appendNotices(state, order, event, recipients) {
  for (const { type, id } of recipients) {
    state.notification_outbox.push({ id: opaqueId(event.id, type, id, 'local'), workspace_id: order.workspace_id,
      work_order_id: order.id, event_id: event.id, recipient_type: type, recipient_id: id,
      channel: 'local', status: 'saved', at: event.at, message: `Work order ${order.trade}: update available.`, login_path: '/' });
  }
}

/** Attachment authority is deliberately stricter than invitation summary visibility. */
export function authorizeAttachment(state, actor, workOrderId, write = false) {
  const principal = normalizeActor(actor);
  const order = findOrder(state, principal, workOrderId);
  if (principal.role === 'landlord') {
    if (!landlordAllowed(state, principal, 'work_order_read') ||
        write && !landlordAllowed(state, principal, 'work_order_dispatch')) fail('FORBIDDEN');
  } else {
    const assignment = assignmentFor(state, order);
    if (!vendorAllowed(state, principal) || !assignment || assignment.partner_id !== principal.partner_id) fail('FORBIDDEN');
  }
  return order;
}

export function attachmentMetadata(row) {
  return { id: row.id, workspace_id: row.workspace_id, work_order_id: row.work_order_id,
    content_type: row.content_type, size_bytes: row.size_bytes, sha256: row.sha256, actor: normalizeActor(row.actor), at: row.at };
}

export function recordAttachmentAccess(state, actor, action, workOrderId, id, now, metadata, expectedVersion) {
  const principal = normalizeActor(actor);
  const next = structuredClone(state);
  const order = authorizeAttachment(next, principal, workOrderId, action === 'attachment-upload');
  const from = order.status;
  const at = timestamp(now);
  if (action === 'attachment-upload') {
    if (['completed', 'cancelled'].includes(order.status)) fail('INVALID_TRANSITION');
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== order.version) fail('VERSION_CONFLICT');
    next.private_attachments.push(attachmentMetadata({ ...metadata, id, workspace_id: order.workspace_id,
      work_order_id: order.id, actor: principal, at }));
    order.version += 1; order.updated_at = at;
  } else if (action !== 'attachment-download') fail('INVALID_ACTION');
  const event = { id: action === 'attachment-upload' ? `event-${order.id}-${order.version}` : `attachment-access-${id}`,
    workspace_id: order.workspace_id, work_order_id: order.id, actor: principal, action, at,
    from, to: order.status, version: order.version, visibility: 'internal', attachment_id: metadata?.attachment_id || id };
  next.work_order_events.push(event);
  return next;
}

// Directory contracts are independent of work-order orchestration. All inputs are
// normalized before idempotency comparison; state-dependent validation runs in the transaction.
const trades = ['repair', 'cleaning', 'other'];
function trade(value) { if (!trades.includes(value)) fail('INVALID_TRADE'); return value; }
function boolean(value) { if (typeof value !== 'boolean') fail('INVALID_INPUT'); return value; }
function strings(value, code) {
  if (!Array.isArray(value) || value.length > 100) fail(code);
  return [...new Set(value.map(v => text(v, code)))].sort();
}
function normalizeSkills(value) {
  if (!Array.isArray(value) || value.length > 100) fail('INVALID_TRADE');
  const rows = value.map(s => {
    if (!s || typeof s !== 'object') fail('INVALID_TRADE');
    return { trade: trade(s.trade), name: text(s.name, 'INVALID_TRADE') };
  }).sort((a, b) => a.trade.localeCompare(b.trade) || a.name.localeCompare(b.name));
  return rows.filter((s, i) => !i || s.trade !== rows[i - 1].trade || s.name !== rows[i - 1].name);
}
function skillRows(data) {
  const skills = data.skills || [];
  return [...skills, ...(data.trades || []).filter(t => !skills.some(s => s.trade === t)).map(trade => ({ trade, name: trade }))];
}
function latestAgreement(state, workspaceId, id) {
  return state.service_agreements.filter(a => a.workspace_id === workspaceId && (a.agreement_id || a.id) === id)
    .sort((a, b) => b.version - a.version)[0];
}
function scopedPartner(state, actor, id) {
  const partner = state.partners.find(p => p.id === id);
  const association = state.workspace_partners.find(p => p.workspace_id === actor.workspace_id && p.partner_id === id);
  if (!partner || !association) fail('NOT_FOUND');
  return { partner, association };
}
function directoryAllowed(state, actor, write = false) {
  if (!landlordAllowed(state, actor, write ? 'work_order_dispatch' : 'work_order_read')) fail('FORBIDDEN');
}
function agreementView(row) {
  return { id: row.id, agreement_id: row.agreement_id || row.id, workspace_id: row.workspace_id,
    partner_id: row.partner_id, title: row.title, trade: row.trade, property_id: row.property_id || '',
    version: row.version, price_twd: row.price_twd, currency: 'TWD', active: row.active,
    starts_at: row.starts_at, ends_at: row.ends_at };
}
function memberView(row) {
  return { actor_id: row.actor_id, workspace_id: row.workspace_id, partner_id: row.partner_id,
    member_role: row.member_role, active: row.active };
}
function priorityView(row) {
  return { workspace_id: row.workspace_id, property_id: row.property_id, trade: row.trade,
    partner_id: row.partner_id, rank: row.rank };
}
function partnerView(state, actor, id) {
  const { partner, association } = scopedPartner(state, actor, id);
  return { id, workspace_id: actor.workspace_id, type: partner.type, name: association.name || partner.name,
    active: partner.active === true && association.active === true,
    trades: [...new Set(state.partner_skills.filter(s => s.workspace_id === actor.workspace_id && s.partner_id === id).map(s => s.trade))].sort(),
    skills: state.partner_skills.filter(s => s.workspace_id === actor.workspace_id && s.partner_id === id)
      .map(s => ({ trade: s.trade, name: s.name || s.trade })),
    service_areas: [...(association.service_areas || [])],
    members: state.partner_memberships.filter(m => m.workspace_id === actor.workspace_id && m.partner_id === id).map(memberView) };
}

export function projectDirectory(state, actor, collection) {
  const principal = normalizeActor(actor);
  if (principal.role === 'vendor') {
    if (!vendorAllowed(state, principal) || collection === 'priority-rules') fail('FORBIDDEN');
  } else directoryAllowed(state, principal);
  const own = row => row.workspace_id === principal.workspace_id &&
    (principal.role === 'landlord' || row.partner_id === principal.partner_id);
  let view;
  if (collection === 'partners') view = state.workspace_partners.filter(own).map(p => partnerView(state, principal, p.partner_id));
  else if (collection === 'priority-rules') view = state.priority_rules.filter(own).map(priorityView);
  else if (collection === 'service-agreements') view = state.service_agreements.filter(own).map(agreementView);
  else fail('INVALID_ACTION');
  return structuredClone(view);
}

export function normalizeDirectoryInput(action, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_INPUT');
  let data;
  switch (action) {
    case 'partner-create':
      data = { ...validatePartnerInput(input), active: input.active === undefined ? true : boolean(input.active),
        trades: (input.trades === undefined ? [] : strings(input.trades, 'INVALID_TRADE')).map(trade),
        service_areas: input.service_areas === undefined ? [] : strings(input.service_areas, 'INVALID_INPUT') };
      if (input.skills !== undefined) data.skills = normalizeSkills(input.skills);
      break;
    case 'partner-update':
      data = {};
      if (input.name !== undefined) data.name = text(input.name, 'INVALID_PARTNER');
      if (input.active !== undefined) data.active = boolean(input.active);
      if (input.trades !== undefined) data.trades = strings(input.trades, 'INVALID_TRADE').map(trade);
      if (input.skills !== undefined) data.skills = normalizeSkills(input.skills);
      if (input.service_areas !== undefined) data.service_areas = strings(input.service_areas, 'INVALID_INPUT');
      if (!Object.keys(data).length) fail('INVALID_INPUT');
      break;
    case 'member-create':
    case 'member-update':
      data = {};
      if (action === 'member-create') data.actor_id = normalizeMemberId(input.actor_id);
      if (action === 'member-create' || input.member_role !== undefined) {
        if (!['manager', 'worker', 'contact'].includes(input.member_role)) fail('INVALID_MEMBER');
        data.member_role = input.member_role;
      }
      if (action === 'member-create' || input.active !== undefined) data.active = input.active === undefined ? true : boolean(input.active);
      if (!Object.keys(data).length) fail('INVALID_INPUT');
      break;
    case 'priority-set':
      if (!Array.isArray(input.rules) || input.rules.length > 100) fail('INVALID_PRIORITY');
      data = { property_id: text(input.property_id, 'INVALID_PRIORITY'), trade: trade(input.trade),
        rules: input.rules.map(r => {
          if (!r || !Number.isSafeInteger(r.rank) || r.rank < 1) fail('INVALID_PRIORITY');
          return { partner_id: text(r.partner_id, 'INVALID_PARTNER'), rank: r.rank };
        }).sort((a, b) => a.rank - b.rank || a.partner_id.localeCompare(b.partner_id)) };
      break;
    case 'agreement-save':
      data = { partner_id: text(input.partner_id, 'INVALID_PARTNER'), title: text(input.title, 'INVALID_AGREEMENT'),
        trade: trade(input.trade), property_id: input.property_id === undefined || input.property_id === '' ? '' : text(input.property_id, 'INVALID_AGREEMENT'),
        price_twd: amount(input.price_twd), starts_at: timestamp(input.starts_at, 'INVALID_AGREEMENT'),
        ends_at: timestamp(input.ends_at, 'INVALID_AGREEMENT'), active: input.active === undefined ? true : boolean(input.active) };
      if (data.ends_at < data.starts_at) fail('INVALID_AGREEMENT');
      if (input.agreement_id !== undefined) {
        data.agreement_id = text(input.agreement_id, 'INVALID_AGREEMENT');
        if (!Number.isSafeInteger(input.expected_version) || input.expected_version < 1) fail('VERSION_CONFLICT');
        data.expected_version = input.expected_version;
      }
      break;
    default: fail('INVALID_ACTION');
  }
  return data;
}

/** Applies a normalized directory mutation on a detached state; IDs are server generated. */
export function mutateDirectory(state, actor, action, input, resource, now, id) {
  const principal = normalizeActor(actor);
  directoryAllowed(state, principal, true);
  const data = normalizeDirectoryInput(action, input);
  const at = timestamp(now);
  const next = structuredClone(state);
  let result;
  let version = 1;
  let from = null;
  let to = 'saved';
  if (action === 'partner-create') {
    if (next.partners.some(p => p.id === id)) fail('ALREADY_EXISTS');
    next.partners.push({ id, type: data.type, name: data.name, active: true });
    next.workspace_partners.push({ workspace_id: principal.workspace_id, partner_id: id,
      name: data.name, active: data.active, service_areas: data.service_areas });
    next.partner_skills.push(...skillRows(data).map(skill => ({ workspace_id: principal.workspace_id, partner_id: id, ...skill })));
    result = partnerView(next, principal, id);
  } else if (action === 'partner-update') {
    const { association } = scopedPartner(next, principal, resource.partner_id);
    for (const key of ['name', 'active', 'service_areas']) if (Object.hasOwn(data, key)) association[key] = data[key];
    if (data.trades || data.skills) {
      next.partner_skills = next.partner_skills.filter(s => !(s.workspace_id === principal.workspace_id && s.partner_id === resource.partner_id));
      next.partner_skills.push(...skillRows(data).map(skill => ({ workspace_id: principal.workspace_id, partner_id: resource.partner_id, ...skill })));
    }
    result = partnerView(next, principal, resource.partner_id);
  } else if (action.startsWith('member-')) {
    scopedPartner(next, principal, resource.partner_id);
    const actorId = action === 'member-create' ? data.actor_id : resource.actor_id;
    let member = next.partner_memberships.find(m => m.workspace_id === principal.workspace_id && m.partner_id === resource.partner_id && m.actor_id === actorId);
    if (action === 'member-create') {
      if (member) fail('ALREADY_EXISTS');
      member = { workspace_id: principal.workspace_id, partner_id: resource.partner_id, ...data };
      next.partner_memberships.push(member);
    } else {
      if (!member) fail('NOT_FOUND');
      from = member.active ? 'active' : 'inactive';
      Object.assign(member, data);
    }
    to = member.active ? 'active' : 'inactive';
    result = memberView(member);
  } else if (action === 'priority-set') {
    const ranks = new Set(), partners = new Set();
    for (const rule of data.rules) {
      if (ranks.has(rule.rank) || partners.has(rule.partner_id)) fail('PRIORITY_CONFLICT');
      ranks.add(rule.rank); partners.add(rule.partner_id);
      if (!partnerActive(next, principal.workspace_id, rule.partner_id)) fail('INVALID_PARTNER');
      if (!next.partner_skills.some(s => s.workspace_id === principal.workspace_id && s.partner_id === rule.partner_id && s.trade === data.trade)) fail('INVALID_TRADE');
    }
    next.priority_rules = next.priority_rules.filter(r => !(r.workspace_id === principal.workspace_id && r.property_id === data.property_id && r.trade === data.trade));
    const rows = data.rules.map(rule => ({ workspace_id: principal.workspace_id, property_id: data.property_id, trade: data.trade, ...rule }));
    next.priority_rules.push(...rows);
    result = rows.map(priorityView);
  } else if (action === 'agreement-save') {
    if (!partnerActive(next, principal.workspace_id, data.partner_id)) fail('INVALID_PARTNER');
    if (!next.partner_skills.some(s => s.workspace_id === principal.workspace_id && s.partner_id === data.partner_id && s.trade === data.trade)) fail('INVALID_TRADE');
    let agreementId = id;
    if (data.agreement_id) {
      const previous = latestAgreement(next, principal.workspace_id, data.agreement_id);
      if (!previous) fail('NOT_FOUND');
      if (previous.version !== data.expected_version) fail('VERSION_CONFLICT');
      if (previous.partner_id !== data.partner_id) fail('INVALID_AGREEMENT');
      version = previous.version + 1;
      agreementId = data.agreement_id;
    }
    const { expected_version, agreement_id, ...fields } = data;
    const row = { id, agreement_id: agreementId, workspace_id: principal.workspace_id, version, ...fields, created_at: at };
    next.service_agreements.push(row);
    result = agreementView(row);
  }
  next.work_order_events.push({ id: `directory-event-${id}`, workspace_id: principal.workspace_id,
    resource: { ...resource, id: action === 'partner-create' ? id : resource.id || result.agreement_id || resource.partner_id || data.property_id },
    actor: principal, action, at, from, to, version, visibility: 'internal' });
  return { state: next, data: structuredClone(result) };
}

/** Task 4 inputs are allowlisted and normalized before persistent replay comparison. */
export function normalizeWorkOrderInput(action, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_INPUT');
  if (action === 'create') {
    const data = { title: text(input.title, 'INVALID_INPUT'), trade: trade(input.trade), area: text(input.area, 'INVALID_INPUT'),
      location: typeof input.location === 'string' ? input.location.trim() : '',
      instructions: typeof input.instructions === 'string' ? input.instructions.trim() : '' };
    if (input.property_id !== undefined) data.property_id = text(input.property_id, 'INVALID_INPUT');
    return data;
  }
  if (!Number.isSafeInteger(input.expected_version) || input.expected_version < 1) fail('VERSION_CONFLICT');
  const data = { expected_version: input.expected_version };
  if (action === 'invite') {
    data.mode = input.mode === undefined ? 'ranked' : input.mode;
    if (!['ranked', 'manual', 'parallel'].includes(data.mode)) fail('INVALID_INPUT');
    data.reply_hours = input.reply_hours === undefined ? 24 : input.reply_hours;
    if (!Number.isSafeInteger(data.reply_hours) || data.reply_hours < 1 || data.reply_hours > 168) fail('INVALID_INPUT');
    data.continue_round = input.continue_round === undefined ? false : boolean(input.continue_round);
    if (input.partner_ids !== undefined) {
      if (data.mode !== 'parallel') fail('PARALLEL_CHOICE_REQUIRED');
      data.partner_ids = strings(input.partner_ids, 'INVALID_PARTNER');
      if (data.partner_ids.length < 2) fail('PARALLEL_CHOICE_REQUIRED');
    }
    if (data.mode === 'parallel' && !data.partner_ids) fail('PARALLEL_CHOICE_REQUIRED');
    if (data.mode === 'manual') data.partner_id = text(input.partner_id, 'INVALID_PARTNER');
    if (input.agreement_id !== undefined) data.agreement_id = text(input.agreement_id, 'INVALID_AGREEMENT');
    if (data.mode === 'parallel' && data.agreement_id) fail('INVALID_AGREEMENT');
  } else if (action === 'quote') Object.assign(data, validateQuoteInput(input));
  else if (action === 'request-supplement') Object.assign(data, validateQuoteInput(input), { reason: text(input.reason, 'INVALID_QUOTE') });
  else if (action === 'approve-supplement') {
    data.supplement_id = text(input.supplement_id, 'INVALID_QUOTE');
    if (!Number.isSafeInteger(input.supplement_version) || input.supplement_version < 1) fail('VERSION_CONFLICT');
    data.supplement_version = input.supplement_version;
  } else if (action === 'complete') {
    data.description = text(input.description, 'INVALID_COMPLETION');
    data.actual_amount_twd = amount(input.actual_amount_twd);
    data.attachment_ids = input.attachment_ids === undefined ? [] : strings(input.attachment_ids, 'INVALID_ATTACHMENT');
  } else if (action === 'accept' || action === 'rework') {
    data.reason = action === 'rework' ? text(input.reason, 'INVALID_ACCEPTANCE') : '';
  }
  else if (action === 'approve-quote') {
    data.quote_id = text(input.quote_id, 'INVALID_QUOTE');
    if (!Number.isSafeInteger(input.quote_version) || input.quote_version < 1) fail('VERSION_CONFLICT');
    data.quote_version = input.quote_version;
    data.decision = input.decision === undefined ? 'approve' : input.decision;
    if (!['approve', 'reject'].includes(data.decision)) fail('INVALID_INPUT');
  } else if (!['decline', 'accept-assignment', 'start', 'complete', 'accept', 'rework', 'request-supplement', 'approve-supplement'].includes(action)) fail('INVALID_ACTION');
  return data;
}

/** Also called inside replay transactions, so revoked membership never replays privileged data. */
export function authorizeWorkOrderAction(state, actor, action, resource = {}) {
  const principal = normalizeActor(actor);
  if (['start', 'complete', 'request-supplement', 'accept', 'rework', 'approve-supplement'].includes(action)) {
    let order;
    if (resource.assignment_id) {
      const assignment = state.assignments.find(a => a.id === resource.assignment_id && a.workspace_id === principal.workspace_id);
      if (!assignment) fail('NOT_FOUND');
      order = findOrder(state, principal, assignment.work_order_id);
    } else order = findOrder(state, principal, resource.work_order_id);
    if (['accept', 'rework', 'approve-supplement'].includes(action)) {
      if (!landlordAllowed(state, principal, 'work_order_read') ||
          !landlordAllowed(state, principal, action === 'approve-supplement' ? 'work_order_approve' : 'work_order_accept')) fail('FORBIDDEN');
    } else {
      const assignment = assignmentFor(state, order);
      if (!vendorAllowed(state, principal) || !assignment || assignment.partner_id !== principal.partner_id ||
          resource.assignment_id && assignment.id !== resource.assignment_id) fail('FORBIDDEN');
    }
    return;
  }
  if (['create', 'invite', 'approve-quote'].includes(action)) {
    if (!landlordAllowed(state, principal, 'work_order_read') ||
        !landlordAllowed(state, principal, action === 'approve-quote' ? 'work_order_approve' : 'work_order_dispatch')) fail('FORBIDDEN');
    if (action !== 'create') findOrder(state, principal, resource.work_order_id);
    return;
  }
  if (!vendorAllowed(state, principal)) fail('FORBIDDEN');
  const invitation = state.invitations.find(i => i.workspace_id === principal.workspace_id &&
    (action === 'accept-assignment' ? i.assignment_id === resource.assignment_id : i.id === resource.invitation_id));
  if (!invitation) fail('NOT_FOUND');
  if (invitation.partner_id !== principal.partner_id) fail('FORBIDDEN');
}
function quoteWaiting(state, order, at) {
  return state.quotes.some(q => belongs(q, order) && q.status === 'submitted' && q.expires_at > at);
}
function agreementSnapshot(agreement) {
  return { id: agreement.id, version: agreement.version, title: agreement.title,
    price_twd: amount(agreement.price_twd), currency: 'TWD', starts_at: agreement.starts_at, ends_at: agreement.ends_at };
}
function validAgreement(a, order, partnerId, at) {
  return a && a.active === true && a.partner_id === partnerId && a.trade === order.trade && order.trade !== 'repair' &&
    (!a.property_id || a.property_id === order.property_id) && a.starts_at <= at && a.ends_at >= at;
}
function recordSourcingEvent(state, order, actor, action, at, from, recipients) {
  order.version += 1;
  order.updated_at = at;
  const event = { id: `event-${order.id}-${order.version}`, workspace_id: order.workspace_id,
    work_order_id: order.id, actor: structuredClone(actor), action, at, from, to: order.status,
    version: order.version, visibility: ['accept-assignment', 'approve-quote'].includes(action) ? 'public' : 'internal' };
  state.work_order_events.push(event);
  for (const recipient of new Set(recipients)) {
    const [recipient_type, recipient_id] = recipient.split(':');
    state.notification_outbox.push({ id: opaqueId(event.id, recipient, 'local'), workspace_id: order.workspace_id, work_order_id: order.id,
      event_id: event.id, recipient_type, recipient_id, channel: 'local', status: 'saved', at,
      message: `Work order ${order.trade}: update available.`, login_path: '/' });
  }
  return event;
}
function sendCandidate(state, order, candidate, at) {
  if (!partnerActive(state, order.workspace_id, candidate.partner_id)) return null;
  const round = order.sourcing_round;
  const invitation = { id: opaqueId(round.id, candidate.partner_id, 'invitation'), workspace_id: order.workspace_id, work_order_id: order.id,
    partner_id: candidate.partner_id, round_id: round.id, status: 'sent', sent_at: at,
    deadline_at: new Date(Date.parse(at) + round.reply_hours * 3600000).toISOString() };
  if (candidate.agreement_snapshot) {
    // Price approval is the explicit landlord dispatch's immutable snapshot, not the sweep's decision.
    invitation.agreement_snapshot = structuredClone(candidate.agreement_snapshot);
    invitation.assignment_id = opaqueId(invitation.id, 'reserved-assignment');
  }
  state.invitations.push(invitation);
  return `partner:${candidate.partner_id}`;
}
function advanceRank(state, order, at) {
  const round = order.sourcing_round;
  if (!round || round.mode !== 'ranked' || assignmentFor(state, order) || quoteWaiting(state, order, at) ||
      state.invitations.some(i => belongs(i, order) && i.round_id === round.id && i.status === 'sent')) return [];
  while (round.cursor < round.ranking.length) {
    const candidate = round.ranking[round.cursor++];
    const recipient = sendCandidate(state, order, candidate, at);
    if (recipient) return [recipient];
  }
  return [];
}
function revokeOtherInvitations(state, order, winner) {
  for (const i of state.invitations.filter(i => belongs(i, order) && i.id !== winner)) {
    if (['sent', 'pending', 'quoted'].includes(i.status)) i.status = 'cancelled';
  }
}
function sourcingTransition(state, actor, action, input, now) {
  const principal = normalizeActor(actor);
  const at = timestamp(now);
  const data = normalizeWorkOrderInput(action, input);
  authorizeWorkOrderAction(state, principal, action, input);
  const next = structuredClone(state);
  const invitation = next.invitations.find(i => i.workspace_id === principal.workspace_id &&
    (action === 'accept-assignment' ? i.assignment_id === input.assignment_id : i.id === input.invitation_id));
  const order = findOrder(next, principal, invitation?.work_order_id || input.work_order_id);
  if (order.version !== data.expected_version) fail('VERSION_CONFLICT');
  if (!['draft', 'sourcing', 'awaiting_approval'].includes(order.status) || assignmentFor(next, order)) fail('INVALID_TRANSITION');
  const from = order.status;
  let recipients = [];
  if (action === 'invite') {
    if (quoteWaiting(next, order, at)) fail('QUOTE_AWAITING_APPROVAL');
    if (data.continue_round) {
      if (!order.sourcing_round || order.sourcing_round.mode !== 'ranked' || data.mode !== 'ranked' || data.agreement_id) fail('INVALID_TRANSITION');
      order.status = 'sourcing';
      recipients = advanceRank(next, order, at);
      if (!recipients.length) fail('NO_CANDIDATE');
    } else {
      let ranking = data.mode === 'ranked' ? next.priority_rules.filter(r => r.workspace_id === order.workspace_id &&
        r.property_id === order.property_id && r.trade === order.trade).sort((a, b) => a.rank - b.rank).map(r => ({ partner_id: r.partner_id, rank: r.rank }))
        : (data.mode === 'manual' ? [data.partner_id] : data.partner_ids).map(partner_id => ({ partner_id }));
      if (!ranking.length) fail('NO_CANDIDATE');
      for (const candidate of ranking) {
        if (!partnerActive(next, order.workspace_id, candidate.partner_id)) fail('INVALID_PARTNER');
        if (!next.partner_skills.some(s => s.workspace_id === order.workspace_id && s.partner_id === candidate.partner_id && s.trade === order.trade)) fail('INVALID_TRADE');
        if (data.agreement_id) {
          const agreement = candidate === ranking[0] ? latestAgreement(next, order.workspace_id, data.agreement_id)
            : next.service_agreements.filter(a => a.workspace_id === order.workspace_id && validAgreement(a, order, candidate.partner_id, at) &&
              latestAgreement(next, order.workspace_id, a.agreement_id || a.id)?.id === a.id).sort((a, b) => b.version - a.version)[0];
          if (!validAgreement(agreement, order, candidate.partner_id, at)) fail('INVALID_AGREEMENT');
          candidate.agreement_snapshot = agreementSnapshot(agreement);
        }
      }
      revokeOtherInvitations(next, order);
      order.sourcing_round = { id: opaqueId(order.id, order.version + 1, 'round'), mode: data.mode, ranking, cursor: 0, reply_hours: data.reply_hours, actor: principal, at };
      order.status = 'sourcing';
      if (data.mode === 'ranked') recipients = advanceRank(next, order, at);
      else recipients = ranking.map(candidate => sendCandidate(next, order, candidate, at)).filter(Boolean);
    }
  } else if (action === 'quote' || action === 'decline' || action === 'accept-assignment') {
    if (!invitation || invitation.deadline_at <= at || ['expired', 'declined', 'cancelled'].includes(invitation.status)) fail('INVITATION_EXPIRED');
    if (!['sent', 'quoted'].includes(invitation.status)) fail('INVALID_TRANSITION');
    if (action === 'quote') {
      if (invitation.agreement_snapshot || data.expires_at <= at) fail('INVALID_QUOTE');
      let quote = next.quotes.find(q => q.invitation_id === invitation.id && belongs(q, order));
      if (quote && quote.status !== 'submitted') fail('INVALID_TRANSITION');
      const quoteId = quote?.id || opaqueId(invitation.id, 'quote');
      const revision = { ...validateQuoteInput(data), id: opaqueId(quoteId, (quote?.version || 0) + 1), workspace_id: order.workspace_id,
        work_order_id: order.id, partner_id: principal.partner_id, invitation_id: invitation.id,
        quote_id: quoteId, version: (quote?.version || 0) + 1, actor: principal, at };
      next.quote_revisions.push(revision);
      if (!quote) { quote = { id: revision.quote_id }; next.quotes.push(quote); }
      Object.assign(quote, revision, { id: revision.quote_id, status: 'submitted' });
      invitation.status = 'quoted';
      order.status = 'awaiting_approval';
      recipients = [`workspace:${order.workspace_id}`];
    } else if (action === 'decline') {
      invitation.status = 'declined';
      for (const q of next.quotes.filter(q => q.invitation_id === invitation.id && belongs(q, order))) q.status = 'withdrawn';
      if (!quoteWaiting(next, order, at)) order.status = 'sourcing';
      recipients = advanceRank(next, order, at);
      if (!recipients.length) recipients = [`workspace:${order.workspace_id}`];
    } else {
      if (!invitation.agreement_snapshot || invitation.status !== 'sent') fail('QUOTE_NOT_APPROVED');
      invitation.status = 'accepted';
      next.assignments.push({ id: invitation.assignment_id, workspace_id: order.workspace_id, work_order_id: order.id,
        partner_id: principal.partner_id, status: 'assigned', actor: principal, created_at: at,
        agreement_snapshot: structuredClone(invitation.agreement_snapshot), approved_amount_twd: invitation.agreement_snapshot.price_twd });
      order.status = 'assigned';
      revokeOtherInvitations(next, order, invitation.id);
      recipients = [`workspace:${order.workspace_id}`];
    }
  } else {
    const quote = next.quotes.find(q => q.id === data.quote_id && belongs(q, order));
    if (!quote || quote.status !== 'submitted') fail('QUOTE_NOT_APPROVED');
    if (quote.version !== data.quote_version) fail('VERSION_CONFLICT');
    if (quote.expires_at <= at) fail('QUOTE_EXPIRED');
    if (!partnerActive(next, order.workspace_id, quote.partner_id)) fail('FORBIDDEN');
    const quotedInvite = next.invitations.find(i => i.id === quote.invitation_id && belongs(i, order) && i.status === 'quoted');
    if (!quotedInvite) fail('INVALID_TRANSITION');
    quote.status = data.decision === 'approve' ? 'approved' : 'rejected';
    if (data.decision === 'approve') {
      next.assignments.push({ id: opaqueId(quote.id, quote.version, 'approved-assignment'), workspace_id: order.workspace_id, work_order_id: order.id,
        partner_id: quote.partner_id, status: 'assigned', actor: principal, created_at: at,
        quote_id: quote.id, quote_version: quote.version, approved_amount_twd: quote.total_twd });
      order.status = 'assigned';
      quotedInvite.status = 'accepted';
      revokeOtherInvitations(next, order, quotedInvite.id);
    } else {
      quotedInvite.status = 'declined';
      order.status = quoteWaiting(next, order, at) ? 'awaiting_approval' : 'sourcing';
      // Moving beyond a rejected quote is a separate explicit landlord action.
      order.sourcing_round.escalation_paused = true;
    }
    recipients = [`partner:${quote.partner_id}`];
  }
  const event = recordSourcingEvent(next, order, principal, action, at, from, recipients);
  if (action === 'invite' && data.continue_round) order.sourcing_round.escalation_paused = false;
  return { state: next, events: [structuredClone(event)], notifications: next.notification_outbox.filter(n => n.event_id === event.id) };
}

/** One expiry event is atomic with the next ranked invitation; no actor permissions are manufactured. */
export function expireDueInvitations(state, now) {
  const at = timestamp(now);
  const next = structuredClone(state);
  for (const quote of next.quotes.filter(q => q.status === 'submitted' && q.expires_at <= at)) {
    const order = next.work_orders.find(w => belongs(quote, w));
    if (!order || !['sourcing', 'awaiting_approval'].includes(order.status) || assignmentFor(next, order)) continue;
    const invitation = next.invitations.find(i => belongs(i, order) && i.id === quote.invitation_id && i.status === 'quoted');
    if (!invitation) continue; // Cancelled/selected rounds cannot be revived by expiry.
    const from = order.status;
    quote.status = 'expired';
    invitation.status = 'expired';
    order.status = quoteWaiting(next, order, at) ? 'awaiting_approval' : 'sourcing';
    const recipients = order.sourcing_round?.escalation_paused ? [] : advanceRank(next, order, at);
    recordSourcingEvent(next, order, { role: 'system', actor_id: 'invitation-sweeper' }, 'quote-expired', at, from,
      recipients.length ? recipients : [`workspace:${order.workspace_id}`]);
  }
  for (const invitation of next.invitations.filter(i => i.status === 'sent' && i.deadline_at <= at)) {
    const order = next.work_orders.find(w => belongs(invitation, w));
    if (!order || !['sourcing', 'awaiting_approval'].includes(order.status) || assignmentFor(next, order)) continue;
    invitation.status = 'expired';
    const from = order.status;
    const recipients = order.sourcing_round?.escalation_paused ? [] : advanceRank(next, order, at);
    recordSourcingEvent(next, order, { role: 'system', actor_id: 'invitation-sweeper' }, 'invitation-expired', at, from,
      recipients.length ? recipients : [`workspace:${order.workspace_id}`]);
  }
  return next;
}

export function projectInbox(state, actor) {
  const principal = normalizeActor(actor);
  if (principal.role === 'vendor' ? !vendorAllowed(state, principal) : !landlordAllowed(state, principal, 'work_order_read')) fail('FORBIDDEN');
  return state.notification_outbox.filter(n => n.workspace_id === principal.workspace_id && n.channel === 'local' &&
    (principal.role === 'landlord' ? n.recipient_type === 'workspace' && n.recipient_id === principal.workspace_id
      : n.recipient_type === 'partner' && n.recipient_id === principal.partner_id)).map(n => ({
    id: n.id, work_order_id: n.work_order_id, event_id: n.event_id, message: n.message, login_path: n.login_path, at: n.at, status: n.status }));
}

export function projectWorkOrderForActor(state, actor, workOrderId) {
  const principal = normalizeActor(actor);
  const order = findOrder(state, principal, workOrderId);
  const landlord = landlordAllowed(state, principal, 'work_order_read');
  const assignment = assignmentFor(state, order);
  const vendor = vendorAllowed(state, principal);
  const invited = vendor && state.invitations.some(i => belongs(i, order) && i.partner_id === principal.partner_id);
  const assigned = vendor && assignment?.partner_id === principal.partner_id;
  if (!landlord && !invited && !assigned) fail('FORBIDDEN');
  const view = { id: order.id, workspace_id: order.workspace_id, title: order.title,
    trade: order.trade, area: order.area, status: order.status, version: order.version,
    created_at: order.created_at, updated_at: order.updated_at };
  if (landlord || assigned) { view.location = order.location; view.instructions = order.instructions; }
  view.invitations = state.invitations.filter(i => belongs(i, order) && (landlord || i.partner_id === principal.partner_id)).map(i => ({
    id: i.id, partner_id: i.partner_id, status: i.status, round_id: i.round_id,
    deadline_at: i.deadline_at, assignment_id: i.assignment_id || null,
    ...(i.agreement_snapshot ? { agreement_snapshot: agreementSnapshot(i.agreement_snapshot) } : {}),
  }));
  view.quotes = state.quotes.filter(q => belongs(q, order) && (landlord || q.partner_id === principal.partner_id)).map(q => ({
    id: q.id, partner_id: q.partner_id, version: q.version, status: q.status,
    labor_twd: q.labor_twd, materials_twd: q.materials_twd, tax_twd: q.tax_twd,
    total_twd: q.total_twd, expires_at: q.expires_at, estimated_days: q.estimated_days,
  }));
  view.assignment = assignment && (landlord || assigned) ? {
    id: assignment.id, partner_id: assignment.partner_id, status: assignment.status,
    approved_amount_twd: assignment.approved_amount_twd,
    ...(assignment.agreement_snapshot ? { agreement_snapshot: {
      id: assignment.agreement_snapshot.id, version: assignment.agreement_snapshot.version,
      title: assignment.agreement_snapshot.title, price_twd: assignment.agreement_snapshot.price_twd,
      currency: assignment.agreement_snapshot.currency, starts_at: assignment.agreement_snapshot.starts_at,
      ends_at: assignment.agreement_snapshot.ends_at,
    } } : {}),
    ...(assignment.quote_id ? { quote_id: assignment.quote_id, quote_version: assignment.quote_version } : {}),
  } : null;
  view.events = state.work_order_events.filter(e => belongs(e, order) && (landlord || e.visibility === 'public')).map(e => ({
    id: e.id, at: e.at, action: e.action, from: e.from, to: e.to, version: e.version,
    ...(landlord ? { actor: e.actor.role === 'system' ? { role: 'system', actor_id: 'invitation-sweeper' } : normalizeActor(e.actor), visibility: e.visibility } : {}),
  }));
  if (landlord || assigned) {
    view.completion_reports = state.completion_reports.filter(r => belongs(r, order)).map(r => ({
      id: r.id, assignment_id: r.assignment_id, description: r.description, actual_amount_twd: r.actual_amount_twd,
      attachment_ids: r.attachment_ids || [], actor: normalizeActor(r.actor), at: r.at, version: r.version }));
    view.acceptances = state.acceptances.filter(r => belongs(r, order)).map(r => ({
      id: r.id, decision: r.decision, reason: r.reason, actor: normalizeActor(r.actor), at: r.at, version: r.version }));
    view.attachments = state.private_attachments.filter(r => belongs(r, order)).map(attachmentMetadata);
    view.supplements = state.quote_revisions.filter(r => belongs(r, order) && r.kind === 'supplement' && r.assignment_id === assignment?.id).map(r => ({
      id: r.id, version: r.version, labor_twd: r.labor_twd, materials_twd: r.materials_twd, tax_twd: r.tax_twd,
      total_twd: r.total_twd, reason: r.reason, expires_at: r.expires_at, at: r.at,
      approved: state.work_order_events.some(e => belongs(e, order) && e.action === 'approve-supplement' && e.supplement_id === r.id && e.supplement_version === r.version) }));
  }
  return structuredClone(view);
}
