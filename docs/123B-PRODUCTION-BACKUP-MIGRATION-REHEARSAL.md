# Phase 123B - Production Backup and Migration Rehearsal

## Frozen RC Check

- Local release branch: `release/cmwebs-v2-rc1`
- Local RC commit: `acdfe8eae5e6ea4914ed791f818beec88d4e7c08`
- Git tree: `a8883aab9c5f302d873531b6b40646e1e56803fb`
- Final candidate count: `36`
- Release worktree: clean when checked on 2026-07-23
- RC source freeze: PASS

## Backup Copies

The verified `cmwebs.saas@gmail.com` Drive session created these copies without
editing the original workbook:

| Role | Google Drive title | Created at | Identity evidence |
| --- | --- | --- | --- |
| Immutable baseline | `[IMMUTABLE BACKUP] CMWebs V2 pre-RC1 20260723-235310` | 2026-07-23 23:53:10 +0800 | No raw identifier recorded. |
| Migration rehearsal | `[REHEARSAL] CMWebs V2 RC1 migration 20260723-235527` | 2026-07-23 23:55:27 +0800 | Masked ID `10_a...xld4`; SHA-256 `9f96aefc2be4cd4f6867d1d0b0daa61efb871d33d5b73c3e25f8c48e5f2dcd34`. |

The rehearsal copy was created from the immutable baseline, not from the
original workbook. No cell values, complete Spreadsheet IDs, Properties,
tokens, LINE identities, or payment data are recorded here.

## Safety Status

- Production original workbook: not modified.
- Production Apps Script: not deployed or changed.
- Production Properties and triggers: not read or changed.
- Real LINE, payment, webhook, or notification action: not performed.
- Git push: not performed.

## Remaining Rehearsal Gate

Backup creation is complete, but this phase is **BLOCKED** before migration.
The browser automation can open the rehearsal workbook and find its Apps
Script menu entry, but cannot yet prove that the linked Apps Script project is
distinct from Production and staging, or set the required non-sensitive
`REHEARSAL` mock configuration. Therefore it must not run a schema migration,
smoke test, idempotency test, rollback, or restore rehearsal.

The following metadata comparisons are also pending a safe rehearsal-runtime
inventory function that returns only sheet names, dimensions, row counts, and
header checksums:

- original versus immutable baseline sheet inventory;
- original versus immutable baseline header-order checksums;
- rehearsal pre/post migration snapshots.

No production deployment approval is implied by this document.

## Phase 123B.1 - Standalone Runtime Identity

On 2026-07-24, the verified `cmwebs.saas@gmail.com` session created a new
standalone Apps Script project named `[REHEARSAL ONLY] CMWebs V2 RC1 Migration
Runtime`.

- Masked Script ID: `1nlv...H3BH`
- Script ID SHA-256: `888a3ba3cf018e203c1de41a56a1e31fa7ae36fc845b528a9e1646dd022e653c`
- Production fingerprint comparison: different
- Staging fingerprint comparison: different
- Trigger inventory: `0`
- Deployment created by this phase: no

The project is therefore an independently identified rehearsal runtime.

## Phase 123B.1 - Isolated clasp Guard Installation

The named clasp credential `cmwebs-rehearsal` authenticated as the verified
`cmwebs.saas@gmail.com` account and completed a read-only pull from the
independently identified rehearsal target. The pull contained only the default
standalone source and manifest; no Production or staging source, deployment
configuration, trigger installer, or Production identifier was found.

The isolated workspace then pushed the following rehearsal-only source files
without creating a version or deployment:

- `REHEARSAL_RUNTIME_CONFIG.gs`
- `REHEARSAL_RUNTIME_GUARD.gs`

The config is fail-closed: `REHEARSAL` environment, all three transports set
to `MOCK`, and external network, trigger installation, deployment, and
Production access all disabled. The guard checksum is
`855cc38306cbd3599dc6b90c0f50e0ae564ff7b4b571daad32f5aa12ff72f1e3`.
Static isolation scanning found no URL fetches, Properties access, trigger
creation, cell reads or writes, network endpoints, LINE/LIFF identifiers,
tokens, payment endpoints, or Production hostnames.

## Phase 123B.1 - Remote Manifest Verification and Runtime Reauthorization

The remote manifest was pulled again with the isolated named credential and
updated only after a second read-only check confirmed it still had the prior
readonly scope. Its exact OAuth allowlist is now:

- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/script.scriptapp`

The Apps Script Overview screen independently showed the same two scopes and
no external-request, Gmail, Drive-management, payment, LINE, or Production
scope. The runtime authorization was then completed in the Apps Script IDE by
the verified `cmwebs.saas@gmail.com` account at `2026-07-24T02:55:46+08:00`.

The second `preflightCmwebsRehearsalIsolation` run completed without an
exception. Its fail-closed implementation would otherwise reject a mismatched
rehearsal title or a nonzero trigger count before returning its sanitized
result. The verified sanitized result is: `REHEARSAL` environment, verified
spreadsheet binding, trigger count `0`, all transports `MOCKED`, external
network disabled, and Production access disabled.

Result: rehearsal runtime isolation and preflight are **PASS**. No spreadsheet
cell value, row count, schema, Property, trigger, deployment, external
transport, or Production resource was changed. No migration was run.

## Phase 123B.2 - Migration Source Gate

The frozen RC integrity check passed at commit
`51ee52d29800c04f9adfcab7c930485eb27b7e44`, tree
`0390c818f620846099fa8d6358ebf74466f88eca`, with a clean release worktree.
All three final candidate manifests contain the same 35 paths and every frozen
SHA-256 value recomputes correctly.

No RC1-approved executable migration entrypoint exists. The frozen migration
artifact explicitly declares `NONE_UNTIL_HUMAN_APPROVAL`; its schema baseline
is marked `HUMAN_REQUIRED`. The only similarly named source function is a
historical operational-data migration, not an RC1 entrypoint, and its active
logic processes legacy LINE identity fields. It therefore cannot be copied
into the rehearsal runtime under the no-UID and no-unapproved-source rules.

Result: Phase 123B.2 is **BLOCKED** before source push, snapshot, migration,
idempotency, smoke, or restore rehearsal. Rehearsal data/schema, immutable
backup, and Production remain unchanged. An approved RC1 migration package
with a single fail-closed entrypoint and non-sensitive source dependencies is
required before this work can resume.

## Phase 123B - RC1 Rehearsal Execution

On 2026-07-24, the independently verified rehearsal runtime received the
approved RC1 migration package and the fail-closed
`getCmwebsRehearsalSpreadsheet_` helper. The remote source push created no
deployment, version, or trigger. Its guard checksum is
`c97b1a572755e057767044f419a92e83de7628e5bb0561d7479a4df85682d63d`.
Static isolation scanning found no Properties access, URL fetch, trigger
installer, destructive sheet operation, endpoint, token, LINE/LIFF identity,
or payment integration.

The sanitized pre-migration snapshot reported `67` sheets, `128851` total
rows, `1565` total columns, empty schema and migration markers, and checksum
`74b124028bdddbee3db5e9d0a2b8b6b5223ef3f1c6b4035a23f55d387b760535`.
The first guarded migration completed without `UNSAFE_SCHEMA_DELTA`. Its
post-migration snapshot reported `69` sheets, `128855` total rows, `1569`
total columns, schema version and migration marker `CMWEBS_V2_RC1`, and
checksum `37ba37e740806aaed6045dc3af46699779264676c78c796f3817877c172d8d74`.
Only additive migration metadata and required sheets were created; no
business-row values were captured in this evidence.

The second execution completed without an unsafe delta and reproduced the
same sheet, row, column, marker, and checksum values. Migration idempotency is
therefore **PASS**.

Core smoke is **FAIL**: this repository has no existing automated or
live-rehearsal coverage for the required tenant, landlord, and infrastructure
smoke paths. No Production modules were copied to the rehearsal runtime merely
to fabricate that coverage.

Restore rehearsal is **FAIL**. The verified Drive session exposed the
immutable backup and its `Create copy` action, but that action produced no
identifiable copy. No `[RESTORE TEST]` workbook was created, so the required
sheet and header-checksum comparison cannot be asserted. Rollback remains
`NOT_APPLICABLE`; the original immutable backup and Production were not
modified.

## Phase 123B - Complete Rehearsal Package, Core Smoke, and Restore

The independently identified rehearsal runtime was pulled as a complete
package, preserving all remote source files. The Apps Script editor discovered
the approved `runRc1CoreSmoke` and `cleanupRc1CoreSmokeFixture` entrypoints.
The temporary metadata verifier used for restore comparison was deleted from
both the remote project and local temporary workspace immediately after use.

`runRc1CoreSmoke` passed the tenant, landlord, and infrastructure paths. It
created only synthetic `RC1SMOKE_` fixture rows on the rehearsal copy, asserted
workspace-substitution and tenant-to-landlord route denial, used all three
mock transports, and removed all `21` fixture rows before returning. The
separate cleanup entrypoint then completed without an exception; no marker
rows remained.

The verified Drive session created `[RESTORE TEST] CMWebs V2 RC1
2026-07-24054651` from the immutable backup. A rehearsal-only metadata verifier
compared only sheet names, last row and column counts, and first-row header
checksums. It reported `67` sheets in each workbook, zero mismatches, and an
exact header-checksum match. No business-cell values, raw identifiers, tokens,
or Properties values were recorded.

Result: Core Smoke and Restore Rehearsal are **PASS**. Rollback remains
`NOT_APPLICABLE`. The immutable backup, Production original, Production
deployment, and all external transports remain unchanged.
