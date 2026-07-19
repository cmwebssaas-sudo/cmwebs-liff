# CMWebs V2 Tenant Frontend Static Validation

- Validation date: 2026-07-19 (Asia/Taipei)
- Branch: `chore/v2-production-consolidation`
- Scope: repository-root `tenant-home.html` and `tenant-bills.html`
- References: `docs/35-TENANT-FRONTEND-CANONICAL-DECISION.md`, `docs/36-TENANT-MOBILE-VALIDATION-PLAN.md`
- Node.js: `v26.5.0`
- npm: `11.17.0`
- Validation type: source review, repository validator and local mocked JavaScript execution only

## 1. Executive result

| Decision | Result |
|---|---|
| Confirmed P0 blocking issue | **0** |
| P1 regression/security risks | **7** |
| P2 UX/maintainability improvements | **5** |
| `npm run validate` | **PASS** |
| Target HTML JavaScript syntax | **PASS / PASS** |
| Modify HTML in this phase | **No** — no confirmed P0; the stated change gate prohibits HTML changes |
| Import candidate HTML | **No** |
| Proceed to real-device validation | **Yes, conditionally** — formal LIFF read-only tests may proceed; `test=1` must remain blocked until its identity/data/write isolation is approved |
| Canonical promotion | **Not yet** — iPhone and Android LINE WebView P0/P1 evidence is still required |

No source-level defect was proven to meet the P0 definition in document 36. Static checks do not prove tenant/workspace authorization, real LIFF behavior, production-data isolation, safe-area rendering or WebView scroll behavior, so this result is not a production/mobile acceptance pass.

## 2. Scope and method

The following were read and checked before producing this report:

- `AGENTS.md`
- `docs/35-TENANT-FRONTEND-CANONICAL-DECISION.md`
- `docs/36-TENANT-MOBILE-VALIDATION-PLAN.md`
- Complete `tenant-home.html`
- Complete `tenant-bills.html`

Checks performed:

1. Full source review of CSS, static HTML and inline JavaScript.
2. `npm run validate` against the canonical repository baseline.
3. Targeted `vm.Script` compilation of each inline script.
4. Local mocked execution of LIFF logged-out/logged-in/test-mode branches without network access.
5. Local mocked execution of both home binding error codes.
6. Local mocked JSONP success cleanup and request URL/action construction.
7. Local function checks for month normalization.
8. Local mocked bills checks for empty data, ordering, modal repeat-open/repeat-close and error degradation.
9. Local out-of-order request simulation to test rapid refresh races.
10. Static checks for internal handlers, links, shell rules, event registrations and duplicate static IDs.

No request was sent to the configured API endpoint. No LIFF session, Google Sheet, Apps Script runtime or deployment was accessed or changed. Complete endpoint, LIFF ID and LINE user ID values are intentionally omitted.

## 3. Local verification summary

| Check | `tenant-home.html` | `tenant-bills.html` |
|---|---|---|
| Inline script compilation | PASS | PASS |
| Missing inline handler function | 0 | 0 |
| Missing internal HTML target | 0 | 0 |
| Duplicate static ID | 0 | 0 |
| Fixed body/app shell/page scroll structure | PASS | PASS |
| Bottom safe-area CSS present | PASS | PASS |
| App-height uses `visualViewport.height` with `innerHeight` fallback | PASS | PASS |
| LIFF logged-out branch | Mock PASS | Mock PASS |
| LIFF logged-in profile branch | Mock PASS | Mock PASS |
| `test=1` branch returns an identity | Mock PASS; approval still required | Mock PASS; approval still required |
| JSONP success removes callback/script | PASS | PASS |
| JSONP timeout literal | 30 seconds | 30 seconds |
| Month inputs `2026-7`, `2026/7`, `202607`, blank | `2026-07`, `2026-07`, `2026-07`, `-` | Same |
| Primary API failure renders retry state | Mock PASS | Mock PASS |
| Secondary API failure degrades without blocking primary data | Contract result handled as optional | Payment-report result Mock PASS |
| Empty bill data | Not applicable | Mock PASS: `0 / 0` and empty state |
| Bill order | Not applicable | Mock PASS: normalized descending months |
| Repeated modal open/close | Not applicable | Mock PASS: one modal state, scroll top `0`, idempotent close |
| Rapid refresh response ordering | **RISK CONFIRMED** | **RISK CONFIRMED** |

The mocked checks validate control flow and DOM-state intent, not browser layout, WebView behavior, backend authorization or real data correctness.

## 4. `tenant-home.html` result

### 4.1 Detailed checks

