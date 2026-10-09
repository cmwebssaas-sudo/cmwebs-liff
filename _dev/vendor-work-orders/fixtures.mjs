import { createInitialState } from './domain.mjs';

/** Synthetic local fixtures only: no real customers, addresses, LINE IDs or tokens. */
export function createSyntheticFixtures() {
  const state = createInitialState();
  const principals = {
    landlord_a: { actor_id: 'landlord-a', workspace_id: 'ws-a', role: 'landlord' },
    landlord_b: { actor_id: 'landlord-b', workspace_id: 'ws-b', role: 'landlord' },
    company_a_manager: { actor_id: 'manager-a', workspace_id: 'ws-a', role: 'vendor', partner_id: 'company-a' },
    company_a_worker: { actor_id: 'worker-a', workspace_id: 'ws-a', role: 'vendor', partner_id: 'company-a' },
    company_a_worker_2: { actor_id: 'worker-a-2', workspace_id: 'ws-a', role: 'vendor', partner_id: 'company-a' },
    company_a_contact: { actor_id: 'contact-a', workspace_id: 'ws-a', role: 'vendor', partner_id: 'company-a' },
    company_b_worker: { actor_id: 'worker-b', workspace_id: 'ws-b', role: 'vendor', partner_id: 'company-b' },
    individual_worker: { actor_id: 'individual-worker', workspace_id: 'ws-a', role: 'vendor', partner_id: 'individual-a' },
  };
  state.partners = [
    { id: 'company-a', type: 'company', name: 'Synthetic Repair Company A', active: true },
    { id: 'company-b', type: 'company', name: 'Synthetic Cleaning Company B', active: true },
    { id: 'individual-a', type: 'individual', name: 'Synthetic Individual Worker', active: true },
  ];
  state.workspace_memberships = [principals.landlord_a, principals.landlord_b].map(p => ({
    actor_id: p.actor_id, workspace_id: p.workspace_id, active: true,
    permissions: ['work_order_read', 'work_order_dispatch', 'work_order_approve', 'work_order_accept'],
  }));
  state.partner_memberships = Object.values(principals).filter(p => p.role === 'vendor').map(p => ({
    actor_id: p.actor_id, workspace_id: p.workspace_id, partner_id: p.partner_id,
    member_role: p.actor_id === 'manager-a' ? 'manager' : p.actor_id === 'contact-a' ? 'contact' : 'worker', active: true,
  }));
  state.workspace_partners = [
    { workspace_id: 'ws-a', partner_id: 'company-a', active: true },
    { workspace_id: 'ws-b', partner_id: 'company-b', active: true },
    { workspace_id: 'ws-a', partner_id: 'individual-a', active: true },
  ];
  state.service_agreements = [{ id: 'agreement-a', workspace_id: 'ws-a', partner_id: 'company-a',
    title: 'Synthetic fixed-price cleaning', trade: 'cleaning', version: 1, price_twd: 1500, active: true,
    starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-12-31T23:59:59.000Z' }];
  return { state, principals };
}
