# CMWebs V2 Tenant Frontend Canonical Decision Review

- Review date: 2026-07-19 (Asia/Taipei)
- Review type: static source comparison only
- Scope: `tenant-home.html` and `tenant-bills.html`
- Repository source: repository root
- Candidate source: `_handoff/cmwebs-codex-handoff-2026-07-18/candidate-overlay/public/`
- Runtime, LINE WebView, Apps Script, Google Sheets and deployment were not changed or exercised in this review.

## 1. Executive decision

| HTML | Recommended canonical version | Adoption strategy | Decision |
|---|---|---|---|
| `tenant-home.html` | Repository root | Adopt the repository file as a whole; do not copy the candidate over it | Repository retains the required unbound-tenant redirect and consistent bill-month formatting. Candidate has no unique UI improvement in its diff and would remove both protections. |
| `tenant-bills.html` | Repository root, provisional until mobile acceptance passes | Keep the repository file as the baseline. Do not adopt the candidate as a whole. Candidate bottom-sheet styling may only be selectively reconsidered after device testing, while retaining repository scroll and safe-area safeguards. | Repository has stronger long-detail scroll containment and resets the detail scroll position on every open. Candidate offers a more conventional mobile bottom-sheet appearance, but removes those safeguards and may overlap the fixed bottom navigation. |

This decision is consistent with the existing consolidation plan: the repository root remains the frontend source of truth, while the candidate overlay remains a read-only comparison and rollback artifact. `tenant-home.html` can be approved from static evidence. `tenant-bills.html` requires iOS and Android LINE WebView acceptance before its provisional repository decision is promoted to final.

## 2. Evidence and comparison method

The decision is based on actual content comparison, not filename, file size or modification time. The unified diffs, function sets, JSONP action sets, internal HTML destinations, LIFF/API constants and relevant CSS/JavaScript behavior were compared.

### 2.1 Source fingerprints

| Source | SHA-256 |
|---|---|
| Repository `tenant-home.html` | `24c40b49e9390aeeeddf638b7931e481d075ecdd286fd085036d943668050f0f` |
| Candidate `tenant-home.html` | `6b691aa5eac2b1e5c11b70634e8b754129ba1446024ea132709c276bedabf5c0` |
| Repository `tenant-bills.html` | `e240096a28ed32a676380ff36f8c063eda7abc8ad165cebffeb004f67e6e858d` |
| Candidate `tenant-bills.html` | `0e08e410019ad6f5d49741c3f624b6fc80de9b25b676bde08780b3d624a11f5f` |

Endpoint, LIFF ID and test identity values are intentionally not reproduced in this document. Equality was checked without treating those values as a reason to select either version.

### 2.2 Actual diff boundary

- `tenant-home.html`: the repository adds `goBindingPage()`, handles `TENANT_NOT_FOUND` and `TENANT_BINDING_REQUIRED`, and applies `formatBillMonth()` to the second latest-month display. No other source difference exists.
- `tenant-bills.html`: the only differences are detail-modal CSS and explicit `detailSheet.scrollTop = 0` behavior before and after rendering. No route, API, data rendering, payment action or navigation difference exists.

## 3. `tenant-home.html` comparison

| Review item | Repository root | Candidate overlay | Assessment |
|---|---|---|---|
| LIFF initialization | Loads the same LIFF SDK, calls `liff.init`, checks login, returns to `location.href`, then obtains the profile user ID | Same | `SAME`; login and return-to-current-page behavior are unchanged. |
| API endpoint | Same configured endpoint | Same configured endpoint | `SAME`; this review does not recommend changing or duplicating it. |
| JSONP calls | Calls `tenant_home` and `tenant_contract_init`; unique callback, 30-second timeout, callback/script cleanup and cache-busting parameter | Same | `SAME`; primary home failure is blocking, while contract-init failure degrades with a warning. |
| Unbound redirect | Detects `TENANT_NOT_FOUND` or `TENANT_BINDING_REQUIRED`, then redirects to `tenant-bind.html`; preserves `test=1` when present | Does not detect either result before `unwrapData`; it falls into the generic error flow instead | Repository is required. Candidate can strand an unbound tenant on an error card instead of the binding workflow. |
| Month format | Uses `formatBillMonth()` for both latest-bill-month displays; accepts `YYYY-M`, `YYYY/M`, `YYYYMM`, date-like values and blank values | One display is formatted, but the “latest bill month” info box prints the raw value or `-` | Repository prevents inconsistent month presentation such as one location showing `2026-07` and another showing `2026/7`. |
| Modal / bottom sheet | No page-specific modal/bottom-sheet difference | Same | Not a decision factor for this page. |
| Scroll | Fixed outer document; `.page` owns vertical scrolling with momentum scrolling | Same | `SAME`. |
| Safe area | Page bottom padding reserves bottom-nav height plus `env(safe-area-inset-bottom)` | Same | `SAME`. |
| Bottom navigation | Same fixed navigation, destinations and active state | Same | `SAME`. |
| Full-height shell | Same `html/body` overflow lock, `.app-shell` height from `--app-height`, and `.page` full-height scroll container | Same | `SAME`. |
| Loading / error handling | Initial loading card, refresh loading state, retry error card; binding-required results take the dedicated redirect path | Same generic handling, but no dedicated binding-required path | Repository has the more complete error classification. |
| Tenant workflow | LIFF identity → parallel home/contract requests → binding redirect when required → render home | LIFF identity → parallel requests → generic unwrap/error when binding is required → render home otherwise | Repository preserves the intended tenant onboarding boundary. |
| Mobile experience | Same viewport-height, orientation and `visualViewport` resize handling; adds no UI divergence | Same | Equivalent except that repository reaches the correct binding page. |
| Existing feature loss | None found relative to candidate | Candidate loses binding redirect and one month-normalization call | Replacing repository with candidate is a functional regression. |
| Regression risk | Redirect loops are possible only if the backend continues returning a binding error after successful binding; must be tested | Unbound tenants can be blocked; raw month formats can leak into UI | Repository risk is testable and lower than the known candidate regressions. |

