# Phase 122B - Production Read-Only Evidence Capture

Date: 2026-07-23 21:37:24+08:00
Decision: **BLOCKED - the current local clasp binding is not the serving Production project.**

## Scope and safety record

This phase used only local repository inspection and the read-only `clasp
deployments` inventory command. It did not execute an Apps Script function,
read any Script Property value, inspect Sheet data, create a deployment, change
a trigger, or modify a Production resource.

| Control | Result |
| --- | --- |
| Production changed | NO |
| Git pushed | NO |
| Deployment created or updated | NO |
| Script Property values read or recorded | NO |
| Spreadsheet content read or recorded | NO |
| Staged entries before capture | 0 |
| Conflicted entries before capture | 0 |

## Inputs and identity reconciliation

The following RC manifests parsed successfully before this capture:

- `release-manifests/cmwebs-v2-rc1-scope-manifest.json`
- `release-manifests/cmwebs-v2-rc1-sha-manifest.json`
- `release-manifests/cmwebs-v2-rc1-path-classification.json`

The path-classification summary retains zero unresolved blockers. This is only a
candidate-scope result, not a Production binding result.

| Evidence source | Observation | Status |
| --- | --- | --- |
| `apps-script/.clasp.json` | Local binding SHA-256: `8be891f7be33c46ac63ead80efafd167cfb54da3e4a1ba348abd63d231925fb1` | VERIFIED as local configuration only |
| `release/phase57/production-rollback-metadata.json` | Historical serving Production project SHA-256: `601b2190f15a93eb5bbcbb1ade48922b1352825d32bb01add37c28ca1f8fa985` | Historical record only |
| Local vs. historical Production script project | The SHA-256 values differ. | MISMATCH |
| Read-only `clasp deployments` against the local binding | One deployment, masked ID `AKfycb...MdBJ`, SHA-256 `97f28cf71041e582582ea59f1af24507129f7dbdc5630c6af57e9ba33a570b3a`, version reference `@HEAD`. | MISMATCH for Production evidence |

The read-only inventory proves that the signed-in local clasp account can query
the locally bound project. It does **not** prove the identity, version, or
configuration of the serving Production project because the local project
binding differs from the recorded Production project. The `@HEAD` reference is
not an immutable version number and cannot satisfy the RC freeze requirement.

## Production Apps Script deployment evidence

| Item | Result | Verification method | Status |
| --- | --- | --- | --- |
| Serving script project identity | Not obtained from the serving project | Local binding reconciliation against Phase 57 record | HUMAN_REQUIRED |
| Serving Web App deployment ID | Not obtained from the serving project | Local deployment inventory is a different project | HUMAN_REQUIRED |
| Serving immutable version | Not obtained | Local inventory reports `@HEAD`, which is not immutable-version evidence | BLOCKED |
| Web App execute-as and access policy | Not obtained | Requires serving-project deployment detail view | HUMAN_REQUIRED |
| Previous rollback version | Historical values exist only | Must be re-confirmed in serving-project version history | HUMAN_REQUIRED |
| Source/deployment SHA mapping | Not possible | Candidate SHA manifest cannot be compared to an unverified serving project | BLOCKED |

## Script Properties presence-only inventory

No Property values were requested, read, stored, or emitted. The keys below are
the required presence-only inventory from `docs/99-PRODUCTION-RELEASE-GATE-CLOSURE.md`.
Their result is intentionally not inferred from source text or from the local
non-Production clasp project.

