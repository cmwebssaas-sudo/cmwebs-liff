# CMWebs V2 Staging Boundary

This directory is a staging bootstrap derived from `release/phase80`.

- `apps-script/` is the only clasp source root.
- `appsscript.json` at this directory level is a review copy; the push manifest is `apps-script/appsscript.json`.
- `.clasp.json` is local and ignored; it must bind only to the verified staging Apps Script project.
- `frontend/cmweb-env.local.js` is local and ignored. Populate it with staging-only Web App, LIFF and test identity settings.
- `frontend/cmweb-env.js` validates the local values and fails closed when any required staging setting is missing.
- `frontend/liff-staging.config.local.json` is the ignored LINE Developers endpoint/callback mapping.
- `frontend/staging-test-uid-allowlist.local.json` is the ignored, deny-by-default staging identity allowlist.

The LIFF ID, frontend host and test UID placeholders must be replaced together. The tenant UID in `cmweb-env.local.js`, the local allowlist and the staging `TEST_TENANT_LINE_UID` Script Property must match privately before smoke testing.

The staging Apps Script project must also define:

```text
CMWEBS_ENVIRONMENT=staging
CMWEB_TENANT_LIFF_URL=https://liff.line.me/2010314940-wlT7zYd8
```

`V2_RUNTIME_ENVIRONMENT.js` fails closed when either value is absent or when
the LIFF URL does not match the approved staging application. It never falls
back to the production LIFF URL.

The six staging tenant pages are `tenant-bind.html`, `tenant-home.html`,
`tenant-bills.html`, `tenant-message.html`, `tenant-contract.html`, and
`tenant-payment-report.html`. Internal navigation must use the explicit
`.html` filenames because this hosting artifact does not canonicalize
extensionless tenant routes.

These optional integrations remain fail-closed until real staging resources
are approved and configured:

```text
CMWEB_LANDLORD_FRONTEND_BASE_URL
CMWEB_LINE_ADD_FRIEND_URL
```

Do not point either key at a production resource merely to enable an action.

Never copy the verified production binding or production endpoint into this tree. Do not run `clasp push` until the staging project and data isolation checklist in `docs/81A-STAGING-ENVIRONMENT-BOOTSTRAP.md` is complete.
