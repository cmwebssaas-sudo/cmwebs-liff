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
