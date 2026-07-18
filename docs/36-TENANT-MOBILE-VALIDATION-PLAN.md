# CMWebs V2 Tenant Frontend Mobile Validation Plan

- Plan date: 2026-07-19 (Asia/Taipei)
- Scope: repository-root `tenant-home.html` and `tenant-bills.html`
- Decision reference: `docs/35-TENANT-FRONTEND-CANONICAL-DECISION.md`
- Validation type: manual mobile, LINE WebView and browser acceptance plan
- This document defines tests only. It does not authorize code, data, configuration or deployment changes.

## 0. Purpose and guardrails

This plan determines whether the repository version of `tenant-home.html` can remain final canonical and whether the repository full-height detail modal in `tenant-bills.html` can be promoted from provisional to final canonical.

Guardrails:

- Do not change HTML, Apps Script, Google Sheets, Script Properties, LIFF configuration, Web App URL, deployment or routing while executing this plan.
- Do not record complete LINE user IDs, credentials, endpoint values or personal data in screenshots, logs or the result table.
- `test=1` is **not** a dry-run guarantee. It may still read/write production data or send LINE messages. Use it only with an approved test identity and approved test records.
- Formal LIFF validation must use an authorized test account. Read-only scenarios run first; any payment-report or contract write action requires separate approval and isolated test data.
- If a required fixture is unavailable without modifying production data, mark the case `BLOCKED`; do not create or repair data during this validation.
- Clear browser/WebView cache only when the test case requires a cold start, and record that action in evidence.
- Do not treat Safari/Chrome success as a substitute for LINE WebView success.

## 1. Test environment

### 1.1 Required environment matrix

| Environment ID | Device class | Browser / WebView | Access mode | Required coverage |
|---|---|---|---|---|
| ENV-IOS-LINE | iPhone with home indicator | Current installed LINE iOS in-app WebView | Formal LIFF, no `test=1` | Full P0/P1 suite for both pages |
| ENV-IOS-LINE-SMALL | Small-screen iPhone, if available | Current installed LINE iOS in-app WebView | Formal LIFF, no `test=1` | Shell, nav, safe area, long modal and back behavior |
| ENV-ANDROID-LINE | Android with gesture navigation | Current installed LINE Android in-app WebView | Formal LIFF, no `test=1` | Full P0/P1 suite for both pages |
| ENV-ANDROID-LINE-3BTN | Android with three-button navigation, if available | Current installed LINE Android in-app WebView | Formal LIFF, no `test=1` | Bottom navigation, modal clearance and back behavior |
| ENV-IOS-SAFARI | iPhone | Safari | Direct URL, approved `test=1` identity | Browser baseline, viewport, safe area and back behavior |
| ENV-ANDROID-CHROME | Android | Chrome | Direct URL, approved `test=1` identity | Browser baseline, viewport, scroll and back behavior |
| ENV-IOS-LINE-TEST | iPhone | LINE iOS in-app WebView | `test=1` only when explicitly approved | Compare test-mode shell/navigation with formal LIFF |
| ENV-ANDROID-LINE-TEST | Android | LINE Android in-app WebView | `test=1` only when explicitly approved | Compare test-mode shell/navigation with formal LIFF |

For every run, record the physical device model, OS version, LINE/browser version, viewport orientation, navigation mode, network type and test timestamp. “Current” means the version installed at execution time; the exact version must be written in the test record rather than assumed by this plan.

### 1.2 Execution modes

#### Formal LIFF

- Open the approved LIFF entry without `test=1`.
- Confirm logged-out users enter the LINE login flow and return to the exact original page/query.
- Confirm logged-in users resolve the authorized profile and tenant without showing or recording the complete LINE user ID.
- Execute read-only scenarios before any separately authorized write scenario.

#### `test=1`

- Confirm the URL visibly contains `test=1` before recording a test-mode result.
- Confirm the page uses the approved test identity path; do not infer that no runtime call occurs.
- Do not submit payment, renewal or termination requests unless the test owner confirms the fixture and side effects are isolated.
- Preserve `test=1` when testing navigation that is expected to propagate it.

### 1.3 Required data profiles

