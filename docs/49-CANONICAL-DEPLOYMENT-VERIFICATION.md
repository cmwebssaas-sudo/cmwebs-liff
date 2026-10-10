# Phase 49 — Canonical Apps Script Deployment Verification

Date: 2026-07-20  
Branch: `chore/v2-production-consolidation`  
Decision: **INSUFFICIENT_EVIDENCE**

## Scope

Phase 49 verifies deployment ownership without changing source, configuration, deployment, Google Sheets or LINE state. It reads the Phase 48 conclusion, local clasp binding, Apps Script manifests, deployed snapshot inventory, repository frontend endpoints and read-only clasp deployment metadata.

All Script IDs and deployment tokens are masked. This document contains no full Script ID, Deployment ID, API key, token, credential, Script Property value or LINE UID.

## Phase 48 baseline

Phase 48 established:

- `apps-script/.clasp.json` exists and is valid;
- it is identical to `_deployed/apps-script/.clasp.json`;
- the canonical and deployed manifests are identical;
- the frontend endpoint's deployment token is absent from the canonical clasp project's deployment list;
- deployment ownership cannot be proven from repository evidence alone;
- no push or deployment is allowed until an authenticated human verifies the owning project and existing deployment.

## Local canonical project

The current Apps Script project name was supplied by the operator as:

```text
綠界結帳
```

This name is descriptive only and is not a stable ownership key. Project ownership must be verified by Script ID equality and deployment records.

| Field | Result |
|---|---|
| Canonical clasp file | `apps-script/.clasp.json` |
| Canonical masked Script ID | `1JmW2N…ihRJ` |
| Deployed snapshot masked Script ID | `1JmW2N…ihRJ` |
| Canonical versus snapshot Script ID | MATCH |
| Canonical versus snapshot `.clasp.json` bytes | MATCH |
| Canonical clasp source root | `apps-script/` |
| Clasp binding tracked by Git | No; ignored local configuration |

The matching local and snapshot Script IDs establish their shared source binding. They do not establish ownership of the frontend Web App endpoint.

## Manifest verification

`apps-script/appsscript.json` and `_deployed/apps-script/appsscript.json` are byte-for-byte identical.

| Setting | Value |
|---|---|
| Timezone | `Asia/Taipei` |
| Runtime | `V8` |
| Exception logging | `STACKDRIVER` |
| Web App execute-as | `USER_DEPLOYING` |
| Web App access | `ANYONE_ANONYMOUS` |

These are expected manifest settings. The live deployment must still be checked in **Deploy → Manage deployments** because manifest intent does not prove the active deployment configuration.

## Deployed snapshot inventory

`_deployed/apps-script` contains:

- 30 JavaScript source files;
- `appsscript.json`;
- `.clasp.json`;
- no additional source subdirectory.

The snapshot includes `程式碼.js`, `V2_API.js`, `TESTS.js`, and all previously inventoried production `V2_*.js` modules. Its clasp binding and manifest match the canonical copies.

## Frontend endpoint inventory

The repository root contains 44 HTML files. Thirty-three contain an Apps Script Web App endpoint, and every one uses the same endpoint.

| Field | Frontend value |
|---|---|
| Host | `script.google.com` |
| Path type | `/macros/s/{deployment}/exec` |
| Masked deployment token | `AKfycb…X6Og` |
| Unique frontend endpoint count | 1 |
| HTML references | 33 |

No complete Web App URL is recorded here.

## Canonical clasp project deployment metadata

Read-only `clasp deployments` and `clasp versions` were executed from `apps-script/`.

| Field | Canonical clasp project value |
|---|---|
| Deployment count | 1 |
| Deployment type/version reference | `@HEAD` |
| Host | `script.google.com` when represented as a Web App path |
| Path type | `/macros/s/{deployment}/exec` |
| Masked deployment token | `AKfycb…MdBJ` |
| Immutable deployed versions | None |

## Endpoint comparison

| Comparison | Frontend | Canonical clasp project | Result |
|---|---|---|---|
| Host | `script.google.com` | `script.google.com` | MATCH |
| Path type | `/macros/s/{deployment}/exec` | `/macros/s/{deployment}/exec` | MATCH |
| Masked deployment token | `AKfycb…X6Og` | `AKfycb…MdBJ` | **MISMATCH** |
| Immutable current version | Unknown | None | NOT VERIFIABLE |
| Previous version | Unknown | None | NOT VERIFIABLE |

A deployment token identifies a deployment but does not reveal its owning Script ID. Therefore token mismatch proves the two deployment records differ, but it does not by itself prove whether they belong to the same or different Script projects.

## Decision

### Current classification

**INSUFFICIENT_EVIDENCE**

Reasoning:

1. The canonical and deployed-snapshot Script IDs match each other.
2. The frontend and canonical project deployment tokens do not match.
3. The canonical project exposes no immutable deployed version.
4. No authenticated **Manage deployments** evidence has yet established the Script ID that owns `AKfycb…X6Og`.
5. Project name alone cannot establish ownership.

