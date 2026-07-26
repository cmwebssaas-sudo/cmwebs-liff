# CMWebs Product Roadmap (Authoritative)

Status: **Authoritative product direction**

Owner: CMWebs product leadership
Last updated: 2026-07-27 (Asia/Taipei)

## Purpose and scope

This is the product boundary for CMWebs. It is the starting point for future
ChatGPT/Codex work and takes precedence over older V3/V4 planning documents
when their scope or sequence conflicts. It does not authorize a deployment,
Production-data change, or feature implementation.

## Supersedes earlier plans

This roadmap supersedes conflicting V2.1/V3/V4 sequencing and scope in
[12-ROADMAP-V2-V4.md](12-ROADMAP-V2-V4.md) where it conflicts. The earlier
document remains historical context. In particular, V2.1 is a bounded internal
completion phase, V3 is a standardized landlord-owned-LINE-OA platform, and V4
AI growth work follows the V3 foundation.

## Permanent product principles

1. CMWebs maintains one shared core program, one set of business rules, and
   one standard UI structure.
2. One release upgrades all customers; adding customers must not create
   proportional maintenance work.
3. There are no customer-specific functions, workflows, fields, pages, or code
   branches.
4. Standardized branding is limited to system name, logo, approved brand
   colors, and contact information.
5. Each landlord uses and owns its own LINE Official Account (OA), brand, and
   customer relationship. CMWebs does not send landlord messages from a shared
   CMWebs OA.
6. Personal LINE may remain for manual communication, but Messaging API
   automation requires the landlord's LINE OA.
7. CMWebs owns the core software, deployment, updates, automation,
   subscription, and module licensing.

## V2.0 — Production Baseline

**Customer:** CMWebs's own managed properties only.

V2.0 is the current internal Production baseline. It provides the operational
rental-management core: landlord and tenant
flows, billing, arrears, reminders, repair, contracts, RBAC, Workspace
isolation, and LINE flows. The V2 objective is reliable internal Production
operations, not a configurable commercial product.

V2.0 accepts only genuine Production blockers, correctness fixes, and stability
repairs. Its serving and rollback versions are recorded only in verified
release evidence and [CMWEBS_CURRENT_STATE.md](CMWEBS_CURRENT_STATE.md); this
roadmap never infers them.

## V2.1 — Internal Operations Completion

V2.1 is the next approved, bounded internal-operations phase. It begins only
after the repository's current Production Consolidation/Gate 0 requirements
are satisfied and an implementation is separately authorized. It is not a V3
or V4 expansion.

### A. Performance consolidation

1. Instrument the critical LIFF/API/Apps Script path before optimizing it.
2. Reduce repeated LIFF initialization where this is safe and measurable.
3. Consolidate multiple API calls into intentional page-bootstrap requests.
4. Use short-lived, Workspace-scoped caching where correctness permits.
5. Reduce repeated full-Sheet scans and reuse safe request-scoped reads.
6. Replace `Date.now()` cache busting with stable release versions or hashes.

These priorities must preserve Workspace isolation, RBAC, billing correctness,
and current Production stability.

### B. Fixed graphical operational reporting

V2.1 delivers one standard reporting set only:

1. Current-month receivable, collected, unpaid, and collection rate.
2. Rolling 12-month receivable, collected, and arrears trends.
3. Arrears ageing buckets.
4. Occupied, vacant, and inactive room distribution with occupancy rate.
5. 30/60/90-day contract expirations and repair-work-order status.

There is no custom report builder and no customer-specific dashboard.

### C. Digital contract workflow

V2.1 includes standard contract generation from system data, landlord preview,
tenant online reading and confirmation, an immutable/fixed contract PDF,
upload of a signed document or signature page, landlord review, version/
timestamp/audit history, and activation into billing.

V2.1 does not build a full legal electronic-signature evidence system from
scratch. Third-party electronic-signature integration belongs to V3.

### D. Operational stability completion

- Backups and restore procedures.
- A controlled Production data-correction workflow and incident runbook.
- One complete real billing cycle.
- One verified renewal, termination/move-out, repair flow, and new-contract
  flow.