| Area | Evidence | Static/local result | Remaining concern |
|---|---|---|---|
| LIFF initialization | `initLineUserId()` at lines 1278–1321 calls `liff.init`, checks login, uses the exact current URL for return and then obtains the profile | PASS in logged-out/logged-in mocks | SDK availability, LINE return history and real profile/workspace resolution require device tests |
| `test=1` | Test-mode detection at lines 822–823; test identity branch at lines 1279–1283 | Functional branch PASS | Page-local test identity at lines 816–817 bypasses LIFF; authorization and data/write isolation are not statically proven |
| Unbound redirect | `goBindingPage()` at lines 1128–1137; result handling at lines 2184–2195 | Both `TENANT_NOT_FOUND` and `TENANT_BINDING_REQUIRED` Mock PASS; `test=1` preserved | Redirect loop and post-binding return require real backend/LIFF evidence |
| JSONP callback cleanup | Timer/cleanup/callback at lines 1177–1221 | PASS on successful callback; timeout path calls the same cleanup | `script.onerror` is intentionally ignored until the 30-second timer |
| API timeout | 30-second timeout at lines 1177–1191 | PASS statically | Actual offline/WebView timing remains untested |
| Loading | Initial loading card at lines 756–760; refresh state at lines 2131–2147 | PASS statically; primary error mock clears to error UI | Rapid refresh requests are not serialized and can clear/render out of order |
| Error handling | `renderError()` at lines 2104–2129; `loadPage()` catch/finally at lines 2230–2238 | Mock PASS with retry control | Full error text comes from the API result; verify it never exposes sensitive details |
| Month format | `formatBillMonth()` at lines 1018–1071; used at lines 1705–1708 and 1766–1769 | PASS for supported local cases; both display locations call the formatter | Invalid values are returned as raw text and need fixture/device review |
| Bottom navigation | Lines 764–804; all four target files resolve | PASS statically | One-tap navigation, active state after back/forward and LIFF history require devices |
| Safe area | Page bottom padding at lines 84–91; nav at lines 656–665; toast at lines 714–729 | PASS statically | Notch/home-indicator behavior cannot be proven without physical devices |
| App height | `setAppHeight()` at lines 828–839; final listeners at lines 2241–2263 | PASS statically | Address-bar, keyboard, orientation and resume behavior require WebView/browser tests |
| Scroll container | Body locked at lines 47–61; `.page` scroll at lines 78–92 | PASS statically | Momentum, bounce and restored position require real rendering |
| Duplicate event binding | One window `resize`, one `orientationchange`, one `visualViewport.resize`; bindings are outside `loadPage()` | PASS; no duplicate registration loop | Resize and orientation can both invoke the idempotent setter, which is expected |
| JavaScript syntax | Targeted `vm.Script` plus repository validator | PASS | Browser-specific runtime remains pending |

### 4.2 Home conclusion

The repository home page retains the canonical binding redirect and month normalization identified in document 35. No confirmed P0 requires a source change. It is ready for controlled real-device testing, subject to the `test=1` approval gate and P1 risks in section 7.

## 5. `tenant-bills.html` result

### 5.1 Detailed checks

