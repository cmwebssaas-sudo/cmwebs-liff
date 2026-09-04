# CMWebs 房東響應式桌面版與 Email OTP 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不影響既有手機／LINE LIFF 流程的前提下，讓房東入口、總覽、房客清單與物件房間頁在寬螢幕使用桌面布局，並支援已驗證房東以 Email 一次性驗證碼登入。

**Architecture:** 保留現有靜態 HTML 與 Apps Script + Google Sheets 架構。桌面布局由共用響應式 stylesheet 套用在既有房東頁；登入由共用前端 auth/transport 模組與 Apps Script Email challenge/session 模組提供。API 在伺服器端解析 LINE／Email 兩種房東 principal，前端不接觸 LINE UID。

**Tech Stack:** Static HTML/CSS/JavaScript、LINE LIFF SDK、Google Apps Script V8、Google Sheets、Apps Script MailApp、Node.js node:test。

**Spec:** docs/superpowers/specs/2026-09-04-desktop-responsive-email-otp-design.md

## Global Constraints

- V2.1 internal-operations scope only；不新增 V3/V4 商業功能、租客 Email 登入或固定密碼。
- 所有程式修改只在隔離 feature branch；根目錄混合 WIP 不得被 staging、commit 或部署。
- 手機 375px 至 767px 的現有布局與 LINE／LIFF 流程必須保持可用；桌面 CSS 只在 @media (min-width: 1024px) 生效。
- Email、OTP code、session token 不得出現在 GET URL、JSONP query、referrer、瀏覽器歷史或一般稽核內容。
- OTP 為 6 位數、10 分鐘有效、單次使用；60 秒內不可重寄，單一 challenge 最多錯誤 5 次。
- 新資料只能追加 header／sheet；不得刪除、重排或覆寫既有資料列。
- 每個受保護 API request 都要在伺服器重新驗證 session、使用者狀態、Workspace membership、角色與權限。
- 未取得另外的正式發布授權前，不執行 Production migration、MailApp 寄信、Apps Script deploy、Pages publish 或資料交易。

## File Map

### Create

- landlord-auth.js — 房東 LINE／Email auth context、POST bridge、session storage、登出與過期處理。
- landlord-responsive.css — 桌面側邊欄、表格與布局覆寫。
- apps-script/V2_LANDLORD_EMAIL_AUTH.js — Email normalization、OTP challenge、驗證與 session primitives。
- tests/phase217-landlord-email-auth.runtime.test.mjs — challenge/session runtime tests。
- tests/phase218-landlord-email-auth-routes.test.mjs — dispatcher/bridge/principal tests。
- tests/phase219-landlord-auth-client.test.mjs — client transport/session tests。
- tests/phase220-landlord-responsive-ui.test.mjs — viewport/layout regression tests。

### Modify

- apps-script/V2_WORKSPACES.js — append Email verification fields to V2_users。
- apps-script/程式碼.js、apps-script/V2_API.js — POST actions and landlord principal resolver。
- landlord-entry.html、landlord-settings.html — Email login and first-time verification UI。
- landlord-home.html、landlord-tenants.html、landlord-properties.html — first-phase desktop layout。
- docs/04-API-ROUTES.md、docs/05-DATA-MODEL.md、docs/09-TEST-MATRIX.md — public contracts and evidence。
- package.json — only when the candidate contains the tracked validation script; update expected routes from 83 to 89。

---

### Task 1: Lock the Email auth contract with failing tests

**Files:** Create tests/phase217-landlord-email-auth.runtime.test.mjs, create tests/phase218-landlord-email-auth-routes.test.mjs, modify docs/04-API-ROUTES.md, modify docs/05-DATA-MODEL.md.

**Interfaces:** Produces the six fixed action names and exact challenge/session headers used by later tasks.

- [ ] **Step 1: Write RED runtime tests.**

Assert the future module exposes:

~~~js
assert.deepEqual(emailAuth.publicActions(), [
  'landlord_email_verify_request',
  'landlord_email_verify_code',
  'landlord_email_login_request',
  'landlord_email_login_verify',
  'landlord_email_session_status',
  'landlord_email_session_revoke'
]);
~~~

Cover Email normalization, hashed code/token storage, expiry, consumed challenge, sixth failed attempt, 60-second resend block, session expiry, revoke, and Workspace mismatch.

- [ ] **Step 2: Write RED dispatcher tests.**