After these four V2.1 areas complete, record `V2_FEATURE_FREEZE = FINAL`.
No further V2 feature expansion is allowed; later V2 work is limited to genuine
Production blockers, correctness fixes, and stability repairs.

## V3 — Standardized Commercial Multi-tenant SaaS

**Promise:** keep each landlord's existing LINE relationship and upgrade it
into a smart rental-management system.

V3 commercializes one standardized CMWebs product. The shared core program,
UI structure, business rules, and upgrade stream apply to every customer. A
new customer must not create proportional maintenance work.

### LINE and identity model

- Each landlord brings and continues to use their existing LINE Official
  Account (BYO LINE OA).
- The landlord retains its existing OA, friends, conversations, trust, brand,
  and customer relationship.
- CMWebs never sends landlord messages from a shared CMWebs OA.
- Personal LINE is for manual communication only; it cannot be used for
  Messaging API automation.
- The landlord OA sends all automated landlord messages.
- A central LINE Channel Registry maps approved OA, LIFF, and Workspace
  configuration dynamically, without customer-specific code branches.

### Standardization model

- Branding may vary only through the system name, logo, approved theme colors,
  and contact information.
- Functionality is not customizable: no tenant-specific feature, workflow,
  field, or layout customization.
- One release upgrades all customers; exceptions must not fork the product.
- Workspace/OA configuration is dynamic and protected by `workspace_id`, RBAC,
  and Workspace isolation.

### Commercial and platform foundation

- Subscription, room limits, provisioning, migration, monitoring, backup, and
  entitlement control are V3 platform capabilities.
- Automated provisioning and suspension, centralized releases, schema
  migration, health checks, and commercial frontend hosting are V3 capabilities.
- Third-party electronic-signature integration belongs to V3.
- The initial multi-tenant environment is centrally operated and logically
  isolated by `workspace_id`, RBAC, and Workspace isolation.
- A physically isolated Enterprise data deployment may be offered later as an
  optional standardized tier, not as an ad-hoc customer branch.
- Each landlord pays its own LINE message-plan costs.

V3 construction must not destabilize the serving V2 Production system.

## V4 — Modular LINE Business Platform and AI Growth Engine

V4 builds standardized modules on the proven V3 identity, customer, team,
notification, billing, and audit core. No V4 module may introduce
customer-specific code branches.

### V4A — Standardized business modules

Standardized Booking, Appointment, and CRM modules use the same LINE identity,
customer, team, notification, billing, and audit foundation.

### V4B — AI listing and growth engine

The original AI listing/social/video vision remains a product goal after the
V3 platform foundation:

- AI property and product listing copy;
- AI images and short-video generation;
- content repurposing and social distribution;
- creator/KOL collaboration;
- trackable links and coupon codes; and
- conversion-based revenue sharing.

All V4 modules are standardized products, not bespoke customer development.

## Product sequencing and guardrails

```text
V2.0 internal Production baseline
  -> V2.1 bounded internal operations completion
  -> V2_FEATURE_FREEZE = FINAL
  -> V3 standardized multi-tenant platform and BYO LINE OA foundation
  -> V4A standardized LINE business modules
  -> V4B AI listing, video, social, and growth engine
```

Before accepting new work, classify it against this sequence. If it would add
commercial customization, a shared CMWebs landlord OA, or a V4 feature to V2,
stop and obtain an explicit product decision.

## New-conversation handoff

Copy and paste this block when starting a new ChatGPT/Codex conversation:

```text
PROJECT: CMWebs 智能租管
REPOSITORY: cmwebs-liff
AUTHORITATIVE PRODUCT DOCS:
- docs/CMWEBS_PRODUCT_ROADMAP.md
- docs/CMWEBS_ARCHITECTURE_DECISIONS.md
- docs/CMWEBS_CURRENT_STATE.md
- docs/CMWEBS_RELEASE_RULES.md
- docs/CMWEBS_CHANGELOG.md

Before any CMWebs task, read the authoritative roadmap, current state,
architecture decisions, and release rules. Read AGENTS.md as well. Preserve V2
Production stability. State the requested scope, V2.0/V2.1/V3/V4
classification, and whether an action touches Production. For every proposed
Codex handoff, state a recommended model and speed (for example:
gpt-5.6-terra, medium) before execution.
```
