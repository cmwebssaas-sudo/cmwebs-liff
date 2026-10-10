# Phase 118 — Production Artifact Freeze Preparation

Date: 2026-07-23  
Decision: **NO-GO — freeze controls are prepared; no Production artifact is frozen.**

## 1. Scope and boundary

This phase prepares the evidence and checklist required to freeze a Production release candidate. It does not calculate an authoritative Production hash from the current dirty working tree, does not access Production resources, and does not deploy, commit, or push.

An artifact may be called **frozen** only after it is assembled from a clean, isolated Production-only source tree, independently reviewed, checksummed, and associated with the exact deployment records below.

## 2. Production SHA manifest template

| Field | Required value at freeze | Current status |
| --- | --- | --- |
| Release ID | Immutable release identifier | TBD |
| Freeze timestamp | Asia/Taipei timestamp and UTC timestamp | TBD |
| Source commit | Reviewed immutable Git commit SHA | TBD |
| Frontend artifact SHA-256 | SHA-256 of the exact hosting artifact | TBD |
| Frontend hosting revision | Immutable hosting revision / release identifier | TBD |
| Backend source SHA-256 | SHA-256 manifest for included Apps Script files | TBD |
| Backend Apps Script version | New immutable Apps Script version | TBD |
| Web App deployment reference | Masked deployment reference and confirmed target | TBD — human verification required |
| Schema version | Approved schema snapshot version | TBD |
| Migration version | Approved migration package version | TBD |
| Migration timestamp | Actual execution time after approval | TBD |
| Rollback frontend revision | Previously serving immutable revision | TBD — must be re-confirmed |
| Rollback backend version | Previously serving immutable Apps Script version | TBD — historical references are not evidence |
| Reviewer approvals | Two named reviewer approvals with timestamp | TBD |

The manifest must never contain access tokens, Script Property values, unmasked deployment IDs, Spreadsheet IDs, or LINE user IDs.

## 3. Release artifact checklist

### Frontend

| Check | Evidence required | Freeze condition |
| --- | --- | --- |
| Hosting revision | Immutable Production hosting revision | Record revision in manifest |
| HTML assets | Exact approved tenant and landlord HTML file list | Generate file manifest with SHA-256 |
| JavaScript/CSS assets | Exact referenced static asset list | Generate file manifest with SHA-256 |
| Environment configuration | Production endpoint/LIFF configuration only | No staging host, LIFF ID, test UID, mock transport, or fallback |
| Route checksum | Canonical internal navigation route list, sorted then SHA-256 hashed | Zero dead links and no unapproved route changes |
| Static validation | `npm run validate` against the proposed release source | PASS |

Route-checksum procedure: extract each relative internal `href`/navigation target from the isolated frontend artifact, normalize and sort it, record the resulting SHA-256, then retain the source list with the release evidence.

### Backend

| Check | Evidence required | Freeze condition |
| --- | --- | --- |
| Apps Script file checksum | SHA-256 for every included `.js` file and `appsscript.json` | Complete manifest signed off by reviewers |
| Dispatcher | Exact canonical dispatcher file and route inventory | Route names unchanged unless explicitly approved |
| Handler inventory | Route-to-handler report | All required handlers resolved; baseline validator result recorded |
| Manifest | `appsscript.json` checksum and required runtime service review | Matches the reviewed artifact |
| Runtime-only inclusion | Included modules have a verified dependency path | No orphan dependencies |
| Exclusions | No tests, repair, migration, diagnostics, fixtures, credentials, or local clasp credentials | Exclusion scan PASS |

The existing canonical baseline historically validates **68 unique routes and 68/68 handler coverage**. This is reference evidence only; the same checks must run again against the isolated Production candidate before it can freeze.

### Schema