| Fixture ID | Profile | Required state | Allowed use |
|---|---|---|---|
| DATA-U | Unbound test identity | Backend returns `TENANT_NOT_FOUND` or `TENANT_BINDING_REQUIRED` | Redirect and binding-flow validation only |
| DATA-B | Bound active tenant | Valid home and active contract data | Normal home/navigation validation |
| DATA-M | Bound tenant with multiple bill months | At least two distinct months; paid and unpaid/overdue states | Bill ordering, cross-month detail and filter validation |
| DATA-L | Bound tenant with a long bill | Detail long enough to require several screen heights of scroll | Modal, overscroll, safe-area and reset validation |
| DATA-E | Bound tenant with no bills | Valid tenant identity, empty bills array | Empty-state validation |
| DATA-R | Bound tenant with payment-report history | At least one pending and one completed report if already available | Report display/navigation validation |

Use pre-existing, approved fixtures only. If month-format variants such as `YYYY-M`, `YYYY/MM`, `YYYYMM`, date-like values or blank values are not available in a safe environment, record the affected cases as `BLOCKED` and validate them later in an authorized fixture environment.

### 1.4 Network and viewport conditions

Run the required cases under:

- Normal Wi-Fi or mobile data.
- One offline/interrupted request run per page.
- One slow/timeout observation per page where practical; the current JSONP timeout is 30 seconds.
- Portrait and landscape.
- App resume after backgrounding LINE/browser for at least 10 seconds.
- Browser/WebView back and forward navigation.
- iPhone home-indicator safe area and Android gesture/three-button navigation areas.
- Address-bar collapse/expand in Safari/Chrome and `visualViewport` resize where observable.

### 1.5 Preflight checklist

- [ ] Record the Git commit or reviewed artifact identifier being tested.
- [ ] Confirm `tenant-home.html` matches the approved repository artifact.
- [ ] Confirm `tenant-bills.html` matches the approved repository artifact.
- [ ] Confirm the approved LIFF entry and API environment without copying their full values into evidence.
- [ ] Confirm the test account/fixture owner and permitted side effects.
- [ ] Confirm no production tenant other than the approved test tenant is selected.
- [ ] Confirm screen recording and screenshots will mask personal data and complete IDs.
- [ ] Confirm tester can identify the result as `PASS`, `FAIL`, `BLOCKED` or `NOT RUN`.
- [ ] Confirm rollback artifact and owner are known before any later candidate bottom-sheet experiment.

## 2. `tenant-home.html` validation

### 2.1 Test cases

