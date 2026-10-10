# Phase 108 — Production Release Candidate Freeze

Date: 2026-07-23  
Decision: **NO-GO — Release Candidate definition is complete, but no
Production artifact is frozen yet**

## Scope and freeze rule

This document defines the one acceptable Production Release Candidate (RC)
freeze process. It does not create a release artifact, modify Production,
deploy, write a Sheet/Property, commit, or push.

An RC becomes frozen only after every `TBD` value below is populated from a
clean, isolated, reviewer-approved artifact and independently recomputed by a
second reviewer. A repository worktree containing unrelated or staging changes
is never a Production RC source.

## 1. Release Candidate definition

| Surface | Freeze field | Current value | Acceptance rule |
| --- | --- | --- | --- |
| Frontend | Artifact SHA-256 | TBD | Hash is generated from Production-only hosting artifact. |
| Frontend | Hosting revision | TBD | Revision is approved, immutable, and has a known rollback revision. |
| Frontend | Environment manifest | TBD | Contains only Production origins/config; no staging/test fallback. |
| Backend | Apps Script source SHA-256 manifest | TBD | Every pushed file is listed; no unexpected file or credential finding. |
| Backend | Apps Script version | TBD | New immutable version is assigned only in a separately authorized deployment phase. |
| Backend | Serving baseline | Historical v74 | Reconfirm immediately before any release action. |
| Backend | Rollback version | Historical v73 | Reconfirm selectable on the same existing Web App deployment. |
| Schema | Approved migration version(s) | TBD | Only explicitly approved additive migrations are listed. |
| Schema | Preflight snapshot ID | TBD | Header, row-count, key, and Workspace coverage snapshot exists. |
| Configuration | Environment inventory timestamp | TBD | Presence/scope matrix is completed without values. |

### RC inclusion principle

The RC includes only components that are both required and approved for the
current V2 Production release. Optional lifecycle/workflow capabilities remain
excluded unless a separate product and security approval names them.

## 2. Source freeze checklist

### Frontend files and routes

- [ ] Production tenant/landlord HTML pages are selected from an isolated
      artifact, not from staging hosting or the aggregate worktree.
- [ ] Required `.html` routes resolve internally and retain canonical routing.
- [ ] Production LIFF/login/API origins are centrally configured and contain no
      staging LIFF ID, staging endpoint, staging host, or test UID.
- [ ] Phase 83 tenant-binding reconciliation behavior is included only after
      dedicated Production frontend review; it preserves existing route/API
      contract and does not auto-resubmit a bind mutation.
- [ ] No debug page, smoke-test page, fixture, mock transport, test route, or
      staging-only navigation is included.

### Backend modules and API routes

- [ ] Module list is generated from a clean isolated Apps Script release tree.
- [ ] Include only required Production runtime modules and `appsscript.json`.
- [ ] Exclude `TESTS`, repair tooling, diagnostics, migration runners, fixture
      setup, local configuration, `STAGING_*`, and unapproved lifecycle code.
- [ ] Route names, handler interfaces, payload schemas, and public JSONP/API
      contracts pass compatibility review.
- [ ] Route count, handler coverage, duplicate declaration, syntax, manifest,
      credential, and helper checks pass on the exact artifact.

### Notification templates and migration scripts

- [ ] Notification templates are included only if the queue feature, schema,
      worker recovery, Messaging channel, and explicit V2 scope are approved.
- [ ] Production-safe migration scripts are separated from runtime modules and
      are feature-gated; no migration runner is automatically deployed/enabled.
- [ ] Repair, move-out, settlement, and other out-of-scope workflow modules
      remain excluded unless explicitly approved.

## 3. Environment separation

Only presence, scope, ownership, and environment match are listed here. Never
record a secret, token, full identifier, or complete endpoint token.

| Resource | Staging requirement | Production requirement | Current Production evidence |
| --- | --- | --- | --- |
| LIFF ID(s) | Staging channel and staging host only. | Production channel and approved Production host only. | PENDING HUMAN CONFIRMATION |
| LINE Login channel | Staging audience/callback only. | Production audience/callback only. | PENDING HUMAN CONFIRMATION |
| Messaging API channel/token | Staging account/token only. | Separate Production account/token Property only. | PENDING HUMAN CONFIRMATION |
| Apps Script project | Staging script/project binding only. | Serving Production project/deployment binding only. | PENDING HUMAN CONFIRMATION |
| Spreadsheet binding | Staging-owned Sheet. | Production-owned Sheet via `CMWEBS_SPREADSHEET_ID`. | PENDING HUMAN CONFIRMATION |
| Environment marker | Staging value and staging flags. | `CMWEBS_ENVIRONMENT` identifies Production; test flags disabled. | PENDING HUMAN CONFIRMATION |
| Feature flags | Safe staging flags may be enabled for fixtures. | New workflow/queue/migration flags disabled until separately approved. | PENDING HUMAN CONFIRMATION |

