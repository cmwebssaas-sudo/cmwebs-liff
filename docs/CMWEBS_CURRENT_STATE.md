# CMWebs Current State

**Status: AUTHORITATIVE current-state record**
**Last verified: 2026-08-12 (Asia/Taipei)**

This record distinguishes verified source reconciliation from live Production
state. It is not deployment authority. Re-verify the relevant target, account,
version, rollback, and runtime state before every Production action.

## Gate 0 / Production Consolidation

Historical canonical source reconciliation for Version 89 is recorded as
`PASS`. The current serving-source parity gate is
`GATE_0_SOURCE_PARITY=BLOCKED` because Version 102 differs from GitHub `main`
in three payment-flow modules.

The approved source commit
`9a17c4bd2719d4cdb24058d4d797bd9281e4b06e` was reconciled with a read-only
immutable Apps Script Version 89 export. All 43 source files are
byte-identical. GitHub PR #12 then merged that exact source tree into canonical
`main` as merge commit
`747b484f871c18985cf414e6640ae04afe8303a1`.

| Gate item | Verified state | Evidence reference |
| --- | --- | --- |
| Immutable serving-source export | PASS | Read-only Version 89 export, 43 source files. |
| Export-to-approved-source comparison | PASS | Approved commit `9a17c4b` is byte-identical to the Version 89 export. |
| Canonical Git reconciliation | PASS | PR #12 merge `747b484` has the same source tree as `9a17c4b`. |
| Static source validation | PASS | 42 JavaScript syntax checks, eight focused checks, diff check, and sensitive-credential scan. |
| Unique canonical source | PASS | GitHub `main` is the canonical source record for the reconciled Version 89 tree. |

The Version 89 evidence proves only that historical source reconciliation. It
does **not** prove current Version 102 parity, Production runtime/UAT result,
current rollback version, Google Sheets state, Properties, triggers, LINE/LIFF,
or GitHub Pages state.

## 2026-08-12 read-only Production identity reconciliation

The current authenticated Apps Script editor was checked read-only under
`cmwebs.saas@gmail.com`. The project shown was `綠界結帳`; its active Web App
deployment was Version 102, with the description `Production V102: ignore
incomplete tenant payment bill rows`. The deployment executes as the owner and
is accessible to everyone. The deployment identifier is intentionally not
duplicated here.

The editor listed 42 `.gs` files. GitHub `main` at merge `0bbbe06e` listed 42
corresponding `.js` files after suffix normalization. This is an inventory
comparison, not a byte-level source export. The complete evidence is recorded
in [125-PRODUCTION-IDENTITY-RECONCILIATION-2026-08-12.md](125-PRODUCTION-IDENTITY-RECONCILIATION-2026-08-12.md).

The Phase 147 GitHub Pages deployment completed successfully in workflow
`31601674513`, and the four public tenant pages were fetched successfully. This
read-only package did not identify a rollback version and did not inspect or
change Sheets, Properties, triggers, LINE, LIFF runtime state, or payment data.

## 2026-08-12 Version 102 source parity result

An immutable read-only export of Apps Script Version 102 was compared with
GitHub `main` at `0865b88e`. The export contained 43 files. 40 matched by
SHA-256; three payment-flow modules differed: `V2_PAYMENT_SETTLEMENT.js`,
`V2_TENANT_PAYMENT_REPORTS.js`, and `V2_LANDLORD_MANAGEMENT.js`. No files were
missing. All 42 exported JavaScript files passed syntax checks.

This means current source parity is **blocked**, despite the earlier filename
inventory match. The complete hashes and classification are recorded in
[126-PRODUCTION-V102-SOURCE-DRIFT-2026-08-12.md](126-PRODUCTION-V102-SOURCE-DRIFT-2026-08-12.md).
Until an authorized owner selects the canonical three-module source, do not
deploy Apps Script or claim byte-level Gate 0 completion.

## Serving and rollback references

- **Canonical source baseline:** GitHub `main` at `0865b88e` is the repository
  baseline, but it is not byte-identical to the currently serving Version 102
  payment modules.
- **Current Apps Script serving version:** Version 102, verified read-only on
  2026-08-12; this is deployment identity evidence, not source equivalence.
- **Current Apps Script rollback version:** `HUMAN_REQUIRED`; it was not
  identified in the read-only reconciliation.
- **GitHub Pages:** merge `0bbbe06e` was deployed successfully by workflow
  `31601674513`; its public tenant pages were fetched successfully.
- **Production editor source:** an open Apps Script editor does not prove what
  immutable version is serving. Deployment metadata and a scoped source export
  are authoritative.

## Historical reconciliation context

The following is retained as historical evidence, not as current serving or
rollback status:

- On 2026-07-30, read-only Version 87 and Version 85 source comparisons
  reconciled the reminder repair, legacy signed-contract sync bridge, and
  related schema/dispatcher compatibility work to then-current `main`.
- That historical record included a 69-tab schema metadata capture,
  presence-only Script Properties inventory, existing trigger inventory, and a
  69-route/handler baseline.
- The previously recorded Version 85 rollback reference applied to the
  Version 87 reminder repair only. It must not be treated as a current
  rollback target.

## V2.1 authorization boundary

V2.0 remains the internal Production baseline. Gate 0 completion does not
authorize implementation or external operations.

On 2026-08-03, local documentation-baseline synchronization was authorized.
On 2026-08-04, a separate local-only candidate enabled the existing
request-local snapshot for `landlord_home_bootstrap`, with a focused mock. Both
are isolated, unpushed source records; neither permits Production read/write,
deployment, GitHub Pages publication, account action, or runtime/UAT claims.
V2.1 work remains bounded by
`CMWEBS_PRODUCT_ROADMAP.md`, `CMWEBS_ARCHITECTURE_DECISIONS.md`, and
`CMWEBS_RELEASE_RULES.md`; every later work unit needs its own explicit scope
authorization.

## New-conversation handoff

```text
Project: CMWebs 智慧租管 / cmwebs-liff
Read AGENTS.md and all docs/CMWEBS_*.md files first.
Recommended model: gpt-5.6-terra; speed: medium.

Historical Gate 0 canonical source reconciliation passed for immutable Apps
Script Version 89 and approved commit 9a17c4b through PR #12 merge 747b484.

The 2026-08-12 read-only reconciliation verified the target account, project,
serving Version 102, and GitHub Pages workflow, but found current source parity
blocked in three payment modules. It did not establish a rollback target, live
Sheets state, or runtime/UAT result. Re-verify those items before a scoped
Production action. V2.1 currently has local-only documentation and snapshot
candidates; later integration or external work needs separate authorization.
```