| ID | Area | Preconditions | Steps | Expected result | Default severity if failed |
|---|---|---|---|---|---|
| HOME-01 | LIFF cold initialization | Formal LIFF; user logged out | Open the home entry from LINE, complete login, observe return | Returns to the same home URL/query, obtains the profile and loads once without a blank screen or loop | P0 |
| HOME-02 | LIFF warm initialization | Formal LIFF; user already logged in; DATA-B | Open, background, resume, close and reopen | No redundant login prompt; correct tenant loads after each supported lifecycle transition | P1 |
| HOME-03 | LIFF SDK failure | Browser/WebView with controlled offline or blocked SDK | Open page and wait for failure | Clear non-secret error is displayed; no infinite spinner; retry remains possible after connectivity returns | P1 |
| HOME-04 | `test=1` startup | Approved test identity; DATA-B | Open direct test-mode URL in Safari and Chrome | LIFF login is not required by the test branch; approved test tenant loads; page clearly indicates test mode | P0 |
| HOME-05 | Unbound: `TENANT_NOT_FOUND` | DATA-U | Open home and observe first `tenant_home` result | Redirects once to `tenant-bind.html`; no generic home error card and no loop | P0 |
| HOME-06 | Unbound: `TENANT_BINDING_REQUIRED` | DATA-U | Open home and observe first `tenant_home` result | Redirects once to `tenant-bind.html`; no generic home error card and no loop | P0 |
| HOME-07 | Unbound test query | DATA-U; approved `test=1` | Trigger the binding redirect | Destination retains `test=1` and cache-busting query; test mode is not represented as dry-run | P1 |
| HOME-08 | Bound data load | DATA-B | Open page and compare tenant, room, bill and contract sections with approved fixture | Correct tenant/workspace data renders; no data from another tenant/workspace appears | P0 |
| HOME-09 | Secondary API degradation | DATA-B; controlled failure of `tenant_contract_init` without changing code/data | Load home | Valid `tenant_home` data remains usable; contract-dependent content degrades without blocking the page | P1 |
| HOME-10 | Month formatting | Safe fixture containing supported month shapes | Check hero footer and latest-bill info box for each fixture | Both locations show the same normalized `YYYY-MM`; blank shows `-`; invalid non-date text follows documented fallback consistently | P1 |
| HOME-11 | Initial loading | Normal network, then throttled network | Cold-open page | Loading card appears promptly, does not overlap nav, and is replaced exactly once by content or error | P1 |
| HOME-12 | Refresh loading | DATA-B | Tap refresh once, then repeat after completion | Refresh affordance shows loading state; existing layout stays usable; final data is current; no duplicate sections | P1 |
| HOME-13 | JSONP/API failure | Interrupt network after shell load and allow timeout | Wait through failure, restore network, tap retry | Error card contains a useful non-secret message; loading state clears; retry succeeds without reloading the whole LIFF login flow | P1 |
| HOME-14 | Bottom navigation | DATA-B | Tap Home, Bills, Contract and Message one at a time; return after each | Every target resolves, `test=1` propagates where expected, active state matches page, and one tap causes one navigation | P0 if broken route; otherwise P1 |
| HOME-15 | Safe area | All primary mobile environments | Inspect header, content bottom, toast and nav in portrait/landscape | Nothing is clipped by notch, home indicator or system navigation; page content can scroll above nav | P1 |
| HOME-16 | Scroll ownership | DATA-B with enough content | Scroll to bottom/top; attempt edge overscroll; rotate; resume app | `.page` scrolls smoothly; outer body stays fixed; no trapped area, jump or blank band | P1 |
| HOME-17 | Return to previous page | DATA-B | Navigate Home → Bills/Contract/Message, use OS/WebView back, then forward where supported | Returns to the expected page and position without login loop, stale overlay or wrong nav active state | P1 |
| HOME-18 | Binding completion return | DATA-U with separately approved binding fixture | Complete the allowed binding flow, then follow its return to home | Home loads the newly bound tenant once; no redirect loop; wrong-workspace data never appears | P0 |
| HOME-19 | Repeated interaction | DATA-B | Rapidly tap refresh and one navigation target without submitting writes | No duplicate page tree, stuck spinner, script error or multiple unintended navigations | P1 |

### 2.2 Home acceptance notes

- `HOME-05`, `HOME-06`, `HOME-08` and `HOME-18` are identity/workspace gates. Any cross-tenant display is an immediate stop, not a retest-later item.
- Month-format acceptance requires the hero footer and latest-bill info box to agree. Testing only one location is insufficient.
- Back behavior must be tested inside LINE and in Safari/Chrome because their history and back controls differ.
- A loading spinner that eventually succeeds but blocks navigation indefinitely after a failed request is a failure.

## 3. `tenant-bills.html` validation

### 3.1 Current month-selection behavior

The current canonical source does not contain a standalone month dropdown or previous/next-month control. It displays bill cards sorted by normalized bill month and provides status filters: All, Unpaid/Overdue, Paid and Report Pending.

For this baseline, “switch bill month” means opening bill cards from at least two different months and confirming that each card/detail switches to the selected month and bill ID. If product acceptance expects a dedicated month selector, record that as a requirement gap for human decision; do not add a control during validation.

### 3.2 Test cases

