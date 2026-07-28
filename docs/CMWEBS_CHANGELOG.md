# CMWebs Changelog

**Status: AUTHORITATIVE product-memory changelog**

## 2026-07-30 — Version 87 source reconciliation closed

- PR #6 merged the retained legacy signed-contract sync bridge and its focused
  regression test into GitHub `main` as `ae2961d`.
- A minimal final comparison found current `main` source-equivalent to the
  immutable serving Version 87 export: the remaining reminder difference is
  comment/format only and `appsscript.json` is semantically equivalent JSON.
- `GATE_0=PASS` is restored for current serving-source reconciliation and
  `V2_INTERNAL_BETA_BASELINE=Version87` is recorded.
- No Apps Script deployment, GitHub Pages publication, Production data or
  configuration change, LINE/LIFF change, or manual message send occurred.

## 2026-07-30 — Serving Version 87 source-reconciliation hold

- Read-only deployment metadata and immutable source export verified that the
  serving Apps Script release is Version 87, with Version 85 retained as its
  rollback reference.
- The Version 87 overdue-reminder tenant-source repair is in `main` through
  PR #5 (`aaab086`, merge `fbefa6f`).
- The Version 87 source also contains an unmerged signed legacy-contract sync
  bridge, related contract schema fields, workspace read options, and POST
  dispatch. Git history traces that work to `251c14b` and `b420df6`.
- `GATE_0` is therefore recorded as `HUMAN_REQUIRED` for serving-source
  reconciliation. No Apps Script deployment, GitHub Pages publication,
  Production data or configuration change, LINE/LIFF change, or manual
  message send occurred.

## 2026-07-29 — Unpublished V2.1 native signing foundation

- Added verified LIFF signing-session and private contract-artifact foundations
  to an isolated local branch only; no Apps Script deployment or Production
  data/configuration action occurred.
- Server-side principal resolution and backend-derived `signing_mode` control
  the permitted artifacts. Normal renewal is signature-only; missing mode or
  missing artifact schema fail closed.
- The final signing-submit action is intentionally not added or simulated.

## 2026-07-29 — Gate 0 canonical baseline formalization

- GitHub PR #3 merged the immutable Apps Script Version 85 source snapshot,
  manifest, and API route inventory into `main`.
- Version 85 is recorded as the V2 internal-beta canonical backend baseline;
  Version 75 is the verified immutable Apps Script rollback reference.
- Production evidence was collected read-only: serving deployment identity,
  Properties key presence, trigger inventory, and Google Sheets schema headers.
- No deployment, GitHub Pages publication, Production data change, trigger
  change, Property change, LINE/LIFF change, or manual message send occurred.

## 2026-07-29 — Product-memory consolidation

- Recorded authoritative V2/V3/V4 boundaries, BYO LINE OA ownership, standard
  branding, no functional customization, and the V2 performance priorities.
- Added a new-conversation handoff contract and release-safety rules.