Assert each action is POST-only, is dispatched exactly once, and never reads OTP/code/session values from GET parameters. Assert the desktop request cannot override server-resolved workspace_id or role.

- [ ] **Step 3: Run RED tests.**

~~~bash
node --test tests/phase217-landlord-email-auth.runtime.test.mjs tests/phase218-landlord-email-auth-routes.test.mjs
~~~

Expected: FAIL because the module and routes are not implemented.

- [ ] **Step 4: Record the six actions, request fields, response codes, and schema headers in the API/data-model docs.**

- [ ] **Step 5: Commit.**

~~~bash
git add tests/phase217-landlord-email-auth.runtime.test.mjs tests/phase218-landlord-email-auth-routes.test.mjs docs/04-API-ROUTES.md docs/05-DATA-MODEL.md
git commit -m "test: define landlord email auth contract"
~~~

### Task 2: Implement challenge, Email verification, and session primitives

**Files:** Create apps-script/V2_LANDLORD_EMAIL_AUTH.js; modify apps-script/V2_WORKSPACES.js; test tests/phase217-landlord-email-auth.runtime.test.mjs.

**Interfaces:** Produces:

~~~js
requestLandlordEmailVerificationByLineUid_(lineUserId, email, requestId)
verifyLandlordEmailVerificationCodeByLineUid_(lineUserId, challengeId, code, requestId)
requestLandlordEmailLogin_(email, requestId)
verifyLandlordEmailLogin_(challengeId, code, requestId)
getLandlordEmailSessionStatus_(sessionToken, requestId)
revokeLandlordEmailSession_(sessionToken, requestId)
resolveLandlordEmailSession_(sessionToken, requestId)
~~~

- [ ] **Step 1: Append the two V2_users headers without changing existing order.**

~~~js
'email_verified_at',
'email_login_enabled'
~~~

Add V2_landlord_email_login_challenges with challenge_id, user_id, email_hash, code_hash, issued_at, expires_at, attempt_count, last_attempt_at, consumed_at, status, request_id. Add V2_landlord_email_sessions with session_id, session_token_hash, user_id, workspace_id, role, issued_at, expires_at, last_seen_at, revoked_at, status, request_id.

- [ ] **Step 2: Implement normalized Email and HMAC helpers.**

Read CMWEBS_EMAIL_LOGIN_HASH_SECRET through getRequiredScriptProperty_(). Generate OTP and session token with cryptographically random values; store only hashes and never log raw values.

- [ ] **Step 3: Implement challenge issue and MailApp send.**

Apply generic responses, 60-second resend blocking, and a 15-minute rate window before MailApp.sendEmail. A send failure must not create a usable challenge.

- [ ] **Step 4: Implement code verification and first-time verification.**

Use constant-time comparison, mark a successful challenge consumed before returning, and update V2_users only after the current LINE principal is verified. Desktop login accepts only active landlord accounts with verified Email.

- [ ] **Step 5: Implement session issue/status/revoke.**

Bind each session to server-resolved user_id, active Workspace, and role. Reload those records on every status or protected-operation check.

- [ ] **Step 6: Run tests and syntax checks.**

~~~bash
node --test tests/phase217-landlord-email-auth.runtime.test.mjs
node --check apps-script/V2_LANDLORD_EMAIL_AUTH.js
node --check apps-script/V2_WORKSPACES.js
~~~

- [ ] **Step 7: Commit.**

~~~bash
git add apps-script/V2_LANDLORD_EMAIL_AUTH.js apps-script/V2_WORKSPACES.js tests/phase217-landlord-email-auth.runtime.test.mjs
git commit -m "feat: add landlord email otp session primitives"
~~~

### Task 3: Route POST bridge and unify landlord principal resolution

**Files:** Modify apps-script/程式碼.js doGet/doPost, modify apps-script/V2_API.js output helpers, test tests/phase218-landlord-email-auth-routes.test.mjs.

**Interfaces:** Produces resolveLandlordPrincipal_(request), which returns canonical user/Workspace/role inside Apps Script only.

- [ ] **Step 1: Extend doPost JSON parsing with request_id and response_mode=bridge.**

Email actions return htmlBridgeOutput_(result, request_id); existing webhook and document-upload response paths remain JSON.

- [ ] **Step 2: Dispatch all six actions from JSON body fields.**

~~~js
if (action === 'landlord_email_login_verify') {
  result = verifyLandlordEmailLogin_(
    request.challenge_id || '',
    request.code || '',
    request.request_id || ''
  );
}
~~~