### 3.1 Canonical recommendation

Adopt the repository-root `tenant-home.html` as a whole. No merge is needed because it is already the recommended canonical file. Do not overlay the candidate version and do not cherry-pick either of its removals.

### 3.2 Repository behavior that must be preserved

- `goBindingPage()` and its cache-busting navigation.
- Propagation of `test=1` through the binding redirect, without treating test mode as dry-run.
- Explicit handling of `TENANT_NOT_FOUND` and `TENANT_BINDING_REQUIRED` before generic result unwrapping.
- `formatBillMonth()` at every latest-bill-month display.
- Existing LIFF return-to-current-page, JSONP timeout/cleanup, fixed shell, safe-area padding and retry behavior.

### 3.3 Candidate UI behavior to adopt

None is mandatory. The candidate diff contains no unique visual behavior for this page; it only removes two repository protections. The candidate should remain a provenance/rollback artifact, not a source for this canonical decision.

## 4. `tenant-bills.html` comparison

| Review item | Repository root | Candidate overlay | Assessment |
|---|---|---|---|
| LIFF initialization | Same LIFF initialization, login return and profile lookup | Same | `SAME`. |
| API endpoint | Same configured endpoint | Same configured endpoint | `SAME`. |
| JSONP calls | Calls `tenant_bills` and `tenant_payment_report_init`; unique callback, 30-second timeout, cleanup and cache busting | Same | `SAME`; bills are required, payment-report history degrades independently. |
| Unbound redirect | No dedicated `tenant-bind.html` redirect | No dedicated redirect | `SAME`, but this is a shared workflow gap. Binding-related backend errors will be shown through generic error handling. |
| Month format | `billMonthOf()` delegates to `formatBillMonth()` | Same | `SAME`. |
| Modal / bottom sheet | Full-height detail surface inside a backdrop that reserves bottom-nav and safe-area space; rounded on all corners; backdrop fade/short vertical entrance | Bottom-aligned sheet; rounded top corners, upward shadow and bottom-sheet entrance; height capped using app height, nav height and safe area | Candidate looks more like a native mobile bottom sheet. Repository provides a larger, nav-safe reading surface for long bills. |
| Scroll | Detail sheet has explicit vertical scrolling, `overscroll-behavior: contain`, momentum scrolling, and scroll reset both before render and on the next animation frame | Detail sheet remains `overflow-y: auto`, but removes overscroll containment, explicit momentum scrolling and both scroll resets | Repository is safer for repeated opening and long detail content. Candidate may reopen at a stale scroll offset or allow scroll chaining in WebView. |
| Safe area | Backdrop bottom padding explicitly reserves nav height plus safe-area inset | Sheet max-height subtracts nav and safe-area values, but the bottom-aligned high-z-index sheet still terminates at the shell bottom | Static CSS alone does not prove the candidate sheet avoids covering the nav/home-indicator area; real-device verification is required. |
| Bottom navigation | Modal is above the nav by z-index, while backdrop padding keeps content out of the nav region | Modal is also above the nav, and the sheet is anchored at the bottom without a bottom offset | Candidate can visually cover the bottom nav even though its maximum height is reduced. Repository deliberately leaves the nav-safe region outside the detail surface. |
| Full-height shell | Same fixed shell, dynamic `--app-height` and page scroll owner | Same | `SAME`; only the detail layer differs. |
| Loading / error handling | Same loading card, refresh state, empty state, retry and partial payment-report degradation | Same | `SAME`. |
| Tenant workflow | Bill list/filter → detail → payment report or report history | Same | `SAME`; content, handlers, bill IDs and payment navigation are unchanged. |
| Mobile experience | Maximizes readable detail height while containing inner scrolling and preserving nav/safe-area spacing | More familiar bottom-sheet silhouette and motion, but weaker scroll isolation and uncertain bottom inset behavior | Candidate has a visual advantage; repository has the stronger interaction safeguards. |
| Existing feature loss | Does not lose candidate data or actions; loses only the candidate bottom-sheet presentation | Removes deterministic scroll reset and overscroll containment | Candidate wholesale adoption creates interaction regression risk. |
| Regression risk | Must prove long content scroll, close behavior and viewport resizing on iOS/Android LINE WebView | Stale scroll, background scroll chaining, nav overlap and home-indicator overlap are plausible | Neither version is final without device acceptance; repository is the safer provisional baseline. |

