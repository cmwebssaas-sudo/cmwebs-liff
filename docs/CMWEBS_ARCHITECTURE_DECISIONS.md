# CMWebs Architecture Decisions (Authoritative)

Status: **Authoritative architecture and product decisions**

Last updated: 2026-07-27 (Asia/Taipei)

## Purpose

These decisions are durable constraints for CMWebs V2–V4. They guide future
design and implementation; they do not independently authorize Production
changes.

## Supersedes earlier V3/V4 decisions

This document supersedes conflicting V3/V4 direction in
[11-ARCHITECTURE-DECISIONS.md](11-ARCHITECTURE-DECISIONS.md) and
[12-ROADMAP-V2-V4.md](12-ROADMAP-V2-V4.md). Earlier ADRs remain applicable
unless replaced below, especially V2's current GitHub Pages + Apps Script +
Sheets boundary and `workspace_id` as the tenancy key.

## Permanent decisions

### ADR-CMW-001 — Ownership boundary

- The landlord owns the LINE OA, brand, and customer relationship.
- CMWebs owns the core software, deployment, updates, automation,
  subscription, and module licensing.

### ADR-CMW-002 — BYO LINE OA, never a shared landlord OA

Every landlord uses its own existing LINE Official Account. CMWebs must never
send landlord messages using a shared CMWebs OA. Personal LINE remains a
manual-communication channel and is not eligible for Messaging API automation.

### ADR-CMW-003 — Configurable branding, standardized functionality

Branding configuration is limited to system name, logo, approved theme colors,
and contact information. Features, workflows, fields, and layouts are not
customer-customizable. There are no customer-specific code branches.

### ADR-CMW-004 — One core and one upgrade stream

CMWebs maintains one shared core program, UI structure, business rules, and
upgrade stream. A release should upgrade all eligible customers. Customer
growth must not produce proportional maintenance work.

### ADR-CMW-005 — Dynamic Workspace/OA configuration

Customer configuration is data/configuration, not a code fork. The central LINE
Channel Registry resolves approved Workspace/OA association dynamically. All
access is constrained by `workspace_id`, RBAC, and Workspace isolation.

### ADR-CMW-006 — Progressive tenancy isolation

V3 begins with centrally managed multi-tenant data protected by `workspace_id`,
RBAC, and Workspace isolation. A physically isolated Enterprise deployment may
be introduced later as a standardized offering, not as a bespoke variant.

### ADR-CMW-007 — Protect serving V2 while building V3

V2 Production is not a proving ground for unbounded V3 migration. V3 work must
be isolated, gated, and reversible; it cannot destabilize existing V2
operations.

### ADR-CMW-008 — V2.0 baseline and V2.1 completion boundary

V2.0 is the serving internal Production baseline and accepts only genuine
Production blockers, correctness fixes, and stability repairs. V2.1 is a
separately gated internal-operations completion phase: performance
consolidation, a fixed standard operational reporting set, the standard digital
contract workflow, and defined operational-stability verification. V3/V4
feature expansion does not belong in V2.

### ADR-CMW-009 — V2.1 performance architecture direction

The V2.1 performance plan is: frontend/backend timing instrumentation; less
repeated LIFF initialization where safe; intentional page-bootstrap requests;
short Workspace-scoped caching; stable release-version/hash cache keys instead
of `Date.now()` cache busting; and fewer full-Sheet scans. Correctness,
authorization, and isolation are release criteria for every optimization.

### ADR-CMW-010 — Standard reporting and contracts are bounded products

V2.1 reporting is exactly one fixed operational reporting set, with no custom
report builder or customer-specific dashboard. V2.1 contracts are the standard
generation, review, immutable-PDF, signed-document upload, audit-history, and
billing-activation workflow. CMWebs will not create a legal electronic-
signature evidence system from scratch; third-party e-signature integration is
a V3 concern.

### ADR-CMW-011 — V2 final feature freeze

After the explicitly listed V2.1 scope completes, record
`V2_FEATURE_FREEZE = FINAL`. No later V2 feature expansion is permitted.
Genuine Production blockers, correctness fixes, and stability repairs remain
permitted under the normal release rules.

### ADR-CMW-012 — Handoff execution contract

Every future Codex handoff must identify the recommended model and speed before
work begins. The handoff must also state the product-version classification and
whether it may touch Production. A recommended default for bounded repository
work is `gpt-5.6-terra`, `medium`; a different choice requires a brief reason.

## Existing V2 decisions retained

- V2 retains GitHub Pages + Apps Script + Sheets while it consolidates
  Production operations.
- `workspace_id` is the new architecture primary key; `landlord_id` is a
  compatibility field.
- `Code.gs` remains the sole V2 API route dispatcher and formal filenames do
  not carry `_FIXED` or similar version suffixes.

See [AGENTS.md](../AGENTS.md) for repository-level engineering requirements.
