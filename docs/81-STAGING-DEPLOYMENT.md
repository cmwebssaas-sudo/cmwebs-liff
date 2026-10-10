# Phase 81 — Staging Deployment

Date: 2026-07-21  
Branch: `chore/v2-production-consolidation`  
Status: **BLOCKED — STAGING TARGET NOT VERIFIED; NO PUSH OR DEPLOYMENT PERFORMED**

## Objective

Deploy the immutable Phase 80 release artifact to a dedicated staging Apps Script project, then run backend, frontend and Tenant smoke checks without changing business logic, API routes, response schema, production source, production deployment, Google Sheets or LINE configuration.

## Release Source Gate

The only permitted source is:

```text
release/phase80/
```

Artifact inventory:

- Apps Script: 30 production JavaScript modules plus `appsscript.json`;
- required snapshot module: `V2_RUNTIME_SNAPSHOT.js` included;
- frontend: `tenant-bind.html`, `tenant-home.html`, `tenant-bills.html`, `tenant-message.html`;
- backend SHA-256 manifest: PASS, 31/31;
- frontend SHA-256 manifest: PASS, 4/4;
- machine-readable release manifest: PASS;
- isolated validation: PASS, 68 unique routes and 68/68 handler coverage;
- excluded modules and credential-file scan: PASS.

No source file was modified during Phase 81.

## Staging Target Investigation

### Known bindings

| Local binding | Classification | Evidence | Allowed for Phase 81 |
|---|---|---|---|
| `release/phase54/apps-script/.clasp.json` | Verified production project | Owns the serving production Web App and immutable version 74 | **NO** |
| `apps-script/.clasp.json` | Historical snapshot project; staging status unknown | Matches `_deployed/apps-script`; exposes one `@HEAD` deployment and no immutable versions | **NO until explicitly verified as staging** |
| `release/phase80/apps-script/.clasp.json` | Absent by design | Phase 80 excluded deployment bindings and credentials | Cannot push |

The current authenticated `clasp list` did not expose a project explicitly named or documented as the CMWebs V2 staging project. Repository documentation also contains no approved staging Script ID fingerprint, staging deployment fingerprint, staging Sheet boundary, staging Script Properties inventory or staging Web App URL.

The historical non-production binding must not be treated as staging merely because it differs from production. Doing so could overwrite an unrelated or obsolete Apps Script project.

### Frontend staging boundary

All four Phase 80 HTML files contain the same existing production Web App endpoint fingerprint. They do not contain a verified staging endpoint or environment switch.

Therefore opening the Phase 80 frontend as-is would exercise production, not the proposed staging backend. A valid staging frontend smoke test requires an approved configuration mechanism or staging-hosted copy that points to the verified staging Web App endpoint. Phase 81 does not authorize rewriting those HTML files.

## Deployment Decision

`clasp push` was **not executed** because no verified staging Script ID or safe ignored binding exists in the Phase 80 Apps Script source tree.

No staging version or Web App deployment was created or updated. Production version 74 and its endpoint were not touched.

## Staging Deployment Checklist

### A. Identity and isolation gate

- [ ] Provide the staging project name.
- [ ] Privately verify the full staging Script ID; record only a masked ID and SHA-256 fingerprint in documentation.
- [ ] Confirm the Script ID is different from the verified production Script ID fingerprint.
- [ ] Confirm the project is owned or administered by the authorized staging operator.
- [ ] Confirm a dedicated staging Spreadsheet and staging-safe Script Properties are configured.
- [ ] Confirm staging test identities cannot access or write production Workspace data.
- [ ] Confirm LINE credentials are disabled or restricted to an approved staging/test channel.
- [ ] Confirm payment credentials are sandbox-only or absent, and that smoke tests will not initiate payment.
- [ ] Record the existing staging deployment/version as the rollback target, if one exists.
- [ ] Confirm installable triggers cannot send production notifications or mutate production data.

### B. Bind Phase 80 artifact

