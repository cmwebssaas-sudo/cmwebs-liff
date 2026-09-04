# Landlord Desktop Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the V2 landlord desktop path by making Email OTP delivery fail closed, wiring the settings page into the shared authenticated transport, and recording the remaining browser and Production acceptance gates without changing tenant, contract, billing, or Sheet data.

**Architecture:** Keep the existing `landlord-auth.js` POST iframe bridge and Apps Script Email session model as the only desktop identity boundary. Add the missing settings-page desktop shell and authenticated bootstrap using the same selectors, navigation, and mobile fallback already used by the other landlord pages. Harden the existing challenge issuer so missing Email configuration or delivery failure returns a generic result before any challenge row is persisted.

**Tech Stack:** Apps Script JavaScript, static HTML/CSS, GitHub Pages, Google Sheets-backed V2 APIs, Node.js built-in `node:test`, VM-based Apps Script/client runtime fixtures.

**Spec:** `docs/superpowers/specs/2026-09-05-landlord-desktop-completion-design.md`

## Global Constraints

- V2.0 only; do not add V2.1/V3/V4 product scope or customer-specific branches.
- Preserve the existing mobile LIFF／LINE login, fixed viewport shell, bottom navigation, safe-area reserve, and mobile visual behavior.
- Email OTP uses a six-digit code, 10-minute challenge TTL, five-attempt limit, 15-minute rate limit, HMAC-only persistence, and opaque `sessionStorage` token transport.
- `CMWEBS_EMAIL_LOGIN_HASH_SECRET` remains an Apps Script Property; no secret, Email, OTP, challenge ID, session token, or test identity may enter Git, URL, GET, JSONP, or release evidence.
- `workspace_id`, role, account status, and membership must remain server-authorized for every protected action.
- Do not modify real tenant, room, contract, bill, notification, or photo data and do not run a Production Sheet migration in this feature.
- Keep formal filenames unchanged; do not create version-suffix source files.
- Use the existing isolated worktree and preserve the dirty root worktree; do not reset, clean, prune, or checkout unrelated files.
- Run `npm run validate`, `node --test tests/*.test.mjs`, Apps Script syntax checks, and the available static release validator before declaring the candidate complete; a parent-directory `package.json` result is not evidence for this worktree.
- Formal Email delivery, authenticated Production desktop operation, real-device LIFF, and browser captures remain `HUMAN_REQUIRED`／`UNVERIFIED` until performed with authorized accounts.

## File Map

- Modify `apps-script/V2_LANDLORD_EMAIL_AUTH.js`: make challenge creation and Email delivery fail closed without persisting a challenge on configuration or delivery failure; keep all existing TTL, rate, hash, Workspace, and session rules.
- Modify `tests/phase217-landlord-email-auth.runtime.test.mjs`: add missing-secret and delivery-failure fixtures and regression assertions for generic errors and zero challenge writes.
- Modify `landlord-settings.html`: add the shared responsive desktop shell, shared auth readiness gate, Email-session POST bridge transport, auth-failure handling, and desktop Workspace／role chrome while preserving the current mobile settings UI.
- Modify `tests/phase220-landlord-responsive-ui.test.mjs`: include `landlord-settings.html` in the same responsive/auth contract matrix and assert that settings cannot bootstrap through unauthenticated JSONP.
- Modify `tests/phase219-landlord-auth-client.test.mjs`: cover the protected settings action through the shared bridge and preserve the no-URL-token contract.
- Modify `docs/09-TEST-MATRIX.md`: record the completed local candidate phase and keep formal Email／browser／LIFF evidence explicitly gated.
- Do not modify `docs/04-API-ROUTES.md` or Schema documentation: this plan adds no route, field, or migration.

### Task 1: Harden Email OTP challenge delivery

**Files:**
- Modify: `tests/phase217-landlord-email-auth.runtime.test.mjs: createRuntime() and Phase 217 runtime tests`
- Modify: `apps-script/V2_LANDLORD_EMAIL_AUTH.js: landlordEmailAuthIssueChallenge_()`

