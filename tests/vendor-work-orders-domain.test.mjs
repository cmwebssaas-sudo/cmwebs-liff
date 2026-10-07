import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, normalizeActor, transitionWorkOrder, projectWorkOrderForActor,
  validatePartnerInput, validateQuoteInput } from '../_dev/vendor-work-orders/domain.mjs';
import { createSyntheticFixtures } from '../_dev/vendor-work-orders/fixtures.mjs';
import * as domain from '../_dev/vendor-work-orders/domain.mjs';

const now = '2026-10-08T04:00:00.000Z';
const later = '2026-10-09T04:00:00.000Z';
const quoteInput = { labor_twd: 1000, materials_twd: 200, tax_twd: 60, estimated_days: 2,
  expires_at: '2026-10-10T04:00:00.000Z' };
function ranked(trade = 'repair') {
  const f = setup(trade);
  f.state.work_orders[0].property_id = 'property-a';
  f.state.partner_skills.push(...['company-a', 'individual-a'].map(partner_id => ({ workspace_id: 'ws-a', partner_id, trade })));
  f.state.priority_rules.push(...['company-a', 'individual-a'].map((partner_id, i) => ({ workspace_id: 'ws-a', property_id: 'property-a', trade, partner_id, rank: i + 1 })));
  return f;
}
function invite(f, input = {}) {
  f.state = step(f.state, f.principals.landlord_a, 'invite', input).state;
  return f;
}
function respond(f, action, extra = {}, time = now, actor = f.principals.company_a_worker) {
  return transitionWorkOrder(f.state, actor, action, { work_order_id: 'wo-1',
    invitation_id: f.state.invitations[0].id, expected_version: f.state.work_orders[0].version, ...extra }, time);
}

