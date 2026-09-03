# Task 4 Report: Shared Landlord Auth Client and Email OTP UI

Date: 2026-09-04 Asia/Taipei
Branch: `codex/desktop-responsive-email-otp-20260904`
Commit: `8d77ea2f658e5d9bf36716b1835fde2f0eb9c4f2`
Recommended model/speed: `gpt-5.6-terra`, `medium`

## Scope

Implemented Task 4 local candidate only. No deployment, push, Production
migration, MailApp production send, Google Sheets write, LINE/LIFF setting
change, GitHub Pages publication, or real data transaction was performed.

## Changed Files

- `landlord-auth.js`
- `landlord-entry.html`
- `landlord-settings.html`
- `tests/phase219-landlord-auth-client.test.mjs`
- `apps-script/程式碼.js`

## Implementation Summary

- Added `window.CMWebsLandlordAuth` with the required exported API:
  `init`, `getMode`, `getRequestAuthParams`, `requestEmailCode`,
  `verifyEmailCode`, `requestEmailVerification`, `verifyEmailVerification`,
  `getSessionStatus`, and `logout`.
- Added hidden-iframe POST bridge with `request_id` correlation, accepted only
  `source === 'CMWEBS_APPS_SCRIPT'`, cleanup of iframe/form/listener, 25-second
  timeout, and no verification auto-retry.
- Kept Email, code, and session token out of GET/JSONP URLs. The browser stores
  only the opaque Email session token in `sessionStorage`.
- Added desktop Email OTP login states to `landlord-entry.html` while preserving
  existing mobile LINE/LIFF behavior and `TEST_MODE`.
- Added LINE-authenticated Email verification controls to
  `landlord-settings.html`, including Email verification status, request-code
  button, code field, 60-second countdown, and success reload.
- Added a small `doPost` compatibility fallback in `apps-script/程式碼.js` so
  hidden iframe form POST fields can feed the same Task 3 bridge dispatcher
  without moving Email/code/session values into GET.

## RED/GREEN Evidence

### RED 1

Command:

```bash
node --test tests/phase219-landlord-auth-client.test.mjs
```

Output:

```text
✖ Phase 219 requires the shared landlord auth client module
﹣ Phase 219 sends Email OTP requests through a hidden POST iframe without GET leakage # SKIP
﹣ Phase 219 stores only the opaque landlord Email session token after code verification # SKIP
﹣ Phase 219 clears Email session and redirects through a validated return_to on auth failures # SKIP
﹣ Phase 219 keeps mobile in LINE mode unless an Email session exists # SKIP
tests 5
pass 0
fail 1
skipped 4
```

Expected failure: `landlord-auth.js` did not exist.

### RED 2

After the client module existed, self-review found the iframe form POST /
JSON-body dispatcher mismatch. I added the parser compatibility test before the
dispatcher change.

Command:

```bash
node --test tests/phase219-landlord-auth-client.test.mjs
```

Output:

```text
✔ Phase 219 requires the shared landlord auth client module
✔ Phase 219 sends Email OTP requests through a hidden POST iframe without GET leakage
✖ Phase 219 dispatcher accepts bridge fields from hidden iframe POST forms
✔ Phase 219 stores only the opaque landlord Email session token after code verification
✔ Phase 219 clears Email session and redirects through a validated return_to on auth failures
✔ Phase 219 keeps mobile in LINE mode unless an Email session exists
tests 6
pass 5
fail 1
```

Expected failure: `doPost` did not yet convert bridge POST form fields into the
same request object used by the Task 3 dispatcher mappings.

### GREEN

Command:

```bash
node --test tests/phase219-landlord-auth-client.test.mjs
```

Output:

```text
✔ Phase 219 requires the shared landlord auth client module
✔ Phase 219 sends Email OTP requests through a hidden POST iframe without GET leakage
✔ Phase 219 dispatcher accepts bridge fields from hidden iframe POST forms
✔ Phase 219 stores only the opaque landlord Email session token after code verification
✔ Phase 219 clears Email session and redirects through a validated return_to on auth failures
✔ Phase 219 keeps mobile in LINE mode unless an Email session exists
tests 6
pass 6
fail 0
```

## Final Verification Commands

Command:

```bash
node --test tests/phase219-landlord-auth-client.test.mjs
```

Output:

```text
tests 6
pass 6
fail 0
duration_ms 49.300917
```

Command:

```bash
node --check landlord-auth.js
```

Output:

```text
exit 0
```

Command:

```bash
npm run validate
```

Output:

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

Command:

```bash
git diff --check
```

Output:

```text
exit 0
```

Command:

```bash
node --test tests/phase217-landlord-email-auth.runtime.test.mjs tests/phase218-landlord-email-auth-routes.test.mjs
```

Output:

```text
tests 10
pass 10
fail 0
duration_ms 53.0525
```

Command:

```bash
node --check apps-script/程式碼.js
```

Output:

```text
exit 0
```

Command:

```bash
node --test tests/*.mjs
```

Output:

