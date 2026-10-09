export function authorizedActor(state, actor) {
  if (!actor || !['landlord', 'vendor'].includes(actor.role)) return null;
  if (actor.role === 'landlord') {
    const membership = state.workspace_memberships.find(row => row.actor_id === actor.actor_id && row.workspace_id === actor.workspace_id && row.active === true);
    return membership ? { ...actor, permissions: [...(membership.permissions || [])] } : null;
  }
  const membership = state.partner_memberships.find(row => row.actor_id === actor.actor_id && row.workspace_id === actor.workspace_id && row.partner_id === actor.partner_id && row.active === true);
  const partner = state.partners.find(row => row.id === actor.partner_id && row.active === true);
  const link = state.workspace_partners.some(row => row.workspace_id === actor.workspace_id && row.partner_id === actor.partner_id && row.active === true);
  return membership && partner && link ? { ...actor, member_role: membership.member_role, partner_type: partner.type } : null;
}