**Interfaces:**
- Consumes: existing `requestLandlordEmailVerificationByLineUid_()` and `requestLandlordEmailLogin_()` calls, `CMWEBS_EMAIL_LOGIN_HASH_SECRET`, `MailApp.sendEmail()`.
- Produces: the existing `EMAIL_DELIVERY_FAILED` result with the existing generic message, no challenge row when secret lookup or mail delivery fails, and unchanged successful `{ challenge_id, expires_at }` output.

- [x] **Step 1: Write the failing runtime tests.**

  Extend `createRuntime(overrides)` with an `emailHashSecret` override and a `sendEmailError` override. Make the mock property getter return the override for `CMWEBS_EMAIL_LOGIN_HASH_SECRET`, and make the mock `MailApp.sendEmail()` throw `sendEmailError` when supplied. Add these tests after the existing normalization tests:

  ```js
  guardedTest('Phase 217 fails closed when the Email hash secret is missing', () => {
    const { api, sheets, state } = createRuntime({ emailHashSecret: '' });
    const result = api.requestLandlordEmailLogin_('owner@example.com', 'missing-secret');

    assert.equal(result.success, false);
    assert.equal(result.code, 'EMAIL_DELIVERY_FAILED');
    assert.equal(result.message, 'Email 驗證碼寄送失敗');
    assert.doesNotMatch(JSON.stringify(result), /CMWEBS_EMAIL_LOGIN_HASH_SECRET/);
    assert.equal(state.mailSends.length, 0);
    assert.equal(sheetObjects(sheets.V2_landlord_email_login_challenges).length, 0);
  });

  guardedTest('Phase 217 does not persist a challenge when MailApp delivery fails', () => {
    const { api, sheets, state } = createRuntime({
      sendEmailError: new Error('MailApp quota or authorization failure')
    });
    const result = api.requestLandlordEmailLogin_('owner@example.com', 'mail-failure');

    assert.equal(result.success, false);
    assert.equal(result.code, 'EMAIL_DELIVERY_FAILED');
    assert.equal(result.message, 'Email 驗證碼寄送失敗');
    assert.equal(state.mailSends.length, 0);
    assert.equal(sheetObjects(sheets.V2_landlord_email_login_challenges).length, 0);
  });
  ```

- [x] **Step 2: Run the focused tests and verify the new tests fail.**

  Run:

  ```bash
  node --test tests/phase217-landlord-email-auth.runtime.test.mjs
  ```

  Expected: the missing-secret case currently throws the Script Property error instead of returning `EMAIL_DELIVERY_FAILED`; the delivery-failure case may already return the generic error after the fixture is added. Keep the test red until the implementation path handles both cases uniformly.

- [x] **Step 3: Implement the smallest backend change.**

  In `landlordEmailAuthIssueChallenge_()`, remove the duplicate unused `landlordEmailAuthChallengeSheet_()` call. Build the normalized email hash, run the existing rate check, generate the OTP and record, and call `landlordEmailAuthSendOtpEmail_()` inside one `try` block. If any secret lookup, HMAC, or `MailApp.sendEmail()` operation throws, return exactly:

  ```js
  landlordEmailAuthError_(
    'EMAIL_DELIVERY_FAILED',
    'Email 驗證碼寄送失敗'
  )
  ```

  Append `record` only after the send call completes. Do not include the caught error in the result or audit payload. Preserve rate-limit results before sending and preserve the current challenge columns, hashes, expiry, request ID, and successful response.

- [x] **Step 4: Run the focused tests and verify they pass.**

  Run:

  ```bash
  node --test tests/phase217-landlord-email-auth.runtime.test.mjs
  ```

  Expected: all Phase 217 tests pass, including existing TTL, attempt, resend, session, Workspace, and generic account-enumeration checks.

