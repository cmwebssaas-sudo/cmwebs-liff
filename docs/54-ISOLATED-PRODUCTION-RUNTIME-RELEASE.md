# Phase 54 — Isolated Production Runtime Release Tree

Date: 2026-07-20  
Branch: `chore/v2-production-consolidation`  
Status: **BUILT AND VALIDATED — NOT PUSHED OR DEPLOYED**

## Release location

```text
release/phase54/apps-script/
```

The tree contains 29 JavaScript runtime files and `appsscript.json`. It does
not contain `.clasp.json`; project binding must be supplied locally and kept
outside Git only after separate push approval.

Checksums are stored in:

```text
release/phase54/SHA256SUMS
```

## Dependency decision

`程式碼.js` is the complete dispatcher for 68 routes. A safe clasp source tree
cannot contain only the four changed Tenant files because omitting other handler
modules would delete or break formal landlord, payment, billing, Workspace,
notification and Tenant workflows when the project source is replaced.

Required dependencies were therefore resolved at project-file granularity:

- the four approved Tenant runtime files use the Phase 53 source;
- every other runtime module is derived from the committed sanitized canonical
  baseline, not the dirty Phase 40–53 working-tree version;
- non-runtime top-level `test*`, `diagnose*`, `repair*`, `preview*`, `plan*`,
  `verify*`, `check*`, and `inspect*` entrypoints were removed from the isolated
  copies only;
- no route handler or remaining callable reference depends on a removed
  entrypoint;
- no canonical or deployed source file was edited while building the tree.

## Approved Tenant runtime sources

- `程式碼.js` — dispatcher, test identity selection and ECPay lazy loading;
- `V2_API.js` — Tenant Home and Bills runtime behavior;
- `V2_TENANT_RUNTIME_RESOLVER.js` — read-only canonical identity resolver;
- `V2_TENANT_MESSAGES.js` — shared identity and landlord recipient isolation.

The isolated copies of `V2_API.js` and `V2_TENANT_MESSAGES.js` exclude their
manual test/diagnostic entrypoints. Production route and handler logic is
unchanged.

## Explicit exclusions

- `TESTS.js`;
- `V2_TENANT_RUNTIME_DATA_REPAIR.js`;
- all Phase 40–53 repair, rollback and diagnosis entrypoints;
- `syncTenantRuntimeViewsForTenant_()`;
- dirty View-sync integrations from:
  - `V2_BILLING_MANAGEMENT.js`;
  - `V2_CONTRACT_REQUESTS.js`;
  - `V2_PROPERTY_ROOM_MANAGEMENT.js`;
  - `V2_TENANT_BINDING_PHONE.js`;
  - `V2_TENANT_LEASE_ONBOARDING.js`;
- `.clasp.json` and `.clasprc.json`;
- credentials, tokens and Script Property values.

## Exact final clasp source list

```text
appsscript.json
V2_ANNOUNCEMENT_MANAGEMENT.js
V2_API.js
V2_AUTO_PAYMENT_REMINDER.js
V2_BILLING_MANAGEMENT.js
V2_BILL_NOTIFICATIONS.js
V2_CONTRACT_REQUESTS.js
V2_LANDLORD_MANAGEMENT.js
V2_LANDLORD_ONBOARDING.js
V2_MANUAL_SETTLEMENT.js
V2_PAID_BILL_MANAGEMENT.js
V2_PAYMENT_REVERSAL.js
V2_PAYMENT_SETTLEMENT.js
V2_PROPERTY_ROOM_MANAGEMENT.js
V2_SETTINGS_INTEGRATION.js
V2_SYSTEM_SETTINGS.js
V2_TEAM_MANAGEMENT.js
V2_TENANT_BINDING_PHONE.js
V2_TENANT_CHECKIN_MANAGEMENT.js
V2_TENANT_LEASE_ONBOARDING.js
V2_TENANT_MESSAGES.js
V2_TENANT_PAYMENT_REPORTS.js
V2_TENANT_RUNTIME_RESOLVER.js
V2_WORKSPACES.js
V2_WORKSPACE_CREATION.js
V2_WORKSPACE_DASHBOARD_NATIVE.js
V2_WORKSPACE_LANDLORD_ACCESS.js
V2_WORKSPACE_NOTIFICATIONS.js
V2_WORKSPACE_OPERATION_AUDIT.js
程式碼.js
```

These 30 files are the complete source payload. The checksum manifest and this
document are outside the clasp source root and are not push files.

## Deployed snapshot comparison

Normalized content comparison against `_deployed/apps-script`:

- same: 1 file — `appsscript.json`;
- modified: 28 JavaScript files;
- added: 1 file — `V2_TENANT_RUNTIME_RESOLVER.js`;
- excluded/deleted from the proposed project source: `TESTS.js`;
- excluded migration-only module: `V2_LEGACY_BILL_IMPORT.js`;
- never added: `V2_TENANT_RUNTIME_DATA_REPAIR.js`.

The 29 modified modules reflect both the previously approved sanitized
canonical baseline and removal of non-runtime admin/test entrypoints from the
isolated copies. This is not a four-file byte-level hotfix.

## Validation

The validator was run directly against the isolated tree:

```text
node scripts/validate-project.js \
  --root . \
  --apps-dir release/phase54/apps-script \
  --html-dir . \
  --expected-routes 68
```

Results:

- Apps Script files: 29;
- HTML files: 44;
- routes: 68 unique;
- handler coverage: 68/68;
- common helper coverage: 7/7;
- duplicate top-level declarations: 0;
- blocking credentials: 0;
- hardcoded LINE UID: 0;
- manifest: PASS;
- HTML links missing: 0;
- JavaScript syntax: PASS for every isolated `.js` file;
- admin/diagnostic entrypoint scan: PASS, none remain;
- View-sync call scan: PASS, none remain;
- SHA-256 manifest verification: PASS, 30/30;
- overall validation: PASS.

## Remaining release risks

1. A future clasp push will replace project source and remove `TESTS.js` from
   the Apps Script project. This is intentional for this runtime-only tree but
   must be approved as a source deletion.
2. The source differs from the deployed snapshot in 29 modules. The differences
   are static-safe, but a human release diff review is still required before
   push.
3. Installable triggers are external project state. Confirm no trigger targets
   any of the 96 removed manual admin/test entrypoints before push.
4. The tree has no `.clasp.json`; do not bind it by guessing a Script ID.
5. No live route, Sheet, LINE or payment smoke test was executed in Phase 54.

## Safe next operation

Before any push:

1. verify the SHA-256 manifest;
2. inspect current installable triggers read-only;
3. review the 29 normalized diffs against the serving source;
4. copy the verified local clasp binding into the isolated directory without
   tracking it;
5. run `clasp status` from the isolated directory;
6. record source and immutable-version rollback points;
7. obtain explicit approval for source replacement and `TESTS.js` removal.

## No-production-change declaration

Phase 54 does not commit, push, run `clasp push`, deploy, modify Google Sheets,
change Web App or LIFF configuration, execute repair or migration, create a
message, or send LINE.
