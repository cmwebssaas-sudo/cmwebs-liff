/** Pure local V3 candidate contract. Actors must come from a trusted server session.
 * Authority is checked against state memberships, never actor permission labels.
 * All successful transitions return a new snapshot; rejected transitions mutate nothing.
 */
const tables = ['partners', 'partner_memberships', 'workspace_memberships', 'workspace_partners',
  'partner_skills', 'priority_rules', 'service_agreements', 'work_orders', 'invitations',
  'quotes', 'quote_revisions', 'assignments', 'completion_reports', 'acceptances',
  'work_order_events', 'private_attachments', 'notification_outbox', 'idempotency_records'];
const permissions = { create: 'work_order_dispatch', source: 'work_order_dispatch',
  assign: 'work_order_approve', start: null, complete: null, accept: 'work_order_accept',
  rework: 'work_order_accept', cancel: 'work_order_dispatch' };

function fail(code) { const error = new Error(code); error.code = code; throw error; }
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
 * assign consumes an already-approved quote or a currently valid fixed-price agreement.
 * Invitation/quote creation and approval orchestration are later tasks.
 */
export function transitionWorkOrder(state, actor, action, input, now) {
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
    next.work_orders.push(order);
  } else {
    order = findOrder(next, principal, input.work_order_id);
    if (['completed', 'cancelled'].includes(order.status)) fail('INVALID_TRANSITION');
    if (!Number.isSafeInteger(input.expected_version) || input.expected_version !== order.version) fail('VERSION_CONFLICT');
    from = order.status;
    const assignment = assignmentFor(next, order);
    if (['start', 'complete'].includes(action) &&
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
        if (input.agreement_id) {
          const agreement = next.service_agreements.find(a => a.id === input.agreement_id &&
            a.workspace_id === order.workspace_id && a.partner_id === input.partner_id);
          if (!agreement || agreement.active !== true || !Number.isSafeInteger(agreement.version) || agreement.version < 1 ||
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
        if (actual > assignment.approved_amount_twd) fail('SUPPLEMENT_REQUIRED');
        next.completion_reports.push({ id: `completion-${order.id}-${order.version + 1}`, workspace_id: order.workspace_id,
          work_order_id: order.id, assignment_id: assignment.id, actor: principal, at,
          description: text(input.description, 'INVALID_COMPLETION'), actual_amount_twd: actual });
        order.status = 'awaiting_acceptance';
        assignment.status = 'awaiting_acceptance';
        break;
      }
      case 'accept':
      case 'rework':
        if (order.status !== 'awaiting_acceptance' || !assignment) fail('INVALID_TRANSITION');
        next.acceptances.push({ id: `acceptance-${order.id}-${order.version + 1}`, workspace_id: order.workspace_id,
          work_order_id: order.id, actor: principal, at, decision: action,
          reason: action === 'rework' ? text(input.reason, 'INVALID_ACCEPTANCE') : '' });
        order.status = action === 'accept' ? 'completed' : 'in_progress';
        assignment.status = order.status;
        break;
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
  next.work_order_events.push(event);
  return { state: next, events: [structuredClone(event)], notifications: [] };
}

export function projectWorkOrderForActor(state, actor, workOrderId) {
  const principal = normalizeActor(actor);
  const order = findOrder(state, principal, workOrderId);
  const landlord = landlordAllowed(state, principal, 'work_order_read');
  const assignment = assignmentFor(state, order);
  const vendor = vendorAllowed(state, principal);
  const invited = vendor && state.invitations.some(i => belongs(i, order) &&
    i.partner_id === principal.partner_id && ['sent', 'quoted', 'accepted'].includes(i.status));
  const assigned = vendor && assignment?.partner_id === principal.partner_id;
  if (!landlord && !invited && !assigned) fail('FORBIDDEN');
  const view = { id: order.id, workspace_id: order.workspace_id, title: order.title,
    trade: order.trade, area: order.area, status: order.status, version: order.version,
    created_at: order.created_at, updated_at: order.updated_at };
  if (landlord || assigned) { view.location = order.location; view.instructions = order.instructions; }
  view.quotes = state.quotes.filter(q => belongs(q, order) && (landlord || q.partner_id === principal.partner_id)).map(q => ({
    id: q.id, partner_id: q.partner_id, version: q.version, status: q.status,
    total_twd: q.total_twd, expires_at: q.expires_at,
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
    ...(landlord ? { actor: normalizeActor(e.actor), visibility: e.visibility } : {}),
  }));
  return structuredClone(view);
}
