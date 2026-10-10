# Phase 114 — Production Workspace Isolation Verification

Date: 2026-07-23  
Decision: **NO-GO — final isolation evidence has not been collected**

## Scope and safety boundary

This verification plan proves that the selected Production release candidate
preserves Workspace and role isolation. It makes no Production change: no
deployment, Property/Sheet/token mutation, trigger change, queue write, LINE
send, commit, or push.

Execution uses two independent disposable staging Workspaces and authenticated
test principals. Production is limited to a read-only, sanitized check that the
same RC/environment boundaries are selected. Do not record personal data,
complete identifiers, tokens, or secret values.

## 1. Workspace isolation matrix

### Fixture boundary

```text
Workspace A
  ├─ landlord A
  └─ tenant A

Workspace B
  ├─ landlord B
  └─ tenant B
```

Every principal must use a distinct authenticated context and must have one
canonical Workspace membership/tenant chain. Do not use Production people or
records.

| Principal | Allowed same-Workspace operation | Expected same-Workspace result | Forbidden operation | Expected denial | Evidence status |
| --- | --- | --- | --- | --- | --- |
| Landlord A | Read authorized Workspace A properties, contracts, bills, and limited tenant projection. | ✅ PASS — only policy-approved A fields. | Read Workspace B data or invoke tenant-only route. | ❌ DENY before projection; no B metadata. | PENDING |
| Tenant A | Read own A home, bills, contract, and authorized messages. | ✅ PASS — only Tenant A canonical chain. | Read Tenant B/Workspace B or invoke landlord route. | ❌ DENY before projection; no B metadata. | PENDING |
| Landlord B | Read authorized Workspace B properties, contracts, bills, and limited tenant projection. | ✅ PASS — only policy-approved B fields. | Read Workspace A data or invoke tenant-only route. | ❌ DENY before projection; no A metadata. | PENDING |
| Tenant B | Read own B home, bills, contract, and authorized messages. | ✅ PASS — only Tenant B canonical chain. | Read Tenant A/Workspace A or invoke landlord route. | ❌ DENY before projection; no A metadata. | PENDING |
| Invalid/expired principal | No protected route. | ❌ DENY before resolver/Sheet access. | Any role/Workspace target. | ❌ DENY without fallback. | PENDING |

Acceptance rule: every same-Workspace allow must pass and every cross-
Workspace/cross-role request must deny closed. One data or projection metadata
leak is an immediate NO-GO.

## 2. RBAC verification

### Landlord routes

For every included landlord route, verify server-side controls in this order:

1. **Authentication identity** — verified LINE/OAuth identity maps to an
   active landlord/user context; client-supplied actor identity is ignored.
2. **Workspace validation** — requested `workspace_id`, when present, must
   match the server-resolved active Workspace context.
3. **Membership validation** — an active membership authorizes the requested
   Workspace; missing/duplicate/conflicting membership fails closed.
4. **Role/permission validation** — owner/manager/maintenance/finance/viewer
   permissions are checked for the specific action; unmapped policy fails
   closed (`RBAC_POLICY_MISSING` or equivalent).
5. **Resource chain validation** — property, room, contract, bill, message,
   and notification recipient all belong to the same resolved Workspace.

| Landlord control | Expected result | Evidence status |
| --- | --- | --- |
| `workspace_id` validation | A caller cannot select another Workspace by changing request input. | PENDING |
| Membership validation | Inactive/missing/ambiguous membership denies before query/projection. | PENDING |
| Role validation | Least privilege applies per route/action; unauthorized role denies. | PENDING |
| Resource ownership | Nested resource ID must resolve inside same authorized Workspace. | PENDING |
| Failure behavior | No first-row fallback, partial payload, or cross-Workspace metadata. | PENDING |

### Tenant routes

| Tenant control | Expected result | Evidence status |
| --- | --- | --- |
| Tenant identity ownership | Verified identity resolves exactly one canonical tenant chain or fails closed. | PENDING |
| Tenant/contract/property/room chain | Every object has consistent tenant and `workspace_id` relationship. | PENDING |
| Caller-supplied IDs | Alternate tenant/contract/property/room IDs cannot override server identity. | PENDING |
| Landlord route access | Tenant cannot invoke a landlord-only route even if a Workspace ID is known. | PENDING |
| Failure behavior | No fallback to a similarly named/first tenant row or other tenant's view. | PENDING |