| ID | Area | Preconditions | Steps | Expected result | Default severity if failed |
|---|---|---|---|---|---|
| BILL-01 | Initial bill load | DATA-M; formal LIFF | Open bills page | Correct tenant/workspace summary and bill list load; no unrelated tenant data appears | P0 |
| BILL-02 | Month ordering | DATA-M with at least two months | Inspect default list order | Months are normalized and sorted newest first; cards, summaries and statuses agree | P1 |
| BILL-03 | Month switching by card | DATA-M | Open month A, close, open month B, then reopen A | Detail title, bill ID, amounts, meter values and report data always match the selected card | P0 |
| BILL-04 | Deep-linked month/bill | DATA-M; known approved `bill_id` | Open bills URL with the approved `bill_id` query | Matching detail opens once after the list loads and begins at the top; unknown ID fails safely without wrong detail | P1 |
| BILL-05 | Status filters | DATA-M and DATA-R | Cycle All → Unpaid/Overdue → Paid → Report Pending → All | Active state, counts and visible cards match each category; horizontal filter row remains usable on small screens | P1 |
| BILL-06 | Full-height modal geometry | DATA-M | Open a detail in each primary environment and orientation | Detail fills the nav-safe content region, remains above page content, and can be closed; no blank viewport-sized gap | P0 if unusable; otherwise P1 |
| BILL-07 | Detail completeness | DATA-M | Compare selected bill fixture with detail sections | Month, status, due/paid dates, rent, management fee, meters, electricity, equipment fee, other fee, total, notes and report state are correct | P0 for financial mismatch |
| BILL-08 | Long-content scroll | DATA-L | Open detail and scroll from first row to final action buttons and back | All content is reachable; motion is smooth; close/payment controls remain reachable; no content is cut off | P0 if action/content unreachable; otherwise P1 |
| BILL-09 | Overscroll containment | DATA-L | At modal top pull downward; at bottom continue upward; repeat quickly | Underlying bill page does not move, bounce into view or receive accidental taps; modal remains open and stable | P1 |
| BILL-10 | Scroll reset: same bill | DATA-L | Open, scroll near bottom, close, reopen same bill | Reopened detail starts exactly at top | P1 |
| BILL-11 | Scroll reset: different bill | DATA-L and another bill | Scroll first detail, close, immediately open a different bill | Second detail starts at top and shows only its own content | P1 |
| BILL-12 | Close behavior | DATA-L | Close by button, then reopen and close by backdrop; repeat after scrolling | Each close removes the modal/body lock once, returns to usable list, and does not trigger a bill action | P1 |
| BILL-13 | List position after close | DATA-M with long list | Scroll list, open a card, close it | Detail resets independently while the underlying bill-list position remains predictable and usable | P1 |
| BILL-14 | Safe area | Primary mobile environments | Open short and long detail in portrait/landscape | Modal content and final buttons remain clear of notch, home indicator, Android system area and bottom nav | P0 if action unreachable; otherwise P1 |
| BILL-15 | Bottom navigation | DATA-M | With modal closed, use each nav item; then verify nav while modal is open | Closed-state nav works and active state is correct; modal layering prevents accidental nav taps without visually clipping the modal | P0 if routing breaks; otherwise P1 |
| BILL-16 | Empty data | DATA-E | Open bills; cycle all filters | Clear empty state appears, totals/counts are safe, filters and nav remain usable, and no placeholder bill opens | P1 |
| BILL-17 | Primary API failure | Controlled failure/offline for `tenant_bills` | Load and wait for error; restore network; retry | Error card replaces loading, contains no sensitive data, and retry recovers without duplicate callbacks or lists | P1 |
| BILL-18 | Secondary API failure | Valid bills; controlled failure of `tenant_payment_report_init` | Load page | Bill list remains usable; missing report data does not corrupt payment status or block details | P1 |
| BILL-19 | Repeated detail taps | DATA-M | Rapidly tap one card/button 5–10 times | Only one modal is visible; one selected bill is active; no stacked DOM, stale content or script error | P1 |
| BILL-20 | Rapid cross-bill taps | DATA-M | Rapidly tap two different bill cards before animation settles | Final visible detail deterministically matches the last accepted tap and starts at top | P1 |
| BILL-21 | Repeated close taps | Open detail | Rapidly tap close/backdrop multiple times | Close is idempotent; list remains interactive; body scroll lock is removed | P1 |
| BILL-22 | Refresh/reload race | DATA-M | Tap refresh repeatedly, navigate away/back, and reopen | No duplicated JSONP result corrupts list or summary; loading state eventually clears | P1 |
| BILL-23 | Payment-report navigation | Approved read-only/payment fixture | From an unpaid bill tap payment report; from a paid bill open report history | Selected `bill_id` is preserved where required; destination is correct; no submission occurs without separate approval | P0 if wrong bill/action |
| BILL-24 | Viewport lifecycle | Modal open and closed | Rotate, background/resume, collapse browser bars, then close/reopen | `--app-height`, modal geometry and scroll remain correct; no stale overlay or unreachable close button | P1 |
| BILL-25 | `test=1` propagation | Approved test fixture | Navigate to payment report and bottom-nav pages | Expected destinations retain test mode; no production identity is substituted | P0 |

### 3.3 Bills acceptance notes

