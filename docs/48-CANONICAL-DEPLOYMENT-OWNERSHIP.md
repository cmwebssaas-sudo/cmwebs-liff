# Phase 48 — Canonical Apps Script Deployment Ownership

Date: 2026-07-20  
Branch: `chore/v2-production-consolidation`  
Status: **OWNERSHIP UNRESOLVED — DO NOT PUSH OR DEPLOY**

## Phase 47 baseline

The highest numbered Phase artifact at the start of this phase was `docs/47-BACKEND-RELEASE-REVIEW.md`.

The only repository artifact attributable to the Phase 47 review itself is that new document. Phase 47 reviewed, but did not publish, the existing uncommitted backend changes in:

- `apps-script/TESTS.js`;
- `apps-script/V2_API.js`;
- `apps-script/程式碼.js`;
- `apps-script/V2_TENANT_RUNTIME_DATA_REPAIR.js`;
- `apps-script/V2_TENANT_MESSAGES.js`;
- `apps-script/V2_BILLING_MANAGEMENT.js`;
- `apps-script/V2_CONTRACT_REQUESTS.js`;
- `apps-script/V2_PROPERTY_ROOM_MANAGEMENT.js`;
- `apps-script/V2_TENANT_BINDING_PHONE.js`;
- `apps-script/V2_TENANT_LEASE_ONBOARDING.js`.

Phase 47 concluded:

- backend release is `NOT SAFE`;
- direct `clasp push` is not allowed;
- the first P0 blocker is unresolved ownership between the repository frontend endpoint and the project bound by `apps-script/.clasp.json`;
- the next P0 blocker is the unimplemented deterministic landlord-link selection rule.

No Phase 1–47 work was repeated in this phase.

## Phase 48 objective

Establish whether repository evidence and read-only Apps Script metadata can prove that the project bound by `apps-script/.clasp.json` owns the existing Web App endpoint used by the repository frontend.

This is a deployment-identity investigation only. It does not authorize resolver implementation, Apps Script source changes, frontend changes, `clasp push`, deployment, Git push, or Google Sheets access.

## Evidence inventory

### Repository identity

- Git remote: `cmwebssaas-sudo/cmwebs-liff`.
- Current branch: `chore/v2-production-consolidation`.
- Current HEAD remains the Phase 38 documentation commit; Phase 39–47 artifacts and backend changes remain uncommitted.

### Clasp configuration

Exactly two `.clasp.json` files exist in the repository tree:

- `apps-script/.clasp.json`;
- `_deployed/apps-script/.clasp.json`.

Findings:

- both contain a non-empty `scriptId`;
- their `scriptId` values are identical;
- their complete `.clasp.json` bytes are identical;
- `apps-script/.clasp.json` is ignored and is not tracked by Git;
- its source root is the `apps-script/` directory;
- `clasp status` succeeds when executed from `apps-script/` and fails from repository root because no root `.clasp.json` exists.

The actual Script ID is intentionally excluded from this document.

### Apps Script manifest

Exactly two relevant manifests exist:

- `apps-script/appsscript.json`;
- `_deployed/apps-script/appsscript.json`.

They are byte-for-byte identical and define:

- V8 runtime;
- `Asia/Taipei` timezone;
- Web App execution as the deploying user;
- anonymous Web App access.

The manifest proves the expected runtime configuration but does not identify a deployment or prove ownership of a public Web App URL.

### Frontend endpoint references

A repository-wide content scan found one Web App endpoint fingerprint across 64 files:

- 33 repository-root HTML files;
- 26 candidate-overlay HTML files;
- `production-manifest.json`;
- `docs/03-CONFIGURATION.md`;
- related handoff/configuration artifacts.

This consistency proves that the handoff, candidate and repository frontend all refer to the same public endpoint. It does **not** prove which Apps Script project owns it.

`production-manifest.json` explicitly labels its source-of-truth status as `production-candidate-only` and warns that it must be reconciled with the actual deployed Apps Script project. Therefore the manifest endpoint cannot override contradictory live project metadata.

The actual Web App URL, deployment ID, LIFF IDs and test identities are intentionally not reproduced here.

### Read-only live metadata for the configured clasp project

Commands executed from `apps-script/`:

- `clasp status`;
- `clasp deployments`;
- `clasp versions`;
- `clasp list` with identifiers masked.

Results:

- the configured Script project exists and is accessible;
- it exposes one deployment at `@HEAD`;
- it has no immutable deployed script versions;
- its deployment identifier does not equal the deployment identifier in the repository frontend endpoint;
- the authenticated clasp project list is insufficient to map the frontend deployment ID back to an owning Script project.

No project, version or deployment was created, updated or deleted.

### Git history

Git history shows the endpoint was introduced and propagated through the handoff/frontend history. No tracked `.clasp.json` history exists that links that endpoint to a Script ID. This is consistent with the policy that `.clasp.json` is local deployment metadata, but it means Git cannot resolve the ownership relationship.