- [ ] Create an ignored `release/phase80/apps-script/.clasp.json` using the verified staging Script ID only.
- [ ] Do not copy the Phase 54 production binding.
- [ ] Do not commit `.clasp.json`, `.clasprc.json`, OAuth files or credentials.
- [ ] Run `clasp status` from `release/phase80/apps-script/`.
- [ ] Confirm exactly 31 push files: 30 JavaScript modules plus `appsscript.json`.
- [ ] Confirm `TESTS.js`, repair, migration, validation, legacy and credential files are absent.
- [ ] Re-run `APPS-SCRIPT-SHA256SUMS` and confirm 31/31.
- [ ] Re-run isolated validation and `npm run validate`.

### C. Staging source push

- [ ] Obtain explicit approval for the verified staging target.
- [ ] Run `clasp push` only from `release/phase80/apps-script/`.
- [ ] Record the push response and pushed file count.
- [ ] Inspect the staging Apps Script editor file list and confirm it matches `RELEASE-MANIFEST.json`.
- [ ] Verify no excluded remote files or triggers remain as undeclared staging dependencies.

### D. Staging Web App deployment

- [ ] Create an immutable staging version or update only the approved staging Web App deployment.
- [ ] Execute as the approved staging project owner.
- [ ] Use only the approved staging access scope.
- [ ] Record masked deployment ID, version and endpoint fingerprint.
- [ ] Do not alter, update or replace the production deployment.
- [ ] Send one read-only endpoint request and confirm HTTP success.
- [ ] Review Apps Script executions for startup, route and authorization errors.

### E. Frontend gate

- [ ] Provide a staging-safe endpoint configuration that does not modify the Phase 80 canonical HTML behavior.
- [ ] Provide the approved staging LIFF callback URL and LIFF test channel configuration.
- [ ] Open `tenant-bind.html` from the staging frontend boundary.
- [ ] Confirm LIFF initialization and callback return to the staging page.
- [ ] Confirm browser requests target the staging endpoint fingerprint, never production.

### F. Smoke test

- [ ] LINE binding succeeds only for the approved staging tenant.
- [ ] `tenant_home` resolves the correct staging tenant/workspace/property/room chain.
- [ ] `tenant_bills` returns the expected staging bill list or a valid empty state.
- [ ] `tenant_message_init` resolves only the authorized staging landlord recipient.
- [ ] Execution logs contain no unhandled error.
- [ ] No production Sheet row, notification, payment or LINE recipient is touched.
- [ ] Record actual results as PASS, FAIL or BLOCKED; do not prefill PASS.

## Validation Results

| Check | Result |
|---|---|
| Phase 80 backend SHA-256 | PASS — 31/31 |
| Phase 80 frontend SHA-256 | PASS — 4/4 |
| Phase 80 release manifest | PASS |
| Isolated route/handler validation | PASS — 68 routes, 68/68 handlers |
| Canonical `npm run validate` | PASS |
| Verified staging binding | **FAIL / missing evidence** |
| `clasp push` to staging | **NOT RUN** |
| Staging deployment | **NOT RUN** |
| Execution-log review | **BLOCKED** |
| `tenant-bind.html` staging availability | **BLOCKED** |
| LIFF staging callback | **BLOCKED** |
| LINE binding smoke test | **NOT TESTED** |
| `tenant_home` smoke test | **NOT TESTED** |
| `tenant_bills` smoke test | **NOT TESTED** |
| `tenant_message_init` smoke test | **NOT TESTED** |

## Required Human Evidence to Continue

Provide the following without exposing complete identifiers or credentials:

```text
staging_project_name: ...
masked_staging_script_id: first6…last4
staging_script_id_sha256: ...
different_from_production: YES
staging_sheet_isolated: YES
staging_script_properties_ready: YES
staging_line_channel_safe: YES / DISABLED
existing_staging_deployment: masked ID or NONE
existing_staging_version: number / HEAD / NONE
staging_web_app_access: ...
staging_frontend_endpoint_method: ...
staging_liff_callback_ready: YES / NO
```

After this evidence is verified, Phase 81 may resume at checklist section B without rebuilding or changing the Phase 80 artifact.

## Safety Declaration

Phase 81 did not modify business logic, API routes, API schema, frontend files, manifest settings, Script Properties, Google Sheets, LINE configuration or any deployment. It did not run `clasp push`, create a version, deploy, commit or Git push. The production Apps Script project and production Web App remain unchanged.
