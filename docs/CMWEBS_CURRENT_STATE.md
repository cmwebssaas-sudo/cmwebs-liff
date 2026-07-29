# CMWebs Current State

**Status: AUTHORITATIVE current-state record**
**Last verified: 2026-07-30 (Asia/Taipei)**

This file records only verified evidence. It is not deployment authority and
must be refreshed before any Production action.

## Gate 0 / Production Consolidation

`GATE_0=HUMAN_REQUIRED` for the current serving source reconciliation.

The prior Version 85 baseline evidence remains useful, but it is not enough to
claim that the current serving Apps Script source is identical to GitHub
`main`. An immutable Version 87 source export was read-only compared on
2026-07-30 and contains deliberate runtime changes that have not all been
reconciled into `main`.

| Gate item | Verified state | Evidence reference |
| --- | --- | --- |
| GitHub main reconciliation | PASS | PR #3 merged the Version 85 baseline as `0328472` / `989dc8c`; PR #5 merged the Version 87 reminder tenant-source repair as `fbefa6f`. |
| Serving Apps Script snapshot | PASS | Read-only immutable Version 87 export inspected on 2026-07-30. |
| Serving-to-main source reconciliation | HUMAN_REQUIRED | Version 87 has no exact matching Git commit. Its contract-sync bridge, contract schema fields, workspace read options, and `doPost` routing are absent from `main`. |
| Rollback reference | PASS | Immutable Version 85 is retained as the rollback reference for the Version 87 reminder repair. |
| Google Sheets schema | PASS | Read-only metadata/header capture: 69 tabs, including core V2 tables. |
| Script Properties | PASS | Read-only presence-only inventory captured; no values retained. |
| Trigger inventory | PASS | Existing time-driven handlers: `runV2AutomaticPaymentReminders` and `syncV1PaidBillsToV2`. |
| Route/handler baseline | PASS | Canonical snapshot validation passed with 69 unique routes/handlers. |
| Unique canonical source | HUMAN_REQUIRED | `main` is the Version 85 baseline, but cannot yet be called the source-equivalent record for serving Version 87. |
| V2 internal-beta baseline | HISTORICAL | `V2_INTERNAL_BETA_BASELINE=Version85`; serving Version 87 requires source reconciliation before a new canonical label. |

## Serving and rollback references

- **Apps Script serving version:** Version 87, verified by read-only
  deployment/version metadata and immutable source export on 2026-07-30.
- **Apps Script rollback version:** Version 85, retained as the rollback
  reference for the Version 87 reminder repair.
- **GitHub Pages:** no Pages publication occurred in this consolidation. Its
  live revision is not inferred from this backend/source record.
- **Production editor source:** must not be assumed to equal a deployment
  version merely because an Apps Script editor is open; immutable deployment
  version and source export are authoritative.

### Version 87 source-reconciliation evidence

The read-only comparison against Version 85 found six relevant differences:

- `V2_AUTO_PAYMENT_REMINDER.js`: canonical tenant-source repair; merged to
  `main` by PR #5 (`aaab086`, merge `fbefa6f`).
- `V2_LEGACY_CONTRACT_SIGNED_SYNC.js`: a signed legacy-contract sync bridge;
  present in Version 87 but absent from `main`.
- `V2_TENANT_LEASE_ONBOARDING.js`: legacy signed-contract artifact columns;
  present in Version 87 but absent from `main`.
- `V2_WORKSPACE_LANDLORD_ACCESS.js`: read paths can skip schema/context
  creation; present in Version 87 but absent from `main`.
- `程式碼.js`: dispatches signed legacy sync POST requests before falling back
  to the LINE webhook; present in Version 87 but absent from `main`.
- `appsscript.json`: formatting-only manifest difference.

Repository history traces the missing bridge/schema/dispatcher work to the
existing local commits `251c14b` and `b420df6`; those commits have not been
merged into `main`. No source should be copied wholesale from Production.

### Required human decision

Decide whether the existing legacy signed-contract sync bridge is an approved
V2.0 Production dependency. Then an isolated candidate may either reconcile
the reviewed bridge into `main` with focused tests or retire it through a
separately approved Production release. Until that decision and an exact
source comparison are recorded, deployment from current `main` is blocked.

## Operational boundary

V2.0 remains the internal Production baseline. Gate 0 completion authorizes no
feature by itself. V2.1 needs a separate, explicitly scoped authorization and
must follow `CMWEBS_PRODUCT_ROADMAP.md` and `CMWEBS_RELEASE_RULES.md`.

## New-conversation handoff

```text
Project: CMWebs 智慧租管 / cmwebs-liff
Read AGENTS.md and all docs/CMWEBS_*.md files first.
Recommended model: gpt-5.6-terra; speed: medium.

Historical V2 internal-beta baseline: Apps Script Version 85 in GitHub main
(PR #3 / merge 0328472). Current serving backend: Version 87; rollback
reference: Version 85. Version 87 is not source-equivalent to `main` because
its legacy signed-contract sync bridge is unmerged.

Gate 0 is HUMAN_REQUIRED for serving-source reconciliation. Do not deploy
from `main`, infer a current live deployment, or alter Sheet, Properties,
triggers, LINE, LIFF, or Pages without fresh scoped approval. Classify all
work as V2.0/V2.1/V3/V4. V2.1 requires separate authorization.
```
