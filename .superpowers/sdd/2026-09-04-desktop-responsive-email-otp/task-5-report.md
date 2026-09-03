# Task 5 Report: Responsive Landlord Desktop Layout

Recommended model/speed: `gpt-5.6-terra`, `medium`.

## Status

PASS for local source/test candidate. No deploy, push, Pages publish, clasp push, Apps Script deploy, MailApp send, migration, Production data transaction, or Email-session page bootstrap integration was performed.

Implementation commit: `a4088c47f1b93b89a9845f3a610ae661c748064d`

## Changed Files

- `landlord-responsive.css`
- `landlord-home.html`
- `landlord-tenants.html`
- `landlord-properties.html`
- `tests/phase220-landlord-responsive-ui.test.mjs`
- `.superpowers/sdd/2026-09-04-desktop-responsive-email-otp/task-5-report.md` (handoff report written after the implementation commit so it can include the commit hash)

## Summary

- Added one shared `landlord-responsive.css` with desktop tokens:
  `--desktop-sidebar-width: 256px`, `--desktop-content-max: 1440px`, and `--desktop-gap: 24px`.
- Kept the fixed mobile shell intact: `html/body` remain `overflow: hidden`, `.app-shell` remains fixed-height/overflow-hidden, `.page` keeps `var(--nav-height)` bottom reserve, `setAppHeight()` remains in all three pages, and `.bottom-nav` remains in markup.
- Added desktop-only layout under `@media (min-width: 1024px)`: sidebar, topbar, 4-column KPI rows, desktop panel grid, table wrappers, sticky table headers, 44px+ controls, visible focus rings, WCAG-oriented colors, and reduced-motion handling.
- Added identical desktop nav labels across all three pages: `總覽`, `房客`, `物件與房間`, `合約`, `退房`, `帳款`; navigation uses existing `goPage()` so release-version and `test=1` query handling remain unchanged.
- Added server-data context wiring for desktop Workspace/role labels after existing page bootstrap/render. This does not integrate Email sessions into page bootstraps.
- Added a desktop tenant table while preserving the existing mobile tenant cards and handlers.
- Added per-property desktop room tables while preserving the existing mobile room cards and actions, including paper-backfill, simple-new-lease, room-account toggle, room edit, and archive handlers.

## TDD Evidence

RED command:

```text
node --test tests/phase220-landlord-responsive-ui.test.mjs
```

RED result:

```text
tests 6
pass 0
fail 6
```

Expected failures: missing `landlord-responsive.css`, missing stylesheet links, missing desktop shell/sidebar/topbar/table hooks, and missing viewport markers.

GREEN command:

```text
node --test tests/phase220-landlord-responsive-ui.test.mjs
```

GREEN result:

```text
tests 6
pass 6
fail 0
duration_ms 39.968625
```

## Verification Commands And Output

```text
node --test tests/phase220-landlord-responsive-ui.test.mjs
```

```text
tests 6
pass 6
fail 0
```

```text
node - <<'NODE'
...parse edited inline scripts with vm.Script...
NODE
```

```text
landlord-home.html: 1 inline script(s) parse
landlord-tenants.html: 1 inline script(s) parse
landlord-properties.html: 1 inline script(s) parse
```

```text
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

```text
node - <<'NODE'
...focused viewport static smoke at 375/390/768/1024/1440...
NODE
```

```text
phase220 viewport static 375: PASS
phase220 viewport static 390: PASS
phase220 viewport static 768: PASS
phase220 viewport static 1024: PASS
phase220 viewport static 1440: PASS
```

```text
node --test tests/phase193-landlord-home-dashboard.test.mjs tests/phase194-landlord-tenant-expiry-display.test.mjs tests/phase208-simple-landlord-contract-flow.test.mjs tests/phase210-paper-contract-backfill.ui.test.mjs tests/phase213-paper-contract-login.ui.test.mjs tests/phase214-paper-backfill-orphan-entry.ui.test.mjs tests/phase215-paper-backfill-legacy-pending-entry.test.mjs room-account-toggle-page.test.mjs tenant-binding-invite-share.test.mjs
```

```text
Phase 193 landlord home dashboard data contract tests passed.
Phase 194 landlord tenant expiry display tests passed.
Phase 208 simple landlord contract flow RED/GREEN tests passed.
Phase 210 paper contract backfill UI tests passed.
Phase 213 paper contract login UI tests passed.
Phase 214 paper backfill orphan entry UI tests passed.
Phase 215 legacy pending paper backfill entry tests passed.
tests 7
pass 7
fail 0
```

Additional legacy static scripts, rerun from repository root after an initial cwd mistake:

```text
node tests/room-account-toggle-page.test.mjs
Room account toggle page tests passed.