test('fixed_price_dispatch_requires_explicit_landlord_action', () => {
  const f = ranked('cleaning');
  assert.throws(() => step(f.state, f.principals.company_a_worker, 'invite', { mode: 'manual', partner_id: 'company-a', agreement_id: 'agreement-a' }), fails('FORBIDDEN'));
  invite(f, { mode: 'manual', partner_id: 'company-a', agreement_id: 'agreement-a' });
  assert.equal(f.state.assignments.length, 0);
  assert.equal(f.state.invitations[0].agreement_snapshot.price_twd, 1500);
  assert.ok(f.state.invitations[0].assignment_id);
  const result = respond(f, 'accept-assignment', { assignment_id: f.state.invitations[0].assignment_id });
  assert.equal(result.state.assignments.length, 1);
  assert.equal(result.state.assignments[0].approved_amount_twd, 1500);
});
test('quote_requires_landlord_approval_before_assignment', () => {
  const f = invite(ranked());
  f.state = respond(f, 'quote', quoteInput).state;
  assert.equal(f.state.assignments.length, 0);
  assert.equal(f.state.work_orders[0].status, 'awaiting_approval');
  const q = f.state.quotes[0];
  assert.throws(() => step(f.state, f.principals.company_a_worker, 'approve-quote', { quote_id: q.id, quote_version: 1 }), fails('FORBIDDEN'));
  const approved = step(f.state, f.principals.landlord_a, 'approve-quote', { quote_id: q.id, quote_version: 1 }).state;
  assert.equal(approved.assignments[0].approved_amount_twd, 1260);
  assert.equal(approved.assignments[0].quote_version, 1);
  assert.equal(approved.work_orders[0].status, 'assigned');
});
test('invites_first_rank_before_second', () => {
  const f = invite(ranked());
  assert.deepEqual(f.state.invitations.map(i => i.partner_id), ['company-a']);
  f.state.priority_rules.reverse();
  f.state.priority_rules[0].rank = 9;
  const next = respond(f, 'decline').state;
  assert.deepEqual(next.invitations.map(i => i.partner_id), ['company-a', 'individual-a']);
  assert.equal(next.invitations[0].status, 'declined');
});
test('decline_or_24_hour_timeout_advances_rank', () => {
  const f = invite(ranked());
  assert.equal(f.state.invitations[0].deadline_at, later);
  const expired = domain.expireDueInvitations(f.state, later);
  assert.equal(expired.invitations[0].status, 'expired');
  assert.equal(expired.invitations[1].partner_id, 'individual-a');
  assert.equal(expired.invitations[1].deadline_at, '2026-10-10T04:00:00.000Z');
  assert.deepEqual(domain.expireDueInvitations(expired, later), expired);
});
test('valid_quote_pauses_rank_escalation', () => {
  const f = invite(ranked());
  f.state = respond(f, 'quote', quoteInput).state;
  const swept = domain.expireDueInvitations(f.state, later);
  assert.equal(swept.invitations.length, 1);
  assert.equal(swept.work_orders[0].status, 'awaiting_approval');
  const rejected = step(swept, f.principals.landlord_a, 'approve-quote', { quote_id: swept.quotes[0].id, quote_version: 1, decision: 'reject' }).state;
  assert.equal(rejected.invitations.length, 1);
  const continued = step(rejected, f.principals.landlord_a, 'invite', { mode: 'ranked', continue_round: true }).state;
  assert.equal(continued.invitations[1].partner_id, 'individual-a');
});
test('expired_submitted_quote_advances_frozen_rank_atomically_at_exact_deadline', () => {
  const f = invite(ranked());
  f.state = respond(f, 'quote', { ...quoteInput, expires_at: later }).state;
  const before = structuredClone(f.state);
  const quote = f.state.quotes[0];
  assert.throws(() => transitionWorkOrder(f.state, f.principals.landlord_a, 'approve-quote', {
    work_order_id: 'wo-1', expected_version: 3, quote_id: quote.id, quote_version: 1 }, later), fails('QUOTE_EXPIRED'));
  assert.throws(() => respond(f, 'quote', quoteInput, later), fails('INVITATION_EXPIRED'));
  assert.deepEqual(f.state, before);
  f.state.priority_rules = [];
  const swept = domain.expireDueInvitations(f.state, later);
  assert.equal(swept.quotes[0].status, 'expired');
  assert.equal(swept.invitations[0].status, 'expired');
  assert.equal(swept.invitations[1].partner_id, 'individual-a');
  assert.equal(swept.invitations[1].status, 'sent');
  assert.equal(swept.work_orders[0].status, 'sourcing');
  assert.equal(swept.work_orders[0].version, 4);
  assert.equal(swept.work_order_events.at(-1).action, 'quote-expired');
  assert.equal(swept.notification_outbox.at(-1).event_id, swept.work_order_events.at(-1).id);
  assert.equal(swept.notification_outbox.at(-1).recipient_id, 'individual-a');
  assert.doesNotMatch(swept.notification_outbox.at(-1).message, /Synthetic|instructions|101/);
  assert.deepEqual(swept.quote_revisions, before.quote_revisions);
  assert.equal(swept.assignments.length, 0);
  assert.deepEqual(domain.expireDueInvitations(swept, later), swept);
});
test('quote_expiry_preserves_other_valid_quote_or_active_sent_invitation_pause', () => {
  for (const otherStatus of ['quoted', 'sent']) {
    const f = invite(ranked());
    f.state = respond(f, 'quote', { ...quoteInput, expires_at: later }).state;
    // Controlled concurrent-wait state: the next frozen candidate must not be sent twice.
    f.state.invitations.push({ ...f.state.invitations[0], id: 'other-wait', partner_id: 'individual-a',
      status: otherStatus, deadline_at: '2026-10-10T04:00:00.000Z' });
    if (otherStatus === 'quoted') f.state.quotes.push({ ...f.state.quotes[0], id: 'other-quote',
      invitation_id: 'other-wait', partner_id: 'individual-a', expires_at: '2026-10-10T04:00:00.000Z' });
    const swept = domain.expireDueInvitations(f.state, later);
    assert.equal(swept.quotes[0].status, 'expired');
    assert.equal(swept.invitations[0].status, 'expired');
    assert.equal(swept.invitations.length, 2);
    assert.equal(swept.invitations[1].status, otherStatus);
    assert.equal(swept.work_orders[0].status, otherStatus === 'quoted' ? 'awaiting_approval' : 'sourcing');
    assert.equal(swept.work_orders[0].sourcing_round.cursor, 1);
    assert.deepEqual(domain.expireDueInvitations(swept, later), swept);
  }
});
test('manual_override_records_actor', () => {
  const f = invite(ranked(), { mode: 'manual', partner_id: 'individual-a' });
  assert.equal(f.state.invitations[0].partner_id, 'individual-a');
  assert.equal(f.state.work_order_events.at(-1).actor.actor_id, 'landlord-a');
  assert.equal(f.state.work_orders[0].sourcing_round.mode, 'manual');
});
test('parallel_quote_round_requires_explicit_choice', () => {
  const f = ranked();
  assert.throws(() => step(f.state, f.principals.landlord_a, 'invite', { partner_ids: ['company-a', 'individual-a'] }), fails('PARALLEL_CHOICE_REQUIRED'));
  invite(f, { mode: 'parallel', partner_ids: ['company-a', 'individual-a'] });
  assert.equal(f.state.invitations.length, 2);
  f.state = respond(f, 'quote', quoteInput).state;
  const expired = domain.expireDueInvitations(f.state, later);
  assert.equal(expired.invitations[1].status, 'expired');
  assert.equal(expired.invitations.length, 2);
});
test('expired_invitation_cannot_be_accepted', () => {
  const f = invite(ranked('cleaning'), { mode: 'manual', partner_id: 'company-a', agreement_id: 'agreement-a' });
  const before = structuredClone(f.state);
  assert.throws(() => respond(f, 'accept-assignment', { assignment_id: f.state.invitations[0].assignment_id }, later), fails('INVITATION_EXPIRED'));
  assert.deepEqual(f.state, before);
});
test('sourcing_is_pure_and_invitation_price_projection_is_allowlisted', () => {
  const f = ranked('cleaning');
  const input = { mode: 'manual', partner_id: 'company-a', agreement_id: 'agreement-a' };
  const first = step(f.state, f.principals.landlord_a, 'invite', input);
  assert.deepEqual(step(f.state, f.principals.landlord_a, 'invite', input), first);
  first.state.invitations[0].agreement_snapshot.private_document_url = 'SECRET';
  assert.doesNotMatch(JSON.stringify(projectWorkOrderForActor(first.state, f.principals.company_a_worker, 'wo-1')), /SECRET|private_document/);
});
test('fixed_rank_decline_and_expiry_keep_dispatch_price_snapshots_without_preassignment', () => {
  for (const decline of [true, false]) {
    const f = ranked('cleaning');
    f.state.service_agreements.push({ ...f.state.service_agreements[0], id: 'individual-agreement', partner_id: 'individual-a', price_twd: 1800 });
    invite(f, { agreement_id: 'agreement-a' });
    assert.equal(f.state.assignments.length, 0);
    f.state.service_agreements.push({ ...f.state.service_agreements[1], id: 'changed', agreement_id: 'individual-agreement', version: 2, price_twd: 9999 });
    f.state = decline ? respond(f, 'decline').state : domain.expireDueInvitations(f.state, later);
    assert.equal(f.state.invitations[0].status, decline ? 'declined' : 'expired');
    assert.equal(f.state.invitations[1].agreement_snapshot.price_twd, 1800);
    assert.equal(f.state.assignments.length, 0);
    const result = respond(f, 'accept-assignment', { assignment_id: f.state.invitations[1].assignment_id }, decline ? now : later, f.principals.individual_worker).state;
    assert.equal(result.assignments.length, 1);
    assert.equal(result.assignments[0].partner_id, 'individual-a');
    assert.equal(result.assignments[0].approved_amount_twd, 1800);
  }
});
const fails = (code) => (error) => error.code === code;
function setup(trade = 'repair') {
  const { state, principals } = createSyntheticFixtures();
  const result = transitionWorkOrder(state, principals.landlord_a, 'create', {
    id: 'wo-1', title: trade === 'cleaning' ? 'Synthetic room cleaning' : 'Synthetic sink repair', trade, area: 'Test north zone',
    location: 'Synthetic room 101', instructions: 'Synthetic work instructions',
  }, now);
  return { state: result.state, principals };
}
function step(state, actor, action, extra = {}) {
  return transitionWorkOrder(state, actor, action, {
    work_order_id: 'wo-1', expected_version: state.work_orders[0].version, ...extra,
  }, now);
}
function sourced(trade = 'repair') {
  const f = setup(trade);
  f.state = step(f.state, f.principals.landlord_a, 'source').state;
  f.state.invitations.push({ id: 'inv-1', workspace_id: 'ws-a', work_order_id: 'wo-1', partner_id: 'company-a', status: 'sent' });
  return f;
}
function fixedAssignment() {
  const f = sourced('cleaning');
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
  const { state, principals } = sourced('cleaning');
  assert.equal(state.service_agreements[0].trade, 'cleaning');
  const assigned = step(state, principals.landlord_a, 'assign', { partner_id: 'company-a', agreement_id: 'agreement-a' });
  const snapshot = assigned.state.assignments[0].agreement_snapshot;
  assert.equal(snapshot.price_twd, 1500);
  assert.equal(snapshot.version, 1);
  assigned.state.service_agreements[0].price_twd = 9999;
  assert.equal(snapshot.price_twd, 1500);
  assert.equal(state.assignments.length, 0);
  assert.throws(() => step(state, principals.company_a_manager, 'assign', { partner_id: 'company-a', agreement_id: 'agreement-a' }), fails('FORBIDDEN'));
});

