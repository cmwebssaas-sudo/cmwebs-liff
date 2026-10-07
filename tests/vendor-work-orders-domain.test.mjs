import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, normalizeActor, transitionWorkOrder, projectWorkOrderForActor,
  validatePartnerInput, validateQuoteInput } from '../_dev/vendor-work-orders/domain.mjs';
import { createSyntheticFixtures } from '../_dev/vendor-work-orders/fixtures.mjs';

const now = '2026-10-08T04:00:00.000Z';
const fails = (code) => (error) => error.code === code;
function setup() {
  const { state, principals } = createSyntheticFixtures();
  const result = transitionWorkOrder(state, principals.landlord_a, 'create', {
    id: 'wo-1', title: 'Synthetic sink repair', trade: 'repair', area: 'Test north zone',
    location: 'Synthetic room 101', instructions: 'Synthetic work instructions',
  }, now);
  return { state: result.state, principals };
}
function step(state, actor, action, extra = {}) {
  return transitionWorkOrder(state, actor, action, {
    work_order_id: 'wo-1', expected_version: state.work_orders[0].version, ...extra,
  }, now);
}
function sourced() {
  const f = setup();
  f.state = step(f.state, f.principals.landlord_a, 'source').state;
  f.state.invitations.push({ id: 'inv-1', workspace_id: 'ws-a', work_order_id: 'wo-1', partner_id: 'company-a', status: 'sent' });
  return f;
}
function fixedAssignment() {
  const f = sourced();
  f.state = step(f.state, f.principals.landlord_a, 'assign', { partner_id: 'company-a', agreement_id: 'agreement-a' }).state;
  return f;
}

test('accepts_company_and_individual_partners', () => {
  assert.deepEqual(validatePartnerInput({ type: 'company', name: '  Test company  ', secret: 'excluded' }), { type: 'company', name: 'Test company' });
  assert.deepEqual(validatePartnerInput({ type: 'individual', name: 'Test worker' }), { type: 'individual', name: 'Test worker' });
  assert.throws(() => validatePartnerInput({ type: 'unknown', name: 'Test' }), fails('INVALID_PARTNER'));
  assert.throws(() => validatePartnerInput({ type: 'company', name: ' ' }), fails('INVALID_PARTNER'));
  const state = createInitialState();
  state.partners.push({ id: 'test' });
  assert.equal(createInitialState().partners.length, 0);
  assert.equal(state.schema_version, 1);
});

test('allows_multiple_members_without_cross_workspace_access', () => {
  const { state, principals } = sourced();
  for (const actor of [principals.company_a_manager, principals.company_a_worker]) {
    const view = projectWorkOrderForActor(state, actor, 'wo-1');
    assert.equal(view.title, 'Synthetic sink repair');
    assert.equal('location' in view, false);
    assert.equal('instructions' in view, false);
  }
  assert.throws(() => projectWorkOrderForActor(state, principals.landlord_b, 'wo-1'), fails('NOT_FOUND'));
  assert.throws(() => projectWorkOrderForActor(state, principals.company_b_worker, 'wo-1'), fails('NOT_FOUND'));
  state.partner_memberships.find(m => m.actor_id === principals.company_a_worker.actor_id).active = false;
  assert.throws(() => projectWorkOrderForActor(state, principals.company_a_worker, 'wo-1'), fails('FORBIDDEN'));
  const normalized = normalizeActor({ ...principals.landlord_a, permissions: ['invented'], secret: 'excluded' });
  assert.equal('permissions' in normalized, false);
  assert.equal('secret' in normalized, false);
  assert.throws(() => normalizeActor({}), fails('INVALID_ACTOR'));
});