| Area | Evidence | Static/local result | Remaining concern |
|---|---|---|---|
| LIFF initialization | `initLineUserId()` at lines 1458–1501 | PASS in logged-out/logged-in mocks | Same real LIFF/profile/workspace evidence gap as home |
| `test=1` | Detection at lines 935–936; identity branch at lines 1459–1463 | Functional branch PASS | Page-local test identity at lines 929–930 bypasses LIFF and propagates to payment-report navigation |
| Bill month selection | `formatBillMonth()` at lines 1224–1275; `billMonthOf()` at lines 1634–1646; sort at lines 2314–2324 | Normalization/order Mock PASS | There is no standalone month selector; current behavior is selecting cards from different months plus status filters |
| Status filters | `setFilter()` at lines 1994–2010; controls at lines 2470–2507 | PASS statically | Horizontal touch scroll and rapid taps require devices |
| Detail open | `openBillDetail()` at lines 2654–3081 | Mock PASS; missing bill returns a toast; repeated synchronous open ends in one visible modal | Dynamic bill IDs are embedded in inline JavaScript handlers; input-character contract is not proven |
| Detail close | Lines 3083–3105; close button and exact-backdrop target | Mock PASS; repeated close is idempotent | Android/system back does not have a modal-specific handler and may navigate away instead of closing |
| Modal scroll | `.detail-sheet` at lines 626–639 has inner scrolling, containment and touch momentum | PASS statically | iOS/Android LINE WebView overscroll and long-content reachability require devices |
| Scroll reset | Before render at line 2750 and inside `requestAnimationFrame` at lines 3076–3080 | Mock PASS; repeat open returns to top | Browser paint/scroll timing requires devices |
| Body scroll lock | CSS at lines 73–75; class add at lines 3072–3074 and remove at lines 3090–3092 | Mock PASS for class state | Body is already locked while `.page` owns scroll; background-scroll prevention relies on modal interception/overscroll behavior and needs devices |
| Safe area | Backdrop padding at lines 604–620 reserves nav height plus bottom inset | PASS statically | Flex sizing, home indicator, landscape and small viewport require devices |
| Bottom navigation | Lines 869–909; modal z-index 1500 versus nav 1000 | PASS statically; target files resolve | Verify modal padding/layering and that modal-open taps do not hit nav |
| App height | Lines 947–958 and 3234–3256 | PASS statically | Modal open during resize/orientation/resume requires devices |
| Empty data | `renderBillList()` at lines 2202–2245 | Mock PASS: correct count and empty card | Visual spacing and all-filter behavior require browser/device rendering |
| Primary API failure | Error path at lines 3107–3141 and 3186–3231 | Mock PASS with retry | `script.onerror` waits for timeout; repeated retries can race |
| Secondary API failure | Optional `tenant_payment_report_init` handling at lines 3202–3217 | Mock PASS: bill page still renders | Correct status/report degradation requires a real fixture |
| Repeated detail clicks | Open/render is synchronous; modal/body classes are idempotent | Mock PASS for same-bill repeated open/close | Rapid cross-element taps and animation timing require devices |
| Repeated refresh | No in-flight guard or request generation token in `loadPage()` | **P1 reproduced locally:** an older request can overwrite a newer completed request | Requires a separately approved fix after this no-change validation phase |
| JavaScript syntax | Targeted `vm.Script` plus repository validator | PASS | Browser-specific runtime remains pending |

### 5.2 Bills conclusion

The repository full-height modal has the intended static safeguards: nav/safe-area reservation, inner scroll ownership, overscroll containment and two scroll resets. No confirmed P0 requires a source change. Static evidence is insufficient to promote it to final canonical; the iPhone and Android LINE WebView cases in sections 9 and 10 remain mandatory.

## 6. Validator result

Command:

```text
npm run validate
```

Result:

```text
Apps Script files: 30
HTML files: 44
Routes: 68 (unique 68, duplicates 0)
Handler coverage: 68/68
Common helper coverage: 7/7
Duplicate top-level declarations: function=0, const=0, let=0, var=0
Credential scan: blocking=0, review-only=0
Hardcoded LINE UID: 0
Manifest: PASS
HTML links: checked=182, missing=0
Validation: PASS
CMWebs validation passed.
```

### 6.1 Validator interpretation

- Syntax/link/route/backend baseline: PASS.
- The credential result must not be interpreted as clearing HTML test identities. The current validator calls `scanCredentials(appFiles)` and does not pass `htmlFiles` to that credential scan. A separate masked source check found page-local `TEST_LINE_USER_ID` literals at `tenant-home.html:816` and `tenant-bills.html:929`.
- No complete UID is recorded in this report.
- This is a P1 validator coverage/security risk, not proof that the approved test identity is unsafe. Its isolation and permitted side effects require human/environment confirmation.

## 7. P0 / P1 / P2 findings

### 7.1 P0 blocking issues

**Confirmed P0 count: 0.**

No syntax failure, broken internal link, missing canonical route/handler, deterministic wrong-bill selection, deterministic unbound-flow failure or deterministic unclosable modal was found in static/local checks.

The following must be escalated to P0 immediately if real evidence confirms them:

- The page-local `test=1` identity can access non-isolated production tenant data or perform an unauthorized write/LINE push.
- A bill ID can contain attacker-controlled quote/markup characters and reach the inline handler constructions listed under P1-05.
- Any real run displays another tenant/workspace, targets the wrong bill or changes financial values.

### 7.2 P1 regression/security risks