test('fixed_price_requires_matching_trade_property_and_latest_active_version', () => {
  const f = sourced('cleaning');
  const assign = s => step(s, f.principals.landlord_a, 'assign', { partner_id: 'company-a', agreement_id: 'agreement-a' });
  f.state.service_agreements[0].trade = 'other';
  assert.throws(() => assign(f.state), fails('INVALID_AGREEMENT'));
  f.state.service_agreements[0].trade = 'cleaning';
  f.state.service_agreements[0].property_id = 'different';
  assert.throws(() => assign(f.state), fails('INVALID_AGREEMENT'));
  f.state.work_orders[0].property_id = 'different';
  f.state.service_agreements.push({ ...f.state.service_agreements[0], id: 'agreement-revision-2',
    agreement_id: 'agreement-a', version: 2, active: false });
  assert.throws(() => assign(f.state), fails('INVALID_AGREEMENT'));
  f.state.service_agreements[1].active = true;
  f.state.service_agreements[1].price_twd = 1700;
  assert.equal(assign(f.state).state.assignments[0].agreement_snapshot.version, 2);
});

test('work_order_creation_preserves_property_scope_for_fixed_price', () => {
  const { state, principals } = createSyntheticFixtures();
  const created = transitionWorkOrder(state, principals.landlord_a, 'create', {
    id: 'scoped-cleaning', title: 'Cleaning', trade: 'cleaning', area: 'North', property_id: 'p1' }, now).state;
  assert.equal(created.work_orders[0].property_id, 'p1');
});

