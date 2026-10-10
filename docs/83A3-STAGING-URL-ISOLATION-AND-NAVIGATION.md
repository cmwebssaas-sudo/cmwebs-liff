# Phase 83A.3 — Staging URL Isolation and Navigation Integrity

## Scope and result

Phase 83A.3 removes executable production frontend and LINE action URLs from
the complete staging payload, adds the two required tenant pages, and verifies
all tenant navigation against the actual staging hosting artifact. This phase
did not push Apps Script, create a version, update a Web App deployment, deploy
the staging frontend, modify any Spreadsheet, rebind TSTG082, or touch any
production source or configuration.

Implementation result: **PASS**. The artifact is ready for a staging deployment
review, but it has not been deployed.

## Exact occurrence audit

The URLs shown in this section are historical, non-executable audit evidence.
They are not staging defaults or fallbacks.

| # | Classification | File / function | Previous URL and purpose | Executable / user-visible | Required staging behavior | Resolution |
|---:|---|---|---|---|---|---|
| 1 | Notification action | `V2_AUTO_PAYMENT_REMINDER.js` / `autoReminderNotifyWorkspaceTeams_` | Production `landlord-arrears.html`; successful reminder summary | YES / YES | Omit action when staging landlord frontend is unavailable | `runtimeLandlordActionUrl_()` |
| 2 | Notification action | Same function, failure branch | Production `landlord-arrears.html`; failed reminder summary | YES / YES | Same as above | `runtimeLandlordActionUrl_()` |
| 3 | Notification action | `V2_TENANT_MESSAGES.js` / `submitTenantMessageByLineUid_` | Production `landlord-messages.html`; tenant-message notification | YES / YES | Preserve message write and suppress only unavailable action | `runtimeLandlordActionUrl_()` |
| 4 | Notification action | `V2_TENANT_CHECKIN_MANAGEMENT.js` / `saveLandlordTenantCheckinByLineUid_` | Production `landlord-tenant-checkin.html`; check-in update | YES / YES | Omit action without production fallback | `runtimeLandlordActionUrl_()` |
| 5 | Notification action | Same module / `sendLandlordTenantCheckinWelcomeByLineUid_` | Production `landlord-tenant-checkin.html`; welcome failure | YES / YES | Same as above | `runtimeLandlordActionUrl_()` |
| 6 | Notification action | `V2_TENANT_PAYMENT_REPORTS.js` / `submitTenantPaymentReportByLineUid_` | Production `landlord-payment-reports.html`; payment report | YES / YES | Omit action without changing report workflow | `runtimeLandlordActionUrl_()` |
| 7 | Notification action | `V2_BILLING_MANAGEMENT.js` / `generateLandlordBillsByLineUid_` | Production `landlord-bill-notifications.html?bill_month=...`; bill batch | YES / YES | Preserve and encode `bill_month`; omit action if unconfigured | Central resolver with parameter encoding |
| 8 | Landlord navigation | `V2_TEAM_MANAGEMENT.js` / former `V2_TEAM_JOIN_URL_` | Production `landlord-join.html`; invitation creation and read projection | YES / YES | Invitation must fail closed before write when no staging landlord frontend exists | Strict `runtimeLandlordFrontendUrl_()` at both use sites |
| 9 | Notification action | `V2_ANNOUNCEMENT_MANAGEMENT.js` / `sendLandlordAnnouncementByLineUid_` | Production `landlord-announcements.html`; announcement result | YES / YES | Omit action without production fallback | `runtimeLandlordActionUrl_()` |
| 10 | Notification action | `V2_CONTRACT_REQUESTS.js` / `contractRequestNotifyLandlordNewRequest_` | Production `landlord-contract-requests.html`; new request | YES / YES | Omit action without production fallback | `runtimeLandlordActionUrl_()` |
| 11 | Notification action | Same module / `contractRequestNotifyLandlordCancelledRequest_` | Production `landlord-contract-requests.html`; cancellation | YES / YES | Same as above | `runtimeLandlordActionUrl_()` |
| 12 | LINE add-friend action | `程式碼.js` / ECPay branch in `doGet` | Production `https://line.me/R/ti/p/@114djwkv`; payment return | YES / YES | Missing staging OA URL must stop this integration; never return to production OA | Strict `runtimeLineAddFriendUrl_()` |

The eleven landlord literals became twelve resolver calls because the former
team-join constant had two executable consumers. There are no direct landlord
production literals left in staging runtime source.

## Canonical URL resolver contract

`V2_RUNTIME_ENVIRONMENT.js` is the single owner of:

- `runtimeTenantLiffUrl_()` and the compatibility alias `runtimeLiffUrl_()`;
- `runtimeTenantFrontendBaseUrl_()`;
- `runtimeLandlordFrontendBaseUrl_()` and URL construction;
- `runtimeLineAddFriendUrl_()`.

All URLs are parsed as HTTPS URLs and validated by host/path rules. Query
parameters are sorted and encoded with `encodeURIComponent`.

Staging behavior:

- tenant LIFF: exact approved staging LIFF URL;
- tenant frontend: exact approved `hanschu.chatgpt.site` staging base;
- landlord frontend absent: strict resolver raises
  `STAGING_LANDLORD_FRONTEND_NOT_CONFIGURED`; notification actions use an empty
  action URL so the primary operation can continue without a production link;