## Ownership decision

### What is confirmed

1. The canonical and deployed-snapshot `.clasp.json` files point to the same existing Apps Script project.
2. The canonical and deployed-snapshot manifests are identical.
3. All current frontend and candidate references use one consistent Web App endpoint.
4. The endpoint deployment ID is not present in the configured project's current deployment list.
5. The configured project has no immutable version that can be mapped to the existing frontend endpoint.

### What is not confirmed

1. The Script ID of the project that owns the frontend endpoint.
2. Whether that owning project is still accessible to the current operator.
3. The immutable version currently serving the endpoint.
4. Whether `_deployed/apps-script` was exported from the endpoint's true owner or from the currently configured, deployment-mismatched project.
5. Which existing deployment must be updated while preserving the production Web App URL.

### Conclusion

Repository evidence cannot prove that `apps-script/.clasp.json` points to the backend serving the repository frontend. The mismatch is real, not a missing local clasp configuration.

Do not replace `.clasp.json`, change the frontend URL, create a new Script project, create a new Web App deployment, push source, or deploy based on inference. The canonical deployment owner must be confirmed manually in an authenticated Apps Script console or a secure deployment record.

## Modified files

Phase 48 modifies only:

- `docs/48-CANONICAL-DEPLOYMENT-OWNERSHIP.md`.

No Apps Script, HTML, manifest, clasp configuration, Google Sheet, Script Property, trigger or deployment is modified.

## Validation results

Final results:

- `npm run validate`: PASS;
- Apps Script files: 31;
- HTML files: 44;
- routes: 68 unique, 68/68 handler coverage;
- duplicate top-level declarations: 0;
- blocking credentials and hardcoded LINE UID findings: 0;
- all `apps-script/*.js` Node syntax checks: PASS;
- `git diff --check`: PASS;
- `clasp status` from `apps-script/`: PASS;
- canonical/deployed `.clasp.json` equality: PASS;
- canonical/deployed `appsscript.json` equality: PASS;
- ownership mapping: FAIL / unresolved.

Static validation cannot clear an ownership failure.

## Risks

### Wrong-project push

Running `clasp push` now could update a Script project that is not serving the frontend endpoint. This could create false confidence while leaving production unchanged, or alter an unrelated source project.

### Wrong deployment update

Creating a new deployment would violate the required stable Web App URL. Updating the only visible `@HEAD` deployment would not update the endpoint referenced by the frontend.

### Irrecoverable rollback gap

The configured project has no immutable version history. Without the endpoint owner's existing deployment/version record, the required previous-known-good rollback target is unavailable.

### Source provenance ambiguity

Matching local and deployed-snapshot clasp files proves snapshot provenance only relative to that local binding. It does not prove the public endpoint is owned by the same project.

### Sensitive configuration exposure

Existing configuration artifacts contain public endpoints and legacy test identifiers. Do not copy full Script IDs, deployment IDs, UIDs, credentials or Script Property values into Git, terminal summaries or screenshots.

## Required human operation

An authorized operator must perform the following without changing any deployment:

1. Open the existing Web App endpoint's Apps Script **Manage deployments** record under the account that owns it.
2. Record privately:
   - owning Script ID;
   - existing deployment ID;
   - current executable version;
   - deployment owner/account;
   - execute-as and access settings;
   - previous known-good version.
3. Compare the owning Script ID privately with `apps-script/.clasp.json`.
4. Export or pull the owning project's source into an isolated directory and compare it with `_deployed/apps-script` and the canonical baseline by SHA-256.
5. Choose one outcome explicitly:
   - **Match**: confirm the existing `.clasp.json` binding and explain why its deployment list omitted the serving endpoint;
   - **Different project**: replace the local ignored `.clasp.json` only after confirming the correct Script ID and preserving the existing endpoint;
   - **Owner unavailable**: stop release and recover access; do not create a replacement Web App URL.
6. Store IDs in an access-controlled deployment record, not in this repository.

No source push is needed to complete this ownership check.

## Next-stage recommendation

Phase 49 should begin only after the human ownership record confirms the exact project and existing deployment.

Recommended next task after confirmation:

1. freeze an isolated source and deployment rollback point;
2. implement the deterministic landlord-link selection rule in the shared resolver;
3. exclude or separately gate manual repair and generic View-sync changes from the emergency Tenant read release;
4. validate Home, Message and Bills against the confirmed canonical project;
5. obtain separate approval before any `clasp push` or deployment.

If ownership remains unresolved, Phase 49 must remain blocked and no backend source change should be promoted.

## No-production-change declaration

Phase 48 performs read-only repository and clasp metadata checks only. It does not execute `clasp push`, `clasp pull`, `clasp deploy`, Git push, Google Sheets access, Script Property changes, migration, repair, LINE push, billing/payment operations, or frontend deployment.
