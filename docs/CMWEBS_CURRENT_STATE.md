# CMWebs Current State

**Status: AUTHORITATIVE current-state record**
**Last verified: 2026-08-27 (Asia/Taipei)**

This record distinguishes verified source reconciliation from live Production
state. It is not deployment authority. Re-verify the relevant target, account,
version, rollback, and runtime state before every Production action.

## 2026-08-27 formal renewal-history release

- The renewal contract-history candidate was merged to GitHub `main` by PR #56
  as commit `74524166aead730a2eaa07e85950102ca2201c39`.
- Apps Script Version 130 is serving on the existing Web App deployment. The
  existing Web App URL was preserved; no new URL was created.
- The additive-only production schema migration was run twice from the
  authenticated Apps Script editor and both executions completed successfully.
  The runner appends only missing headers and does not delete or rewrite old
  contract versions.
- GitHub Pages workflow `33054940344` completed successfully for the merged
  `main` commit. Public readback found `房客合約`, `合約版本紀錄`, and
  `查看完整合約與簽名` in the landlord tenant-detail page.
- Local verification passed: full Node suite `55/55`, candidate validator
  `83/83` routes and handlers, duplicate declarations `0`, credential scan `0`,
  and `git diff --check`.
- `HUMAN_REQUIRED`: authenticated real LINE/mobile room-603 UAT and actual
  landlord/tenant contract interaction remain unverified.

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

## Serving and rollback references

- **Canonical source baseline:** the Version 89 source tree described above,
  reconciled to GitHub `main` by PR #12.
- **Current Apps Script serving version:** Version 130, read back from the
  existing Web App deployment on 2026-08-27 after the formal renewal-history
  release. This is deployment identity evidence, not a real-device UAT result.
- **Current Apps Script rollback version:** `HUMAN_REQUIRED`; it was not
  identified in the read-only reconciliation.
- **GitHub Pages:** the renewal-history release at merged `main` commit
  `7452416` completed successfully in workflow `33054940344`; public
  landlord tenant-detail readback found the contract-history entry and the
  complete contract/signature action.
- **Production editor source:** an open Apps Script editor does not prove what
  immutable version is serving. Deployment metadata and a scoped source export
  are authoritative.

## 2026-08-25 tenant fixed-template signature preview release

This authorized work unit completes the fixed Google Docs template path for the
tenant contract signing surface. The configured fixed template remains the
content source; the original template is not modified. Submission materializes
a private signed copy, writes the stored signature artifact into the signed
document, and the mobile read model returns the private signature image for the
tenant preview after successful submission.

### Verified release evidence

- Apps Script was pushed to the verified target project and the existing Web
  App deployment was updated to immutable Version 125. No new Web App URL was
  created. No Sheets, Script Properties, trigger, LINE configuration, or
  tenant data migration was performed in this work unit.
- GitHub Pages commits `b4d164d`, `d719eb9`, and `9e18425` completed the
  signature-preview and cache-busting changes. Workflow `32793428257` passed
  build, deploy, and status-report jobs.
- Public readback returned HTTP 200 for `tenant-contract.html`; the three
  tenant entry pages load the versioned `frontend-release.js` asset, whose
  release value is `20260825-tenant-signature-preview-v1`.
- Local verification passed: focused tenant signing UI test, full Node suite
  (`48 pass, 0 fail`), project validator (`81/81` routes and handlers,
  duplicate declarations `0`, credential scan `0`), and `git diff --check`.

### Remaining gate

`HUMAN_REQUIRED`: an authenticated real LINE/mobile room-603 submission and
post-submit preview has not been verified. Directly opening a nested tenant
page outside the LIFF entry reproduced LINE 400 because the current URL is not
under the configured LIFF endpoint; the tenant must reopen from the official
LIFF entry, not a copied nested page URL. The separate direct deep-link
redirect hardening remains a follow-up risk and was not included in this
release.

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

The latest isolated worktree is
`codex/fix-fixed-contract-template-20260825` at `9e18425`, clean after the
handoff documentation commit if present. The root aggregate worktree remains
user-owned and dirty; do not clean or reset it.

The authorized fixed Google Docs template tenant-signature-preview release is
deployed: Apps Script Version 125 on the existing Web App deployment and
GitHub Pages workflow `32793428257` for commit `9e18425`. Public asset
readback and local tests pass. This does not prove authenticated LINE/mobile
room-603 UAT. The next action is to use the official LIFF entry on a real LINE
device, submit the signed fixture, and verify both the success state and the
signature image in the mobile preview and private signed Google Doc.

If that UAT still fails, first capture the authenticated browser/network
evidence; do not redeploy Apps Script or change Sheets/Properties blindly. The
direct nested-page LIFF 400 and deep-link redirect hardening remain separate
follow-up work.
```