| ID | File / lines | Risk | Evidence and impact | Required action before canonical promotion |
|---|---|---|---|---|
| P1-01 | `tenant-home.html:2149–2239`; `tenant-bills.html:3161–3232` | Out-of-order refresh responses | Local deferred-promise test reproduced an older request overwriting newer rendered data in both pages. Refresh buttons are animated but not disabled and no generation/abort guard exists. | Reproduce on devices; separately authorize a minimal request-generation or in-flight policy and regression tests. |
| P1-02 | `tenant-home.html:816–817,1279–1283`; `tenant-bills.html:929–930,1459–1463` | `test=1` bypasses LIFF using page-local static identities | Behavior is statically confirmed. AGENTS.md states test mode may still write production data/send LINE. Validator reports zero because it scans Apps Script credentials only. | Do not run `test=1` until identity ownership, workspace isolation, data scope and write/push policy are approved. Centralization/removal is a separate change. |
| P1-03 | `tenant-home.html:1262–1267`; `tenant-bills.html:1442–1447` | Network script error waits for 30-second timeout | `script.onerror` only logs; rejection/cleanup occurs later through the timer. Users can remain on loading for the full timeout after an immediate network/CSP error. | Exercise offline/WebView cases; separately decide whether immediate reject is safe without breaking JSONP quirks. |
| P1-04 | `tenant-bills.html:604–639,3068–3105` | Modal scroll/back behavior is browser-dependent | CSS intent is correct, but `.page` is the actual scroll owner and no system-back/popstate handler closes the modal. WebView scroll chaining or page exit cannot be ruled out. | Mandatory iOS/Android LINE WebView overscroll, long-content, close and hardware/system-back tests. |
| P1-05 | `tenant-bills.html:2042,2171,2182,2191,3057–3059` | Dynamic bill IDs are inserted into inline JavaScript using HTML escaping | `safeHtml()` is correct for HTML text but is not a JavaScript-string encoder; HTML entities in an event attribute are decoded before the inline handler executes. Risk depends on the backend bill-ID character contract. | Confirm a strict generated bill-ID invariant. If not guaranteed, escalate to P0 and use an approved data-attribute/event-listener or JS-string-safe design. |
| P1-06 | `tenant-bills.html:1503–1520,3161–3232` | Direct unbound bills entry has no binding redirect | Unlike home, bills generically renders an API error. An unbound user entering a direct bills link can be stranded rather than sent to binding. | Test direct unbound entry; human decision whether bills must share the home binding redirect before final promotion. |
| P1-07 | Both pages, final listener blocks | Back/forward, bfcache and app-resume freshness are not handled explicitly | There is no `pageshow`, `visibilitychange` or request-generation handling. A restored page can retain stale data/modal state. | Mandatory LINE/browser back, forward, background/resume and reopen tests; decide refresh policy separately. |

### 7.3 P2 UX/maintainability improvements

| ID | Improvement | Constraint |
|---|---|---|
| P2-01 | Add clear busy/disabled feedback or tap coalescing for refresh and high-frequency actions | Must accompany, not replace, a correctness guard for P1-01. |
| P2-02 | Consider immediate, friendlier network-error feedback instead of waiting the full JSONP timeout | Must preserve callback cleanup and known Apps Script JSONP behavior. |
| P2-03 | Add dialog semantics, focus placement/restoration and keyboard/Escape behavior to bill detail | Treat as P1 if accessibility testing shows a blocked user. |
| P2-04 | Consider a dedicated month selector only if product acceptance requires it | Current canonical behavior is month cards plus status filters; do not invent a control during consolidation. |
| P2-05 | Compare the candidate bottom-sheet presentation after repository full-height testing | Only a minimal CSS/open-close merge is eligible; API, routing, data and scroll safeguards are immutable. |

## 8. Items that static analysis cannot confirm

- Real LIFF SDK initialization, login handoff, profile identity and return history.
- Whether the configured LIFF entry and endpoint correspond to the intended production/test environment.
- Tenant/workspace authorization on every backend response and write.
- Whether the two page-local test identities are approved, isolated and safe for `test=1`.
- Whether test mode can write production data or send LINE in the traversed flow.
- Backend bill-ID character constraints relevant to P1-05.
- Real API latency, Apps Script JSONP/CSP failure behavior and 30-second timeout UX.
- Home binding completion and redirect-loop behavior against live backend state.
- Financial values, meter values, payment statuses and report mappings against approved fixtures.
- iPhone/Android safe-area, home-indicator and system-navigation clearance.
- `visualViewport` behavior during URL-bar changes, orientation, keyboard, background/resume and LIFF reopen.
- Full-height modal flex geometry, long-detail reachability, touch momentum and edge overscroll.
- Underlying page stability while modal is open.
- Browser/system back behavior, bfcache restoration and active nav state.
- Rapid physical taps during animation/navigation.
- Cross-page behavior for binding, payment report, contract, renewal and termination.
- Accessibility with VoiceOver, TalkBack, external keyboard or switch control.

