# CMWebs Product Roadmap (Authoritative)

Status: **Authoritative product direction**

Owner: CMWebs product leadership
Last updated: 2026-07-27 (Asia/Taipei)

## Purpose and scope

This is the product boundary for CMWebs. It is the starting point for future
ChatGPT/Codex work and takes precedence over older V3/V4 planning documents
when their scope or sequence conflicts. It does not authorize a deployment,
Production-data change, or feature implementation.

## Supersedes earlier V3/V4 plans

This roadmap supersedes the V3/V4 sequencing and scope in
[12-ROADMAP-V2-V4.md](12-ROADMAP-V2-V4.md) where it conflicts. The earlier
document remains historical context. In particular, V3 is now explicitly a
standardized, landlord-owned-LINE-OA platform; V4 AI growth work follows that
foundation.

## V2 — Internal Production Operations

**Customer:** CMWebs's own managed properties only.

V2 provides the operational rental-management core: landlord and tenant
flows, billing, arrears, reminders, repair, contracts, RBAC, Workspace
isolation, and LINE flows. The V2 objective is reliable internal Production
operations, not a configurable commercial product.

Allowed V2 work is limited to Production blockers, performance, reliability,
security/isolation verification, regression coverage, and operational QA.
Do not add V3 or V4 product expansion to V2.

### V2 performance-consolidation priorities

1. Instrument the critical LIFF/API/Apps Script path before optimizing it.
2. Make each page bootstrap through one intentional request boundary.
3. Use short-lived, Workspace-scoped caching where correctness permits.
4. Use stable build-version cache keys and invalidate them deliberately.
5. Reduce repeated full-Sheet scans and reuse safe request-scoped reads.

These priorities must preserve Workspace isolation, RBAC, billing correctness,
and current Production stability. They are not permission to introduce a new
V3 data platform inside V2.

## V3 — Standardized Commercial Multi-tenant SaaS

**Promise:** keep each landlord's existing LINE relationship and upgrade it
into a smart rental-management system.

V3 commercializes one standardized CMWebs product. The shared core program,
UI structure, business rules, and upgrade stream apply to every customer. A
new customer must not create proportional maintenance work.

### LINE and identity model

- Each landlord brings and continues to use their existing LINE Official
  Account (BYO LINE OA).
- The landlord owns the LINE OA, brand, and customer relationship.
- CMWebs never sends landlord messages from a shared CMWebs OA.
- Personal LINE is for manual communication only; it cannot be used for
  Messaging API automation.
- A central LINE Channel Registry maps approved Workspace/OA configuration
  dynamically, without customer-specific code branches.

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

- AI property and product listing generation;
- short-video generation;
- social distribution;
- creator/KOL collaboration;
- trackable links and coupon codes; and
- conversion-based revenue sharing.

All V4 modules are standardized products, not bespoke customer development.

## Product sequencing and guardrails

```text
V2 internal operational reliability
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

Read AGENTS.md and the five docs first. Preserve V2 Production stability.
State the requested scope, the V2/V3/V4 classification, and whether an action
touches Production. For every proposed Codex handoff, state a recommended
model and speed (for example: gpt-5.6-terra, medium) before execution.
```