## 3. Cross-Workspace attack simulation

All requests below are against disposable staging fixtures, with an identical
candidate route/policy set. Record only route/action, masked fixture label,
status/code, and redacted logs.

| Attack simulation | Caller | Mutation / request change | Expected response | Pass criteria |
| --- | --- | --- | --- | --- |
| Workspace replacement | Landlord A or Tenant A | Replace `workspace_id` with Workspace B. | Fail closed: `WORKSPACE_ACCESS_DENIED` or equivalent. | No B rows, projection, or metadata. |
| User replacement | Authenticated A principal | Supply B `user_id` / actor identifier. | Fail closed; verified identity remains authoritative. | No B lookup before denial. |
| Tenant replacement | Tenant A / Landlord A | Supply Tenant B `tenant_id`. | Fail closed unless route is explicitly A-authorized and B belongs to A (it does not in fixture). | No B tenant payload. |
| Contract/property/room replacement | A principal | Supply B nested resource ID. | Fail closed at Workspace/resource-chain validation. | No B metadata. |
| Membership omission | Principal without membership | Omit or use invalid Workspace context. | Fail closed; no first-row/default Workspace fallback. | No data read/projection. |
| Role downgrade/upgrade | Viewer/tenant | Attempt owner/manager/write route. | Fail closed by RBAC. | No write, queue job, or notification. |
| Expired/invalid token | Any principal | Use invalid authentication. | Fail before resolver/Sheet access. | No data/projection/log secret. |

## 4. Notification isolation

Notification behavior must inherit the server-resolved Workspace and recipient
chain. A caller must never select an arbitrary recipient or Workspace through
event payload.

| Scenario | Expected isolation requirement | Evidence status |
| --- | --- | --- |
| Workspace A event | At most one A-scoped queue lineage/recipient resolution is created. | PENDING — mock/staging proof required. |
| Workspace A event targeting B recipient | Deny before queue creation; do not create B notification. | PENDING |
| Workspace A event with B `workspace_id` | Deny before queue creation; no B queue/log entry. | PENDING |
| Tenant A event | Recipient resolution stays within authorized A landlord/team scope. | PENDING |
| B event | Cannot read, modify, enqueue, or deliver against A queue/log/recipient. | PENDING |
| Duplicate/cross-role event | Idempotency/dedupe does not accidentally coalesce across Workspaces. | PENDING |

Production notification queue/worker remains disabled until the notification
schema, mock recovery, feature gate, trigger owner, Messaging channel, and this
isolation proof all pass.

## 5. Release gate update

### GO — PASS conditions

All of the following must have dated, sanitized evidence:

- [ ] Landlord A/B and Tenant A/B same-Workspace allow cases pass.
- [ ] Every cross-Workspace and cross-role case denies before projection.
- [ ] Landlord `workspace_id`, membership, and RBAC policy checks pass for all
      included landlord routes.
- [ ] Tenant ownership chain and caller-supplied ID protections pass for all
      included tenant routes.
- [ ] Notification recipient/queue isolation passes using mock staging events.
- [ ] Exact Production RC hash/artifact contains the verified policy/runtime
      code; Production/staging environment separation is confirmed.

### NO-GO

Any of the following blocks release immediately:

- A landlord reads another Workspace or unauthorized tenant data.
- A tenant reads another tenant/Workspace or invokes a landlord API.
- `workspace_id`, user, tenant, or nested resource replacement produces data,
  a partial projection, or metadata from another scope.
- Missing/ambiguous membership/identity falls back to a default/first row.
- A Workspace A event can produce a Workspace B notification/recipient/job.
- Authentication failure resolves a tenant/landlord/Workspace before denial.

### Current status

**NO-GO.** Static validation passes, but real two-Workspace route and
notification-isolation evidence has not been captured against disposable
staging fixtures, and the Production environment/RC is not frozen.

## Validation record

Run `npm run validate`, the staging validator, and `git diff --check` for this
Phase. Passing static checks is necessary but is not substitute evidence for
the matrix or attack simulations above.
