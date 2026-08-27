# CMWebs Changelog

**Status: AUTHORITATIVE product-memory changelog**

## 2026-08-27 — Renewal contract history and 30-day offer (formal release)

- Added append-only renewal versions for existing tenants. Each renewal gets a
  new contract ID and links to its predecessor while retaining all prior
  contract snapshots and document/signature references.
- Renewal defaults carry rent, management fee, deposit, other fixed fees,
  payment day, terms, and a one-year period from the day after expiry. Renewal
  identity uploads are optional and reuse existing immutable document
  references when omitted; a new renewal signature remains required.
- Added the 30-calendar-day expiry non-renewal offer. Meeting the threshold
  waives the penalty; a shorter notice is routed to landlord review without an
  automatic charge or waiver. Early termination remains unchanged.
- Added landlord and tenant contract-history UI. The landlord's selected
  version can load a complete contract/signature view in read-only mode.
- Added the explicit additive-only `runV2ContractRenewalHistoryProductionMigration`
  runner. It appends only missing renewal/request/document headers and is
  idempotent; it does not delete or rewrite historical contracts.
- Apps Script was deployed as immutable Version 130 on the existing Web App
  deployment; the existing Web App URL was preserved. The additive schema
  migration was executed twice from the authenticated Apps Script editor and
  both executions completed successfully, proving the runner is idempotent.
- GitHub PR #56 merged the release into `main` as `7452416`. GitHub Pages
  workflow `33054940344` completed build, deploy, and status-report jobs, and
  public readback found the landlord contract-history entry and
  `查看完整合約與簽名`.
- Local Phase 174–176 tests and the full Node suite pass (`55 pass, 0 fail`);
  the candidate validator passes all `83/83` routes and handlers with zero
  duplicate declarations and zero credential findings.
- Authenticated real LINE/mobile room-603 UAT remains `HUMAN_REQUIRED` and is
  not implied by this release.

## 2026-08-25 — Deploy fixed-template tenant signature preview

- Deployed the fixed Google Docs template signing path to Apps Script Version
  125 on the existing Web App deployment. The signed copy remains private and
  the original fixed template is unchanged.
- The tenant mobile preview now renders the stored handwritten signature image
  after submission, while the backend continues to source it from the private
  stored artifact and signed document record.
- Bumped the tenant entry release asset and added versioned script URLs to bust
  stale LIFF/Pages caches. GitHub Pages workflow `32793428257` completed
  successfully for commit `9e18425`.
- Local tests and public static readback passed. Authenticated real LINE/mobile
  room-603 acceptance remains unverified and is not implied by this release.

## 2026-08-25 — Restore supplied Google Docs fixed contract template (local candidate)

- Replaced the generated standard-contract fallback in the tenant signing
  preview and landlord review view with the configured fixed Google Docs
  template and canonical placeholder substitution.
- Submission now copies the fixed document, supports the supplied text-based
  `乙方簽名（線上簽署）` slot as well as an image slot, promotes the supplied
  pending-signature evidence, and records the signed copy in the document
  signing schema.
- Phase 168 and the full local suite pass. This remains a local candidate; no
  Apps Script deployment, Script Properties update, Drive-folder migration,
  GitHub Pages publication, or real LINE/mobile acceptance occurred.

## 2026-08-16 — Landlord-initiated new lease and renewal signing (local candidate)

- Added the approved landlord-first contract flow in an isolated local branch:
  new vacant-room contracts may start with blank tenant prefill data, while
  renewals are started from the current active contract and link a new version
  to its predecessor.
- Added one-time invite claiming with LINE identity verification, tenant name
  and Taiwan mobile completion, private identity-artifact requirements for new
  tenants, signature-only renewal signing, and landlord-only approval as the
  activation boundary.
- Added landlord and tenant mobile UI entry points, short POST/JSONP exchanges,
  ScriptLock-protected writes, activation view synchronization, and focused
  Phase 157–159 regression tests.
- This is a local implementation candidate only. No Apps Script deployment,
  GitHub Pages publication, Production Spreadsheet/Properties/trigger change,
  LINE/LIFF configuration change, or real message send occurred.

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
