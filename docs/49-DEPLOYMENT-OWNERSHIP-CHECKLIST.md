# Phase 49 — Deployment Ownership Manual Checklist

Use this checklist in the existing Apps Script project. It is read-only. Do not click **Deploy**, **Save**, **New deployment**, **Archive**, **Delete**, or any action that changes a version or deployment.

Current automated classification: **INSUFFICIENT_EVIDENCE**

## Before opening settings

- [ ] Confirm the browser is signed into the intended authorized Google account.
- [ ] Confirm the visible project name is expected; currently reported as `綠界結帳`.
- [ ] Do not open Script Properties, execution logs, OAuth credentials or Google Sheets.
- [ ] Prepare an image editor or screenshot redaction tool before capturing evidence.
- [ ] Do not paste a complete Script ID, Deployment ID or Web App URL into chat or documentation.

## Project Settings verification

1. In the left sidebar, open **Project Settings**.
2. Record the project name as plain text.
3. Locate the Script ID.
4. Compare the full Script ID privately with `apps-script/.clasp.json`.
5. Do not copy the full value outside the private comparison.
6. Record only the Boolean match and a masked form.

Checklist:

- [ ] Project name: `________________`
- [ ] Masked Script ID: `______…____`
- [ ] Matches canonical `.clasp.json`: `YES / NO / UNKNOWN`
- [ ] Owning account is authorized: `YES / NO / UNKNOWN` — do not record email
- [ ] Screenshot filename: `________________` — no identifiers in filename

Safe screenshot crop:

- project name;
- label `Script ID`;
- masked first six and last four characters only.

Mask before sharing:

- middle and full Script ID;
- account email/avatar/name;
- Google Cloud project number;
- OAuth and property sections;
- unrelated settings.

## Manage deployments verification

1. Open **Deploy → Manage deployments**.
2. Select the existing deployment whose URL is expected to serve the Tenant frontend.
3. Do not select **New deployment**.
4. Do not click the edit pencil unless needed only to reveal read-only fields; if opened, do not save or deploy.
5. Record the following using masked or categorical values only.

Checklist:

- [ ] Deployment type: `Web app / API executable / Add-on / Other`
- [ ] Masked Deployment ID: `______…____`
- [ ] Matches frontend token `AKfycb…X6Og`: `YES / NO / UNKNOWN`
- [ ] Execute as: `DEPLOYING_USER / ACCESSING_USER / OTHER / UNKNOWN`
- [ ] Access: `ANYONE_ANONYMOUS / ANYONE / DOMAIN / ONLY_MYSELF / OTHER / UNKNOWN`
- [ ] Current version: `________` or `HEAD / UNKNOWN`
- [ ] Previous version: `________` or `NONE / UNKNOWN`
- [ ] Web App host: `script.google.com / OTHER / UNKNOWN`
- [ ] Web App path type: `/macros/s/{deployment}/exec / OTHER / UNKNOWN`
- [ ] Web App URL matches repository frontend: `YES / NO / UNKNOWN`
- [ ] Rollback version exists: `YES / NO / UNKNOWN`
- [ ] Screenshot filename: `________________`

Safe screenshot crop:

- selected deployment name/description without personal information;
- deployment type;
- masked deployment token;
- execute-as category;
- access category;
- current version number;
- masked Web App URL.

Mask before sharing:

- complete Deployment ID;
- complete Web App URL;
- account identity;
- unrelated deployments;
- descriptions containing tenant, customer or property data;
- any authorization, OAuth or credential information.

## Current and previous version verification

Use **Project history** or the version selector exposed by the existing deployment. Do not create a version.

- [ ] Current deployment version: `________`
- [ ] Previous known-good version: `________ / NONE / UNKNOWN`
- [ ] Current version timestamp recorded privately: `YES / NO`
- [ ] Previous version timestamp recorded privately: `YES / NO`
- [ ] No source or deployment was changed: `YES / NO`

Only numeric version numbers may be provided to Codex. Do not provide editor links, Script IDs, deployment IDs, account names or source screenshots.

## Frontend comparison

Use this known masked repository reference:

| Field | Repository frontend |
|---|---|
| Host | `script.google.com` |
| Path type | `/macros/s/{deployment}/exec` |
| Masked deployment token | `AKfycb…X6Og` |

Compare privately with the selected deployment:

- [ ] Host matches.
- [ ] Path type matches.
- [ ] Full deployment token matches privately.
- [ ] Full Web App URL matches privately.
- [ ] Only masked/Boolean results will be supplied to Codex.

## Non-sensitive response template

Copy only this template back to Codex:

```text
project_name: 綠界結帳
masked_script_id: ______…____
script_id_matches_canonical: YES / NO / UNKNOWN
deployment_type: WEB_APP / OTHER / UNKNOWN
masked_deployment_id: ______…____
deployment_id_matches_frontend: YES / NO / UNKNOWN
execute_as: DEPLOYING_USER / ACCESSING_USER / OTHER / UNKNOWN
access: ANYONE_ANONYMOUS / ANYONE / DOMAIN / ONLY_MYSELF / OTHER / UNKNOWN
current_version: NUMBER / HEAD / UNKNOWN
previous_version: NUMBER / NONE / UNKNOWN
web_app_host: script.google.com / OTHER / UNKNOWN
web_app_path_type: /macros/s/{deployment}/exec / OTHER / UNKNOWN
web_app_url_matches_frontend: YES / NO / UNKNOWN
rollback_version_exists: YES / NO / UNKNOWN
screenshots_redacted: YES / NO
```

Do not append any raw IDs, URLs, emails or screenshots that have not been redacted.

## Decision matrix

| Script ID match | Frontend deployment belongs to selected project | Deployment/URL match | Decision |
|---|---|---|---|
| YES | YES | YES | `VERIFIED_CANONICAL` |
| YES | YES | NO | `PROJECT_MATCH_DEPLOYMENT_MISMATCH` |
| NO | YES, under a different project | YES | `PROJECT_MISMATCH` |
| UNKNOWN or incomplete | UNKNOWN | Any | `INSUFFICIENT_EVIDENCE` |

If any required field is `UNKNOWN`, retain `INSUFFICIENT_EVIDENCE`.

## Phase 50 gate

### `VERIFIED_CANONICAL`

- [ ] Permit read-only isolated source pull and SHA-256 reconciliation.
- [ ] Permit rollback-record preparation.
- [ ] Permit planning/implementation of the deterministic landlord-link resolver only under a separate code-change scope.
- [ ] Do not permit push or deployment without explicit approval.

### `PROJECT_MATCH_DEPLOYMENT_MISMATCH`

- [ ] Reconcile missing/stale deployment history only.
- [ ] Do not change the frontend URL.
- [ ] Do not create a new deployment.
- [ ] Do not push source.

### `PROJECT_MISMATCH`

- [ ] Read-only export and source comparison only.
- [ ] Prepare a secure `.clasp.json` correction plan.
- [ ] Do not edit `.clasp.json` without separate approval.
- [ ] Do not deploy.

### `INSUFFICIENT_EVIDENCE`

- [ ] Collect missing masked UI fields.
- [ ] Keep backend release blocked.
- [ ] Do not modify code, configuration, deployment or data.

## Completion declaration

- [ ] No Apps Script source changed.
- [ ] No manifest or clasp binding changed.
- [ ] No deployment or version created/updated.
- [ ] No Google Sheet read/write was performed.
- [ ] No LINE message was sent.
- [ ] No complete identifier or credential was shared.
