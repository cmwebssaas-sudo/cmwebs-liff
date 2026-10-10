# Phase 56 — Final Production Release Preflight

Date: 2026-07-20  
Branch: `chore/v2-production-consolidation`  
Decision: **BLOCKED — SOURCE MANIFEST PASSES, PRODUCTION ROLLBACK TARGET IS NOT VERIFIED**

## Scope

This phase performs a read-only final preflight of the isolated Apps Script
release. It does not run `clasp push`, create or update a deployment, write a
Google Sheet, invoke an Apps Script function, send LINE, commit, or push Git.

Audited release source:

```text
release/phase54/apps-script/
```

## Installable trigger audit

The canonical Apps Script project was opened using the existing authenticated
Apps Script session. The **Triggers** page reports:

```text
0 installable triggers
```

Therefore the inspected canonical project has no installable trigger that can
reference:

- `TESTS.js` or one of its functions;
- `V2_TENANT_RUNTIME_DATA_REPAIR.js`;
- `V2_LEGACY_BILL_IMPORT.js`;
- a removed `test*`, `diagnose*`, `repair*`, `preview*`, `plan*`, `verify*`,
  `check*`, or `inspect*` entrypoint;
- a removed View-sync writer.

No trigger was created, edited, executed or deleted.

This result applies to the canonical project bound by the local `.clasp.json`.
Because the frontend Web App deployment is not proven to belong to that project,
the trigger state of the actual serving project cannot yet be asserted.

## Deployment and rollback evidence

No complete identifier is recorded in this document.

| Evidence | Result |
|---|---|
| Canonical project name | `綠界結帳` |
| Canonical masked Script ID | `1JmW2N…ihRJ` |
| Apps Script **Manage deployments** | This project has no deployment |
| Read-only `clasp deployments` | One masked deployment `AKfycb…MdBJ` at `@HEAD` |
| Read-only `clasp versions` | No deployed/immutable versions |
| Repository frontend deployment | `AKfycb…X6Og` |
| Canonical deployment token versus frontend | MISMATCH |
| Frontend deployment current version | UNKNOWN |
| Frontend deployment previous version | UNKNOWN |
| Verified rollback deployment/version | **NONE** |

An `@HEAD` clasp deployment with no immutable version is not an acceptable
production rollback point. It also does not match the repository frontend
endpoint. The Apps Script UI provides no Web App deployment under the inspected
canonical project.

Consequently, Phase 56 cannot record a verified current production version,
previous version, or owning deployment ID. A production push must remain blocked
until the project that owns `AKfycb…X6Og` is opened and its deployment/version
history is recorded privately.

## Release manifest verification

The final isolated tree still matches the Phase 55 approved manifest:

- JavaScript runtime files: 29;
- manifest files: 1;
- total clasp source files: 30;
- isolated `clasp status`: PASS;
- SHA-256 manifest: PASS, 30/30;
- `.clasp.json` in release payload: absent after the status check;
- `TESTS.js`: absent;
- `V2_TENANT_RUNTIME_DATA_REPAIR.js`: absent;
- `V2_LEGACY_BILL_IMPORT.js`: absent;
- forbidden diagnostic/repair executable references: 0;
- View-sync writer references: 0;
- routes: 68 unique;
- first-level handler coverage: 68/68.

The exact 30-file manifest remains the one recorded in
`docs/55-RUNTIME-RELEASE-DEPENDENCY-AUDIT.md` and
`release/phase54/SHA256SUMS`.

## Final deployment checklist

### A. Ownership and rollback gate — required before push

- [x] Canonical project Script ID matches the local clasp binding privately.
- [x] Canonical project installable trigger count recorded as zero.
- [ ] Open the Apps Script project that owns the frontend deployment
  `AKfycb…X6Og`.
- [ ] Privately verify its Script ID against the intended canonical owner.
- [ ] Confirm the selected deployment is a Web App.
- [ ] Confirm its full Web App URL exactly matches the frontend endpoint.
- [ ] Record the masked deployment ID.
- [ ] Record the current immutable numeric version.
- [ ] Record the previous known-good numeric version.
- [ ] Confirm execute-as is the deploying user.
- [ ] Confirm access is the approved public/anonymous category.
- [ ] Record the current source snapshot and SHA-256 as a rollback source.
- [ ] Confirm rollback can switch the existing Web App deployment to the
  previous version without changing its URL.

If any unchecked item cannot be completed, do not push.

### B. Source payload gate

- [x] Release source contains exactly 30 tracked files.
- [x] `clasp status` matches the approved manifest.
- [x] SHA-256 verifies 30/30.
- [x] Validator passes with 68 unique routes and 68/68 handler coverage.
- [x] No blocking credential or hardcoded LINE UID is present.
- [x] `TESTS.js`, repair tooling, diagnostics, legacy import and View-sync
  writers are excluded.
- [x] `.clasp.json` and `.clasprc.json` are excluded from the release artifact.
- [ ] Human explicitly approves remote deletion of `TESTS.js` and
  `V2_LEGACY_BILL_IMPORT.js` during whole-project source replacement.

### C. Approved future push procedure — not executed in Phase 56

1. Complete section A and record the rollback version privately.
2. Re-verify `release/phase54/SHA256SUMS`.
3. Copy the verified local `.clasp.json` into the isolated source directory
   temporarily; never commit it.
4. Run `clasp status` and compare all 30 files with the approved manifest.
5. Obtain explicit human approval for `clasp push` and the two source deletions.
6. Run one `clasp push` from `release/phase54/apps-script/` only.
7. Remove the temporary `.clasp.json` immediately.
8. Confirm the editor source contains the 30 approved files only.
9. Run read-only Tenant Home, Bills and Message payload checks.
10. Under separate deployment approval, create an immutable version and update
    the existing Web App deployment; do not create a different Web App URL.
11. Run the narrow Tenant smoke tests without payment, Sheet writes or LINE.

### D. Rollback procedure

1. Stop smoke testing immediately on a P0/P1 failure.
2. Select the same existing Web App deployment.
3. Change it back to the recorded previous known-good numeric version.
4. Confirm the Web App URL is unchanged.
5. If source restoration is also required, restore the recorded pre-push source
   snapshot and verify its SHA-256 before any separate approved push.
6. Re-run read-only Home, Bills and Message checks.
7. Record the failure without repairing Sheets or sending LINE.

Rollback cannot be considered ready while the current and previous production
versions remain unknown.

## Final gate

| Gate | Result |
|---|---|
| Installable triggers in canonical project | PASS — 0 |
| Forbidden trigger references | PASS for inspected canonical project |
| Isolated release manifest | PASS |
| Static validation and SHA-256 | PASS |
| Production deployment ownership | NOT VERIFIED |
| Current production immutable version | UNKNOWN |
| Previous rollback version | UNKNOWN |
| Safe to run `clasp push` now | **NO** |

## No-production-change declaration

Phase 56 did not push source, deploy, create a version, invoke Apps Script,
modify Google Sheets, send LINE, change a Web App URL, modify a LIFF ID, commit,
or push Git.
