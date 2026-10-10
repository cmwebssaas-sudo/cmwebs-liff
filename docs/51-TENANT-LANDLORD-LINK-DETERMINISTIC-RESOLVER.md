# Phase 51 — Tenant Landlord-Link Deterministic Resolver

Date: 2026-07-20  
Branch: `chore/v2-production-consolidation`  
Status: **IMPLEMENTED LOCALLY — NOT DEPLOYED**

## Baseline

The repository working tree already contained the uncommitted Phase 40–49
Tenant runtime changes when Phase 51 started. The local and remote branch HEAD
were both `d4dd7a8`; no `docs/50-*` artifact was present in the repository.
Phase 50 was not repeated, and no deployment-ownership evidence was requested.

Phase 47 identified the next backend P0 blocker after deployment ownership:
the shared Tenant runtime resolver rejected every case with more than one
`V2_landlord_tenant_list_view` candidate. Phase 46 defined the required safe
selection policy.

## Objective

Implement one shared deterministic landlord-link selection rule for Tenant Home
and Tenant Message reads:

- resolve the unique tenant and active contract from master data first;
- derive the canonical Workspace, tenant, contract, room and landlord IDs;
- prefer one complete canonical landlord-link row over compatible incomplete
  legacy rows;
- logically collapse equivalent complete duplicates for reads;
- fail closed on any non-empty identifier, tenant UID, status or protected-field
  conflict;
- never use first-row-wins selection.

This phase does not modify Google Sheets or remove either known T000020 row.

## Implementation

### Shared selector

`tenantRuntimeSelectLandlordLink_(rows, canonical)` was added to
`apps-script/V2_TENANT_RUNTIME_DATA_REPAIR.js`.

Candidate classification:

1. **Exact canonical** — non-empty `workspace_id`, `tenant_id`, contract ID,
   `room_id` and `landlord_id` all match the master-data chain.
2. **Compatible incomplete legacy** — the row is related to the tenant and all
   non-empty canonical fields agree, but one or more required fields are blank.
3. **Conflict** — any non-empty Workspace, tenant, tenant-user, contract, room,
   landlord or tenant LINE identity differs, or an explicit status is not an
   accepted active/current status.

Selection behavior:

- exactly one exact row is selected;
- one exact row outranks any number of compatible incomplete legacy rows and
  returns warning `COMPATIBLE_LEGACY_LINK_IGNORED`;
- equivalent exact rows are logically collapsed, with `updated_at` used as the
  deterministic preference and warning
  `EQUIVALENT_DUPLICATE_LINKS_COLLAPSED`;
- exact rows with different protected fields return
  `CONFLICTING_TENANT_LANDLORD_LINKS`;
- incomplete-only matches return `TENANT_LANDLORD_LINK_INCOMPLETE`;
- no related row preserves the previous nullable-link behavior and emits
  `TENANT_LANDLORD_LINK_NOT_FOUND` diagnostics.

The master-data landlord ID is now resolved before link selection. Selection
diagnostics are attached to the canonical runtime object as
`landlord_link_diagnostics`. Route names, handler names and public response
contracts are unchanged.

### Fixture coverage

`testTenantLandlordLinkDeterministicSelection()` was added to
`apps-script/TESTS.js`. It is a pure in-memory fixture test and performs no
Spreadsheet or LINE operations.

Covered cases:

- complete canonical row plus compatible incomplete legacy row;
- equivalent complete duplicates;
- Workspace conflict;
- tenant conflict;
- contract conflict;
- room conflict;
- landlord conflict;
- tenant LINE UID conflict;
- landlord LINE recipient conflict;
- complete-link status conflict;
- incomplete-only candidate;
- no landlord-link row compatibility.

The existing `testTenantRuntimeViewSyncPlanning_()` and
`testTenantRuntimeDataRepairSafety_()` fixtures were also executed locally to
confirm the resolver change did not break View planning, empty-bill behavior,
Workspace isolation or repair scope.

## Modified files

- `apps-script/V2_TENANT_RUNTIME_DATA_REPAIR.js`
- `apps-script/TESTS.js`
- `docs/51-TENANT-LANDLORD-LINK-DETERMINISTIC-RESOLVER.md`

No frontend, route dispatcher, manifest, clasp binding, Web App URL, LIFF ID,
Google Sheet, Script Property or deployment was modified.

## Validation

- `node --check apps-script/V2_TENANT_RUNTIME_DATA_REPAIR.js`: PASS
- `node --check apps-script/TESTS.js`: PASS
- `testTenantLandlordLinkDeterministicSelection()`: PASS, 12/12 fixture cases
- `testTenantRuntimeViewSyncPlanning_()`: PASS
- `testTenantRuntimeDataRepairSafety_()`: PASS
- `npm run validate`: PASS — 31 Apps Script files, 44 HTML files, 68 unique
  routes and 68/68 handler coverage
- `git diff --check`: PASS

## Risks and release boundary

- The selector has not been run in Apps Script against the live rows. Fixture
  success does not establish the actual row status, landlord contact fields or
  deployment version.
- Equivalent duplicates are collapsed only for reads; no Sheet cleanup occurs.
- An incomplete-only relationship now returns an explicit error instead of
  silently becoming canonical.
- The broader working tree still contains production write-path and manual
  repair code previously identified by Phase 47. This Phase 51 change does not
  make the entire dirty Apps Script tree safe for direct `clasp push`.
- Repository evidence still lacks a committed Phase 50 artifact. No deployment
  action is authorized by this document.

## Manual verification

After the complete backend release set and target deployment are independently
approved:

1. Review the exact source diff in an isolated clean release tree.
2. Run `testTenantLandlordLinkDeterministicSelection()` in Apps Script.
3. Run the approved read-only Tenant deployment verifier.
4. Confirm Home and Message select the same Workspace, tenant, contract, room
   and landlord without exposing a UID.
5. Confirm the compatible legacy row is reported but not selected.
6. Confirm no Sheet writes and no LINE push occurred.
7. Only after deployment approval, smoke-test Tenant Home and Message with the
   controlled test identity; do not pre-mark results as PASS.

## Rollback

Revert the shared selector integration and fixture addition to the reviewed
pre-Phase-51 source. Do not delete or edit landlord-link rows as a rollback.
For any later deployment, preserve and restore the previous immutable Apps
Script version while keeping the existing Web App URL unchanged.

## Next phase recommendation

Phase 52 should isolate a minimal Tenant read-runtime release set from the
broader dirty Apps Script tree and review Message recipient isolation. It must
exclude generic View write integration and manual repair entrypoints unless
they receive separate approval. No `clasp push` or deployment should occur
until the canonical target and rollback version are evidenced in the actual
repository/release record.

## No-production-change declaration

Phase 51 does not commit, push, run `clasp push`, deploy, change a Web App URL,
write Google Sheets, alter Script Properties, execute repair or migration, or
send LINE messages.