node tests/tenant-binding-invite-share.test.mjs
Tenant binding invite share tests passed.
```

```text
git diff --check
```

```text
PASS (no output)
```

```text
node --check landlord-auth.js
```

```text
PASS (no output)
```

## Rulings

- Kept desktop chrome hidden by default in markup with `hidden`, and only displayed it under the shared `@media (min-width: 1024px)` desktop rules. This protects 375/390/768 mobile and tablet behavior.
- Did not call `CMWebsLandlordAuth.getRequestAuthParams()` or alter the page API bootstrap identity paths. That remains Task 6.
- Used existing `goPage()` navigation so release-version and test-mode parameters are preserved.
- Used existing action functions rather than adding new business logic or recalculations.
- No docs/API/schema updates were needed for Task 5 because no routes, schema, or business calculations changed.

## Self-Review

- Scope stayed within the approved three pages plus one shared stylesheet and one Phase 220 test.
- Desktop selectors in `landlord-responsive.css` are inside the `1024px` media query except non-layout root tokens and reduced-motion rules.
- Mobile `.bottom-nav`, `.app-shell`, `.page`, `setAppHeight()`, and safe-area/nav reserve remain present.
- Tenant table and room tables are additive and hidden below desktop width.
- Paper-backfill, simple-new-lease, checkout-adjacent navigation, room-account toggle, room edit, archive, tenant detail, contract, and invite-share handlers remain present.
- No Production or external operation was run.

## Concerns

- Browser screenshot verification was not run in this turn; Task 5 evidence is static/parse validation plus existing UI tests.
- The report is written after implementation commit `a4088c47f1b93b89a9845f3a610ae661c748064d` so it can include the exact hash; it is therefore not part of that implementation commit unless a later controller chooses to commit report artifacts.
- The initial explicit `node tests/room-account-toggle-page.test.mjs` and `node tests/tenant-binding-invite-share.test.mjs` runs were accidentally launched from `tests/`, causing expected `ENOENT` cwd errors; both passed when rerun from repository root.

## Fix Round 1 Evidence

Review findings addressed in Task 5 files only:

- Desktop typography: raised explicit desktop `font-size` declarations in `landlord-responsive.css` from `12px` through `15px` to at least `16px`.
- Viewport test contract: removed reliance on `phase220-width-*` marker comments and replaced it with static parsing of the actual `@media (min-width: 1024px)` block, desktop selector isolation checks, desktop sidebar/table/bottom-nav visibility checks, and data-driven source checks for widths `375`, `390`, `768`, `1024`, and `1440`.
- Browser screenshot verification remains Task 7 and was not claimed here.

RED command:

```text
node --test tests/phase220-landlord-responsive-ui.test.mjs
```

RED result after strengthening the test and before the CSS fix:

```text
tests 7
pass 5
fail 2
```

Expected failures: `desktop font-size 12px is below 16px` and lingering `phase220-width-*` marker comments.

GREEN and verification commands:

```text
node --test tests/phase220-landlord-responsive-ui.test.mjs
```

```text
tests 7
pass 7
fail 0
```

```text
node - <<'NODE'
...parse edited inline scripts with vm.Script...
NODE
```

```text
landlord-home.html: 1 inline script(s) parse
landlord-tenants.html: 1 inline script(s) parse
landlord-properties.html: 1 inline script(s) parse
```

```text
node --test tests/phase193-landlord-home-dashboard.test.mjs tests/phase194-landlord-tenant-expiry-display.test.mjs tests/phase208-simple-landlord-contract-flow.test.mjs tests/phase210-paper-contract-backfill.ui.test.mjs tests/phase213-paper-contract-login.ui.test.mjs tests/phase214-paper-backfill-orphan-entry.ui.test.mjs tests/phase215-paper-backfill-legacy-pending-entry.test.mjs
```

```text
tests 7
pass 7
fail 0
```

```text
node tests/room-account-toggle-page.test.mjs
node tests/tenant-binding-invite-share.test.mjs
```

```text
Room account toggle page tests passed.
Tenant binding invite share tests passed.
```

```text
rg -n "font-size:\s*(1[0-5]|[0-9])px|phase220-width" landlord-responsive.css
```

```text
PASS (no matches; command exits 1 because rg found nothing)
```

```text
npm run validate
```

```text
Validation: PASS
CMWebs validation passed.
```

```text
git diff --check
```

```text
PASS (no output)
```