- team invitation absent: fail closed before the invitation row is written;
- LINE add-friend absent: `STAGING_LINE_ADD_FRIEND_NOT_CONFIGURED`; no ECPay
  return link is generated.

Production fixtures return the exact previous production LIFF, tenant frontend,
landlord frontend and add-friend values. Production source was not modified.

## Remote staging property verification

The local staging binding (`1ZfX…k23T`, fingerprint `2be1ad2a31db`) is distinct
from the production binding (`1JmW…ihRJ`, fingerprint `8be891f7be33`). The
browser page matched the bound staging Script ID, project name
`CMWebs V2 STAGING BOUND 2026-07-21`, account `cmwebs.saas@gmail.com`, and
environment property `CMWEBS_ENVIRONMENT=staging` before any write.

Only this property was added to the dedicated staging project:

```text
CMWEB_TENANT_LIFF_URL=https://liff.line.me/2010314940-wlT7zYd8
```

The disabled property row was read back after save and matched exactly. No
other remote property was changed. The landlord frontend and LINE add-friend
properties remain intentionally unconfigured and fail closed.

## Frontend navigation repair

The original four-page artifact had five unique broken source/target pairs:

| Source | Missing target | Resolution |
|---|---|---|
| `tenant-home.html` | `tenant-contract.html` | Added actual environment-configured contract page |
| `tenant-home.html` | `tenant-payment-report.html` | Added actual environment-configured payment-report page |
| `tenant-bills.html` | `tenant-contract.html` | Same canonical contract page |
| `tenant-bills.html` | `tenant-payment-report.html` | Same canonical payment-report page |
| `tenant-message.html` | `tenant-contract.html` | Same canonical contract page |

The two added pages use `cmweb-env.local.js` and `cmweb-env.js`; they contain no
production API URL, production LIFF ID or hardcoded UID. They retain their real
API workflows (`tenant_contract_init` and `tenant_payment_report_init`) and are
not placeholders. The contract page's renewal and termination actions are
clearly disabled in staging because those pages are outside this release
boundary; no dead link remains.

The same six pages exist byte-for-byte in `release/staging/frontend`, hosting
`public`, and the built hosting `dist/client` artifact.

### Hosting route behavior

Local production-mode hosting returned HTTP 200 for all six explicit `.html`
URLs. The hosting stack returned HTTP 404 for extensionless forms. Therefore
the canonical staging navigation rule is **explicit `.html` only**. All current
internal links follow that rule; there are zero extensionless internal links
and zero internal targets returning 404.

## Isolation scan

| Finding | Executable staging count |
|---|---:|
| Production LIFF URL / ID | 0 |
| Production tenant frontend | 0 |
| Production landlord frontend | 0 |
| Production LINE channel / add-friend URL | 0 |
| Silent staging-to-production fallback | 0 |
| Malformed `hanschuh` hostname | 0 |
| Deleted staging LIFF IDs | 0 |
| Hardcoded LINE UID | 0 |
| Missing required tenant pages | 0 |
| Dead internal links | 0 |
| HTTP 404 internal targets | 0 |

The configured staging Apps Script endpoint and Spreadsheet ID occur only in
Git-ignored staging configuration. There is no literal `openById` Spreadsheet
ID in runtime source.

## Validation

| Gate | Result |
|---|---|
| Apps Script syntax (32 files) | PASS |
| Staging Apps Script routes | 68 unique; 68/68 handlers |
| Staging HTML inline JavaScript (6 pages) | PASS |
| Staging internal links | 25 checked; 0 missing |
| Phase 83A.1 mutation/rollback/UID fixtures | PASS — 5 mutation boundaries, 7 conflict fixtures |
| Phase 83A.2 environment isolation fixtures | PASS |
| Phase 83A.3 URL isolation fixtures | PASS |
| Staging hosting build and tests | PASS — 6 pages |
| Root `npm run validate` | PASS |
| `git diff --check` | PASS |
| Production Apps Script checksum | Unchanged: `f1cee14591ade…` |
| TSTG082 | Unchanged; no Spreadsheet operation performed |

## Deployment review

- Phase 83A.3 implementation result: **PASS**
- occurrence audit completed: **YES**
- remote `CMWEB_TENANT_LIFF_URL` configured: **YES**
- remote property read-back exact match: **YES**
- staging tenant frontend resolver: **PASS**
- staging landlord frontend isolation: **PASS**
- staging LINE add-friend isolation: **PASS**
- ready for staging deployment review: **YES**

Functional limitations remain explicit rather than unsafe: landlord action
links are omitted and team invitations / ECPay payment return configuration are
blocked until real staging landlord frontend and staging LINE Official Account
URLs are supplied. They are not blockers to reviewing or deploying the tenant
read/bind smoke-test surface, but those integrations must not be marked PASS.

## Rollback

Because there was no push or deployment, rollback is local: restore the previous
`release/staging` and `release/staging-hosting` artifact. For the one authorized
remote property change, remove only `CMWEB_TENANT_LIFF_URL` from the confirmed
staging project if rollback is required. Do not edit any production property.