| Check | Evidence required | Freeze condition |
| --- | --- | --- |
| Required sheets | Approved Production schema snapshot covering users, tenants, workspaces/memberships, properties, rooms, contracts, bills/payments, notification storage, and any approved lifecycle tables | Snapshot is dated, access-controlled, and reviewed |
| Migration order | Ordered, reversible migration package | All dependencies are explicit |
| Compatibility | Additive/backward-compatible check for existing routes and views | No destructive or ambiguous conversion |
| Rollback point | Pre-migration backup and schema snapshot | Restore owner and validation method recorded |
| Post-migration validation | Read-only schema/route/workspace-isolation checks | PASS before traffic enablement |

No schema migration may be inferred from staging alone. Only a separately approved Production migration package may populate the schema and migration fields in the manifest.

## 4. Required migration and deployment order

1. Obtain an approved Production backup checkpoint: Sheet export/snapshot, schema snapshot, Apps Script version/deployment record, trigger inventory, and redacted Properties existence checklist.
2. Build a clean, isolated Production release tree from the approved commit; exclude staging configuration, fixtures, tests, diagnostics, repair tools, migrations not in the approved package, credentials, and local `.clasp.json` files.
3. Run the release validators and generate frontend/backend SHA-256 manifests from that isolated tree.
4. Obtain independent review of the manifest, runtime dependency list, schema migration package, and rollback record.
5. Perform approved additive schema migration only after backup verification.
6. Push reviewed backend source, create a new immutable Apps Script version, and update only the approved existing Web App deployment.
7. Deploy the reviewed frontend artifact to its approved hosting revision.
8. Verify trigger ownership and environment separation, then run the approved read-only smoke tests and workspace-isolation checks.
9. Enable production traffic only after all release-gate items are marked PASS.

Any source, schema, property, deployment, or hosting revision change after manifest creation invalidates the freeze and requires a new release ID and SHA manifest.

## 5. Rollback point template

| Layer | Required rollback evidence | Rollback action |
| --- | --- | --- |
| Frontend | Previous immutable hosting revision and artifact SHA | Revert hosting to the recorded revision |
| Backend | Previous immutable Apps Script version and existing deployment target | Repoint the existing deployment to the recorded version |
| Schema | Timestamped pre-migration snapshot and approved reverse plan | Execute only the reviewed reverse migration or restore procedure |
| Notification worker | Trigger inventory and queue pause/recovery procedure | Pause worker safely; do not discard queued audit records |
| Data validation | Read-only post-rollback checklist | Confirm routes, workspace isolation, and notification state integrity |

Historical version references in earlier phases are not a rollback record. The actual serving version and deployment binding must be captured immediately before a Production release.

## 6. Phase 118 validation record

| Validation | Result | Meaning |
| --- | --- | --- |
| Repository validator | PASS | Current repository static checks pass; this does not freeze a Production candidate |
| Staging validator | PASS | Current staging artifact static checks pass |
| `git diff --check` | PASS | No whitespace errors in the current worktree diff |
| Phase 116 staging isolation evidence | PASS | Staging A/B landlord, tenant, and notification isolation evidence passed |
| Production artifact SHA | BLOCKED | No clean, isolated, reviewed Production-only artifact exists yet |

## 7. GO / NO-GO matrix

| Gate | Status | Required action |
| --- | --- | --- |
| Static repository validation | PASS | Re-run against the isolated release candidate |
| Staging validator and isolation regression | PASS | Preserve evidence with the candidate package |
| Frontend artifact SHA and hosting revision | BLOCKER | Build and review an isolated Production frontend artifact |
| Backend file manifest, Apps Script version, and deployment binding | BLOCKER | Capture exact approved source manifest and human-verified target |
| Production schema/migration package | BLOCKER | Approve migration scope, backup, compatibility, and rollback plan |
| Production credentials, LIFF/channel mapping, Properties, and triggers | BLOCKER | Human verification using redacted existence/scope evidence |
| Two-party release approval | BLOCKER | Obtain recorded approvals after all prior gates pass |

**Final decision: NO-GO.** Production remains untouched until every blocker is resolved and the resulting release candidate is frozen with immutable evidence.

