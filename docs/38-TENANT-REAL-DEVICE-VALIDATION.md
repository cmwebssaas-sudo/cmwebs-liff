# CMWebs V2 Tenant Frontend Phase 38 — Real Device Validation Execution Pack

- Pack date: 2026-07-19 (Asia/Taipei)
- Scope: Tenant Home, Tenant Bills and five tenant regression pages
- Execution type: human-operated real-device validation
- Initial result state: `NOT TESTED`
- This pack does not claim that any real-device test has run.

## 1. Version and gate confirmation

### 1.1 Starting state

| Check | Observed result | Gate |
|---|---|---|
| Branch | `chore/v2-production-consolidation` | PASS |
| Working tree before document creation | Clean | PASS |
| Latest commit | `037d57f docs(v2): add tenant frontend static validation` | Recorded |
| Previous commit | `d6fdfaf docs(v2): add tenant mobile validation plan` | Recorded |
| Previous commit | `f34952a docs(v2): define tenant frontend canonical decisions` | Recorded |
| `npm run validate` | PASS | PASS |
| Apps Script files | 30 | Recorded |
| HTML files | 44 | Recorded |
| Routes | 68 unique, 0 duplicate | PASS |
| Handler coverage | 68/68 | PASS |
| HTML links | 182 checked, 0 missing | PASS |
| Blocking credentials reported by validator | 0 | PASS within validator scope |

### 1.2 Canonical frontend fingerprints

| Artifact | Canonical source | SHA-256 |
|---|---|---|
| `tenant-home.html` | Repository root | `24c40b49e9390aeeeddf638b7931e481d075ecdd286fd085036d943668050f0f` |
| `tenant-bills.html` | Repository root | `e240096a28ed32a676380ff36f8c063eda7abc8ad165cebffeb004f67e6e858d` |

The repository versions are the files under test. The candidate overlay must not be copied or deployed during Phase 38.

### 1.3 Safety gates before opening a test URL

- [ ] The test owner has approved the test identity used by `test=1`.
- [ ] The test identity is mapped only to approved test tenant/workspace records.
- [ ] The tester understands that `test=1` is not dry-run and can reach real APIs.
- [ ] No binding, payment report, cancellation, renewal or termination submission will be completed.
- [ ] No screenshot, video, filename, console capture or document will contain a complete LINE UID, token, credential or Script Property value.
- [ ] Tenant A, Tenant B, unbound, empty-bill and long-bill fixtures are identified by aliases only.
- [ ] The exact Git commit and device/app/browser versions will be recorded.

If any gate is not satisfied, mark affected cases `BLOCKED`; do not improvise with a real tenant or production write.

## 2. Test URL list

### 2.1 GitHub Pages base

`https://cmwebssaas-sudo.github.io/cmwebs-liff/`

### 2.2 Direct `test=1` URLs

These are public test URL formats. Do not open them until section 1.3 is approved.

