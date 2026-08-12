# Production Identity Reconciliation — 2026-08-12

## Scope

This is a read-only evidence package for the CMWebs V2 Production identity
after the authorized Phase 147 GitHub Pages deployment. It does not modify
Apps Script, Sheets, Properties, triggers, LINE configuration, LIFF settings,
or payment data.

Recommended model for the work unit: `gpt-5.6-terra`, `medium`.

## Evidence collected

| Surface | Observed state | Evidence boundary |
|---|---|---|
| Apps Script account | `cmwebs.saas@gmail.com` | Authenticated Apps Script editor UI |
| Apps Script project | `綠界結帳` | Project editor URL and project file inventory |
| Active Web App deployment | Version 102, timestamp shown as 2026-08-12 04:59 | Apps Script 管理部署作業 read-only view |
| Deployment description | `Production V102: ignore incomplete tenant payment bill rows` | Apps Script deployment metadata |
| Web App execution/access | Executes as owner; access is 所有人 | Apps Script deployment metadata |
| Apps Script source inventory | 42 `.gs` files | Apps Script project editor |
| GitHub source inventory | 42 corresponding `.js` files | GitHub `main` tree, merge `0bbbe06e` |
| GitHub Pages workflow | Successful run `31601674513` | [GitHub Actions run](https://github.com/cmwebssaas-sudo/cmwebs-liff/actions/runs/31601674513) |
| Public Pages fetch | Four Phase 147 tenant pages fetched successfully | `cmwebssaas-sudo.github.io/cmwebs-liff/` |

The 42-file comparison is an inventory/name comparison after normalizing the
Apps Script `.gs` suffix to the repository `.js` suffix. It is not a byte-level
source export comparison.

## Public Pages verification

The following deployed pages were fetched from the public GitHub Pages origin:

- `tenant-payment-report.html`
- `tenant-contract.html`
- `tenant-renewal.html`
- `tenant-termination.html`

All four pages had no hard-coded 32-character LINE UID, retained formal LIFF
initialization, and retained the Phase 146 tenant payment gateway behavior.

## Release boundary

- PR #23 merged the Phase 147 frontend change into `main`.
- GitHub Pages was deployed from the merged `main` revision.
- The Apps Script Version 102 observation is current deployment evidence only;
  this Phase 147 release did not modify or redeploy Apps Script.
- No rollback version was identified in this read-only package.
- No Sheets, Script Properties, triggers, LINE messages, or payment actions
  were performed.

## Follow-up

Before any Apps Script release or rollback, obtain a scoped immutable source
export and independently verify the rollback deployment. Do not infer source
equivalence from the file inventory alone.