test('requires_quote_before_nonfixed_assignment', () => {
  const { state, principals } = sourced();
  const before = structuredClone(state);
  assert.throws(() => step(state, principals.landlord_a, 'assign', { partner_id: 'company-a' }), fails('QUOTE_REQUIRED'));
  assert.deepEqual(state, before);
  state.quotes.push({ id: 'quote-a', workspace_id: 'ws-a', work_order_id: 'wo-1', partner_id: 'company-a', version: 1, status: 'submitted', total_twd: 1200, expires_at: '2026-10-09T04:00:00.000Z' });
  assert.throws(() => step(state, principals.landlord_a, 'assign', { partner_id: 'company-a', quote_id: 'quote-a' }), fails('QUOTE_NOT_APPROVED'));
  state.quotes[0].status = 'approved';
  const assigned = step(state, principals.landlord_a, 'assign', { partner_id: 'company-a', quote_id: 'quote-a' });
  assert.equal(assigned.state.work_orders[0].status, 'assigned');
  assert.equal(assigned.state.assignments[0].approved_amount_twd, 1200);
  assert.equal(assigned.state.assignments[0].quote_version, 1);
});

test('snapshots_fixed_price_agreement', () => {
  const { state, principals } = sourced();
  const assigned = step(state, principals.landlord_a, 'assign', { partner_id: 'company-a', agreement_id: 'agreement-a' });
  const snapshot = assigned.state.assignments[0].agreement_snapshot;
  assert.equal(snapshot.price_twd, 1500);
  assert.equal(snapshot.version, 1);
  assigned.state.service_agreements[0].price_twd = 9999;
  assert.equal(snapshot.price_twd, 1500);
  assert.equal(state.assignments.length, 0);
  assert.throws(() => step(state, principals.company_a_manager, 'assign', { partner_id: 'company-a', agreement_id: 'agreement-a' }), fails('FORBIDDEN'));
});

test('completion_waits_for_landlord_acceptance', () => {
  const f = fixedAssignment();
  let state = step(f.state, f.principals.company_a_worker, 'start').state;
  state = step(state, f.principals.company_a_worker, 'complete', { description: 'Synthetic repair complete', actual_amount_twd: 1500 }).state;
  assert.equal(state.work_orders[0].status, 'awaiting_acceptance');
  assert.throws(() => step(state, f.principals.company_a_worker, 'accept'), fails('FORBIDDEN'));
  const completed = step(state, f.principals.landlord_a, 'accept').state;
  assert.equal(completed.work_orders[0].status, 'completed');
  assert.equal(completed.acceptances.length, 1);
  assert.throws(() => step(completed, f.principals.landlord_a, 'cancel'), fails('INVALID_TRANSITION'));
});

test('appends_actor_scoped_events', () => {
  const { state, principals } = setup();
  const before = structuredClone(state);
  const result = step(state, principals.landlord_a, 'source');
  assert.deepEqual(state, before);
  assert.equal(result.events.length, 1);
  assert.equal(result.state.work_order_events.length, 2);
  assert.deepEqual(result.state.work_order_events[0], state.work_order_events[0]);
  const event = result.events[0];
  assert.equal(event.actor.actor_id, 'landlord-a');
  assert.equal(event.workspace_id, 'ws-a');
  assert.equal(event.at, now);
  assert.equal(event.from, 'draft');
  assert.equal(event.to, 'sourcing');
  assert.equal(event.version, 2);
  assert.equal(event.visibility, 'internal');
  assert.deepEqual(result.notifications, []);
  assert.throws(() => step(result.state, principals.landlord_a, 'cancel', { expected_version: 1 }), fails('VERSION_CONFLICT'));
});

test('rejects_negative_fractional_or_unsafe_twd_amounts', () => {
  for (const value of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, '100']) {
    assert.throws(() => validateQuoteInput({ labor_twd: value, materials_twd: 0, tax_twd: 0, expires_at: '2026-10-09T04:00:00.000Z', estimated_days: 1 }), fails('INVALID_AMOUNT'));
  }
  assert.throws(() => validateQuoteInput({ labor_twd: Number.MAX_SAFE_INTEGER, materials_twd: 1, tax_twd: 0, expires_at: '2026-10-09T04:00:00.000Z', estimated_days: 1 }), fails('INVALID_AMOUNT'));
  const quote = validateQuoteInput({ labor_twd: 1000, materials_twd: 200, tax_twd: 60, total_twd: 1, expires_at: '2026-10-09T04:00:00.000Z', estimated_days: 2 });
  assert.equal(quote.total_twd, 1260);
  assert.equal(quote.currency, 'TWD');
});