### 4.1 Canonical recommendation

Keep the repository-root `tenant-bills.html` as the provisional canonical version. Do not replace it with the candidate file as a whole. Promote the decision to final only after iOS and Android LINE WebView tests pass.

If product review explicitly prefers a bottom sheet, use a **partial, behavior-preserving merge**, not a file replacement: selectively adopt the candidate’s bottom alignment, top-only corner radius, upward shadow and entrance motion, while retaining or re-establishing the repository’s deterministic scroll reset, scroll containment, momentum scrolling and explicit nav/safe-area clearance.

### 4.2 Repository behavior that must be preserved

- Bill list, filtering, status badges, empty state and detail content.
- `tenant_bills` and `tenant_payment_report_init` JSONP requests and their partial-failure behavior.
- Payment-report navigation, including the selected bill ID and existing test-mode propagation.
- Detail scroll reset before/after rendering.
- Overscroll containment and touch momentum for long bill details.
- Modal layering above the page while keeping content clear of bottom navigation and safe area.
- Existing close button, backdrop close behavior and body scroll lock.

### 4.3 Candidate UI behavior worth selective adoption

- Bottom-aligned sheet presentation.
- Top-only rounded corners.
- Upward shadow and bottom-up entrance motion.
- A viewport-relative maximum height.

These are optional presentation improvements, not mandatory canonical behavior. They must not be adopted unless the resulting sheet has an explicit bottom inset or equivalent layout that keeps interactive content clear of the home indicator and fixed navigation, and all scroll tests pass.

### 4.4 Shared issues not resolved by choosing a version

- Neither bills version has a dedicated unbound-tenant redirect.
- Neither modal declares dialog semantics such as `role="dialog"` and `aria-modal="true"`.
- Neither implementation provides focus trapping, focus restoration or Escape-key handling.
- Runtime behavior under LIFF keyboard/viewport changes cannot be proven by static comparison.

These are follow-up issues requiring separate authorization. They are not grounds to modify either HTML during this review.

## 5. Regression assessment

| Risk | Affected choice | Severity | Required gate |
|---|---|---:|---|
| Unbound tenant remains on generic error card | Candidate `tenant-home.html` | High | Reject candidate wholesale; exercise both binding error codes against repository behavior. |
| Latest bill month has inconsistent formats | Candidate `tenant-home.html` | Medium | Test all supported month inputs and require identical output in both locations. |
| Detail reopens at prior scroll position | Candidate `tenant-bills.html` | High | Open a long bill, scroll, close, then open the same and a different bill. Both must start at top. |
| Detail scroll chains into page or viewport | Candidate `tenant-bills.html` | High | Test top/bottom overscroll in iOS and Android LINE WebView. |
| Bottom sheet covers nav or safe area | Candidate `tenant-bills.html` | High | Test devices with and without home indicators in portrait/landscape. |
| Full-height detail cannot scroll or close | Repository `tenant-bills.html` | High | Required mobile acceptance before final promotion. |
| LIFF viewport resize leaves stale shell height | Both versions | Medium | Resize/orientation/keyboard/reopen tests using `visualViewport`. |
| Missing accessibility dialog behavior | Both bills versions | Medium | Separate accessibility remediation decision and regression suite. |

## 6. Recommended implementation order

No implementation is performed by this document. When a later approved implementation phase begins, use this order:

1. Freeze the four fingerprints in section 2 and confirm the repository root remains the frontend source of truth.
2. Approve repository `tenant-home.html` without candidate overlay; run binding, month-format, LIFF-return and error-path tests.
3. Run repository `tenant-bills.html` unchanged on iOS LINE WebView, Android LINE WebView and normal mobile browsers.
4. If repository bills passes, promote it to final canonical with no candidate merge.
5. If it fails or product explicitly requires a bottom sheet, create a separately reviewed partial merge of presentation only; retain all repository data/actions and scroll safeguards.
6. Repeat static syntax/link checks, device workflow tests and visual/safe-area acceptance before any deployment decision.
7. Record the approved commit, test evidence and rollback artifact; deployment remains a separate, manually authorized phase.

