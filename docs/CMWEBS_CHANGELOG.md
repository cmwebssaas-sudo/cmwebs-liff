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
- Focused source reconciliation confirmed that four previously flagged files
  are byte-identical to `main`; the remaining reminder and manifest changes
  are non-executing comments, whitespace, and JSON key order.
- `GATE_0=PASS` for Production Consolidation. This records source-equivalence
  only; it does not authorize an Apps Script deployment, GitHub Pages
  publication, Production data or configuration change, LINE/LIFF change, or
  manual message send.

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
