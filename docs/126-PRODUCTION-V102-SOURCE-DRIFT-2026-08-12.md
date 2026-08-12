# Production Version 102 Source Drift — 2026-08-12

## Scope

This is a read-only source reconciliation result for the authenticated CMWebs
Apps Script project. It does not modify Apps Script, Sheets, Properties,
triggers, LINE configuration, LIFF settings, or payment data.

Recommended model for the work unit: `gpt-5.6-terra`, `medium`.

## Identity

- Apps Script project: `綠界結帳`
- Project account: `cmwebs.saas@gmail.com`
- Active Web App deployment: Version 102
- Version 102 description: `201 tenant payment report blank-row guard`
- Repository baseline: GitHub `main` at `0865b88e`

The Version 102 source was exported read-only with `clasp clone` using the
immutable version number. The export contained 43 files: 42 JavaScript files
and `appsscript.json`.

## Hash reconciliation

SHA-256 comparison between the Version 102 export and repository `main`:

| Result | Count |
|---|---:|
| Identical files | 40 |
| Different files | 3 |
| Missing files | 0 |

The three differences are:

| File | GitHub `main` SHA-256 | Version 102 SHA-256 |
|---|---|---|
| `V2_PAYMENT_SETTLEMENT.js` | `321a93835725fd4ff370a0702f85d5a3bffae1c957cc5d4186fd4c0860a7198a` | `6396ddfe9764bf5f520a0a91c9678dfce87d7331fb829cba4e43c724a88696db` |
| `V2_TENANT_PAYMENT_REPORTS.js` | `c00e5237efc5b010cb9c93f8645566cb10d23c20c5efb54467bdce21a41b682c` | `459f07311db09cc046ac172d415a7be655be1b554e385701f225c44158c8ee64` |
| `V2_LANDLORD_MANAGEMENT.js` | `6d0c738ef1619040cc2116816fb84abc499fee6aa54230014223ae581725598b` | `4a19e85ec221a4e199faede60101f038db46cec2e5980b09ac135b5113310b8d` |

The remaining 40 files, including `appsscript.json`, matched byte-for-byte by
SHA-256. The Version 102 export passed `node --check` for all 42 JavaScript
files and a sensitive-pattern scan.

## Drift classification

The differences are concentrated in the payment flow:

- `V2_PAYMENT_SETTLEMENT.js`: Version 102 contains the settlement and payment
  report ownership implementation from the deployed payment release sequence.
- `V2_TENANT_PAYMENT_REPORTS.js`: Version 102 contains canonical tenant context,
  bill-row filtering, and the 201 incomplete-row guard.
- `V2_LANDLORD_MANAGEMENT.js`: Version 102 contains effective payment-report
  status reconciliation so already-settled bills do not remain pending.

The repository history identifies the related source work as the Version 99–102
payment release sequence, but the Version 102 blobs are not byte-identical to
the current `main` blobs. This is source drift, not proof that either side is
incorrect.

## Gate result

`GATE_0_SOURCE_PARITY = BLOCKED` until an authorized source owner selects and
records the canonical resolution:

1. reconcile the three Version 102 payment modules into GitHub `main`, or
2. explicitly approve the current `main` payment modules as the intended
   replacement and create a separately authorized Apps Script release.

No deployment, `clasp push`, merge, Production write, or rollback was performed
as part of this read-only check.
