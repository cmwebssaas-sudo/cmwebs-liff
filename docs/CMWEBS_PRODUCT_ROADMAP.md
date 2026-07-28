# CMWebs Product Roadmap

**Status: AUTHORITATIVE**
**Last updated: 2026-07-29 (Asia/Taipei)**

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