- [Tenant Home test URL](https://cmwebssaas-sudo.github.io/cmwebs-liff/tenant-home.html?test=1)
- [Tenant Bills test URL](https://cmwebssaas-sudo.github.io/cmwebs-liff/tenant-bills.html?test=1)
- [Tenant Bind test URL](https://cmwebssaas-sudo.github.io/cmwebs-liff/tenant-bind.html?test=1)
- [Tenant Payment Report test URL](https://cmwebssaas-sudo.github.io/cmwebs-liff/tenant-payment-report.html?test=1)
- [Tenant Contract test URL](https://cmwebssaas-sudo.github.io/cmwebs-liff/tenant-contract.html?test=1)
- [Tenant Renewal test URL](https://cmwebssaas-sudo.github.io/cmwebs-liff/tenant-renewal.html?test=1)
- [Tenant Termination test URL](https://cmwebssaas-sudo.github.io/cmwebs-liff/tenant-termination.html?test=1)

Optional cache-busting format:

```text
https://cmwebssaas-sudo.github.io/cmwebs-liff/<PAGE>.html?test=1&v=<RUN_ID>
```

Approved bill deep-link format, without placing a real bill ID in this document:

```text
https://cmwebssaas-sudo.github.io/cmwebs-liff/tenant-bills.html?test=1&bill_id=<APPROVED_TEST_BILL_ID>&v=<RUN_ID>
```

### 2.3 Formal Tenant LIFF URL

[Formal Tenant LIFF](https://liff.line.me/2010314940-iJB1D6sN)

Do not append `test=1` to the formal smoke-test entry. Formal LIFF smoke testing is limited to launch, identity, Home load and Bills load. It must not submit binding, payment, cancellation, renewal, termination, repair, notification or any data change.

## 3. Device matrix

### 3.1 iPhone

| Matrix ID | Container | Orientation / lifecycle | Required action | Evidence |
|---|---|---|---|---|
| IP-LINE-P | LINE built-in WebView | Portrait | Run all applicable TH, TB, TR and SEC cases | Screen recording plus version/device record |
| IP-LINE-L | LINE built-in WebView | Landscape, then portrait | Run orientation/layout cases and confirm recovery | Before/after screenshots or video |
| IP-LINE-BG | LINE built-in WebView | Foreground → background for at least 10 seconds → foreground | Run initialization, state and modal-resume cases | Continuous video with timestamp |
| IP-LINE-KB | LINE built-in WebView | Open/close keyboard on Bind, Payment Report, Renewal and Termination forms; do not submit | Confirm viewport/safe area returns correctly | Video showing keyboard transition and return |
| IP-SAFARI-P | Safari | Portrait with approved `test=1` | Run browser baseline and back/history cases | Screenshot/video and Safari version |
| IP-SAFARI-L | Safari | Landscape, then portrait | Run shell, nav, scroll and safe-area cases | Before/after screenshots |

### 3.2 Android

| Matrix ID | Container | Orientation / lifecycle | Required action | Evidence |
|---|---|---|---|---|
| AN-LINE-P | LINE built-in WebView | Portrait | Run all applicable TH, TB, TR and SEC cases | Screen recording plus version/device record |
| AN-LINE-L | LINE built-in WebView | Landscape, then portrait | Run orientation/layout cases and confirm recovery | Before/after screenshots or video |
| AN-LINE-BG | LINE built-in WebView | Foreground → background for at least 10 seconds → foreground | Run initialization, state and modal-resume cases | Continuous video with timestamp |
| AN-LINE-BACK | LINE built-in WebView | System Back with modal open/closed and across pages | Run TB-21 and history regression | Continuous video |
| AN-LINE-KB | LINE built-in WebView | Open/close keyboard on forms; do not submit | Confirm viewport/safe area returns correctly | Video showing keyboard transition and return |
| AN-CHROME-P | Chrome | Portrait with approved `test=1` | Run browser baseline and back/history cases | Screenshot/video and Chrome version |
| AN-CHROME-L | Chrome | Landscape, then portrait | Run shell, nav, scroll and safe-area cases | Before/after screenshots |

Record whether Android uses gesture or three-button navigation. Use both when available.

### 3.3 Desktop supplement

| Matrix ID | Environment | Mode | Required scope | Limitation |
|---|---|---|---|---|
| DT-CHROME | macOS Chrome | Approved `test=1` | Syntax/runtime smoke, links, loading/error, status filters, modal open/close and console review | Does not replace mobile or LINE WebView evidence |
| DT-SAFARI | macOS Safari | Approved `test=1` | WebKit baseline, history, modal and console review | Does not prove iPhone safe area or LINE behavior |

### 3.4 Case counts and applicability

| Case group | Definitions | iPhone required | Android required | Notes |
|---|---:|---:|---:|---|
| Tenant Home `TH-01`–`TH-20` | 20 | 20 | 19 | TH-14 is specifically the iPhone Home Indicator case |
| Tenant Bills `TB-01`–`TB-25` | 25 | 24 | 24 | TB-20 is iPhone-only; TB-21 is Android-only |
| Regression `TR-01`–`TR-10` | 10 | 10 | 10 | Read-only boundaries unless separate write authorization exists |
| Security `SEC-01`–`SEC-08` | 8 | 8 | 8 | Every security case runs on both primary LINE WebViews |
| **Total unique definitions** | **63** | **62** | **61** | Primary device execution slots are counted independently |

## 4. Result field rules

Every case below contains fields for human execution. Initial status is `NOT TESTED`; replace it only after direct observation.

Allowed final status values:

- `PASS`: every expected result was observed with adequate evidence.
- `FAIL`: one or more expected results were not observed.
- `BLOCKED`: the case could not be safely or meaningfully executed.
- `NOT TESTED`: no real-device result exists yet.

`Actual`, `Evidence` and `Notes` must be filled by the tester. Never infer a PASS from static validation or another device.

## 5. Tenant Home cases

| Case ID | Test purpose | Preconditions | Exact operation steps | Expected result | Actual | Status | Evidence | Severity | Notes |
|---|---|---|---|---|---|---|---|---|---|
| TH-01 | Confirm page opens | Approved bound test tenant; target URL recorded | 1. Force-close container.<br>2. Open Tenant Home.<br>3. Wait up to the documented timeout.<br>4. Record first stable screen. | Shell and loading state appear, then Home or a classified error; no blank/crash/redirect loop. | Human fills | NOT TESTED | Launch-to-stable video | P0 | Human fills |
| TH-02 | Confirm formal LIFF initialization | Formal LIFF; signed-out and signed-in runs | 1. Open formal LIFF signed out.<br>2. Complete LINE login.<br>3. Observe return.<br>4. Repeat while signed in. | Returns to the same entry once, obtains the correct tenant identity and does not repeatedly prompt login. | Human fills | NOT TESTED | Video covering login and return; no full UID | P0 | Human fills |
| TH-03 | Confirm `test=1` test identity | Section 1.3 approved | 1. Open Home test URL.<br>2. Record visible test-mode label.<br>3. Compare masked tenant alias with approved fixture.<br>4. Do not navigate to a submit action. | Only the approved test tenant appears; formal account identity is not substituted. | Human fills | NOT TESTED | Masked tenant alias screenshot and approved audit reference | P0 | Human fills |
| TH-04 | Confirm unbound redirect | Approved unbound identity; no binding write | 1. Open Home using unbound fixture.<br>2. Observe first API result behavior.<br>3. Stop at Bind page.<br>4. Repeat for both approved unbound error fixtures if available. | Redirects once to `tenant-bind.html`; query mode is preserved; no generic Home error or loop. | Human fills | NOT TESTED | Continuous Home→Bind video and final URL without UID | P0 | Human fills |
| TH-05 | Verify bound tenant data | Approved DATA-B fixture | 1. Open Home.<br>2. Compare masked tenant alias, room, contract and account state with fixture sheet/audit read-only view.<br>3. Capture masked screen. | Only the expected tenant/workspace data is displayed and fields agree with the approved fixture. | Human fills | NOT TESTED | Masked screen plus read-only fixture reference | P0 | Human fills |
| TH-06 | Verify month formatting | Fixture with known month values | 1. Locate hero bill month.<br>2. Locate latest-bill month box.<br>3. Compare both with approved fixture.<br>4. Repeat available formats. | Both locations show the same normalized `YYYY-MM`; blank is `-`; no contradictory month appears. | Human fills | NOT TESTED | One screenshot containing both month locations | P1 | Human fills |
| TH-07 | Verify current bill summary | Bound tenant with current bill | 1. Record current bill status, total, due date and count.<br>2. Compare with approved read-only fixture.<br>3. Open Bills and return. | Home summary matches the current bill and remains consistent after return. | Human fills | NOT TESTED | Masked Home/Bills comparison screenshots | P0 if wrong financial data | Human fills |
| TH-08 | Verify unpaid amount | Tenant with known unpaid bills | 1. Record Home unpaid total/count.<br>2. Open Bills unpaid filter.<br>3. Compare totals/counts without submitting anything. | Unpaid total and count correspond to the same tenant’s unpaid/overdue/partial bills. | Human fills | NOT TESTED | Masked comparison evidence | P0 if wrong tenant/amount | Human fills |
| TH-09 | Verify paid state | Tenant with paid latest bill | 1. Open Home.<br>2. Observe status badge and displayed amount.<br>3. Open corresponding Bills card. | Paid status text/color and amount agree with Bills; no unpaid call-to-action is falsely presented for the paid bill. | Human fills | NOT TESTED | Home/Bills screenshots | P1; P0 if financial mismatch | Human fills |
| TH-10 | Verify no-bill state | Approved bound tenant with no bills | 1. Open Home.<br>2. Inspect latest-bill month, count, amount and actions.<br>3. Open Bills. | Page does not crash or invent a bill; placeholders/zero count are stable and Bills shows empty state. | Human fills | NOT TESTED | Home and empty Bills screenshots | P1 | Human fills |
| TH-11 | Verify API error state | Safe offline/interrupted network method | 1. Open shell.<br>2. Interrupt network before response.<br>3. Wait for error/timeout.<br>4. Restore network and tap retry once. | Loading ends in a non-sensitive error; retry recovers; no permanent spinner or duplicate page. | Human fills | NOT TESTED | Timed video and redacted console if available | P1 | Human fills |
| TH-12 | Ensure loading does not persist | Normal and slow network runs | 1. Start timer at open.<br>2. Observe loading transition.<br>3. Repeat with throttled network.<br>4. Record duration/outcome. | Loading becomes Home, Bind or error within the documented behavior; never remains indefinitely. | Human fills | NOT TESTED | Timed recording | P0 if completely stuck; otherwise P1 | Human fills |
| TH-13 | Verify fixed bottom navigation | Bound tenant; portrait and landscape | 1. Scroll Home top→bottom.<br>2. Tap each nav item once and return.<br>3. Observe active state and position. | Nav stays fixed, targets resolve once, active state is correct and content remains reachable above it. | Human fills | NOT TESTED | Scroll/navigation video | P1; P0 if route unusable | Human fills |
| TH-14 | Verify iPhone Home Indicator safe area | iPhone with home indicator | 1. Open portrait Home.<br>2. Scroll to bottom.<br>3. Rotate landscape and repeat.<br>4. Trigger a toast if safely available. | Nav, last content and toast remain above the home indicator and are tappable/readable. | Human fills | NOT TESTED | Portrait/landscape screenshots | P1 | Human fills |
| TH-15 | Verify page scrolling | Enough Home content | 1. Swipe through full page.<br>2. Test top/bottom edge.<br>3. Repeat after returning from another tenant page. | `.page` scrolls smoothly; outer shell does not drift; no trapped or unreachable content. | Human fills | NOT TESTED | Full scroll video | P1 | Human fills |
| TH-16 | Verify top/bottom clipping | Small and normal screens | 1. Inspect first header pixels.<br>2. Scroll to last content.<br>3. Compare portrait/landscape and keyboard-after-return states. | Header, first card, last card and nav are not clipped or covered. | Human fills | NOT TESTED | Four boundary screenshots | P1 | Human fills |
| TH-17 | Verify return from tenant pages | Bound fixture | 1. Home→Bills→Home.<br>2. Home→Contract→Home.<br>3. Home→Message→Home.<br>4. Use container Back where applicable. | Correct Home/tenant returns without login loop, stale modal, wrong active nav or cross-tenant state. | Human fills | NOT TESTED | Continuous navigation video | P0 if identity/context wrong; otherwise P1 | Human fills |
| TH-18 | Verify foreground/background initialization | LINE WebView; bound fixture | 1. Open stable Home.<br>2. Background for 10–30 seconds.<br>3. Return.<br>4. Repeat twice. | No repeated login/init loop or duplicate page; tenant remains correct; data is not unexpectedly duplicated. | Human fills | NOT TESTED | Continuous lifecycle video | P1 | Human fills |
| TH-19 | Verify rapid taps do not corrupt page | Read-only actions only | 1. Rapidly tap refresh 5 times.<br>2. Rapidly tap one nav item.<br>3. Wait for all activity.<br>4. Compare final tenant/month with fixture. | One coherent final page remains; no duplicate DOM/request side effect, stale older data or wrong navigation. | Human fills | NOT TESTED | Video plus redacted request timeline | P1 | Known static race risk; stop on wrong data |
| TH-20 | Verify orientation recovery | iPhone and Android | 1. Open Home portrait.<br>2. Scroll mid-page.<br>3. Rotate landscape.<br>4. Rotate back portrait.<br>5. Recheck nav and scroll. | Shell height recalculates; no blank band/clipping; portrait layout and navigation recover. | Human fills | NOT TESTED | Continuous rotation video | P1 | Human fills |

## 6. Tenant Bills cases

The current canonical page has no standalone month selector. “Switch month” means opening cards for different bill months and confirming selected content.

| Case ID | Test purpose | Preconditions | Exact operation steps | Expected result | Actual | Status | Evidence | Severity | Notes |
|---|---|---|---|---|---|---|---|---|---|
| TB-01 | Confirm page opens | Approved bound tenant | 1. Open Bills from Home.<br>2. Open Bills directly.<br>3. Wait for stable screen. | Loading becomes bill list/empty/error; no crash, blank page or identity drift. | Human fills | NOT TESTED | Launch video | P0 | Human fills |
| TB-02 | Confirm formal LIFF initialization | Formal LIFF; signed-out/in runs | 1. Launch formal LIFF.<br>2. Navigate Home→Bills.<br>3. Repeat warm open. | Correct formal tenant loads without repeated login or test identity substitution. | Human fills | NOT TESTED | Navigation/login video | P0 | Human fills |
| TB-03 | Confirm `test=1` identity | Section 1.3 approved | 1. Open Bills test URL.<br>2. Compare masked tenant/room with fixture.<br>3. Do not submit payment. | Only approved test tenant bills appear; formal tenant is not mixed into the page. | Human fills | NOT TESTED | Masked header/list screenshot | P0 | Human fills |
| TB-04 | Verify bill month list | Multi-month fixture | 1. Record visible month sequence.<br>2. Scroll full list.<br>3. Compare with approved read-only fixture. | Months are normalized, newest first and each expected bill appears once. | Human fills | NOT TESTED | Full-list recording and fixture alias | P1; P0 if wrong bill | Human fills |
| TB-05 | Switch between months | At least two months | 1. Open month A detail.<br>2. Close.<br>3. Open month B.<br>4. Reopen A. | Title, bill ID, amount, meter and report data always match the selected month/card. | Human fills | NOT TESTED | Continuous A→B→A video | P0 | Human fills |
| TB-06 | Open bill detail | Valid bill card | 1. Tap card body.<br>2. Close.<br>3. Tap “完整明細”. | Exactly one full-height detail opens at top with correct selected bill. | Human fills | NOT TESTED | Both entry paths video | P1; P0 if wrong bill | Human fills |
| TB-07 | Close bill detail | Open detail | 1. Scroll mid-detail.<br>2. Tap top close.<br>3. Reopen and tap bottom close. | Each close removes modal/lock once and returns to usable list. | Human fills | NOT TESTED | Close-path video | P1 | Human fills |
| TB-08 | Close from backdrop | Open detail at top and mid-scroll | 1. Tap dimmed backdrop outside sheet.<br>2. Repeat after scroll.<br>3. Tap inside sheet to confirm it stays open. | Backdrop closes; inner taps do not; no bill/payment action fires. | Human fills | NOT TESTED | Touch-indicator video | P1 | Human fills |
| TB-09 | Verify list scroll after close | Long bill list | 1. Scroll list to a known card.<br>2. Open/close detail.<br>3. Resume list scrolling. | List remains interactive and at a predictable position; body lock is removed. | Human fills | NOT TESTED | Before/after list video | P1 | Human fills |
| TB-10 | Verify detail scroll reset | Long detail | 1. Open and scroll to bottom.<br>2. Close.<br>3. Reopen same bill.<br>4. Repeat with another bill. | Every newly opened detail starts at top and shows the correct bill. | Human fills | NOT TESTED | Same/cross-bill video | P1 | Human fills |
| TB-11 | Read all long detail content | DATA-L fixture | 1. Open detail.<br>2. Scroll every section.<br>3. Reach final actions.<br>4. Return top. | All financial/meter/report content and final controls are reachable and readable. | Human fills | NOT TESTED | Full top→bottom→top video | P0 if required content/action unreachable | Human fills |
| TB-12 | Ensure modal clears bottom nav | Modal open in both orientations | 1. Inspect modal bottom and nav.<br>2. Attempt safe-area scroll to last control.<br>3. Confirm no accidental nav tap. | Modal content is not hidden by nav; modal layer prevents unintended navigation. | Human fills | NOT TESTED | Bottom-boundary video | P1 | Human fills |
| TB-13 | Verify modal safe area | iPhone and Android | 1. Open long detail portrait.<br>2. Scroll to final buttons.<br>3. Rotate landscape.<br>4. Repeat. | Close/payment controls clear home indicator/system bar and remain tappable. | Human fills | NOT TESTED | Portrait/landscape screenshots | P1 | Human fills |
| TB-14 | Prevent background scrolling | Long list and long detail | 1. Open detail.<br>2. Pull past top.<br>3. Push past bottom.<br>4. Close and compare list position. | Underlying page does not move or receive taps while modal is open. | Human fills | NOT TESTED | Edge-gesture video | P1 | Human fills |
| TB-15 | Verify empty bills | Approved empty fixture | 1. Open Bills.<br>2. Cycle all status filters.<br>3. Try no card action. | `0 / 0` and clear empty state appear; no placeholder bill opens; nav remains usable. | Human fills | NOT TESTED | Empty/filter screenshots | P1 | Human fills |
| TB-16 | Verify API error | Safe offline/interruption | 1. Interrupt request.<br>2. Wait for error/timeout.<br>3. Restore network.<br>4. Retry once. | Loading becomes non-sensitive error; retry restores correct list without duplication. | Human fills | NOT TESTED | Timed video and redacted console | P1 | Human fills |
| TB-17 | Ensure loading does not persist | Normal and slow network | 1. Time cold load.<br>2. Repeat throttled.<br>3. Record terminal state. | Loading always becomes list/empty/error within documented behavior. | Human fills | NOT TESTED | Timed recording | P0 if completely stuck; otherwise P1 | Human fills |
| TB-18 | Rapidly tap same bill | Valid bill | 1. Tap same card/detail button 5–10 times rapidly.<br>2. Wait for animation.<br>3. Inspect DOM behavior visually. | One modal and one selected bill remain; no stack, stale content or repeated navigation. | Human fills | NOT TESTED | Rapid-tap video | P1 | Human fills |
| TB-19 | Rapidly switch months | Two month cards | 1. Tap month A then B rapidly.<br>2. Close/repeat.<br>3. Verify final detail. | Final detail deterministically matches last accepted tap and starts at top. | Human fills | NOT TESTED | Slow-motion/video evidence | P1; P0 if wrong bill/amount | Human fills |
| TB-20 | Verify iPhone overscroll | iPhone LINE WebView and Safari | 1. Open long detail.<br>2. Pull beyond top/bottom repeatedly.<br>3. Observe backdrop/list. | Detail remains stable; no background scroll, rubber-band escape or lost controls. | Human fills | NOT TESTED | iPhone edge-gesture video | P1 | iPhone only |
| TB-21 | Verify Android Back | Android LINE WebView and Chrome | 1. Open detail.<br>2. Press system Back once.<br>3. Record whether modal closes or page leaves.<br>4. Repeat with modal closed. | Approved behavior is consistent; no stuck overlay, wrong page or lost tenant context. Unexpected page exit while modal is expected to close is FAIL. | Human fills | NOT TESTED | Continuous Back-button video | P1 | Android only |
| TB-22 | Verify foreground/background return | LINE WebView; modal open and closed runs | 1. Background 10–30 seconds.<br>2. Return.<br>3. Repeat with detail open. | Correct tenant/bill remains; no duplicate load, blank sheet or stuck body lock. | Human fills | NOT TESTED | Lifecycle video | P1 | Human fills |
| TB-23 | Verify landscape | iPhone and Android | 1. Open list/detail portrait.<br>2. Rotate landscape.<br>3. Scroll/close.<br>4. Return portrait. | List/detail reflow, remain reachable and restore portrait shell correctly. | Human fills | NOT TESTED | Rotation video | P1 | Human fills |
| TB-24 | Verify focus and scroll after close | Long list/detail; accessibility observation | 1. Note triggering control/list position.<br>2. Open/scroll/close.<br>3. Continue touch or assistive navigation.<br>4. Reopen. | List is usable at expected position; detail scroll resets. Missing focus restoration is recorded and severity follows user impact. | Human fills | NOT TESTED | Video; VoiceOver/TalkBack note if used | P1 for scroll; P2→P1 for focus impact | Human fills |
| TB-25 | Verify Home/Bills navigation consistency | Bound fixture | 1. Home→Bills via nav.<br>2. Bills→Home.<br>3. Repeat with Back.<br>4. Compare active state and tenant alias. | Same tenant remains, active nav is correct, no stale modal and test/formal identity does not mix. | Human fills | NOT TESTED | Cross-page video | P0 if identity wrong; otherwise P1 | Human fills |

## 7. Cross-page regression cases

Write-capable controls exist on Bind, Payment Report, Contract cancellation, Renewal and Termination pages. Stop before final submission unless a separate authorization explicitly permits an isolated write.

| Case ID | Test purpose | Preconditions | Exact operation steps | Expected result | Actual | Status | Evidence | Severity | Notes |
|---|---|---|---|---|---|---|---|---|---|
| TR-01 | Validate `tenant-bind.html` boundary | Approved unbound or already-bound fixture; no submit | 1. Open Bind test/formal path.<br>2. Verify loading/form or already-bound state.<br>3. Open/close keyboard in phone field if form appears.<br>4. Do not tap final bind.<br>5. Return Home where safe. | Correct masked identity state, valid mobile layout, query mode preserved and no binding write occurs. | Human fills | NOT TESTED | Video and masked final URL | P0 if wrong identity/write | Human fills |
| TR-02 | Validate `tenant-payment-report.html` boundary | Approved bill; no submit | 1. Enter from unpaid bill.<br>2. Verify selected bill.<br>3. Open/close keyboard in safe fields.<br>4. Do not confirm submission.<br>5. Return Bills. | Correct bill context, stable keyboard/safe area, no payment report created and return works. | Human fills | NOT TESTED | Video and masked bill alias | P0 | Human fills |
| TR-03 | Validate `tenant-contract.html` | Bound tenant; read-only | 1. Open from nav/Home.<br>2. Compare contract alias/status.<br>3. Inspect request list.<br>4. Do not cancel a request.<br>5. Return Home. | Correct tenant/contract appears; navigation works; no cancellation/write. | Human fills | NOT TESTED | Masked contract screenshots | P0 if wrong data; otherwise P1 | Human fills |
| TR-04 | Validate `tenant-renewal.html` boundary | Contract allows page; no submit | 1. Open from Contract.<br>2. Inspect form/permission state.<br>3. Open/close keyboard.<br>4. Open confirmation only if safe, then cancel.<br>5. Return Contract. | Correct contract context, stable modal/keyboard and no renewal request created. | Human fills | NOT TESTED | Video; post-test read-only request check | P0 if write/wrong contract | Human fills |
| TR-05 | Validate `tenant-termination.html` boundary | Contract allows page; no submit | 1. Open from Contract.<br>2. Inspect allowed types/date preview.<br>3. Open/close keyboard.<br>4. Open confirmation only if safe, then cancel.<br>5. Return Contract. | Correct contract context, stable modal/keyboard and no termination request created. | Human fills | NOT TESTED | Video; post-test read-only request check | P0 if write/wrong contract | Human fills |
| TR-06 | Check bottom nav across pages | Bound fixture | 1. Traverse Home, Bills, Contract and Message using nav.<br>2. Visit regression forms and return.<br>3. Repeat portrait/landscape. | Nav labels/positions/active state are consistent; every target resolves once. | Human fills | NOT TESTED | Full traversal video | P1; P0 if unable to return | Human fills |
| TR-07 | Return to Tenant Home | All readable tenant pages | 1. From each page use provided Home/back control.<br>2. Use system/browser Back where applicable.<br>3. Observe Home identity/state. | Home returns without blank page, loop, stale modal or tenant change. | Human fills | NOT TESTED | Per-page return clips | P0 | Human fills |
| TR-08 | Validate unbound flow | Approved unbound identity; no submit | 1. Open formal/test Home per approval.<br>2. Observe redirect to Bind.<br>3. Stop before write.<br>4. Use safe back/reopen. | No tenant data leaks; Bind remains the boundary; no redirect storm or accidental binding. | Human fills | NOT TESTED | Continuous flow video | P0 | Human fills |
| TR-09 | Ensure test identity does not pollute formal identity | Approved test and formal accounts | 1. Record masked formal tenant alias.<br>2. Close LIFF.<br>3. Open approved `test=1` Home/Bills.<br>4. Close test pages.<br>5. Reopen formal LIFF. | Test pages show only test alias; reopened formal LIFF shows only formal alias; no mixed cache/state/URL. | Human fills | NOT TESTED | Masked before/test/after evidence | P0 | Human fills |
| TR-10 | Reopen LIFF on same device | Formal test account | 1. Open Home and Bills.<br>2. Fully close LIFF/LINE view.<br>3. Reopen formal LIFF three times.<br>4. Compare identity/loading/history. | Every open resolves to correct tenant without duplicate initialization, stale page or test query. | Human fills | NOT TESTED | Three-open video or three timestamped clips | P1; P0 if identity wrong/stuck | Human fills |

## 8. Data isolation and security cases

| Case ID | Test purpose | Preconditions | Exact operation steps | Expected result | Actual | Status | Evidence | Severity | Notes |
|---|---|---|---|---|---|---|---|---|---|
| SEC-01 | Ensure `test=1` uses only test identity | Approved test identity and audit method | 1. Open Home/Bills test URLs.<br>2. Compare masked tenant alias with approved mapping.<br>3. Review redacted request/audit identity if available. | Every test request maps only to approved test identity; no formal tenant appears. | Human fills | NOT TESTED | Masked alias and audit reference | P0 | Never record full UID |
| SEC-02 | Prevent cross-workspace tenant data | Approved Tenant A fixture | 1. Open Home, Bills and Contract.<br>2. Compare room/tenant/bill aliases with Workspace A.<br>3. Search visible data for Workspace B aliases. | Only Workspace A data appears across all pages. | Human fills | NOT TESTED | Masked page set and read-only mapping | P0 | Human fills |
| SEC-03 | Prevent landlord test identity becoming tenant | Approved landlord-only account; no impersonation | 1. Open formal tenant entry using landlord-only account where authorized.<br>2. Do not use a copied UID.<br>3. Observe binding/error boundary. | Landlord identity is not resolved as a tenant and no tenant data appears. | Human fills | NOT TESTED | Masked boundary screenshot | P0 | Mark BLOCKED if account use is not approved |
| SEC-04 | Prevent Tenant A seeing Tenant B bills | Two approved isolated fixtures | 1. Record masked A bill aliases.<br>2. Close session/view.<br>3. Open B with approved account/mode.<br>4. Compare lists and deep links. | A never sees B bills and B never sees A bills; copied/unknown bill link never shows another tenant’s detail. | Human fills | NOT TESTED | Masked A/B evidence | P0 | Never place real bill ID in filename |
| SEC-05 | Keep complete UID out of URLs | All tested navigation paths | 1. Inspect address bar after Home, Bills, Bind, Payment, Contract, Renewal and Termination navigation.<br>2. Capture redacted URL evidence. | No complete LINE UID appears in path, query or fragment. | Human fills | NOT TESTED | Redacted URL screenshots | P0 if exposed | Human fills |
| SEC-06 | Keep secrets out of console | Desktop devtools and approved mobile remote debug | 1. Clear console.<br>2. Load each page and safe error path.<br>3. Search output for token/credential/private key/complete UID patterns.<br>4. Do not copy values. | No token, credential, Script Property value, private key or complete UID is logged. | Human fills | NOT TESTED | Redacted console-search screenshot | P0 | Stop capture immediately if secret appears |
| SEC-07 | Keep secrets out of errors | Safe offline/API error tests | 1. Trigger safe load error.<br>2. Record visible message.<br>3. Inspect redacted console/network metadata. | Error contains useful classification but no complete UID, token, credential, endpoint secret or personal data. | Human fills | NOT TESTED | Redacted error evidence | P0 | Human fills |
| SEC-08 | Ensure tests create no formal payment/notification | Read-only test authorization and pre/post audit | 1. Record pre-test payment/request/notification counts via approved read-only method.<br>2. Run only navigation/display tests.<br>3. Never press final submit.<br>4. Record post-test counts. | No formal payment report, binding, contract request, cancellation or notification is created. | Human fills | NOT TESTED | Redacted pre/post audit reference | P0 | Stop immediately on any write |

## 9. Severity definitions

### P0 — release and test stop

- Page cannot open or becomes completely stuck.
- Identity is wrong.
- Cross-tenant/workspace data is exposed.
- Wrong bill or financial data is shown/targeted.
- Test activity modifies formal data or sends a formal notification.
- User cannot return from a core page or the page is completely unusable.

On P0: stop the run, preserve masked evidence, do not attempt repair/write, and notify the human owner.

### P1 — canonical promotion blocker

- Modal cannot close normally.
- Scroll lock/background scrolling is wrong.
- Safe area hides a primary action.
- Month list/switching is wrong.
- Repeated requests produce stale or wrong data.
- Android Back behavior breaks the intended flow.

### P2 — may be accepted only by explicit owner decision

- Animation is not smooth.
- Small layout alignment issue with no blocked control.
- Non-core wording or spacing issue.
- Flow remains usable but experience is suboptimal.

Only a documented, reproducible P2 with a safe workaround may be accepted. Accessibility impact can raise an apparent P2 to P1.

## 10. Evidence rules

Every FAIL must record:

- Device model.
- OS version.
- LINE or browser version.
- Page URL, redacted if needed.
- Test case ID.
- Exact operation steps.
- Actual result.
- Screenshot or recording filename.
- Occurrence time with timezone.
- Reproduction result, such as `3/3`.
- Severity.

Evidence filename format:

```text
<CASE-ID>_<DEVICE-ALIAS>_<ENVIRONMENT>_<RESULT>_<YYYYMMDD-HHMMSS>.<ext>
```

Never place a complete UID, real bill ID, phone number, tenant name, token or credential in the filename. Mask personal and financial data in evidence before sharing.

## 11. Human execution order

### Round 1 — iPhone LINE WebView

1. Complete safety gates.
2. Run Tenant Home applicable cases.
3. Run Tenant Bills applicable cases.
4. Run iPhone lifecycle, orientation, safe-area and overscroll cases.
5. Stop on P0; record P1/P2 without changing code.

### Round 2 — Android LINE WebView

1. Repeat Tenant Home and Tenant Bills cases independently.
2. Run gesture/three-button navigation when available.
3. Run Android Back, lifecycle, orientation and keyboard cases.
4. Do not reuse iPhone PASS results.

### Round 3 — Safari / Chrome and regression pages

1. Run iPhone Safari and Android Chrome baselines.
2. Run macOS Chrome/Safari supplement.
3. Exercise Bind, Payment Report, Contract, Renewal and Termination read-only boundaries.
4. Do not press any final submit/cancel action.
5. Run cross-page navigation and test/formal identity separation.

### Round 4 — formal LIFF smoke test

Formal LIFF smoke test verifies only:

- LIFF can launch.
- Identity is correct.
- Tenant Home can load.
- Tenant Bills can load.

Do not perform payment, notification, repair, binding, cancellation, renewal, termination, data modification, repeated stress testing or bulk testing in the formal smoke round.

## 12. Release decision rules

- No case may be marked PASS without direct device evidence.
- Any confirmed P0 makes the recommendation `DO NOT RELEASE`.
- Any open/blocked required P1 keeps `tenant-bills.html` provisional and recommendation `NOT READY`.
- Required iPhone and Android cases must pass independently.
- Desktop PASS cannot replace mobile/WebView evidence.
- Formal smoke cannot replace full test-identity validation.
- Final recommendation is recorded only in `docs/39-TENANT-REAL-DEVICE-RESULTS.md` after human execution.

## 13. Rollback reference

No program change or deployment occurs in Phase 38, so there is no runtime rollback to execute now.

If a later approved frontend change is tested:

1. Record the exact pre-change commit and canonical fingerprints from section 1.2.
2. Change one HTML per reviewed commit.
3. On P0/P1 regression, restore the reviewed repository artifact.
4. Rerun validator and the affected iPhone/Android smoke cases.
5. Do not use candidate HTML as rollback without explicit human approval.

## 14. No-execution and no-change declaration

This document is an execution pack only. No iPhone, Android, Safari, Chrome or formal LIFF result has been observed or marked PASS. Phase 38 does not modify HTML, Apps Script, routes, endpoint, LIFF ID, test UID, Google Sheets, Script Properties, Web App deployment or candidate overlay. It does not run `clasp push`, `clasp deploy`, commit, push or deploy.