## 9. iPhone LINE WebView mandatory tests

- [ ] Formal LIFF cold login returns to the exact page/query once.
- [ ] Formal LIFF warm open/background/resume/reopen uses the correct tenant.
- [ ] Both unbound home codes redirect to binding without a loop.
- [ ] Home month values match in both display positions.
- [ ] Home page scrolls only inside `.page`; bottom nav and toast clear the home indicator.
- [ ] Address-bar/viewport/orientation changes update `--app-height` without blank bands.
- [ ] Bills from two months open the correct bill/financial detail.
- [ ] Full-height detail fits inside the nav-safe region in portrait and landscape.
- [ ] Long detail reaches the final close/payment controls.
- [ ] Top/bottom overscroll never moves the underlying bill list.
- [ ] Same-bill and cross-bill reopen start at scroll top.
- [ ] Close button and backdrop work after long scroll, rotation and app resume.
- [ ] Browser/WebView back behavior with an open modal is recorded and classified.
- [ ] Rapid refresh/tap sequence is run to assess P1-01 without submitting writes.
- [ ] Offline/API failure clears loading and retry recovers.
- [ ] `test=1` cases remain `BLOCKED` unless the P1-02 approval gate is complete.

## 10. Android LINE WebView mandatory tests

- [ ] Repeat formal LIFF cold/warm/profile and unbound home tests.
- [ ] Test gesture-navigation and, if available, three-button-navigation devices.
- [ ] Confirm bottom nav/system bar clearance in portrait and landscape.
- [ ] Confirm `.page` and modal touch scrolling, momentum and edge containment.
- [ ] Confirm Android system Back with modal open; classify page exit versus modal close behavior.
- [ ] Confirm Back after Home → Bills → Payment Report/Contract preserves context.
- [ ] Open a long bill, scroll, close and open the same/different bill; each detail starts at top.
- [ ] Rapidly tap bill cards, detail buttons and close/backdrop; only one deterministic modal remains.
- [ ] Rotate/background/resume with modal open and closed; shell height remains correct.
- [ ] Run primary/secondary API failure and retry paths.
- [ ] Verify empty bills and all status filters on a small screen.
- [ ] `test=1` cases remain `BLOCKED` unless the P1-02 approval gate is complete.

## 11. Recommendation

### 11.1 Should HTML be modified now?

**No.** No confirmed P0 was found, so this phase must not modify either HTML. The P1 findings require human prioritization, backend/input-contract confirmation or device evidence before a separately authorized change. Candidate HTML must not be imported.

### 11.2 Should real-device testing begin?

**Yes, with gates:**

1. Begin with read-only formal LIFF tests on an authorized tenant in iPhone and Android LINE WebViews.
2. Keep all `test=1` cases blocked until the page-local test identity, workspace/data isolation and write/LINE side effects are explicitly approved.
3. Do not submit payment, renewal, termination or binding writes without separate authorization and isolated fixtures.
4. Treat any cross-tenant data, wrong bill, financial mismatch, unauthorized write or unclosable/unreachable primary flow as P0 and stop immediately.
5. Do not promote `tenant-bills.html` to final canonical until all full-height modal P0/P1 mobile cases pass.

## 12. Rollback

No HTML or runtime change occurred in this phase, so no production rollback is required.

Reviewed repository fingerprints:

| Artifact | SHA-256 |
|---|---|
| `tenant-home.html` | `24c40b49e9390aeeeddf638b7931e481d075ecdd286fd085036d943668050f0f` |
| `tenant-bills.html` | `e240096a28ed32a676380ff36f8c063eda7abc8ad165cebffeb004f67e6e858d` |

For any later approved frontend experiment:

1. Record the pre-change commit and both fingerprints.
2. Change one HTML per reviewed commit.
3. On P0/P1 failure, restore the corresponding repository artifact, not an inferred candidate version.
4. Rerun `npm run validate`, targeted page checks and iPhone/Android smoke tests.
5. Candidate bottom-sheet rollback/adoption requires explicit human approval and the evidence gates in documents 35 and 36.

To roll back this documentation-only phase before commit, remove only `docs/37-TENANT-FRONTEND-STATIC-VALIDATION.md`. No deployed artifact is affected.

## 13. No-change declaration

This phase created only `docs/37-TENANT-FRONTEND-STATIC-VALIDATION.md`. It did not modify either HTML, Apps Script, routes, endpoint, LIFF ID, test identity, Google Sheets, Script Properties, Web App deployment or candidate overlay. It did not run `clasp push`, `clasp deploy`, commit, push or deploy.
