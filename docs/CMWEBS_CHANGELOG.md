# CMWebs Changelog

**Status: AUTHORITATIVE product-memory changelog**

## 2026-08-13 — Payment write timeout recovery (local candidate)

- Added client-side authoritative-state recovery for landlord payment-report
  confirmation and manual bill settlement when the write JSONP response times
  out after the backend may already have committed the Sheet changes.
- Recovery never resubmits the write; it confirms `confirmed` payment reports or
  settled/removed arrears records before showing success.
- Phase 147 covers the recovery paths. This candidate was not deployed or
  verified against Production.

## 2026-08-12 — Phase 147 tenant identity release and Production identity check

- PR #23 merged the Phase 147 tenant test-identity migration into GitHub
  `main` as `0bbbe06e`.
- GitHub Pages workflow `31601674513` completed successfully; the four tenant
  pages were fetched from the public Pages origin and retained formal LIFF
  initialization and the Phase 146 payment gateway.
- A read-only Apps Script check identified the authenticated project and active
  Web App Version 102. The file inventory matched GitHub `main` by normalized
  filename count only; no byte-level source export or rollback identification
  was performed.
- No Apps Script, Sheets, Properties, triggers, LINE, LIFF configuration, or
  payment data was changed by this release.

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

## 2026-07-29 — Unpublished V2.1 native signing foundation

- Added verified LIFF signing-session and private contract-artifact foundations
  to an isolated local branch only; no Apps Script deployment or Production
  data/configuration action occurred.
- Server-side principal resolution and backend-derived `signing_mode` control
  the permitted artifacts. Normal renewal is signature-only; missing mode or
  missing artifact schema fail closed.
- Added a server-verified signing-submission action. It requires consent and
  the mode-specific stored artifacts, records only explicit signing-audit
  fields, preserves `contract_status`, and fails closed without the required
  schema. It does not simulate approval, activation, or completed contract
  status.
- Added the corresponding isolated local `tenant-contract.html` signing UI:
  server-derived summary and terms, conditional new-tenant identity uploads,
  signature capture, consent, and submitted-for-review state. Renewal renders
  no identity upload flow. No frontend publication or Production action
  occurred.

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