- [x] **Step 5: Commit the independently reviewable backend change.**

  ```bash
  git add apps-script/V2_LANDLORD_EMAIL_AUTH.js tests/phase217-landlord-email-auth.runtime.test.mjs
  git commit -m "fix: fail closed on landlord email delivery errors"
  ```

### Task 2: Put settings on the shared responsive/authenticated shell

**Files:**
- Modify: `tests/phase220-landlord-responsive-ui.test.mjs: pageNames and settings assertions`
- Modify: `tests/phase219-landlord-auth-client.test.mjs: protected settings bridge test`
- Modify: `landlord-settings.html: head, shell markup, auth helpers, jsonpRequest(), loadPage()`

**Interfaces:**
- Consumes: `window.CMWebsLandlordAuth.init()`, `getMode()`, `getSessionStatus()`, `getRequestAuthParams()`, `request()`, and `handleAuthFailure()`.
- Produces: `landlord-settings.html` desktop mode using `landlord_settings_init` through the same POST bridge as the other protected pages, and mobile mode using the existing LINE JSONP compatibility path.

- [x] **Step 1: Write failing responsive and transport tests.**

  Add `landlord-settings.html` to the `pageNames` array in Phase 220. Add these assertions to the existing shared-auth test and settings-hook test:

  ```js
  assert.match(pages['landlord-settings.html'], /<link[^>]+href="landlord-responsive\.css"/);
  assert.match(pages['landlord-settings.html'], /<div class="app-shell desktop-ready">/);
  assert.match(pages['landlord-settings.html'], /<main class="page desktop-main">/);
  assert.match(pages['landlord-settings.html'], /async function ensureLandlordAuthReady\(\)/);
  assert.match(pages['landlord-settings.html'], /const authParams = window\.CMWebsLandlordAuth\.getRequestAuthParams\(\)/);
  assert.match(pages['landlord-settings.html'], /handleAuthFailure\(result\)/);
  assert.doesNotMatch(pages['landlord-settings.html'], /\?v2_action=[^"']*&line_user_id=/);
  ```

  Add a Phase 219 runtime test that initializes `landlord-auth.js`, stores `cmwebs_landlord_session_token`, invokes the settings action through the shared client, and asserts the submitted form contains `landlord_settings_init`, `response_mode=bridge`, and the session token while the form action does not contain that token. Dispatch a correlated `CMWEBS_APPS_SCRIPT` response and assert the promise resolves successfully.

- [x] **Step 2: Run the focused UI/client tests and verify they fail.**

  Run:

  ```bash
  node --test tests/phase219-landlord-auth-client.test.mjs tests/phase220-landlord-responsive-ui.test.mjs
  ```

  Expected: Phase 220 fails because settings lacks the shared stylesheet, desktop shell, and auth gate; the new Phase 219 test fails because the current settings page has no bridge path for protected requests.

- [x] **Step 3: Add the settings page desktop structure without changing mobile content.**

  In `landlord-settings.html`:

  1. Link `landlord-responsive.css` beside `frontend-release.js` and `landlord-auth.js`.
  2. Change the outer shell to `<div class="app-shell desktop-ready">`.
  3. Add the same six-item `desktop-sidebar` contract used by the other landlord pages, with `系統設定` reached through the existing `landlord-more.html` route, `desktopWorkspaceName`, `desktopRoleLabel`, and `desktopLogoutButton` IDs. Keep `合約` and `退房` links exactly aligned with the existing pages.
  4. Change the content element to `<main class="page desktop-main">` and add a hidden-by-default `desktop-topbar` containing `系統設定`, Workspace label, and status pill before the existing settings topbar.
  5. Preserve the current `<nav class="bottom-nav">`, mobile `.page` CSS rule, `setAppHeight()`, settings tabs, controls, and safe-area bottom padding.
  6. Add `setDesktopText()` and `updateDesktopChrome(workspaceName, roleLabel)` using `textContent` so Workspace and role values are escaped by the DOM. Call the update after `PAGE_DATA` is assigned and before `renderPage()` finishes.

