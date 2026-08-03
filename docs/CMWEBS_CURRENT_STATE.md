# CMWebs Current State

**Status: AUTHORITATIVE current-state record**
**Last verified: 2026-08-03 (Asia/Taipei)**

This record distinguishes verified source reconciliation from live Production
state. It is not deployment authority. Re-verify the relevant target, account,
version, rollback, and runtime state before every Production action.

## Gate 0 / Production Consolidation

`GATE_0=PASS` for canonical source reconciliation.

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

This evidence proves source reconciliation only. It does **not** prove a fresh
Production deployment, runtime/UAT result, current Apps Script serving version,
current rollback version, Google Sheets state, Properties, triggers, LINE/LIFF,
or GitHub Pages state.

## Serving and rollback references

- **Canonical source baseline:** the Version 89 source tree described above,
  reconciled to GitHub `main` by PR #12.
- **Current serving and rollback versions:** `HUMAN_REQUIRED` for each future
  Production action. Do not infer them from this document or from historical
  release evidence.
- **GitHub Pages:** its live revision is separate from backend-source evidence
  and must be independently verified before a Pages action.
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

On 2026-08-03, the only V2.1 authorization recorded here is a local
documentation-baseline synchronization. It permits no Production read/write,
runtime test, deployment, GitHub Pages publication, account action, or feature
implementation. V2.1 work remains bounded by
`CMWEBS_PRODUCT_ROADMAP.md`, `CMWEBS_ARCHITECTURE_DECISIONS.md`, and
`CMWEBS_RELEASE_RULES.md`; every later work unit needs its own explicit scope
authorization.

## New-conversation handoff

```text
Project: CMWebs 智慧租管 / cmwebs-liff
Read AGENTS.md and all docs/CMWEBS_*.md files first.
Recommended model: gpt-5.6-terra; speed: medium.

Gate 0 canonical source reconciliation is PASS. Immutable Apps Script Version
89 source is byte-identical to approved commit 9a17c4b; canonical Git main
contains that same tree through PR #12 merge 747b484.

This is source evidence, not a current Production deployment claim. Re-verify
the target account, project, serving version, rollback version, live runtime,
and any external surface before a scoped action. V2.1 currently has only a
separately authorized local documentation-baseline unit; later V2.1 work needs
separate authorization.
```
