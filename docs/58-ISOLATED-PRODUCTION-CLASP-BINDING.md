# Phase 58 — Isolated Production Clasp Binding

Date: 2026-07-20  
Branch: `chore/v2-production-consolidation`  
Status: **BOUND TO VERIFIED PRODUCTION PROJECT — NOT PUSHED OR DEPLOYED**

## Objective

Bind only the isolated 30-file production runtime tree to the Apps Script
project that owns the currently serving Web App deployment. Runtime code,
deployment state, Sheets, LINE and the canonical `apps-script/.clasp.json` are
outside this phase's write scope.

## Production evidence re-verification

The authenticated Apps Script UI was checked again before creating the binding.

| Field | Verified result |
|---|---|
| Production project name | `綠界結帳` |
| Production masked Script ID | `1NAPtZ…MD0k` |
| Script ID SHA-256 | `601b2190f15a93eb5bbcbb1ade48922b1352825d32bb01add37c28ca1f8fa985` |
| Deployment name | `CMWebs金流中繼站` |
| Masked Deployment ID/token | `AKfycb…X6Og` |
| Deployment version | **73** |
| Deployment type | Web App |
| Repository frontend endpoint | Exact private match |
| Web App host/path | `script.google.com/macros/s/{deployment}/exec` |

The complete Script ID and deployment token are not duplicated in this
document. The local binding was verified against the Phase 57 Script ID
SHA-256 fingerprint.

## Binding change

Created local binding:

```text
release/phase54/apps-script/.clasp.json
```

Properties:

- Script ID fingerprint matches the verified production project;
- `rootDir` resolves to the isolated release source directory;
- supported source extensions remain `.js`, `.gs`, `.html` and `.json`;
- no push order override;
- no credential, token, OAuth value or deployment ID is stored;
- the file is ignored by Git and excluded from the release checksum manifest.

The existing `apps-script/.clasp.json` was not modified. It remains the
historical canonical/snapshot binding documented in Phase 57 and must not be
used for the production push.

## Ignore protection

`.gitignore` now uses:

```text
**/.clasp.json
```

This protects both the canonical and isolated local clasp bindings. Existing
rules continue to exclude `.clasprc.json`, OAuth, client-secret and credential
files. No authentication file was copied into the repository or release tree.

## Runtime integrity

The binding does not participate in Apps Script source checksums.

- runtime files: 30;
- runtime SHA-256: PASS, 30/30 against `release/phase54/SHA256SUMS`;
- runtime source changes in Phase 58: 0;
- manifest changes in Phase 58: 0;
- Web App deployment/version changes: 0.

## Clasp status

`clasp status` was run from `release/phase54/apps-script/`.

Result:

- 30 tracked Apps Script push files;
- the local `.clasp.json` is reported separately as an untracked clasp control
  file and is ignored by Git;
- the file list exactly matches the Phase 55 approved push manifest;
- `TESTS.js`, `V2_TENANT_RUNTIME_DATA_REPAIR.js` and
  `V2_LEGACY_BILL_IMPORT.js` remain excluded.

No `clasp push`, pull, version creation or deployment operation was run.

## Validation

- production Script ID fingerprint: MATCH;
- deployment token and frontend endpoint: MATCH;
- current production version: 73;
- runtime SHA-256: PASS, 30/30;
- `npm run validate`: PASS;
- routes: 68 unique;
- handler coverage: 68/68;
- duplicate declarations: 0;
- blocking credentials: 0;
- hardcoded LINE UID: 0;
- `git diff --check`: PASS.

## Release gate

The isolated tree is now correctly bound for a future production push, but this
phase grants no push or deployment authorization. Before a separate approved
push:

1. verify the Phase 57 rollback metadata checksum;
2. re-run the isolated SHA-256 and `clasp status` checks;
3. confirm the current Web App still serves version 73;
4. approve deletion of excluded remote test/legacy modules;
5. explicitly authorize one `clasp push` from the isolated directory only.

Deployment must remain a later, separately authorized operation and must update
the existing Web App deployment without changing its URL.

## No-change declaration

Phase 58 did not alter runtime code, manifest content, production version,
deployment configuration, Google Sheets, LINE, Web App URL or LIFF settings. It
did not run `clasp push`, deploy, commit or Git push.