- [x] **Step 4: Replace settings bootstrap identity handling with the shared auth gate.**

  Update `initAuthClient()` to pass `testMode: TEST_MODE`. Add the following settings-specific readiness function, using the existing `initLine()` for the mobile branch:

  ```js
  async function ensureLandlordAuthReady() {
    const auth = initAuthClient();

    if (TEST_MODE) {
      LINE_USER_ID = TEST_LINE_USER_ID;
      initAuthClient();
      return true;
    }

    if (auth.getMode() === 'email') {
      await auth.getSessionStatus();
      return true;
    }

    if (!LINE_USER_ID) {
      const ready = await initLine();
      if (!ready) return false;
    }

    initAuthClient();
    return true;
  }
  ```

  In `loadPage()`, call `await ensureLandlordAuthReady()` before `landlord_settings_init`; return early when the mobile LINE login redirects. Do not call `initLine()` on the Email desktop branch.

- [x] **Step 5: Route settings API requests through the existing auth envelope.**

  At the start of `jsonpRequest(action, params)`, obtain `authParams`. When it contains `response_mode === 'bridge'` and `landlord_session_token`, return `window.CMWebsLandlordAuth.request(action, params || {})`. Otherwise merge `authParams` into the existing JSONP request, reject if `line_user_id` is missing, and build the URL from the merged request. In the JSONP callback, call `handleAuthFailure(result)` before resolving; on an auth failure, reject an `Error` whose `code` is the server code so the existing settings error UI can display it. Keep the existing timeout, retry, cleanup, and callback naming behavior.

- [x] **Step 6: Run the focused tests and verify they pass.**

  Run:

  ```bash
  node --test tests/phase219-landlord-auth-client.test.mjs tests/phase220-landlord-responsive-ui.test.mjs
  ```

  Expected: all client and responsive tests pass; settings is covered at 375／390／768／1024／1440 contracts, uses the shared auth boundary, and has no protected JSONP URL with a hard-coded LINE identity.

- [x] **Step 7: Commit the independently reviewable settings change.**

  ```bash
  git add landlord-settings.html tests/phase219-landlord-auth-client.test.mjs tests/phase220-landlord-responsive-ui.test.mjs
  git commit -m "feat: complete landlord settings desktop auth shell"
  ```

### Task 3: Run full candidate verification and update release records

**Files:**
- Modify: `docs/09-TEST-MATRIX.md: V2.1 landlord desktop candidate entries`
- Read-only check: `docs/04-API-ROUTES.md`
- Read-only check: `docs/EXECUTION_RECORD.md`

**Interfaces:**
- Consumes: the committed backend and settings changes from Tasks 1–2, existing route and schema documentation, and the repository’s current release-version validator.
- Produces: reproducible local test evidence, a documented candidate status, and an explicit list of Production／browser／LIFF gates that remain unverified.

- [x] **Step 1: Run the complete automated test suite.**

  Run:

  ```bash
  node --test tests/*.test.mjs
  ```

  Expected: zero failures. If a failure occurs, stop release recording, isolate it to the changed file or an existing baseline regression, fix it with a new failing regression test, and rerun the complete command.

- [x] **Step 2: Run syntax and static release checks.**

  Run each command separately from the isolated worktree:

  ```bash
  find apps-script -type f -name '*.js' -print0 | xargs -0 -n1 node --check
  node scripts/validate-static-release-cache.js
  npm run validate
  git diff --check HEAD~2..HEAD
  ```

  Expected: Apps Script syntax passes. If the available static release check reports the existing release-marker mismatch, capture that fact; if `npm run validate` resolves a parent-directory package instead of a tracked package in this worktree, capture that fact and do not call it candidate evidence.