| Property key | Purpose | Presence result |
| --- | --- | --- |
| `CMWEBS_ENVIRONMENT` | Environment separation marker | HUMAN_REQUIRED |
| `CMWEBS_SPREADSHEET_ID` | Production spreadsheet binding | HUMAN_REQUIRED |
| `CMWEBS_LINE_LOGIN_CHANNEL_ID` | LINE Login channel reference | HUMAN_REQUIRED |
| `CMWEB_TENANT_LIFF_URL` | Tenant LIFF mapping | HUMAN_REQUIRED |
| `CMWEB_TENANT_FRONTEND_BASE_URL` | Tenant frontend origin | HUMAN_REQUIRED |
| `CMWEB_LANDLORD_FRONTEND_BASE_URL` | Landlord frontend origin | HUMAN_REQUIRED |
| `LINE_CHANNEL_ACCESS_TOKEN` | Messaging credential presence only | HUMAN_REQUIRED |
| `CMWEBS_LINE_VERIFY_TIMEOUT_MS` | Login-verification timeout | HUMAN_REQUIRED |
| `CMWEBS_LINE_VERIFY_MAX_ATTEMPTS` | Login-verification bound | HUMAN_REQUIRED |
| `CMWEBS_NOTIFICATION_PROCESSING_TIMEOUT_MINUTES` | Worker recovery bound | HUMAN_REQUIRED |
| `CMWEBS_FEATURE_ALLOW_TEST_IDENTITY` | Test identity feature flag | HUMAN_REQUIRED |
| `CMWEBS_FEATURE_SCHEMA_MIGRATIONS` | Schema-migration feature flag | HUMAN_REQUIRED |
| `CMWEBS_FEATURE_NOTIFICATION_QUEUE` | Notification-queue feature flag | HUMAN_REQUIRED |
| `CMWEBS_FEATURE_REPAIR_WORKFLOW` | Repair-workflow feature flag | HUMAN_REQUIRED |
| `CMWEBS_FEATURE_LEASE_LIFECYCLE` | Lease-lifecycle feature flag | HUMAN_REQUIRED |
| `CMWEBS_FEATURE_BILLING_LIFECYCLE` | Billing-lifecycle feature flag | HUMAN_REQUIRED |
| `CMWEBS_FEATURE_MOVE_OUT_SETTLEMENT` | Move-out feature flag | HUMAN_REQUIRED |
| `CMWEBS_FEATURE_SECURITY_FAILURE_QUEUE` | Security-failure queue feature flag | HUMAN_REQUIRED |

## Trigger inventory

Source inspection identifies two candidate handlers only; it is not proof that
either handler is installed in Production. It also identifies three handlers
that must remain absent until independently approved.

| Handler | Expected cadence or state | Serving-project result |
| --- | --- | --- |
| `runV2AutomaticPaymentReminders` | Hourly when installed | HUMAN_REQUIRED |
| `syncV1PaidBillsToV2` | Every five minutes when installed; legacy candidate | HUMAN_REQUIRED |
| `processNotificationQueue` | Must be absent unless separately approved | HUMAN_REQUIRED |
| `processContractExpiryNotifications` | Must be absent unless separately approved | HUMAN_REQUIRED |
| `processBillingLifecycleNotifications` | Must be absent unless separately approved | HUMAN_REQUIRED |

The serving-project inventory still needs handler, trigger type, cadence, masked
owner, enabled/existing state, and duplicate/unexpected classification. No
trigger inspection function was executed because the local clasp project is not
the serving Production project.

## Spreadsheet and frontend/hosting evidence

| Evidence item | Result | Status |
| --- | --- | --- |
| Production Spreadsheet identity | Not obtained; ID is prohibited from this repository | HUMAN_REQUIRED |
| Sheet names | Not obtained | HUMAN_REQUIRED |
| Header/schema checksums | Not obtained | HUMAN_REQUIRED |
| Row counts | Not obtained | HUMAN_REQUIRED |
| Frontend hosting project and current revision | Not obtained | HUMAN_REQUIRED |
| Frontend artifact-to-RC-SHA comparison | Cannot compare without the serving hosting revision/artifact reference | BLOCKED |

## Exact read-only closure procedure

Use the serving Production Apps Script project, not the local project whose
binding SHA is recorded above. In the Apps Script UI, record only masked IDs,
version numbers, account role/owner category, and timestamps:

1. Open **Deployments -> Manage deployments** and capture the serving Web App
   type, masked deployment ID, immutable version, execute-as/access categories,
   and rollback version.
2. Open **Project Settings -> Script properties** and record each required key
   as `PRESENT` or `MISSING`; do not open, copy, or save its value.
3. Open **Triggers** and record handler, trigger type, cadence, masked owner,
   enabled state, and last-error category. Do not edit or delete a trigger.
4. Open the Production spreadsheet in read-only metadata mode and record only
   sheet name, header SHA-256, and row count. Do not export cell contents.
5. Open the Production hosting provider release history and record the immutable
   revision plus an artifact reference that can be compared to the RC SHA
   manifest.

## Final gate result

```text
PRODUCTION_EVIDENCE: BLOCKED
RC_FREEZE_READY: NO
```

Blocking condition: the available local clasp binding and its one queried
deployment are a different project from the historical serving Production
project. The remaining deployment, Properties, triggers, spreadsheet, and
hosting evidence must be captured from the actual serving project by an
authorized reviewer using the read-only procedure above.
