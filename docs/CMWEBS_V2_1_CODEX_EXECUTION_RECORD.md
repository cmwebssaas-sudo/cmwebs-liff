# CMWebs V2.1 Codex Execution Record

**Status: AUTHORITATIVE V2.1 execution record**
**Last updated: 2026-08-03 (Asia/Taipei)**

## Purpose

This record separates V2.1 authorization and execution from Gate 0 source
reconciliation and from live Production claims. It is a work-control record,
not a deployment record or authorization for external actions.

## Canonical source baseline

Gate 0 source reconciliation is complete:

- The approved source commit `9a17c4bd2719d4cdb24058d4d797bd9281e4b06e` is
  byte-identical to the read-only immutable Apps Script Version 89 export
  across all 43 source files.
- GitHub PR #12 merged that exact source tree to canonical `main` as
  `747b484f871c18985cf414e6640ae04afe8303a1`.
- Static verification covered 42 JavaScript syntax checks, eight focused
  checks, `git diff --check`, and a sensitive-credential scan.

This baseline does not establish a current serving version, deployment state,
rollback target, runtime result, or external account state. Each of those must
be verified for the particular action that needs it.

## Recorded V2.1 authorization

| Date | Authorized unit | Boundary |
| --- | --- | --- |
| 2026-08-03 | Documentation authority-baseline synchronization | Only this record, `CMWEBS_CURRENT_STATE.md`, and `CMWEBS_CODEX_HANDOFF.md`; isolated local branch and local commit only. No push, deployment, Production access, runtime test, or source implementation. |

No other V2.1 activity is implied by this record.

## V2.1 scope boundary

Allowed V2.1 work remains limited to the approved Internal Operations
Completion scope: performance consolidation, fixed operational reporting,
standard digital-contract completion, backup/restore/runbook work, and real
operational-cycle verification. It must not introduce V3/V4 functionality,
architecture redesign, speculative refactoring, or customer-specific branches.

Existing native-signing code remains subject to the documented contract:
server-derived `signing_mode`, verified session and artifact, private
fail-closed access, normal-renewal signature-only flow, and an idempotent
submission that cannot activate a contract or fabricate approval. This records
the existing boundary; it does not authorize a new feature, UAT, or deployment.

## Next-work gates

| Candidate work | Required authorization and preflight |
| --- | --- |
| Local source or test change | Separate explicit scope, isolated branch, affected tests and documentation. |
| Backup/restore rehearsal | Separate explicit scope, target and data-handling preflight, and a stated rollback plan. |
| Production read-only verification | Separate explicit scope with account and exact target identity verification. |
| Production write or deployment | Separate explicit authorization after target, serving version, deployment, rollback, and impact checks. |
| LINE, LIFF, Pages, Properties, triggers, or payment surface | Separate authorization for that exact external surface. |

V2.1 is complete only after separately authorized scope work and operational
evidence satisfy the product and release rules, at which point
`V2_FEATURE_FREEZE=FINAL` may be recorded. This document does not make that
declaration.
