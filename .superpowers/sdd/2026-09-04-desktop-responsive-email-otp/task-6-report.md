# Task 6 Report: Integrate Email Sessions Into First-Phase Pages

Recommended model/speed: `gpt-5.6-terra`, `medium`.

## Status

PASS for local source/test candidate. No deploy, clasp push, GitHub Pages
publish, MailApp send, Sheet migration, external data change, LINE action, or
Production operation was performed.

## Changed Paths

- `landlord-auth.js`
- `landlord-entry.html`
- `landlord-home.html`
- `landlord-tenants.html`
- `landlord-properties.html`
- `tests/phase193-landlord-home-dashboard.test.mjs`
- `tests/phase219-landlord-auth-client.test.mjs`
- `tests/phase220-landlord-responsive-ui.test.mjs`
- `.superpowers/sdd/2026-09-04-desktop-responsive-email-otp/task-6-report.md`

## Implementation Summary

- Added a generic shared-auth `request(action, params)` path that sends
  Email-session page actions through the existing hidden iframe POST bridge.
- Added shared `handleAuthFailure(result)` handling for `SESSION_EXPIRED`,
  `AUTH_REQUIRED`, and `WORKSPACE_FORBIDDEN`; it clears the local session and
  redirects through the validated entry return path.
- Passed `testMode` into `landlord-entry.html` auth initialization and kept test
  identities out of Email verification action payloads.
- Loaded `landlord-auth.js` in `landlord-home.html`, `landlord-tenants.html`,
  and `landlord-properties.html`.
- Added `ensureLandlordAuthReady()` to the three protected pages so shared auth
  is awaited before page bootstrap requests.
- Replaced page-local JSONP identity construction with
  `window.CMWebsLandlordAuth.getRequestAuthParams()`.
- Preserved mobile LINE/LIFF JSONP behavior and deterministic test identity for
  non-Email test-mode page requests.
- Kept existing page layouts and operational handlers intact; no new desktop
  layout or auth protocol was added in this task.
- Updated the Phase 193 home-dashboard test harness to provide the shared auth
  LINE envelope while continuing to test its original JSONP timeout retry
  behavior.

## TDD Evidence

RED command:

```bash
node --test tests/phase219-landlord-auth-client.test.mjs tests/phase220-landlord-responsive-ui.test.mjs
```

RED result:

```text
tests 22
pass 18
fail 4
```

Expected failures:

- Missing `CMWebsLandlordAuth.request`.
- Test-mode Email verification action still included the deterministic test
  LINE identity.
- Missing `CMWebsLandlordAuth.handleAuthFailure`.
- Protected pages had not loaded or awaited the shared auth client before page
  bootstrap.

GREEN command:

```bash
node --test tests/phase219-landlord-auth-client.test.mjs tests/phase220-landlord-responsive-ui.test.mjs
```

GREEN result:

```text
tests 22
pass 22
fail 0
duration_ms 49.503291
```

## Verification Commands And Results

```bash
node --test tests/phase219-landlord-auth-client.test.mjs tests/phase220-landlord-responsive-ui.test.mjs
```

```text
tests 22
pass 22
fail 0
duration_ms 49.503291
```

```bash
node --test tests/phase193-landlord-home-dashboard.test.mjs
```

```text
tests 1
pass 1
fail 0
duration_ms 56.619334
```

```bash
node --test tests/phase193-landlord-home-dashboard.test.mjs tests/phase194-landlord-tenant-expiry-display.test.mjs tests/phase208-simple-landlord-contract-flow.test.mjs tests/phase210-paper-contract-backfill.ui.test.mjs tests/phase213-paper-contract-login.ui.test.mjs tests/phase214-paper-backfill-orphan-entry.ui.test.mjs tests/phase215-paper-backfill-legacy-pending-entry.test.mjs
```

```text
tests 7
pass 7
fail 0
duration_ms 75.348792
```

```bash
node tests/room-account-toggle-page.test.mjs
```

```text
Room account toggle page tests passed.
```

```bash
node tests/tenant-binding-invite-share.test.mjs
```

```text
Tenant binding invite share tests passed.
```

```bash
node --check landlord-auth.js
```

```text
PASS (no output)
```

```bash
node --input-type=module -e "import { readFileSync } from 'node:fs'; import vm from 'node:vm'; for (const file of ['landlord-entry.html','landlord-home.html','landlord-tenants.html','landlord-properties.html']) { const source = readFileSync(file, 'utf8'); const scripts = [...source.matchAll(/<script\\b(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)<\\/script>/gi)].map((match) => match[1]); scripts.forEach((script, index) => new vm.Script(script, { filename: file + '#inline-' + (index + 1) })); console.log(file + ': ' + scripts.length + ' inline script(s) parse'); }"
```

```text
landlord-entry.html: 1 inline script(s) parse
landlord-home.html: 1 inline script(s) parse
landlord-tenants.html: 1 inline script(s) parse
landlord-properties.html: 1 inline script(s) parse
```

```bash
npm run validate
```

```text
Apps Script files: 35
HTML files: 46
Routes: 71 (unique 71, duplicates 0)
Handler coverage: 71/71
Common helper coverage: 7/7
Duplicate top-level declarations: function=0, const=0, let=0, var=0
Credential scan: blocking=0, review-only=0
Hardcoded LINE UID: 0
Manifest: PASS
HTML links: checked=202, missing=0
WARNING: Local .clasp.json is present but must remain ignored: apps-script/.clasp.json
Validation: PASS
CMWebs validation passed.
```

```bash
git diff --check
```

```text
PASS (no output)
```

## Scope Notes

- `docs/EXECUTION_RECORD.md` and `docs/00-HANDOFF-INDEX.md` were not present in
  this isolated worktree. I followed the local `AGENTS.md` and read
  `docs/CMWEBS_CODEX_HANDOFF.md` plus the authoritative docs named there.
- `landlord-settings.html` was intentionally not edited because Task 6 scope
  names only entry, home, tenants, properties, auth client, and focused tests.
- Authenticated browser/LIFF UAT, real Email delivery, real desktop operation,
  Apps Script deployment, and GitHub Pages publication remain
  `HUMAN_REQUIRED` / `UNVERIFIED`.
