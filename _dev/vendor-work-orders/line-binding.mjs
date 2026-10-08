import { createHash, randomBytes, randomUUID } from 'node:crypto';
const fail = code => { throw Object.assign(new Error(code), { code }); };
const hash = value => createHash('sha256').update(value).digest('hex');
function time(now) { if (!Number.isSafeInteger(now) || now < 0) fail('INVALID_TIME'); return now; }
function authorize(state, principal, partnerId) {
  if (principal?.role !== 'landlord' || !state.workspace_memberships.some(m => m.active === true &&
    m.workspace_id === principal.workspace_id && m.actor_id === principal.actor_id && m.permissions.includes('work_order_dispatch')) ||
    !state.workspace_partners.some(p => p.active === true && p.workspace_id === principal.workspace_id && p.partner_id === partnerId) ||
    !state.partners.some(p => p.id === partnerId && p.active === true)) fail('FORBIDDEN');
}
/** Pure transitions. verified_identity must come from the server's LINE verifier,
 * never from a public request body. Persistence/API integration is a separate gate. */
export function createBindingInvite(state, principal, input, now) {
  time(now); authorize(state, principal, input?.partner_id);
  if (!['manager', 'worker', 'contact'].includes(input.member_role)) fail('INVALID_MEMBER');
  const token = randomBytes(32).toString('base64url');
  const invite = { id: randomUUID(), workspace_id: principal.workspace_id, partner_id: input.partner_id,
    member_role: input.member_role, token_hash: hash(token), expires_at: now + 86400000, status: 'pending', created_at: now };
  const next = structuredClone(state); next.line_binding_invites.push(invite);
  return { state: next, token, invite: structuredClone(invite) };
}
export function requestBinding(state, { token, verified_identity: identity }, now) {
  time(now);
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) fail('INVALID_INVITE');
  if (!identity || ['provider_id', 'subject'].some(k => typeof identity[k] !== 'string' || !identity[k].trim() || identity[k].length > 256)) fail('INVALID_IDENTITY');
  const next = structuredClone(state), invite = next.line_binding_invites.find(i => i.token_hash === hash(token));
  if (!invite) fail('INVALID_INVITE');
  if (invite.status === 'revoked') fail('INVITE_REVOKED');
  if (invite.status !== 'pending') fail('INVITE_USED');
  if (invite.expires_at <= now) fail('INVITE_EXPIRED');
  const request = { id: randomUUID(), invite_id: invite.id, workspace_id: invite.workspace_id, partner_id: invite.partner_id,
    member_role: invite.member_role, identity: { provider_id: identity.provider_id, subject: identity.subject }, status: 'awaiting_approval', created_at: now };
  invite.status = 'used'; next.line_binding_requests.push(request);
  return { state: next, request: structuredClone(request) };
}
export function approveBinding(state, principal, requestId, now) {
  time(now); const next = structuredClone(state), request = next.line_binding_requests.find(r => r.id === requestId);
  if (!request) fail('NOT_FOUND');
  if (request.workspace_id !== principal?.workspace_id) fail('FORBIDDEN');
  authorize(next, principal, request.partner_id);
  if (request.status !== 'awaiting_approval') fail('INVALID_TRANSITION');
  const invite = next.line_binding_invites.find(i => i.id === request.invite_id);
  if (!invite || invite.status === 'revoked') fail('INVITE_REVOKED');
  if (invite.expires_at <= now) fail('INVITE_EXPIRED');
  const actor_id = 'line-' + hash(JSON.stringify([request.identity.provider_id, request.identity.subject]));
  if (next.partner_memberships.some(m => m.actor_id === actor_id && m.workspace_id === request.workspace_id && m.partner_id === request.partner_id)) fail('ALREADY_BOUND');
  const membership = { actor_id, workspace_id: request.workspace_id, partner_id: request.partner_id, member_role: request.member_role, active: true };
  next.partner_memberships.push(membership); request.status = 'approved'; request.approved_at = now; request.actor_id = actor_id;
  return { state: next, membership: structuredClone(membership) };
}
export function revokeBindingInvite(state, principal, inviteId, now) {
  time(now); const next = structuredClone(state), invite = next.line_binding_invites.find(i => i.id === inviteId);
  if (!invite) fail('NOT_FOUND');
  if (invite.workspace_id !== principal?.workspace_id) fail('FORBIDDEN');
  authorize(next, principal, invite.partner_id); invite.status = 'revoked'; invite.revoked_at = now;
  return next;
}
