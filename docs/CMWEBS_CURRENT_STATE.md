# CMWebs Current State

**Status: AUTHORITATIVE current-state record**
**Last verified: 2026-07-29 (Asia/Taipei)**

This file records only verified evidence. It is not deployment authority and
must be refreshed before any Production action.

## Gate 0 / Production Consolidation

`GATE_0=PASS` for source consolidation and evidence closure.

| Gate item | Verified state | Evidence reference |
| --- | --- | --- |
| GitHub main reconciliation | PASS | PR #3 merged to `main` as `0328472`; reviewed snapshot commit `989dc8c`. |
| Serving Apps Script snapshot | PASS | Existing Web App served immutable Version 85; matching snapshot retained under `apps-script/`. |
| Rollback reference | PASS | Immutable Version 75 retained as the existing rollback deployment. |
| Google Sheets schema | PASS | Read-only metadata/header capture: 69 tabs, including core V2 tables. |
| Script Properties | PASS | Read-only presence-only inventory captured; no values retained. |
| Trigger inventory | PASS | Existing time-driven handlers: `runV2AutomaticPaymentReminders` and `syncV1PaidBillsToV2`. |
| Route/handler baseline | PASS | Canonical snapshot validation passed with 69 unique routes/handlers. |
| Unique canonical source | PASS | GitHub `main` is the V2 internal-beta canonical backend source. |
| V2 internal-beta baseline | PASS | `V2_INTERNAL_BETA_BASELINE=Version85`. |

## Serving and rollback references

- **Apps Script serving version:** Version 85, verified through the existing
  Web App deployment on 2026-07-29.
- **Apps Script rollback version:** Version 75, verified through the existing
  rollback deployment on 2026-07-29.
- **GitHub Pages:** no Pages publication occurred in this consolidation. Its
  live revision is not inferred from this backend/source record.
- **Production editor source:** must not be assumed to equal Version 85 merely
  because an Apps Script editor is open; deployment version is authoritative.

## Operational boundary

V2.0 remains the internal Production baseline. Gate 0 completion authorizes no
feature by itself. V2.1 needs a separate, explicitly scoped authorization and
must follow `CMWEBS_PRODUCT_ROADMAP.md` and `CMWEBS_RELEASE_RULES.md`.

## New-conversation handoff

```text
Project: CMWebs 智慧租管 / cmwebs-liff
Read AGENTS.md and all docs/CMWEBS_*.md files first.
Recommended model: gpt-5.6-terra; speed: medium.

Canonical V2 internal-beta backend baseline: Apps Script Version 85 in
GitHub main (PR #3 / merge 0328472). Verified rollback: Version 75.
Gate 0 is PASS. Do not infer a current live deployment, Sheet, Properties,
trigger, LINE, LIFF, or Pages state from this record; re-verify before action.
Classify all work as V2.0/V2.1/V3/V4. V2.1 requires separate authorization.
```
