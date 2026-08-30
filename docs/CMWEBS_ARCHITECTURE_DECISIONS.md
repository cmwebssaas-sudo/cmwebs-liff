# CMWebs Architecture Decisions

**Status: AUTHORITATIVE**
**Last updated: 2026-08-27 (Asia/Taipei)**

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
- The contract content source is the configured fixed Google Docs template,
  selected by `CMWEBS_CONTRACT_TEMPLATE_DOCUMENT_ID`. Preview replaces only
  canonical placeholders and fails closed when the template cannot be read;
  submission copies the template into the private folder selected by
  `CMWEBS_CONTRACT_SIGNING_DRIVE_ROOT_FOLDER_ID`, writes the signature into the
  supplied text or image signature slot, and records the copy in
  `V2_contract_signing_documents` plus `tenant_signed_document_record_id`.

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

## 2026-08-30 expiry-review renewal candidate

For an active contract ending within 60 calendar days, a daily scheduler may
append exactly one renewal draft with `contract_status=pending_landlord_review`.
The draft inherits the predecessor's stored financial and payment snapshot and
keeps the existing append-only version chain. It is a landlord notification and
review aid only: it does not contact the tenant, replace the previous contract,
or change room pointers. At 30 days, an unconfirmed draft receives one retained
Workspace reminder. The landlord's explicit Workspace-scoped confirmation is
the only step that creates the tenant signing invite. The tenant list exposes
the current contract end date and remaining days; visual warning changes at 60
and 30 days, without altering contract data.

The additive `V2_contracts` fields are `renewal_review_status`,
`renewal_review_prepared_at`, `renewal_review_confirmed_at`, and
`renewal_review_reminded_30d_at`. Missing fields are appended only; existing
headers and historic rows are never rewritten.
The time trigger is installed only by the explicit, idempotent
`contractExpiryRenewalEnsureDailyTrigger_` release step; source publication
alone does not create scheduling state.

## 2026-08-27 renewal contract-history candidate

The approved local candidate uses an append-only contract version chain for
existing tenants. A renewal appends a new `V2_contracts` row with a new
`contract_id`, keeps the same `contract_family_id`, increments
`renewal_sequence`, and links `renewed_from_contract_id`／
`renewed_to_contract_id`. The predecessor's dates, amounts, terms, documents,
and signature evidence are never overwritten or deleted; its lifecycle status
may become `renewed`／`archived` only after the new version is created.

The renewal version carries a complete snapshot of rent, management fee,
deposit, other fixed fee, payment day, terms, and the 30-day expiry
non-renewal offer. The offer is waived only when the non-renewal notice is at
least 30 calendar days before expiry. A notice under 30 days is
`landlord_review`; it does not auto-charge or auto-waive a penalty. Mid-term
early termination remains outside this offer.

Renewal identity documents are optional. When the tenant does not re-upload,
the new version stores immutable `carried_forward` references through
`source_document_id`; a renewal still requires a new signature artifact. New
tenant signing keeps identity documents required. The landlord and tenant
read models expose `contract_history`, and selected landlord history versions
are served as read-only complete contract/signature views.

This is a local V2.1 implementation candidate only. It does not authorize
Production Sheet migration, Apps Script deployment, GitHub Pages publication,
or LINE/mobile UAT.