The classification must not be upgraded to `PROJECT_MATCH_DEPLOYMENT_MISMATCH` until a human confirms that the frontend deployment belongs to the same Script ID. It must not be changed to `PROJECT_MISMATCH` until a different owning Script ID is confirmed.

## Decision matrix

| Owning Script ID compared with canonical `.clasp.json` | Frontend deployment token found under that project | Version and URL verified | Classification |
|---|---|---|---|
| Match | Yes, token matches | Yes | `VERIFIED_CANONICAL` |
| Match | No, only a different token is present | Sufficient deployment evidence | `PROJECT_MATCH_DEPLOYMENT_MISMATCH` |
| Different | Frontend token belongs to the different project | Yes | `PROJECT_MISMATCH` |
| Unknown, masked comparison unavailable, or evidence incomplete | Any | No or incomplete | `INSUFFICIENT_EVIDENCE` |

When evidence conflicts, choose `INSUFFICIENT_EVIDENCE` and stop. Never infer ownership from project title, file contents, deployment-token prefix, account position or physical browser tab.

## Non-sensitive fields the operator may provide

Provide only:

- project name;
- `script_id_matches_canonical: YES / NO / UNKNOWN`;
- masked Script ID in first-six/last-four format;
- deployment type, such as `Web app`;
- masked deployment token in first-six/last-four format;
- `deployment_token_matches_frontend: YES / NO / UNKNOWN`;
- execute-as category without account email;
- access category;
- current numeric version or `HEAD`;
- previous numeric version or `NONE / UNKNOWN`;
- host only;
- path type only;
- `web_app_url_matches_frontend: YES / NO / UNKNOWN`;
- whether a rollback version exists;
- screenshot filenames with no IDs or personal data.

Do not provide full identifiers even in chat.

## Safe screenshot locations

Screenshots may be taken from:

1. **Project Settings** around the project name and Script ID section, after masking the Script ID and account information.
2. **Deploy → Manage deployments** showing one selected deployment's type, version, execute-as, access and Web App URL, after masking the deployment token and full URL.
3. **Project history** or the deployment version selector showing current and previous numeric versions, after masking account names and unrelated project data.

Crop screenshots to the smallest relevant region. Apply masking before uploading or sharing.

## Fields that must be hidden

- complete Script ID;
- complete Deployment ID;
- complete Web App URL;
- Google account email, avatar identity and owner name;
- Google Cloud project number or OAuth client identifiers;
- Script Properties and their values;
- API keys, access tokens, refresh tokens and credentials;
- LINE UIDs, LIFF IDs and tenant or landlord personal data;
- Spreadsheet IDs, Sheet contents and execution logs;
- browser profile details and unrelated project names.

## Validation results

Final validation:

- `npm run validate`: PASS;
- Apps Script files: 31;
- HTML files: 44;
- routes: 68 unique;
- handler coverage: 68/68;
- duplicate top-level declarations: 0;
- blocking credentials: 0;
- hardcoded LINE UID findings: 0;
- manifest and HTML links: PASS;
- `git diff --check`: PASS;
- Phase 49 allowed-file scope: PASS; only the two `docs/49-*` files were added;
- ownership classification: `INSUFFICIENT_EVIDENCE`.

## Phase 50 allowed actions

### If `VERIFIED_CANONICAL`

Phase 50 may, without deploying:

- record an access-controlled rollback point;
- pull the verified project into an isolated temporary directory;
- compare source SHA-256 with `_deployed/apps-script` and canonical source;
- isolate the intended backend release set;
- implement and statically test deterministic landlord-link selection after separate code-change approval.

`clasp push` and deployment still require explicit approval.

### If `PROJECT_MATCH_DEPLOYMENT_MISMATCH`

Phase 50 may only reconcile deployment history:

- determine whether the frontend URL is stale or the deployment record is missing/archived;
- identify the existing deployment that must retain its URL;
- recover current and previous version numbers;
- update documentation and rollback planning.

Do not change frontend URLs, create deployments or push source.

### If `PROJECT_MISMATCH`

Phase 50 may only prepare a secure binding correction plan:

- export the true owner's source read-only;
- compare it with canonical and deployed snapshots;
- document the correct Script ID in a secure record;
- propose a local `.clasp.json` correction for separate approval.

Do not automatically rewrite `.clasp.json`.

### If `INSUFFICIENT_EVIDENCE`

Phase 50 is limited to collecting the missing masked UI evidence. No code, binding, deployment, frontend or data action is allowed.

## No-change declaration

Phase 49 does not modify Apps Script code, HTML, `appsscript.json`, `.clasp.json`, Google Sheets, Script Properties, triggers, versions or deployments. It does not execute `clasp push`, `clasp pull`, `clasp deploy`, Git commit, Git push, LINE push, repair, migration, billing or payment operations.
