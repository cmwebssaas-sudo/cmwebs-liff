# CMWebs Codex Handoff (Authoritative)

Project: CMWebs 智能租管 / `cmwebs-liff`

Before beginning a task, read `AGENTS.md` and these authoritative records:

- `docs/CMWEBS_PRODUCT_ROADMAP.md`
- `docs/CMWEBS_CURRENT_STATE.md`
- `docs/CMWEBS_ARCHITECTURE_DECISIONS.md`
- `docs/CMWEBS_RELEASE_RULES.md`
- `docs/CMWEBS_CHANGELOG.md`

State the recommended Codex model and speed before execution. Default for
bounded repository work: `gpt-5.6-terra`, `medium`.

## Product boundary

- **V2.0** is the current internal Production baseline. Only genuine blockers,
  correctness fixes, and stability repairs are in scope.
- **V2.1** begins only after Gate 0/Production Consolidation and separate
  authorization. It is limited to performance consolidation, fixed graphical
  operational reporting, a standard digital-contract closed loop, and
  backup/restore/Runbook/real operating-cycle verification. After completion,
  record `V2_FEATURE_FREEZE = FINAL`.
- **V3** is standardized multi-tenant SaaS. Each landlord brings and uses its
  own LINE OA; CMWebs never sends landlord messages through a shared OA.
  Branding is limited to name, logo, approved colors, and contact information.
  There is no customer-specific function, workflow, field, page, layout, or
  code branch. V3 includes subscriptions, room limits, Channel Registry,
  automated provisioning, centralized upgrades, and third-party e-signature
  integration.
- **V4** builds standardized Booking, Appointment, CRM, AI copy/image/short
  video, social distribution, KOL or micro-creator, tracked-link, coupon, and
  conversion-revenue-share modules on V3.

## Permanent rules

One shared core, one set of business rules, and one upgrade stream serve every
customer. New customers must not create proportional maintenance work. Branding
may be configured; functionality may not be customized.

## Production safety

Do not infer current Production state from historical documentation. Without
separate explicit authorization, do not change Production data, Script
Properties, triggers, LINE settings, credentials, deployments, GitHub Pages,
or external accounts. A documentation-only update does not authorize runtime
implementation or release action.
