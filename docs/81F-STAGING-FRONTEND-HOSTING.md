# Phase 81F — Independent Staging Frontend Hosting

Date: 2026-07-21  
Branch: `chore/v2-production-consolidation`  
Status: **DEPLOYED — READY FOR STAGING LIFF ID CONFIGURATION**

## Objective

Publish the four Phase 80 Tenant pages on a separate public HTTPS staging host without modifying or replacing production GitHub Pages, production LIFF, production Apps Script or application business logic.

## Hosting Decision

An isolated OpenAI Sites project is used for staging. It has its own source repository, deployment lifecycle and public hostname and does not share the production GitHub Pages deployment.

Staging base URL:

```text
https://cmwebs-v2-tenant-staging.hanschu.chatgpt.site
```

## Published URLs

| Page | HTTPS URL | Result |
|---|---|---|
| Tenant binding | `https://cmwebs-v2-tenant-staging.hanschu.chatgpt.site/tenant-bind.html` | HTTP 200 |
| Tenant home | `https://cmwebs-v2-tenant-staging.hanschu.chatgpt.site/tenant-home.html` | HTTP 200 |
| Tenant bills | `https://cmwebs-v2-tenant-staging.hanschu.chatgpt.site/tenant-bills.html` | HTTP 200 |
| Tenant messages | `https://cmwebs-v2-tenant-staging.hanschu.chatgpt.site/tenant-message.html` | HTTP 200 |

The LINE Developers Endpoint URL for the future staging LIFF app is:

```text
https://cmwebs-v2-tenant-staging.hanschu.chatgpt.site/tenant-bind.html
```

The staging callback mapping uses the same URL.

## Deployment Content

The isolated hosting source is under:

```text
release/staging-hosting/
```

The published boundary contains:

- the four requested Tenant HTML pages;
- `cmweb-env.js`;
- a staging-only `cmweb-env.local.js`;
- a no-index landing page and `robots.txt`.

No production frontend file or production GitHub Pages deployment was overwritten.

## Environment Isolation

Validation confirmed:

- the hosted environment file points to the Phase 81D staging Apps Script Web App endpoint;
- the endpoint does not match an Apps Script endpoint found in repository-root production HTML;
- no real LIFF ID is present;
- no hardcoded LINE UID is present;
- the LIFF and test UID values remain explicit staging placeholders;
- there is no fallback to production configuration.

The full staging Apps Script deployment token remains omitted from this document.

## Remote Verification

All four HTTPS pages and the staging environment file return HTTP 200.

The remotely served environment file is byte-identical to the validated staging hosting source. The hosting edge injects its own Cloudflare challenge-loader script into HTML responses, so remote HTML checksums differ from the source only by that provider-managed script. The source HTML files themselves were copied without application-logic edits.

## LIFF Status

This phase intentionally did not create or modify a LINE LIFF application.

Still required for Phase 81F real-value activation:

1. create/select a LIFF app in a staging/test LINE Developers channel;
2. set its Endpoint URL to the Tenant binding URL above;
3. place the new staging LIFF ID only in ignored staging configuration;
4. add an approved staging test UID to the deny-by-default allowlist;
5. set the matching staging `TEST_TENANT_LINE_UID` Script Property;
6. run the LIFF smoke test without LINE push or production data access.

## Safety Declaration

- Production GitHub Pages: unchanged.
- Production LIFF ID/channel: unchanged.
- Production Web App URL/deployment: unchanged.
- Production test UID and credentials: not copied.
- Apps Script business logic/API routes: unchanged.
- Google Sheets: unchanged.
- Production deployment: not executed.

