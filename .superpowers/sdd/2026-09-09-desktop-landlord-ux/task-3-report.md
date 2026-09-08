# Task 3 implementation report

## Scope

- Repository/worktree: `/Users/hans/CMWebs/cmwebs-liff/.worktrees/desktop-ux-login-20260909`
- Branch: `codex/desktop-ux-login-20260909`
- Base commit: `964570a51679edbe4f399925fd010f4d0409fd1f`
- Implementation commit: `d0dd3f0` (`feat(landlord): add desktop shell to arrears and contracts`)
- Task boundary: Task 3 only. No Apps Script, schema, data, deployment, push, or root-worktree changes.

## Implementation

- Added the shared desktop landlord shell, sidebar navigation, Workspace/role chrome, desktop viewport-height handling, responsive list layout, and desktop modal stacking/internal scrolling to the arrears and contract-request pages.
- Preserved the existing mobile app shell, bottom navigation, LINE/JSONP path, page IDs, modal IDs, and action-handler names.
- Added the existing `landlord-auth.js`/`landlord-api.js` boundary to both pages. Desktop Email sessions use the POST bridge through the shared auth client; mobile continues through the existing LINE-compatible API client.
- Removed the unreachable page-local JSONP URL builders so these pages do not retain a second auth transport that could place identity/session values into URLs.
- Kept native contract signing review on its separate `NATIVE_SIGNING_REVIEW_SESSION_TOKEN`. Desktop Email sessions fail closed with an explicit unsupported-flow message instead of reusing the landlord Email session.
- Added Phase 220 coverage for the two legacy operational pages, modal/action preservation, desktop auth readiness, URL-boundary checks, and native-session separation.

## Fix round 1 — reviewer findings

- Fix commit: `9f861f9` (`fix(landlord): close unsupported desktop operations`)
- Finding 1: verified the existing Apps Script POST dispatcher does not expose the legacy arrears or contract-request actions. Both pages now throw `DESKTOP_EMAIL_UNSUPPORTED` before entering the Email bridge for those protected actions; the mobile LINE/JSONP path remains unchanged.
- Finding 2: `landlord-auth.js` keeps the existing bridge `request_id` as the transport correlation ID and carries an incoming business `request_id` separately as `business_request_id`, without changing the bridge response protocol or mutating caller parameters.
- Finding 3: removed the unsupported `landlord-tenant-checkout.html` link from both legacy desktop sidebars; the page requires `contract_id` and is outside this task scope.
- Finding 4: bridge timeout errors now carry `API_TIMEOUT`, preserving the arrears manual-settlement authoritative recheck path.
- Added Phase 219 regressions for business-ID preservation and timeout normalization, plus Phase 220 regressions for fail-closed unsupported actions and checkout-link exclusion.

## Changed files

- `landlord-arrears.html`
- `landlord-auth.js` (Fix round 1)
- `landlord-contract-requests.html`
- `landlord-responsive.css`
- `tests/phase219-landlord-auth-client.test.mjs` (Fix round 1)
- `tests/phase220-landlord-responsive-ui.test.mjs`

## Verification

Passed:

- `node --test tests/phase219-landlord-auth-client.test.mjs tests/phase220-landlord-responsive-ui.test.mjs` — 32 passed, 0 failed.
- Inline script syntax parse for both target HTML files — passed.
- `node --check landlord-auth.js` and `node --check landlord-api.js` — passed.
- `node --check` for all `apps-script/**/*.js` — passed.
- `git diff --check` — passed.

Round 1 latest verification:

- `node --test tests/phase219-landlord-auth-client.test.mjs tests/phase220-landlord-responsive-ui.test.mjs` — 36 passed, 0 failed.
- Inline target-page syntax, `landlord-auth.js`/`landlord-api.js` syntax, and all `apps-script/**/*.js` syntax — passed.
- `git diff --check` — passed before the fix commit.

Failed or unavailable without scope expansion:

- `node scripts/validate-static-release-cache.js` — fails on the base repository's unchanged `frontend-release.js` version (`20260906-landlord-api-resilience-v1`); the validator currently requires `20260905-prepaid-rent-quick-renewal-v1`. `frontend-release.js` was not changed because release-version repair is outside Task 3.
- `npm run validate` — `UNVERIFIED`; this worktree has no `package.json`/`validate` script.

## HUMAN_REQUIRED / UNVERIFIED boundaries

- `HUMAN_REQUIRED`: verify the deployed desktop Email-session flow in a real browser, including protected arrears/contract-request API calls, sidebar navigation, modal stacking, internal modal scrolling, and viewport resizing.
- `HUMAN_REQUIRED`: verify the existing mobile LINE/JSONP flow on a real LIFF device/browser after deployment.
- `UNVERIFIED`: no Apps Script deployment, live API acceptance, Google Sheets/schema check, or production data operation was performed.
- `UNVERIFIED`: the static release-cache validator remains a pre-existing baseline failure and was intentionally not repaired in this Task 3 commit.
