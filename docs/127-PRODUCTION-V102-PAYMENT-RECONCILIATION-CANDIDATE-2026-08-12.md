# Production Version 102 Payment Reconciliation Candidate

**Status:** local candidate only — not canonical, merged, or deployed by this
work unit.

## Scope

This candidate reconciles three Apps Script files observed in the read-only
Production Version 102 export with the current GitHub `main` source:

- `apps-script/V2_TENANT_PAYMENT_REPORTS.js`
- `apps-script/V2_LANDLORD_MANAGEMENT.js`
- `apps-script/V2_PAYMENT_SETTLEMENT.js`

The candidate is limited to the reported payment-flow correctness issues:
blank tenant payment-report rows, stale landlord pending counts after a bill was
already settled, and fail-closed settlement when `bill_id` is missing.

## Candidate behavior

1. Tenant payment-report initialization uses canonical runtime bill rows and
   filters out blank `bill_id` rows.
2. Tenant payment-report submission uses the same canonical bill rows while
   preserving identity, Workspace, duplicate-report, paid-bill, and voided-bill
   checks.
3. Landlord payment-report reads reconcile stale `pending`/
   `payment_reported` rows against `V2_bills.payment_status`. A matching paid
   bill is exposed as `confirmed` for read/count purposes only; no Sheet row is
   mutated by this reconciliation.
4. Settlement returns `REPORT_BILL_ID_EMPTY` before any settlement write when a
   report has no bill ID, and still applies authorized landlord and bill
   Workspace checks.

## Source evidence

- Read-only Apps Script source reference: Version 102, observed through the
  authenticated Apps Script editor and cloned with `clasp`.
- Candidate base: GitHub `main` commit `8e539d8`.
- Version 102 file SHA-256 values:
  - `V2_PAYMENT_SETTLEMENT.js`: `6396ddfe9764bf5f520a0a91c9678dfce87d7331fb829cba4e43c724a88696db`
  - `V2_TENANT_PAYMENT_REPORTS.js`: `459f07311db09cc046ac172d415a7be655be1b554e385701f225c44158c8ee64`
  - `V2_LANDLORD_MANAGEMENT.js`: `4a19e85ec221a4e199faede60101f038db46cec2e5980b09ac135b5113310b8d`

## Local validation

- `node --test tests/*.test.mjs`: **PASS** — 17 tests.
- Focused Phase 148 payment-reconciliation test: **PASS**.
- Apps Script JavaScript syntax check: **PASS** — every `apps-script/*.js`
  file in the candidate.
- `git diff --check`: **PASS**.
- `npm run validate`: **NOT RUN / unavailable** — this repository checkout has
  no `package.json`.

The Phase 140 fixture was updated to provide the canonical `tenant_bill_rows`
source expected by the Version 102 runtime contract. This is a test-fixture
alignment only; it does not change the tenant UI or tenant data.

## Safety state

No Apps Script push, new deployment, Web App reassignment, Sheet write,
Property/trigger change, LINE message, GitHub Pages publication, commit, push,
merge, or Production payment action occurred in this work unit. The root mixed
worktree remains untouched; all candidate changes are isolated in
`/private/tmp/cmwebs-v102-payment-reconciliation-20260812`.

Before any external action, review the settlement ownership fallback and capture
the immutable serving version, rollback target, schema state, and authenticated
runtime smoke evidence in a separate approval packet.
