# CMWebs Current State

**Status: AUTHORITATIVE current-state record**
**Last verified: 2026-07-30 (Asia/Taipei)**

This file records only verified evidence. It is not deployment authority and
must be refreshed before any Production action.

## Gate 0 / Production Consolidation

`GATE_0=PASS` for source consolidation and current serving-source
reconciliation.

The historical Version 85 baseline remains useful. The read-only immutable
Version 87 source export was compared with current GitHub `main` on
2026-07-30 after PR #6 merged. All runtime source is aligned; the remaining
differences are a comment/format-only change in the reminder module and
semantically equivalent JSON formatting in `appsscript.json`.

| Gate item | Verified state | Evidence reference |
| --- | --- | --- |
| GitHub main reconciliation | PASS | PR #3 merged the Version 85 baseline as `0328472` / `989dc8c`; PR #5 merged the Version 87 reminder tenant-source repair as `fbefa6f`. |
| Serving Apps Script snapshot | PASS | Read-only immutable Version 87 export inspected on 2026-07-30. |
| Serving-to-main source reconciliation | PASS | Version 87 compared to current `main`: all runtime logic is aligned; the reminder difference is comment/format only and `appsscript.json` parses to the same JSON. |
| Rollback reference | PASS | Immutable Version 85 is retained as the rollback reference for the Version 87 reminder repair. |
| Google Sheets schema | PASS | Read-only metadata/header capture: 69 tabs, including core V2 tables. |
| Script Properties | PASS | Read-only presence-only inventory captured; no values retained. |
| Trigger inventory | PASS | Existing time-driven handlers: `runV2AutomaticPaymentReminders` and `syncV1PaidBillsToV2`. |
| Route/handler baseline | PASS | Canonical snapshot validation passed with 69 unique routes/handlers. |
| Unique canonical source | PASS | GitHub `main` is source-equivalent to the serving Version 87 backend. |
| V2 internal-beta baseline | PASS | `V2_INTERNAL_BETA_BASELINE=Version87`. |

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
  `main` by PR #5 (`aaab086`, merge `fbefa6f`). The final export comparison
  found only explanatory comment/formatting differences.
- `V2_LEGACY_CONTRACT_SIGNED_SYNC.js`: a signed legacy-contract sync bridge;
  reconciled to `main` by PR #6 (merge `ae2961d`).
- `V2_TENANT_LEASE_ONBOARDING.js`: legacy signed-contract artifact columns;
  reconciled to `main` by PR #6.
- `V2_WORKSPACE_LANDLORD_ACCESS.js`: read paths can skip schema/context
  creation; reconciled to `main` by PR #6.
- `程式碼.js`: dispatches signed legacy sync POST requests before falling back
  to the LINE webhook; reconciled to `main` by PR #6.
- `appsscript.json`: formatting-only manifest difference; parsed JSON is
  semantically equivalent.

Repository history traces the bridge/schema/dispatcher work to
`251c14b` and `b420df6`. It was reconciled from the immutable Version 87
export through reviewed PR #6, without copying Production wholesale.

### Reconciliation result

The legacy signed-contract sync bridge was retained as an approved V2.0
Production dependency. The final comparison now supports GitHub `main` as the
Version 87 source-equivalent record. This reconciliation did not deploy Apps
Script or alter Production; any future deployment still needs its own scoped
preflight and authorization.

## Operational boundary

V2.0 remains the internal Production baseline. Gate 0 completion authorizes no
feature by itself. V2.1 needs a separate, explicitly scoped authorization and
must follow `CMWEBS_PRODUCT_ROADMAP.md` and `CMWEBS_RELEASE_RULES.md`.

## New-conversation handoff

```text
Project: CMWebs 智慧租管 / cmwebs-liff
Read AGENTS.md and all docs/CMWEBS_*.md files first.
Recommended model: gpt-5.6-terra; speed: medium.

Canonical V2 internal-beta backend baseline: Apps Script Version 87 in GitHub
`main` (PR #6 / merge `ae2961d`). Verified rollback reference: Version 85.
Gate 0 is PASS for current source reconciliation.

Do not infer a future live deployment, Sheet, Properties, trigger, LINE, LIFF,
or Pages state from this record; re-verify before each scoped action. Classify
all work as V2.0/V2.1/V3/V4. V2.1 requires separate authorization.
```