- The repository full-height modal is not final canonical until `BILL-06`, `BILL-08` through `BILL-15`, and `BILL-24` pass on both primary LINE WebViews.
- Financial mismatches in `BILL-03` or `BILL-07` are P0 even if the UI remains usable.
- Repeated-click testing must stop before any write/submit confirmation unless separately authorized.
- A visually attractive modal that hides final actions, overlaps the safe area, reopens mid-scroll or scrolls the page beneath it does not pass.

## 4. Regression validation

All five pages below are readable in the repository and participate in the tenant flow. This plan validates their navigation boundary with the two canonical pages; it does not authorize changes to them.

| ID | Page / flow | Steps | Expected result | Severity if failed |
|---|---|---|---|---|
| REG-01 | `tenant-bind.html` | Trigger unbound redirect from home, exercise only the approved binding path, then follow return | Receives expected query mode, shows binding UI, and returns to `tenant-home.html` without loop | P0 |
| REG-02 | `tenant-payment-report.html` | Enter from an approved unpaid bill; verify bill context; return to bills without submitting unless authorized | Correct bill is selected, back action reaches `tenant-bills.html`, nav state is consistent and query mode is preserved | P0 |
| REG-03 | `tenant-contract.html` | Enter from home and bottom nav; use back action to home; reopen | Correct tenant contract loads; Home/Bills/Contract navigation resolves; no identity or history drift | P0 for wrong data; otherwise P1 |
| REG-04 | `tenant-renewal.html` | From contract, open renewal; inspect read-only state; return to contract | Correct contract context is preserved; back returns once; no request is submitted without approval | P0 for wrong contract/write; otherwise P1 |
| REG-05 | `tenant-termination.html` | From contract, open termination; inspect read-only state; return to contract | Correct contract context is preserved; back returns once; no request is submitted without approval | P0 for wrong contract/write; otherwise P1 |
| REG-06 | Cross-page back stack | Home → Bills → Payment Report → Bills → Contract → Renewal/Termination → Contract → Home | Each step returns to the expected page without login loop, blank shell, stale modal or duplicate history entries | P1 |
| REG-07 | Cross-page safe area/nav | Visit each page in primary LINE WebViews | Bottom actions/nav remain reachable and do not overlap system safe areas | P1 |

## 5. Acceptance standard

### 5.1 Severity definitions

| Severity | Definition | Examples | Release effect |
|---|---|---|---|
| P0 | Security, identity, data integrity, financial correctness or core-flow failure with no safe workaround | Cross-tenant data, wrong bill/payment target, binding/login loop, page cannot load, modal cannot close, required action unreachable, unintended production write | Immediate stop. Canonical promotion/deployment is prohibited and rollback is required if a change caused it. |
| P1 | Major functional/mobile defect affecting a supported primary environment, with only an impractical or risky workaround | Broken safe area, stale modal scroll, underlying-page scroll, incorrect month format, retry failure, broken primary navigation, repeated-click corruption | Must be fixed or rolled back before canonical promotion. No open P1 is accepted for this gate. |
| P2 | Minor visual, animation, copy or low-impact compatibility issue with a safe workaround and no identity/data/workflow impact | Small spacing variance, non-blocking animation jank, cosmetic shadow difference | May be accepted only with documented evidence, owner, workaround and follow-up decision. |

### 5.2 Blocking issue definition

A test run or release gate is `BLOCKED` when execution evidence cannot be obtained safely, for example:

- Required physical LINE WebView device or approved account is unavailable.
- Required fixture would require modifying production Google Sheets or impersonating a real tenant.
- Network/environment ownership is unclear or the approved LIFF entry cannot be confirmed.
- Testing would require an unauthorized payment, renewal, termination, binding or LINE push.
- Evidence cannot distinguish the tested build/artifact.

`BLOCKED` is not `PASS`. Any blocked P0/P1 case prevents final canonical promotion until the condition is resolved and the case is rerun.

### 5.3 Pass criteria

The tenant frontend mobile gate passes only when:

- [ ] All required environments in section 1 have identifying evidence.
- [ ] Every P0 case is `PASS` in both primary LINE WebViews and the applicable browser baseline.
- [ ] Every P1 case is `PASS`; none is `FAIL`, `BLOCKED` or `NOT RUN` for a required environment.
- [ ] No cross-tenant/workspace, wrong-bill or unauthorized-write evidence exists.
- [ ] `tenant-home.html` binding redirect and month formatting pass.
- [ ] Repository `tenant-bills.html` full-height modal passes long-content, overscroll, scroll-reset, safe-area and close tests on iOS and Android LINE WebView.
- [ ] All regression pages resolve and return correctly.
- [ ] Accepted P2 issues have evidence, owner, workaround, scope and follow-up target.
- [ ] Test results identify the exact artifact and can be reproduced.

### 5.4 Acceptable known issues

Only P2 issues may be accepted at this gate. An accepted issue must:

- Be cosmetic or low-impact and have no privacy, identity, financial, navigation, accessibility-blocking or write-side effect.
- Have a reliable workaround.
- Be reproduced on named environments.
- Include screenshot/video evidence with sensitive data masked.
- Name an owner and follow-up decision/date.
- Be explicitly approved by the human release owner.

Missing dialog semantics, focus trapping, focus restoration and Escape-key behavior identified in document 35 remain known follow-up items. They may be tracked as P2 only if touch interaction and assistive-technology review prove that no user is blocked; otherwise classify them P1.

### 5.5 Rollback conditions

Rollback or reject the tested frontend variant when any of the following occurs:

- Any P0 is observed.
- Any P1 remains on iPhone LINE WebView or Android LINE WebView.
- Home no longer redirects both unbound error codes or loses consistent month formatting.
- Bill detail cannot reach all content/actions, cannot close, reopens at stale scroll, scrolls the underlying page, or overlaps nav/safe area.
- API action, endpoint selection, LIFF identity, route destination, `bill_id` or `test=1` propagation changes unexpectedly.
- Regression pages no longer preserve tenant/contract/bill context.
- The tested artifact cannot be identified or differs from the approved review artifact.

For a future bill-modal experiment, restore the reviewed repository `tenant-bills.html` artifact and repeat the P0/P1 smoke subset before any release decision. Rollback execution, commit, push and deployment require separate authorization.

## 6. Minimum partial merge if bottom sheet performs better

This section applies only if comparative real-device evidence shows the candidate bottom-sheet presentation is materially better and a separate implementation change is approved. Do not replace the whole candidate file.

### 6.1 Evidence required before implementation

- Same device, OS, LINE/browser version, fixture and scenario run against full-height and bottom-sheet variants.
- Bottom sheet passes all P0/P1 cases and improves a recorded usability metric such as reachability, close success or task completion.
- Human product owner approves bottom-sheet presentation.
- Repository artifact and rollback point are recorded.

### 6.2 Smallest permitted merge surface

| Area | May be selectively adopted | Must be retained or added | Must not be changed |
|---|---|---|---|
| CSS presentation | Bottom alignment, top-only corner radius, upward shadow, bottom-up entrance animation, viewport-relative max height | Explicit clearance from bottom nav and system safe area; current z-index relationship; no content clipping | Page shell, bill cards, filters, financial-detail styling and unrelated responsive rules |
| Open behavior | Presentation class/state strictly needed to show a bottom sheet | `detailSheet.scrollTop = 0` before content injection and again in `requestAnimationFrame`; one active modal/bill | `openBillDetail` data lookup, bill selection, detail template, handler name and arguments |
| Close behavior | Presentation class/state strictly needed to hide the sheet | Existing close button, backdrop close, idempotent body-class cleanup and usable underlying list | `closeBillDetail`, `closeDetailFromBackdrop`, active bill semantics and navigation actions |
| Scroll lock | Bottom-sheet-specific inner scrolling | `body.modal-open`, inner `overflow-y: auto`, `overscroll-behavior: contain`, touch momentum and no background scroll chaining | Page scroll ownership and unrelated global overflow rules |
| Safe area | Sheet max-height/offset/padding needed for tested devices | Explicit bottom inset or equivalent layout proving final controls stay above home indicator and nav in both orientations | Bottom-nav height/token, nav destinations or global app-height calculation |

### 6.3 Immutable API and routing boundary

The partial merge must not change:

- API endpoint or LIFF configuration values.
- JSONP implementation, callback cleanup, timeout or cache-busting behavior.
- `tenant_bills` and `tenant_payment_report_init` action names.
- `line_user_id`, callback or other request parameter names.
- Bill/result parsing, financial calculations, status mapping, sorting or rendering content.
- `bill_id` deep-link and payment-report propagation.
- `test=1` behavior or propagation.
- Destinations for `tenant-home.html`, `tenant-bills.html`, `tenant-contract.html`, `tenant-message.html` or `tenant-payment-report.html`.
- DOM IDs `detailModal` and `detailSheet` or public handler names unless a separate compatibility change is approved.

### 6.4 Bottom-sheet validation delta

After an approved partial merge, rerun all bill P0/P1 cases plus these focused checks:

- [ ] Short and long sheets stop above the home indicator and do not hide final actions.
- [ ] Bottom navigation is either deliberately visible and non-overlapped or deliberately covered by a tested modal layer; behavior matches the approved design.
- [ ] Opening the same/different bill always starts at top.
- [ ] Edge overscroll never moves the page behind the sheet.
- [ ] Backdrop and close button work after viewport rotation and app resume.
- [ ] Rapid open/close/cross-bill taps leave one deterministic sheet.
- [ ] No API request, route, bill content or payment behavior differs from repository baseline.

Any failed P0/P1 delta test rejects the bottom-sheet merge and triggers restoration of the repository full-height modal artifact.

## 7. Test execution sequence

1. Complete preflight and record artifact/environment identifiers.
2. Run read-only smoke tests with approved `test=1` in Safari and Chrome.
3. Run formal LIFF home identity/binding tests in iPhone and Android LINE WebViews.
4. Run home layout, loading, error, navigation, scroll and back tests.
5. Run bills data/month/filter and financial-detail correctness tests.
6. Run bills full-height modal, long-content, overscroll, reset, safe-area and repeated-click tests.
7. Run cross-page regression flows.
8. Classify every result and attach masked evidence.
9. Stop immediately on P0; do not continue into write-capable flows.
10. Resolve/rerun P1 and blocked cases; obtain explicit approval for accepted P2 issues.
11. Decide whether repository bills becomes final canonical or remains provisional. Bottom-sheet comparison is optional and separately authorized.

## 8. Evidence requirements

For each required P0/P1 scenario, evidence should include:

- Artifact/commit identifier and test case ID.
- Device model, OS and LINE/browser version.
- Access mode: formal LIFF or approved `test=1`.
- Timestamp and network/orientation state.
- Screenshot or short recording showing start state, action and result.
- Redacted console/network evidence when needed; record action names, status and timing without full endpoint, token, UID or personal data.
- Expected versus actual result.
- Reproduction rate for failures, such as `3/3`.
- Severity and owner/next action.

Suggested evidence filename:

```text
<CASE-ID>_<DEVICE>_<CONTAINER>_<RESULT>_<YYYYMMDD-HHMM>.<ext>
```

## 9. Test record

Allowed `Result` values: `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`.

| Device | OS | Browser / WebView | Page | Scenario | Result | Evidence | Severity | Notes |
|---|---|---|---|---|---|---|---|---|
|  |  |  | `tenant-home.html` |  |  |  |  |  |
|  |  |  | `tenant-home.html` |  |  |  |  |  |
|  |  |  | `tenant-bills.html` |  |  |  |  |  |
|  |  |  | `tenant-bills.html` |  |  |  |  |  |
|  |  |  | Regression |  |  |  |  |  |

## 10. Sign-off summary

| Decision item | Status | Evidence / approver |
|---|---|---|
| `tenant-home.html` mobile gate | `NOT RUN` |  |
| `tenant-home.html` final canonical confirmation | Pending |  |
| Repository `tenant-bills.html` full-height modal gate | `NOT RUN` |  |
| `tenant-bills.html` final canonical promotion | Pending |  |
| Bottom-sheet comparative test required | Pending human decision |  |
| Open P0 count | Unknown until execution |  |
| Open P1 count | Unknown until execution |  |
| Accepted P2 list | None recorded |  |
| Rollback readiness | Pending execution evidence |  |

## 11. No-change declaration

This planning phase creates only `docs/36-TENANT-MOBILE-VALIDATION-PLAN.md`. It does not modify any HTML, Apps Script, API route, LIFF setting, Web App URL, test identity, Google Sheet, Script Property, runtime, deployment or prior documentation. It does not commit, push, run `clasp push` or deploy.