test('repair_assignment_requires_approved_quote_even_with_fixed_price_agreement', () => {
  const { state, principals } = sourced();
  const before = structuredClone(state);
  const input = { partner_id: 'company-a', agreement_id: 'agreement-a' };
  assert.throws(() => step(state, principals.landlord_a, 'assign', input), fails('QUOTE_REQUIRED'));
  assert.deepEqual(state, before);
  state.quotes.push({ id: 'quote-repair', workspace_id: 'ws-a', work_order_id: 'wo-1',
    partner_id: 'company-a', version: 1, status: 'submitted', total_twd: 1200,
    expires_at: '2026-10-09T04:00:00.000Z' });
  const withQuote = { ...input, quote_id: 'quote-repair' };
  const unapproved = structuredClone(state);
  assert.throws(() => step(state, principals.landlord_a, 'assign', withQuote), fails('QUOTE_NOT_APPROVED'));
  assert.deepEqual(state, unapproved);
  state.quotes[0].status = 'approved';
  const assigned = step(state, principals.landlord_a, 'assign', withQuote).state;
  assert.equal(assigned.work_orders[0].status, 'assigned');
  assert.equal(assigned.assignments[0].quote_id, 'quote-repair');
  assert.equal(assigned.assignments[0].approved_amount_twd, 1200);
  assert.equal('agreement_snapshot' in assigned.assignments[0], false);
});

test('completion_waits_for_landlord_acceptance', () => {
  const f = fixedAssignment();
  let state = step(f.state, f.principals.company_a_worker, 'start').state;
  state = step(state, f.principals.company_a_worker, 'complete', { description: 'Synthetic cleaning complete', actual_amount_twd: 1500 }).state;
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
  const f = sourced('cleaning');
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