Separation acceptance:

- [ ] No frontend or backend artifact file references a staging host, LIFF,
      channel, token, Script Property value, fixture, or test identity.
- [ ] No staging resource points at the serving Production Apps Script, Sheet,
      channel, token, or frontend host.
- [ ] A reviewer records only masked/datestamped console evidence.

## 4. Migration freeze

### Required order

```text
freeze artifacts and approvals
  → backup checkpoint
  → read-only schema preflight
  → approved additive schema migration
  → isolated backend deployment
  → isolated frontend deployment
  → trigger verification
  → read-only smoke test
```

### Dependency graph

```text
approved schema subset
  → schema preflight + backup
  → backend modules requiring that schema
  → compatible frontend artifact
  → approved feature flag / trigger
  → read-only tenant + landlord smoke tests
```

For notifications specifically:

```text
queue schema + template approval
  → mock recovery / idempotency proof
  → Production credential/flag/owner verification
  → one approved worker trigger
  → controlled activation
```

### Rollback point freeze

| Surface | Required rollback point | Current status |
| --- | --- | --- |
| Schema | Checked backup plus migration-owned row log; additive schema is disabled rather than destructively removed. | TBD |
| Backend | Existing Web App rollback version 73 with unchanged URL. | Historical; must re-confirm. |
| Frontend | Prior approved hosting revision and artifact hash. | TBD |
| Notification | Feature flag OFF, worker trigger disabled, queue/log evidence preserved. | TBD |

## 5. Artifact manifest

The following manifest must be completed from the exact isolated RC. Entries
are placeholders until two reviewers verify their checksums and inclusion.

| Artifact category | Manifest content | Freeze status |
| --- | --- | --- |
| Frontend | File list, SHA-256, hosting revision, expected `.html` routes, environment-origin scan result. | TBD |
| Backend | Module file list, SHA-256 per file, `appsscript.json` hash, route/handler validation result, masked project-binding confirmation. | TBD |
| Schema | Approved migration IDs, affected Sheets/headers, preflight snapshot, migration log/restore reference. | TBD |
| Documentation | Approved release notes, migration runbook, rollback runbook, human verification evidence references. | TBD |
| Tests | Canonical validator, staging validator, artifact-specific route/handler/credential/link scans, mock notification recovery, Workspace isolation evidence. | PARTIAL — static validators pass; remote evidence pending. |

Manifest exclusions (must be explicit):

```text
TESTS and admin diagnostics
repair/migration/fixture tooling
STAGING_* modules and staging resource config
local .clasp.json, OAuth files, credentials, tokens
test UIDs and mock-only transport
unapproved notification/lifecycle/financial workflows
```

## 6. GO / NO-GO matrix

### READY

- [x] Canonical repository static validation currently passes: 68 unique API
      routes, 68/68 handler coverage, no duplicate top-level declarations,
      zero blocking credential findings, and zero missing HTML links.
- [x] Staging release-tree static validation currently passes: 87 unique API
      routes, 87/87 handler coverage, no duplicate top-level declarations,
      zero blocking credential findings, and zero missing links.
- [x] This Phase does not modify Production, deploy, commit, or push.

### BLOCKED

- [ ] Clean isolated Production frontend and backend artifact lists/SHA-256
      manifests have not been created or second-reviewed.
- [ ] Production LIFF, LINE Login, Messaging channel, Properties, Spreadsheet,
      Apps Script binding, and trigger inventories are pending human evidence.
- [ ] Approved additive schema scope, preflight snapshot, backup/restore
      rehearsal, and migration owner are pending.
- [ ] Notification worker recovery, idempotency, trigger ownership, and
      emergency-stop proof are incomplete.
- [ ] Two-Workspace tenant/landlord isolation evidence is incomplete.
- [ ] Optional workflow scope is not approved for Production inclusion.

### Human approval required

1. Approve the exact V2 release scope and explicitly exclude unapproved
   lifecycle/repair/settlement modules.
2. Create a clean isolated candidate tree and have two reviewers freeze the
   frontend/backend/schema manifests.
3. Complete the presence-only Production environment and trigger inventory.
4. Approve the backup/rollback owners and validate the staging recovery and
   two-Workspace tests with sanitized evidence.
5. Reconfirm v74 serving status and v73 rollback availability immediately
   before any separately authorized deployment.

## Final decision

**NO-GO.** Phase 108 establishes the Release Candidate freeze format but does
not freeze a deployable Production candidate. Production remains untouched.

## Validation record

The canonical validator, staging validator, and `git diff --check` are run
for this Phase. Passing static validation is necessary but cannot freeze the
candidate until the missing environment, artifact, migration, recovery, and
approval evidence is attached.
