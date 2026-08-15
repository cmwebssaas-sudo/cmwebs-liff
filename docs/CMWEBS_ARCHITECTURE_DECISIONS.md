# CMWebs Architecture Decisions

**Status: AUTHORITATIVE**
**Last updated: 2026-07-29 (Asia/Taipei)**

## Supersedes

These decisions supersede any older V3/V4 proposal that assumes a shared CMWebs
LINE OA, customer-specific branches, or feature customization.

## Permanent decisions

1. The landlord owns its LINE OA, brand, and customer relationship.
2. CMWebs owns core software, deployment, updates, automation, subscription,
   and module licensing.
3. V3 uses BYO LINE OA. CMWebs does not impersonate a landlord through a
   shared OA; personal LINE is manual communication only.
4. Branding may be configured only through standardized name, logo, approved
   colors, and contact information. Functionality is not customizable.
5. A single core program, UI structure, business-rule set, and upgrade stream
   serve all customers. A release must upgrade all customers.
6. `workspace_id`, RBAC, and Workspace isolation are mandatory control points
   for centralized multi-tenant data. Enterprise physical isolation is a later,
   optional deployment model.
7. Production secrets live in Apps Script Properties and must never be stored
   in Git, documentation, URLs, browser storage, or console output.
8. Existing V2 Production is isolated from V3 construction. Apps Script and
   GitHub Pages are independently released and independently rolled back.
9. New customers and new modules must remain standardized; no customer-specific
   code branch, workflow, field, or layout is allowed.
10. Every future Codex handoff states recommended model and speed, current
    authoritative source, release surface, risk, and rollback reference.

## Canonical source decision

The immutable Apps Script Version 85 snapshot is retained in GitHub `main`
under `apps-script/` as the V2 internal-beta canonical backend baseline. It is
not permission to deploy the current editor source. Serving deployment identity
and immutable rollback remain separate Production evidence.

## V2.1 native contract-signing boundary

- The backend-derived `signing_mode` is the only source of truth for a signing
  session. The browser must not select the mode or supply tenant, Workspace,
  landlord, or LINE identity as write authority.
- A normal renewal is a condition-confirmation and signature flow. It does not
  repeat new-tenant onboarding, identity-image upload, tenant/room/Workspace
  creation, or LINE binding.
- A future renewal record/version links to its immutable predecessor through
  `previous_contract_id` or `renewed_from_contract_id`; a changed actual
  tenant, name, or identity is a re-contract exception, not normal renewal.
- New-tenant signing may require the approved identity artifacts and signature;
  renewal permits only the signature artifact. Identity or actual-tenant
  changes are exception/re-sign flows, not normal renewal.
- Tokens, identity images, signatures, Drive identifiers, and internal metadata
  stay out of URLs, browser storage, and console output. Private artifact
  storage must fail closed when its required schema is absent.
- The signing read model returns only fields from the server-resolved signable
  contract and, for a renewal, its same-tenant, same-Workspace linked
  predecessor. Missing full-contract content or predecessor linkage is shown as
  unavailable; the browser must not invent either.
- The native final action records a tenant signing submission only after a
  verified session, consent, and required stored artifacts. It preserves
  `contract_status`, is idempotent after a successful submission, and fails
  closed when the explicit signing-audit schema is absent. It is not a contract
  activation, approval, or status-transition mechanism.

## V2.1 native landlord signing-review candidate

This local candidate adds the post-submission review step without changing the
native queue object: a submitted item remains the canonical `V2_contracts` row,
not a `V2_contract_requests` or legacy-integration record.

- The `V2_contracts` review audit schema is append-only and idempotent. Its
  required fields are `tenant_signing_reviewed_at`,
  `tenant_signing_reviewed_by_user_id`,
  `tenant_signing_reviewed_by_membership_id`, and
  `tenant_signing_review_note`. A missing schema fails closed; this document
  does not authorize migration of any Production spreadsheet.
- Native landlord-review read and write routes require a short-lived,
  server-verified LINE session bound to the active V2 user, Workspace membership
  and Workspace. A raw URL `line_user_id` cannot authorize these routes.
- The approval/rejection write obtains `ScriptLock`, re-reads the contract
  inside the lock, enforces the existing Workspace `contract_write` policy and
  preserves the final-decision idempotency boundary. Approval revalidates the
  required stored artifacts before changing `contract_status` to `active`.
- Rejection preserves the existing signable contract status and records
  `tenant_signing_submission_status=rejected`; the tenant may resubmit through
  the existing verified native session and artifact path. Neither outcome calls
  LINE, Make, the legacy signed-contract bridge, or an external e-sign service.
