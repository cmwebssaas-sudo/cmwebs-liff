# Phase 53 — Tenant Runtime Resolver Separation

Date: 2026-07-20  
Branch: `chore/v2-production-consolidation`  
Status: **SEPARATED LOCALLY — NOT DEPLOYED**

## Objective

Separate the Tenant production read resolver from the mixed repair and
derived-View write tooling so a later isolated Tenant read release does not
need to include admin repair entrypoints.

## Canonical ownership

### `V2_TENANT_RUNTIME_RESOLVER.js`

This new module is the sole owner of:

- canonical Tenant identity resolution;
- read-only Sheet snapshot helpers;
- unique Tenant and active-contract validation;
- Workspace, property and room isolation;
- deterministic landlord-link selection;
- tenant → contract → property → room → landlord identity chain;
- Tenant Home read projection;
- successful empty-bill compatibility result.

The formal read entrypoint is:

```text
resolveCanonicalTenantRuntimeByLineUid_()
```

The pure fixture entrypoint is:

```text
tenantRuntimeResolveCanonicalFromSnapshot_()
```

The module contains no Sheet write method, ScriptLock, View synchronizer,
repair, rollback, migration, diagnostic entrypoint, Logger call or LINE push.

### `V2_TENANT_RUNTIME_DATA_REPAIR.js`

The repair module now begins at the admin boundary and depends on the resolver
module for canonical identity and shared read helpers. It retains:

- read-only admin diagnostics;
- repair preview and validation;
- explicitly invoked test-tenant repair;
- derived-View plan/apply/sync functions;
- rollback data handling;
- View-sync and repair-safety fixtures.

It no longer defines the formal read resolver, deterministic selector or Home
projection. No function in the repair module is a `v2_action` route.

## Handler dependencies

`V2_API.js` documents `V2_TENANT_RUNTIME_RESOLVER.js` as the Tenant Home read
dependency. Its existing Home handler calls the resolver and Home projection.
Its Bills handler remains the separately scoped, Workspace-aware Bills read
implementation.

`V2_TENANT_MESSAGES.js` documents the resolver module as its read dependency.
Both Message init and submit use the same canonical identity chain as Home,
then apply the Phase 52 landlord recipient validator.

Neither handler module references `V2_TENANT_RUNTIME_DATA_REPAIR.js` or any
repair, rollback or View-sync function.

## Tests

`testTenantRuntimeResolverSeparation()` was added to `TESTS.js`. It verifies:

- required resolver entrypoints are present;
- deterministic landlord-link selection fixtures pass;
- Home canonical identity fixtures pass;
- Bills Workspace identity fixtures pass;
- Message recipient-isolation fixtures pass;
- test execution reports zero Sheet writes and zero LINE pushes.

Existing admin fixtures were rerun after the split:

- `testTenantRuntimeViewSyncPlanning_()` — PASS;
- `testTenantRuntimeDataRepairSafety_()` — PASS.

This confirms the admin module still resolves canonical identity through the
new read module without duplicating top-level declarations.

## Modified files

- new `apps-script/V2_TENANT_RUNTIME_RESOLVER.js`;
- separated `apps-script/V2_TENANT_RUNTIME_DATA_REPAIR.js`;
- dependency documentation in `apps-script/V2_API.js`;
- dependency documentation in `apps-script/V2_TENANT_MESSAGES.js`;
- resolver-boundary fixtures in `apps-script/TESTS.js`;
- this document.

No route, handler signature, frontend, manifest, clasp binding, Script
Property, Web App URL, LIFF ID or Google Sheet was changed.

## Validation

- Apps Script syntax checks: PASS;
- resolver-boundary fixture: PASS;
- deterministic landlord-link fixture: PASS;
- Tenant read identity and recipient fixture: PASS;
- View-sync planning fixture: PASS;
- repair-safety fixture: PASS;
- Apps Script files: 32;
- routes: 68 unique;
- handler coverage: 68/68;
- duplicate top-level declarations: 0;
- credential and hardcoded LINE UID findings: 0;
- `npm run validate`: PASS;
- `git diff --check`: PASS.

## Release boundary

The minimum Tenant read backend replacement set is now:

```text
程式碼.js
V2_API.js
V2_TENANT_RUNTIME_RESOLVER.js
V2_TENANT_MESSAGES.js
```

Optional read-only validation:

```text
TESTS.js
```

The following must be excluded from the minimal Tenant read release:

```text
V2_TENANT_RUNTIME_DATA_REPAIR.js
V2_BILLING_MANAGEMENT.js
V2_CONTRACT_REQUESTS.js
V2_PROPERTY_ROOM_MANAGEMENT.js
V2_TENANT_BINDING_PHONE.js
V2_TENANT_LEASE_ONBOARDING.js
```

The five formal workflow files still contain earlier uncommitted calls to
`syncTenantRuntimeViewsForTenant_()`. Phase 53 does not overwrite that prior
work. An isolated release must use their sanitized canonical baseline versions,
not the dirty working-tree versions, when the repair module is excluded.

## Risk

Direct `clasp push` remains unsafe because clasp uploads the complete project
tree. The current working directory still contains the repair module and the
five formal View-sync callers. The split makes an isolated release possible;
it does not make the dirty working tree an approved push source.

## Rollback

Before any later release, retain the prior immutable Apps Script version and a
complete sanitized source snapshot. If the Tenant read release fails, restore
that version without changing the Web App URL. Do not invoke repair or modify
Sheet rows as rollback.

## No-production-change declaration

Phase 53 does not commit, push, run `clasp push`, deploy, write Google Sheets,
execute repair or migration, create messages, or send LINE.