test('rejects_forged_actor_and_allowlists_vendor_projection', () => {
  const f = fixedAssignment();
  f.state.work_orders[0].tenant_name = 'must never escape';
  f.state.assignments[0].agreement_snapshot.private_document_url = 'must never escape';
  f.state.quotes.push({ id: 'other-quote', workspace_id: 'ws-a', work_order_id: 'wo-1', partner_id: 'company-b', total_twd: 10 });
  assert.throws(() => step(f.state, { ...f.principals.company_a_worker, role: 'landlord', permissions: ['work_order_accept'] }, 'cancel'), fails('FORBIDDEN'));
  const view = projectWorkOrderForActor(f.state, f.principals.company_a_worker, 'wo-1');
  assert.equal(view.location, 'Synthetic room 101');
  assert.equal('tenant_name' in view, false);
  assert.equal(view.quotes.length, 0);
  assert.equal('private_document_url' in view.assignment.agreement_snapshot, false);
  view.assignment.agreement_snapshot.price_twd = 1;
  assert.equal(f.state.assignments[0].agreement_snapshot.price_twd, 1500);
});

test('rejects_expired_or_wrong_scope_agreements_and_invalid_completion', () => {
  const f = sourced();
  f.state.service_agreements[0].ends_at = '2026-10-07T04:00:00.000Z';
  assert.throws(() => step(f.state, f.principals.landlord_a, 'assign', { partner_id: 'company-a', agreement_id: 'agreement-a' }), fails('INVALID_AGREEMENT'));
  f.state.service_agreements[0].workspace_id = 'ws-b';
  assert.throws(() => step(f.state, f.principals.landlord_a, 'assign', { partner_id: 'company-a', agreement_id: 'agreement-a' }), fails('INVALID_AGREEMENT'));
  const g = fixedAssignment();
  const state = step(g.state, g.principals.company_a_worker, 'start').state;
  assert.throws(() => step(state, g.principals.company_a_worker, 'complete', { description: 'Done', actual_amount_twd: 1501 }), fails('SUPPLEMENT_REQUIRED'));
  assert.throws(() => step(state, g.principals.company_a_worker, 'complete', { description: ' ', actual_amount_twd: 1500 }), fails('INVALID_COMPLETION'));
});

test('rework_requires_reason_and_cancel_preserves_history', () => {
  const f = fixedAssignment();
  let state = step(f.state, f.principals.company_a_worker, 'start').state;
  state = step(state, f.principals.company_a_worker, 'complete', { description: 'Done', actual_amount_twd: 1500 }).state;
  assert.throws(() => step(state, f.principals.landlord_a, 'rework', { reason: '' }), fails('INVALID_ACCEPTANCE'));
  state = step(state, f.principals.landlord_a, 'rework', { reason: 'Synthetic leak remains' }).state;
  assert.equal(state.work_orders[0].status, 'in_progress');
  assert.equal(state.acceptances[0].reason, 'Synthetic leak remains');
  state = step(state, f.principals.landlord_a, 'cancel').state;
  assert.equal(state.work_orders[0].status, 'cancelled');
  assert.equal(state.assignments[0].status, 'cancelled');
  assert.equal(state.completion_reports.length, 1);
  assert.throws(() => step(state, f.principals.company_a_worker, 'start'), fails('INVALID_TRANSITION'));
});

test('rejects_invalid_action_time_and_expired_quote_without_mutation', () => {
  const f = sourced();
  const before = structuredClone(f.state);
  assert.throws(() => step(f.state, f.principals.landlord_a, 'invented'), fails('INVALID_ACTION'));
  assert.throws(() => transitionWorkOrder(f.state, f.principals.landlord_a, 'cancel', { work_order_id: 'wo-1', expected_version: 2 }, 'bad time'), fails('INVALID_TIME'));
  assert.deepEqual(f.state, before);
  f.state.quotes.push({ id: 'q', workspace_id: 'ws-a', work_order_id: 'wo-1', partner_id: 'company-a', status: 'approved', total_twd: 100, version: 1, expires_at: now });
  assert.throws(() => step(f.state, f.principals.landlord_a, 'assign', { partner_id: 'company-a', quote_id: 'q' }), fails('QUOTE_EXPIRED'));
});