## 7. Validation checklist

### 7.1 Common page checks

- [ ] Inline JavaScript syntax passes.
- [ ] LIFF SDK load failure produces a clear, non-secret error.
- [ ] Logged-out LIFF flow returns to the exact original page and query string.
- [ ] Logged-in LIFF flow obtains the profile and never sends an empty LINE user ID.
- [ ] API endpoint and LIFF configuration match the approved environment without page-local drift.
- [ ] Each JSONP request creates a unique callback, times out, and removes callback/script state.
- [ ] Primary-request failure and secondary-request partial failure follow the documented behavior.
- [ ] Loading, retry, refresh spinner, empty state and error state are usable.
- [ ] Fixed shell uses current `visualViewport.height` or `window.innerHeight` after resize and orientation changes.
- [ ] Page scroll is confined to `.page`; the outer document does not scroll.
- [ ] Bottom navigation destinations resolve and its active state is correct.
- [ ] Content and toast remain above the bottom nav and safe area.
- [ ] iOS LINE WebView, Android LINE WebView, iOS Safari and Android Chrome are covered.

### 7.2 `tenant-home.html`

- [ ] `tenant_home` success renders all existing home sections and actions.
- [ ] `tenant_contract_init` failure does not block valid home data.
- [ ] `TENANT_NOT_FOUND` redirects once to `tenant-bind.html`.
- [ ] `TENANT_BINDING_REQUIRED` redirects once to `tenant-bind.html`.
- [ ] Successful binding followed by return does not create a redirect loop.
- [ ] `test=1` is preserved through the binding redirect and is not treated as dry-run.
- [ ] `YYYY-M`, `YYYY/MM`, `YYYYMM`, date-like, blank and invalid month inputs have expected output.
- [ ] Both latest-bill-month locations render the same normalized value.
- [ ] Refresh, browser back, LIFF close/reopen and network timeout recover correctly.

### 7.3 `tenant-bills.html`

- [ ] `tenant_bills` success renders unpaid, paid and empty states.
- [ ] `tenant_payment_report_init` failure does not block the bill list.
- [ ] Month sorting and rendering remain normalized.
- [ ] Filters and all existing bill-card actions still work.
- [ ] A long bill detail opens at the top every time.
- [ ] Opening a second bill after scrolling the first also starts at the top.
- [ ] Detail scroll does not move the underlying page at either boundary.
- [ ] Close button and backdrop close work after long scrolling.
- [ ] The detail remains usable after orientation and `visualViewport` changes.
- [ ] No control or text is hidden by the bottom nav, home indicator or safe area.
- [ ] Detail z-index remains above nav while toast remains visible when required.
- [ ] Unpaid bills pass the selected bill ID to payment report; paid bills retain report-history navigation.
- [ ] Test-mode query propagation remains unchanged.
- [ ] If bottom-sheet styling is tested, repository scroll reset/containment remains present.
- [ ] Accessibility review covers dialog semantics, focus order, focus return and keyboard dismissal.

## 8. Rollback strategy

1. Preserve the four source artifacts and SHA-256 fingerprints in section 2 before any future change.
2. Change only one canonical HTML per reviewed commit so home and bills can be rolled back independently.
3. For `tenant-home.html`, restore the repository fingerprint above if a later merge removes binding routing or consistent month formatting.
4. For `tenant-bills.html`, restore the repository fingerprint above if a bottom-sheet experiment fails. If the repository full-height modal fails the required device gate, the candidate fingerprint is an available rollback artifact, but using it still requires explicit human approval and repeat validation.
5. Rollback must use the reviewed Git commit/artifact, followed by syntax, link, LIFF, workflow and mobile smoke tests.
6. A GitHub Pages or LIFF deployment rollback must be separately authorized; this document does not authorize commit, push or deployment.

## 9. Final canonical decision summary

- **`tenant-home.html`: repository root is the recommended final canonical version; adopt as a whole.**
- **`tenant-bills.html`: repository root is the recommended provisional canonical version; do not adopt candidate wholesale.**
- Candidate `tenant-home.html` contributes no behavior that should be merged.
- Candidate `tenant-bills.html` contributes an optional mobile bottom-sheet presentation that may be selectively merged only after explicit approval and device validation.
- Repository binding routing, month normalization, bill-detail scroll reset, overscroll containment, payment workflow, fixed shell, navigation and safe-area protections must not regress.
- This review created only this document. It did not modify HTML, Apps Script, runtime configuration, routes, data, deployment or existing consolidation artifacts, and did not commit, push or deploy.