Apply the same explicit mapping to the other five actions and reject missing fields before writes.

- [ ] **Step 3: Add dual principal resolution at the dispatcher boundary.**

Accept the existing verified LINE identity for mobile or landlord_session_token for desktop. Resolve the user and membership server-side; ignore client-provided Workspace and role. Do not change tenant routes.

- [ ] **Step 4: Audit direct landlord identity reads.**

~~~bash
rg -n "e\.parameter\.line_user_id|request\.line_user_id|workspace_id|role" apps-script/程式碼.js apps-script/V2_*.js
~~~

Make every first-phase landlord route consume the resolved principal while retaining current ownership checks.

- [ ] **Step 5: Run route tests and all Apps Script syntax checks.**

~~~bash
node --test tests/phase218-landlord-email-auth-routes.test.mjs
for file in apps-script/*.js; do node --check "$file"; done
~~~

- [ ] **Step 6: Commit.**

~~~bash
git add apps-script/程式碼.js apps-script/V2_API.js tests/phase218-landlord-email-auth-routes.test.mjs
git commit -m "feat: resolve landlord email sessions server-side"
~~~

### Task 4: Build the shared client auth transport and login UI

**Files:** Create landlord-auth.js; modify landlord-entry.html and landlord-settings.html; create tests/phase219-landlord-auth-client.test.mjs.

**Interfaces:** window.CMWebsLandlordAuth exposes init, getMode, getRequestAuthParams, requestEmailCode, verifyEmailCode, requestEmailVerification, verifyEmailVerification, getSessionStatus, and logout.

- [ ] **Step 1: Write RED client tests.**

Assert the client uses a hidden-iframe POST bridge, correlates request_id, never puts Email/code/session token in GET or JSONP URLs, and stores only the opaque session token in sessionStorage.

- [ ] **Step 2: Implement the POST bridge.**

Accept only source === 'CMWEBS_APPS_SCRIPT' and the matching request ID; remove the iframe/listener on completion; timeout after 25 seconds; never auto-retry code verification.

- [ ] **Step 3: Implement Email/LINE mode selection and session failure.**

At desktop widths Email is primary and LINE is fallback; mobile retains current LIFF initialization. On SESSION_EXPIRED, AUTH_REQUIRED, or WORKSPACE_FORBIDDEN, clear session and redirect through validated return_to.

- [ ] **Step 4: Implement entry states.**

Render Email input, code input, 60-second countdown, generic unknown-account message, invalid/expired/rate-limit errors, success redirect, and LINE fallback. Do not reveal whether an Email exists.

- [ ] **Step 5: Implement LINE-authenticated settings verification.**

Add Email field, status, request-code button, code field, and verified timestamp. Enable Email login only after code success.

- [ ] **Step 6: Run tests and commit.**

~~~bash
node --test tests/phase219-landlord-auth-client.test.mjs
node --check landlord-auth.js
git add landlord-auth.js landlord-entry.html landlord-settings.html tests/phase219-landlord-auth-client.test.mjs
git commit -m "feat: add landlord email otp client login"
~~~

### Task 5: Add the desktop layout without changing mobile behavior

**Files:** Create landlord-responsive.css; modify landlord-home.html, landlord-tenants.html, landlord-properties.html; create tests/phase220-landlord-responsive-ui.test.mjs.

**Interfaces:** Produces one desktop layout contract; the existing .app-shell, .page, .bottom-nav, setAppHeight(), and button handlers remain intact below 1024px.

- [ ] **Step 1: Write RED viewport/CSS isolation tests.**

Assert each page includes the stylesheet, keeps .bottom-nav, contains @media (min-width: 1024px), and has no desktop selector outside that boundary.

- [ ] **Step 2: Implement shared desktop tokens and shell.**

~~~css
:root {
  --desktop-sidebar-width: 256px;
  --desktop-content-max: 1440px;
  --desktop-gap: 24px;
}
@media (min-width: 1024px) {
  .app-shell.desktop-ready {
    display: grid;
    grid-template-columns: var(--desktop-sidebar-width) minmax(0, 1fr);
  }
  .desktop-sidebar { display: flex; }
  .bottom-nav { display: none; }
}
~~~

Add visible focus rings, 44px controls, 16px body text, WCAG AA colors, fixed table headers, and prefers-reduced-motion handling; reuse existing inline SVG icons.

- [ ] **Step 3: Add identical sidebar/topbar navigation.**

Use 總覽、房客、物件與房間、合約、退房、帳款 with active state, Workspace, role, and logout. Links must use the existing release-version builder and preserve test-mode parameters.

- [ ] **Step 4: Convert the three content regions.**

Home gets KPI row and operational panels; tenants gets table/search/filter with card fallback; properties gets property groups and room table. Preserve all existing IDs and paper-backfill, simple-new-lease, checkout, and room-account actions.

- [ ] **Step 5: Run UI tests at 375, 390, 768, 1024, and 1440 widths and commit.**

~~~bash
node --test tests/phase220-landlord-responsive-ui.test.mjs
git add landlord-responsive.css landlord-home.html landlord-tenants.html landlord-properties.html tests/phase220-landlord-responsive-ui.test.mjs
git commit -m "feat: add responsive landlord desktop layout"
~~~

### Task 6: Integrate Email sessions into first-phase pages

**Files:** Modify landlord-home.html, landlord-tenants.html, landlord-properties.html, landlord-entry.html, landlord-auth.js; test Tasks 219–220.

- [ ] **Step 1: Await shared auth before page bootstrap.**

Test mode keeps the existing deterministic test identity; never send a test identity to Email actions.

- [ ] **Step 2: Replace direct page identity parameters with the shared auth envelope.**

~~~js
const authParams = window.CMWebsLandlordAuth.getRequestAuthParams();
return jsonpRequest(action, Object.assign({}, params, authParams));
~~~

Email mode uses the opaque session transport; mobile mode preserves the current LINE path.

- [ ] **Step 3: Add uniform auth failure handling.**

Clear session and redirect to the validated entry return path for SESSION_EXPIRED, AUTH_REQUIRED, and WORKSPACE_FORBIDDEN; never retry writes or switch identities automatically.

- [ ] **Step 4: Run focused integration tests and commit.**

~~~bash
node --test tests/phase219-landlord-auth-client.test.mjs tests/phase220-landlord-responsive-ui.test.mjs
git add landlord-auth.js landlord-entry.html landlord-home.html landlord-tenants.html landlord-properties.html
git commit -m "feat: connect landlord pages to shared auth context"
~~~

### Task 7: Validate, document, and stop at the release gate

**Files:** Modify docs/04-API-ROUTES.md, docs/05-DATA-MODEL.md, docs/09-TEST-MATRIX.md, and package.json only when it is tracked in the candidate.

- [ ] **Step 1: Reconcile docs with final source.**

Confirm six POST-only actions, fields, error codes, appended schemas, Script Property name, and migration idempotency. Mark real Email sending, first verification, and authenticated desktop operation HUMAN_REQUIRED until manually verified.

- [ ] **Step 2: Run candidate checks.**

~~~bash
node --test tests/*.test.mjs
npm run validate
node /Users/hans/CMWebs/cmwebs-liff/scripts/validate-project.js --root . --apps-dir apps-script --html-dir . --expected-routes 89
for file in apps-script/*.js; do node --check "$file"; done
git diff --check
~~~

The candidate validator must report 89 unique routes and 89/89 handlers after six new actions. If the clean ref has no tracked package.json, record that limitation and use the direct validator as the candidate authority rather than the dirty root package.

- [ ] **Step 3: Run read-only browser checks.**

Verify no horizontal scroll, mobile bottom nav at 375/390, desktop sidebar at 1024/1440, keyboard focus, return-to navigation, Email error states, and no production write in test mode.

- [ ] **Step 4: Inspect and commit docs.**

~~~bash
git status --short --branch
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
git add docs/04-API-ROUTES.md docs/05-DATA-MODEL.md docs/09-TEST-MATRIX.md package.json
git commit -m "docs: record desktop landlord auth release candidate"
~~~

- [ ] **Step 5: Stop before deployment.**

Do not run migration, clasp push, Apps Script deploy, MailApp production send, Git push, or Pages publish until the user separately authorizes formal release. Record pre-release immutable backend and Pages rollback references before any such action.

## Plan Self-Review

- The plan covers every spec section: responsive boundary, first-phase pages, shared auth client, Email verification, challenge/session storage, POST bridge, principal resolution, security, testing, release, and rollback.
- All six API actions and all client/server interface boundaries are named explicitly.
- No task asks an implementer to guess validation, error behavior, schema fields, or authorization rules.
- The plan does not include tenant Email login, fixed passwords, React migration, iframe desktop shell, or business-data transactions.
- The root dirty worktree remains outside the plan; all implementation starts from the isolated feature branch.
