# Phase 52 — Tenant Read Runtime Minimal Implementation

Date: 2026-07-20  
Branch: `chore/v2-production-consolidation`  
Status: **IMPLEMENTED LOCALLY — NOT DEPLOYED**

## Objective

Apply the smallest approved changes needed to align Tenant Home, Bills and
Message test identity handling and to prevent Tenant Message from resolving a
LINE recipient through an ambiguous generic `line_user_id` field.

No Sheet data, route, deployment, Web App URL, LIFF ID or Script Property is
changed.

## Implementation

### Tenant Message frontend

`tenant-message.html` now appends `test=1` to JSONP requests whenever the page
itself is in test mode. The UID remains server-side in
`TEST_TENANT_LINE_UID`; no UID is added to navigation or documentation.

Formal mode does not add `test=1`.

### Shared Tenant identity

Home and Message continue to call the same top-level resolver:

```text
resolveCanonicalTenantRuntimeByLineUid_
  → unique V2_tenants identity
  → unique active V2_contracts row
  → same-Workspace property and room
  → deterministic landlord-link selection
```

The Phase 51 selector remains the only landlord-link selection implementation.
The resolver no longer treats a selected landlord-link row's generic
`line_user_id` as a landlord recipient candidate. Only
`landlord_line_user_id` and the explicit compatibility alias
`landlord_line_uid` are accepted.

### Tenant Message recipient isolation

`tenantMessageResolveLandlordRecipient_()` was added as a pure validation
helper and is used by both:

- `getTenantMessageInitByLineUid()`;
- `submitTenantMessageByLineUid_()`.

Before Message exposes or uses a recipient, the helper requires:

- a canonical `workspace_id`;
- link Workspace equality with the canonical Workspace;
- a canonical `landlord_id`;
- link landlord equality with the canonical landlord;
- exactly one explicit landlord LINE recipient across the canonical chain;
- recipient identity different from the Tenant LINE identity.

The helper never reads `tenantLink.line_user_id`. Message submission passes the
validated Workspace and landlord identity to team notification and uses the
validated landlord LINE UID only as the existing fallback recipient.

Validation errors fail closed before message append or LINE notification.

## Read-only fixture coverage

`testTenantReadRuntimeIsolationFixtures()` was added to `apps-script/TESTS.js`.
It uses in-memory objects only and covers:

- Tenant Home canonical tenant/contract/Workspace/room/landlord identity;
- Tenant Bills identity priority and Workspace filtering;
- exclusion of a different-Workspace bill row;
- ignoring ambiguous landlord-link `line_user_id`;
- Message Workspace conflict rejection;
- conflicting landlord recipient rejection;
- rejection when the landlord recipient equals the Tenant identity.

The Phase 51 deterministic selector fixture and the existing View-sync and
repair-safety fixtures were also rerun. No fixture reads or writes a Sheet or
sends LINE.

## Modified files

- `tenant-message.html`
- `apps-script/V2_TENANT_RUNTIME_DATA_REPAIR.js`
- `apps-script/V2_TENANT_MESSAGES.js`
- `apps-script/TESTS.js`
- `docs/52-TENANT-READ-RUNTIME-MINIMAL-IMPLEMENTATION.md`

`apps-script/V2_API.js` and `apps-script/程式碼.js` were not modified in Phase
52. Their existing dispatcher and handler behavior remains a release
dependency and must be reviewed with the complete Apps Script push set.

## Validation

- Apps Script syntax checks: PASS
- `testTenantLandlordLinkDeterministicSelection()`: PASS
- `testTenantReadRuntimeIsolationFixtures()`: PASS
- `testTenantRuntimeViewSyncPlanning_()`: PASS
- `testTenantRuntimeDataRepairSafety_()`: PASS
- `npm run validate`: PASS — 31 Apps Script files, 44 HTML files, 68 unique
  routes and 68/68 handler coverage
- `git diff --check`: PASS

## Risks

- The fixtures are static and have not been executed against production data.
- The currently served Apps Script deployment has not been changed, so current
  online symptoms will remain until a separately approved release occurs.
- The working tree contains broader pre-existing backend write-path and repair
  changes outside this minimal Phase 52 change. A direct `clasp push` from the
  dirty tree remains prohibited.
- Tenant Message submission is a write and notification path. Only its pure
  resolver fixture was executed; no message was created or sent.

## Manual validation before release

1. Review Phase 52 changes separately from the broader dirty working tree.
2. Run the two pure resolver fixtures in the intended Apps Script project.
3. Run the approved read-only deployment verifier.
4. Confirm Home and Message return the same tenant, contract, Workspace, room
   and landlord identifiers.
5. Confirm Bills selects only same-Workspace rows.
6. Confirm Message init exposes only the validated landlord recipient.
7. Do not execute Message submit until recipient evidence and notification
   isolation receive separate approval.

## Rollback

- Restore the previous `tenant-message.html` JSONP builder.
- Restore the previous shared resolver recipient-field list.
- Restore the previous Message recipient handling and remove the Phase 52
  fixture.
- For a later deployed release, restore the prior immutable Apps Script version
  without changing the Web App URL, and restore the prior frontend commit.
- Do not edit or delete Sheet rows as rollback.

## No-production-change declaration

Phase 52 does not commit, push, run `clasp push`, deploy, modify Google Sheets,
run repair or migration, create a message, or send LINE.
