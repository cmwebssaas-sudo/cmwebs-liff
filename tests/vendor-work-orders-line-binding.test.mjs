import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyntheticFixtures } from '../_dev/vendor-work-orders/fixtures.mjs';
import { createBindingInvite, requestBinding, approveBinding, revokeBindingInvite } from '../_dev/vendor-work-orders/line-binding.mjs';
const now = Date.parse('2026-10-08T00:00:00Z');
function fixture() { const f = createSyntheticFixtures(); return { ...f, state: { ...f.state, line_binding_invites: [], line_binding_requests: [] } }; }
const identity = { provider_id: 'test-provider', subject: 'synthetic-subject' };
test('invite stores only hash and requests require landlord approval', () => {
  const f = fixture(); const issued = createBindingInvite(f.state, f.principals.landlord_a, { partner_id: 'company-a', member_role: 'worker' }, now);
  assert.equal(JSON.stringify(issued.state).includes(issued.token), false);
  const pending = requestBinding(issued.state, { token: issued.token, verified_identity: identity }, now);
  assert.equal(pending.state.partner_memberships.length, f.state.partner_memberships.length);
  const approved = approveBinding(pending.state, f.principals.landlord_a, pending.request.id, now);
  assert.equal(approved.membership.member_role, 'worker');
  assert.equal(approved.membership.active, true);
  assert.throws(() => requestBinding(pending.state, { token: issued.token, verified_identity: identity }, now), /INVITE_USED/);
});
test('rejects expired, revoked, cross-workspace and forged authority without mutation', () => {
  const f = fixture(); const before = JSON.stringify(f.state);
  assert.throws(() => createBindingInvite(f.state, f.principals.company_a_worker, { partner_id: 'company-a', member_role: 'manager' }, now), /FORBIDDEN/);
  assert.throws(() => createBindingInvite(f.state, f.principals.landlord_b, { partner_id: 'company-a', member_role: 'worker' }, now), /FORBIDDEN/);
  const issued = createBindingInvite(f.state, f.principals.landlord_a, { partner_id: 'company-a', member_role: 'worker' }, now);
  assert.throws(() => requestBinding(issued.state, { token: issued.token, verified_identity: identity }, now + 86400000), /INVITE_EXPIRED/);
  const revoked = revokeBindingInvite(issued.state, f.principals.landlord_a, issued.invite.id, now);
  assert.throws(() => requestBinding(revoked, { token: issued.token, verified_identity: identity }, now), /INVITE_REVOKED/);
  const pending = requestBinding(issued.state, { token: issued.token, verified_identity: identity }, now);
  assert.throws(() => approveBinding(pending.state, f.principals.landlord_b, pending.request.id, now), /FORBIDDEN/);
  assert.equal(JSON.stringify(f.state), before);
});