- [x] **Step 3: Verify routes and scope stayed unchanged.**

  Run:

  ```bash
  git diff -- apps-script/程式碼.js docs/04-API-ROUTES.md
  git diff -- apps-script docs | rg -n "previous_contract_id|V2_contracts|migration|V2_users|landlord_email" || true
  ```

  Expected: no dispatcher, route, Schema, migration, or Production data change is introduced by this plan; the only Apps Script change is the existing Email challenge delivery boundary.

- [x] **Step 4: Add the candidate test-matrix record.**

  Append a new checked local-candidate item in the V2.1 desktop section of `docs/09-TEST-MATRIX.md` stating that Phase 223 covers:

  - Email OTP missing-secret and MailApp failure fail-closed behavior;
  - settings desktop shell and authenticated `landlord_settings_init` bridge transport;
  - existing Phase 217／219／220 regression coverage;
  - local automated tests and Apps Script syntax checks passed; the available static release check remains `UNVERIFIED` because its committed expected marker is stale;
  - formal Email send, authenticated desktop operation against Production, five viewport captures, and LIFF real-device UAT remain `HUMAN_REQUIRED`／`UNVERIFIED`.

  Do not mark Production Email delivery or real-device/browser acceptance as passed based on local fixtures.

- [x] **Step 5: Run final verification after the documentation edit.**

  Run:

  ```bash
  node --test tests/*.test.mjs
  git diff --check
  git status --short
  git log --oneline -3
  ```

  Expected: tests remain green, whitespace is clean, only the planned commits and documentation are present, and the root worktree remains untouched.

- [x] **Step 6: Commit the release-record update.**

  ```bash
  git add docs/09-TEST-MATRIX.md
  git commit -m "docs: record landlord desktop completion candidate"
  ```

### Task 4: Production and browser acceptance handoff

**Files:**
- No source changes.
- Evidence destination: do not store Email addresses, OTPs, cookies, session tokens, or real user identifiers in Git or release docs.

**Interfaces:**
- Consumes: the three clean candidate commits and an explicitly authorized Production operator with access to Apps Script Properties, the bound MailApp account, GitHub Pages, and a real landlord account.
- Produces: separate deployment, public-readback, browser-capture, and real-device acceptance evidence; this task does not claim those gates are complete automatically.

- [ ] **Step 1: Reconcile the serving Apps Script binding before any push or deployment.**

  Confirm the target binding and current immutable version from the authorized deployment surface, compare the export to the candidate’s `apps-script/` source, and stop if the binding or version cannot be verified. Do not use a test UID or modify a real Sheet as a deployment check.

- [ ] **Step 2: Configure the required Email secret outside Git.**

  An authorized operator sets `CMWEBS_EMAIL_LOGIN_HASH_SECRET` in Apps Script Properties and confirms the executing account has MailApp authorization/quota. Never paste the value into the repository, terminal output, browser URL, Sheet, or chat.

- [ ] **Step 3: Deploy only after an explicit Production deployment instruction.**

  Create a new immutable Apps Script version while preserving the existing Web App URL, publish the Pages commit through the existing workflow, and record Apps Script version, Pages workflow, public readback, and rollback targets separately. Do not perform a Sheet migration because this plan has none.

- [ ] **Step 4: Perform manual acceptance with the real landlord account.**

  Verify first-time Email binding from an already LINE-authenticated landlord, desktop Email OTP login, settings/home/tenants/properties read operations, logout, expired/revoked session recovery, and mobile LIFF regression. Capture 375／390／768／1024／1440 browser screenshots and check no horizontal overflow or bottom-nav obstruction. Keep all personal data and tokens out of evidence.

- [ ] **Step 5: Report acceptance with surface-specific status.**

  Report source tests, deployment/readback, browser capture, and real-device/LINE results separately. Use `HUMAN_REQUIRED`, `BLOCKED`, `UNVERIFIED`, or `UNKNOWN` when the corresponding evidence is absent; never infer Production completion from local tests or HTTP 200 alone.
