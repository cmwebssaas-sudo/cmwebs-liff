# CMWebs Product Roadmap

**Status: AUTHORITATIVE**
**Last updated: 2026-11-02 (Asia/Taipei)**

## Supersedes

This roadmap supersedes older V3/V4 plans that placed SaaS, custom work, or AI
growth ahead of the V3 standardized platform foundation. It does not alter a
verified V2 Production release or authorize a release by itself.

## V2 — Internal Production Operations

CMWebs V2 serves internally self-owned properties. It includes landlord,
tenant, billing, arrears, reminders, repair, contracts, RBAC, Workspace
isolation, and LINE flows.

V2 accepts only Production blockers, performance, reliability, and operational
QA. V2.1 is bounded Internal Operations Completion, not a V3/V4 feature lane.
Performance consolidation priorities are:

1. instrumentation;
2. one bootstrap request per page;
3. short Workspace caching;
4. stable build-version cache keys; and
5. reduced full-Sheet scans.

No V3/V4 feature expansion belongs inside V2.

V2.1 is complete only when all of these have recorded evidence:

1. main landlord pages meet the performance target;
2. real-device LINE and mobile acceptance passes;
3. a backup and restore rehearsal succeeds;
4. the operations runbook is complete; and
5. one full monthly operating cycle is verified.

`V2_FEATURE_FREEZE=FINAL` has not been recorded as of this update.

## V3 — Standardized Commercial Multi-tenant SaaS

V3 is a shared standardized product. Each landlord brings and continues using
their existing LINE Official Account (BYO LINE OA). CMWebs never sends landlord
messages through a shared CMWebs OA. Personal LINE remains manual-only and
cannot be used for Messaging API automation.

V3 provides one shared program, UI structure, business rules, and upgrade
stream. Customer-specific functionality, workflows, fields, layouts, and code
branches are prohibited. Standardized branding is limited to system name, logo,
approved theme colors, and contact information.

The foundation includes dynamic Workspace/OA configuration, a central LINE
Channel Registry, subscription and room limits, provisioning, migration,
monitoring, backup, entitlement control, and a central multi-tenant data
environment protected by `workspace_id`, RBAC, and Workspace isolation.
Physically isolated Enterprise data deployment is optional and later. Each
landlord pays its own LINE message-plan costs.

**Product promise:** keep the landlord's existing LINE relationship and upgrade
it into a smart rental-management system.

### V3 delivery status

| Area | Status |
| --- | --- |
| Membership, room limits, bank-transfer subscription and platform admin | Released on 2026-10-11 |
| BYO LINE OA and Channel Registry | Specified in `docs/V3-BYO-LINE-OA-SPEC.md`; registry source added, not deployed |
| Central multi-tenant data environment and monitoring | Partial; primary data remains in Google Sheets |
| Online payment providers | Not started; bank transfer only |
| Third-party electronic signature | Not started |
| Standard smart-device module | Planned; not started |

### V3 delivery order

1. BYO LINE OA, tracked by Issue #296. The owner chose on 2026-11-03 not to wait
   for the isolated restore rehearsal.
2. Backup and restore rehearsal plus the operations runbook, tracked by Issue #298.
3. Data migration planning and monitoring.
4. Online payment providers.
5. Standard smart-device module.
6. Third-party electronic signature, after the standard digital contract proves
   insufficient.

### Standard smart-device module

The planned order is meter reading, door switch, lock, then camera. One approved
vendor comes first. Tuya is the preferred candidate, but commercial terms and
pricing are unconfirmed, so paid landlord use waits for vendor confirmation.
Each capability requires a separate Issue, permission checks and operation logs.
Cameras must stay in shared areas and never point at a tenant's door.

## V4 — Modular LINE Business Platform and AI Growth Engine

V4 follows a stable V3 foundation and remains standardized.

- **V4A:** Booking, Appointment, and CRM modules using the same LINE identity,
  customer, team, notification, billing, and audit core.
- **V4B:** AI property/product listing generation, short-video generation,
  social distribution, creator/KOL collaboration, trackable links, coupon
  codes, and conversion-based revenue sharing.

No V4 module may create customer-specific code branches.

## Permanent product principles

- Landlord owns the LINE OA, brand, and customer relationship.
- CMWebs owns core software, deployment, updates, automation, subscription,
  and module licensing.
- Branding is configurable; functionality is not customizable.
- One release upgrades all customers.
- Adding customers must not create proportional maintenance work.
- Existing V2 Production must not be destabilized while building V3.