```text
tests 101
pass 101
fail 0
duration_ms 672.839167
```

## Self-Review

- Verified the shared client exposes exactly the Task 4 public API.
- Verified Email/code/session values are submitted through POST bridge fields,
  not appended to `form.action`, GET URLs, JSONP callbacks, or page navigation
  URLs.
- Verified bridge responses are ignored unless both source and request ID match.
- Verified iframe, form, message listener, and timeout cleanup on completion.
- Verified the browser stores only `cmwebs_landlord_session_token` for Email
  auth.
- Verified mobile and `TEST_MODE` entry flows keep using existing LINE/LIFF
  status loading.
- Verified settings Email verification remains LINE-authenticated and does not
  enable tenant Email login, passwords, desktop layout, or home/tenants/
  properties integration.
- Verified no deployment, migration, MailApp production send, or real data
  transaction was performed.

## Rulings

- `docs/EXECUTION_RECORD.md` and `docs/00-HANDOFF-INDEX.md` named in the user
  pasted instruction were absent in this isolated worktree. The local
  `AGENTS.md` instead names `docs/CMWEBS_CODEX_HANDOFF.md` and the
  authoritative CMWebs docs, which were read before implementation.
- The dispatcher form fallback was included because a hidden iframe form POST
  cannot produce a raw JSON body in the browser. This keeps sensitive fields in
  POST body form parameters and avoids GET/JSONP leakage while preserving the
  Task 3 action mappings.
- The release marker in `frontend-release.js` was intentionally not changed,
  because this task is not an approved frontend release or deployment.

## Concerns

- Authenticated browser/LIFF UAT is still `HUMAN_REQUIRED` / `UNVERIFIED`.
- Apps Script deployment, GitHub Pages publication, MailApp production delivery,
  and Production schema/data state remain `HUMAN_REQUIRED` / `UNVERIFIED`.
- First-phase desktop Email session integration for home, tenants, and
  properties is intentionally not implemented in Task 4.

## Fix Round 1: Reviewer Findings

Date: 2026-09-04 Asia/Taipei
Commit: `c151b35d4f17d8f1197f9da8927de534684e3bf1`

### Findings Addressed

- Desktop LINE fallback intent is now persisted in
  `cmwebs_landlord_line_fallback_intent` before LIFF redirect. On callback or
  reload, `landlord-entry.html` checks that intent before the desktop
  Email-first branch and runs the existing LINE `initLine` plus status flow.
  The intent is cleared after the LINE status path completes or fails.
- Settings Email verification now derives the bound Email from loaded server
  data and blocks code requests when the edited Email input is empty or differs
  from the persisted value. The UI tells the landlord to save Email first, and
  the existing profile save path remains the way to bind the first Email before
  requesting a verification code.
- The auth bridge listener now requires the message to come from
  `iframe.contentWindow`, requires the expected origin when it can be parsed
  from the configured Apps Script endpoint, and still requires the controlled
  `CMWEBS_APPS_SCRIPT` source plus matching `requestId`.

### RED Evidence

Command:

```bash
node --test tests/phase219-landlord-auth-client.test.mjs
```

Output:

```text
tests 9
pass 6
fail 3
```

Expected failures:

- wrong-window/wrong-origin bridge messages were accepted.
- desktop LINE fallback intent was not persisted across LIFF reloads.
- settings verification did not prove it was using the persisted bound Email.

### GREEN and Regression Evidence

Command:

```bash
node --test tests/phase219-landlord-auth-client.test.mjs
```

Output:

```text
tests 9
pass 9
fail 0
duration_ms 43.05825
```

Command:

```bash
node --check landlord-auth.js
```

Output:

```text
exit 0
```

Command:

```bash
node --check apps-script/程式碼.js
```

Output:

```text
exit 0
```

Command:

```bash
node --test tests/phase217-landlord-email-auth.runtime.test.mjs tests/phase218-landlord-email-auth-routes.test.mjs
```

Output:

```text
tests 10
pass 10
fail 0
duration_ms 55.142334
```

Command:

```bash
git diff --check
```

Output:

```text
exit 0
```

Command:

```bash
npm run validate
```

Output:

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

Command:

```bash
node --test tests/*.mjs
```

Output:

```text
tests 104
pass 104
fail 0
duration_ms 681.002583
```

### Fix Round 1 Self-Review

- Verified mobile widths still resolve to LINE mode unless an Email session
  token exists.
- Verified `TEST_MODE` remains outside the desktop Email-first branch.
- Verified settings verification still sends no raw Email to schema storage;
  it only blocks unsaved input before calling the existing Task 2 handler.
- Verified bridge trust was tightened client-side without changing server
  `htmlBridgeOutput_` compatibility.

### Fix Round 1 Concerns

- Authenticated browser/LIFF UAT is still `HUMAN_REQUIRED` / `UNVERIFIED`.
- Apps Script deployment, GitHub Pages publication, MailApp production delivery,
  and Production schema/data state remain `HUMAN_REQUIRED` / `UNVERIFIED`.
