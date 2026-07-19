# CMWebs V2 Tenant Frontend Phase 38 — Real Device Results

- Result sheet date: 2026-07-19 (Asia/Taipei)
- Execution source: `docs/38-TENANT-REAL-DEVICE-VALIDATION.md`
- Initial state: every case is `NOT TESTED`
- Release recommendation: `NOT EVALUATED`

This file is an unexecuted human-test template. It contains no inferred PASS result. Create a separate row when the same case is run on more than one device or environment; never overwrite one device's evidence with another device's result.

## 1. Result summary

| Metric | Initial value |
|---|---:|
| Total cases | 63 unique case definitions |
| Passed | 0 |
| Failed | 0 |
| Blocked | 0 |
| Not tested | 63 |
| P0 count | 0 confirmed findings |
| P1 count | 0 confirmed findings |
| P2 count | 0 confirmed findings |
| Release recommendation | **NOT EVALUATED** |

Applicability totals are 62 cases for iPhone and 61 cases for Android. These are execution slots, not completed results. `TH-14` and `TB-20` are iPhone-only; `TB-21` is Android-only. Desktop checks supplement but never replace the required mobile/WebView rows.

## 2. Recording rules

- Allowed status values: `NOT TESTED`, `PASS`, `FAIL`, `BLOCKED`.
- Change a row from `NOT TESTED` only after direct observation on the recorded device.
- Record the actual OS, LINE/browser version, URL/environment, timestamp, tester and evidence filename.
- For multiple devices, duplicate the case row and give each execution its own result and evidence.
- Assign P0/P1/P2 in the result summary only to confirmed failures. The table's Severity column is the default severity if the stated failure occurs; it is not an existing defect count.
- Every FAIL must have reproducible steps and evidence as defined in the execution pack.
- Never record a complete LINE UID, bill ID, phone number, tenant name, token, credential or Script Property value.
- Mark a case `BLOCKED` when an approved identity, fixture, authorization or safe read-only method is unavailable; do not substitute production data.

## 3. Tenant Home results

| Case ID | Device | OS | Environment | Page | Scenario | Expected | Actual | Status | Severity | Evidence | Tested At | Tester | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TH-01 | iPhone + Android | — | LINE WebView | `tenant-home.html` | Page opens | Shell reaches Home, Bind or classified error without blank/crash/loop. | — | NOT TESTED | P0 | — | — | — | — |
| TH-02 | iPhone + Android | — | Formal LIFF | `tenant-home.html` | LIFF initialization | Login returns once to the correct tenant entry without an initialization loop. | — | NOT TESTED | P0 | — | — | — | — |
| TH-03 | iPhone + Android | — | Approved `test=1` | `tenant-home.html` | Test identity | Only the approved test tenant appears; formal identity is not substituted. | — | NOT TESTED | P0 | — | — | — | — |
| TH-04 | iPhone + Android | — | Approved unbound identity | `tenant-home.html` | Unbound redirect | Redirects once to `tenant-bind.html`, preserves mode and does not loop. | — | NOT TESTED | P0 | — | — | — | — |
| TH-05 | iPhone + Android | — | LINE WebView | `tenant-home.html` | Bound data | Tenant, workspace, room and contract match the approved fixture only. | — | NOT TESTED | P0 | — | — | — | — |
| TH-06 | iPhone + Android | — | LINE WebView | `tenant-home.html` | Month format | Month values are consistent `YYYY-MM`; blank is `-`. | — | NOT TESTED | P1 | — | — | — | — |
| TH-07 | iPhone + Android | — | LINE WebView | `tenant-home.html` | Current bill summary | Status, total, due date and count match the approved current bill. | — | NOT TESTED | P0 if financial data differs | — | — | — | — |
| TH-08 | iPhone + Android | — | LINE WebView | `tenant-home.html` | Unpaid amount | Unpaid total/count match the same tenant's eligible bills. | — | NOT TESTED | P0 if tenant or amount differs | — | — | — | — |
| TH-09 | iPhone + Android | — | LINE WebView | `tenant-home.html` | Paid state | Paid badge, amount and available actions agree with Bills. | — | NOT TESTED | P1; P0 if financial data differs | — | — | — | — |
| TH-10 | iPhone + Android | — | LINE WebView | `tenant-home.html` | Empty state | No invented bill or crash; placeholders and Bills empty state remain stable. | — | NOT TESTED | P1 | — | — | — | — |
| TH-11 | iPhone + Android | — | Safe network interruption | `tenant-home.html` | API error | Loading ends in a non-sensitive error and one retry can recover. | — | NOT TESTED | P1 | — | — | — | — |
| TH-12 | iPhone + Android | — | Normal and slow network | `tenant-home.html` | Loading timeout | Loading reaches Home, Bind or error and never remains indefinitely. | — | NOT TESTED | P0 if stuck; otherwise P1 | — | — | — | — |
| TH-13 | iPhone + Android | — | Portrait and landscape | `tenant-home.html` | Bottom navigation | Nav remains fixed, active and usable; content remains reachable. | — | NOT TESTED | P1; P0 if navigation is unusable | — | — | — | — |
| TH-14 | iPhone | — | LINE WebView and Safari | `tenant-home.html` | Safe area | Nav, content and toast clear the Home Indicator in both orientations. | — | NOT TESTED | P1 | — | — | — | iPhone only |
| TH-15 | iPhone + Android | — | LINE WebView | `tenant-home.html` | Page scroll | Inner page scrolls fully without shell drift or trapped content. | — | NOT TESTED | P1 | — | — | — | — |
| TH-16 | iPhone + Android | — | Small and normal screens | `tenant-home.html` | Top/bottom clipping | Header, first/last content and nav are not clipped or covered. | — | NOT TESTED | P1 | — | — | — | — |
| TH-17 | iPhone + Android | — | Cross-page navigation | `tenant-home.html` | Return from tenant pages | Home returns without identity drift, loop, stale modal or wrong nav state. | — | NOT TESTED | P0 if context differs; otherwise P1 | — | — | — | — |
| TH-18 | iPhone + Android | — | LINE lifecycle | `tenant-home.html` | Background/foreground | Resume does not repeat initialization, duplicate page or change tenant. | — | NOT TESTED | P1 | — | — | — | — |
| TH-19 | iPhone + Android | — | Read-only rapid taps | `tenant-home.html` | Duplicate actions | Final page is coherent with no stale data or duplicate navigation. | — | NOT TESTED | P1 | — | — | — | — |
| TH-20 | iPhone + Android | — | Portrait → landscape → portrait | `tenant-home.html` | Orientation recovery | Shell height, nav and scroll recover without blank band or clipping. | — | NOT TESTED | P1 | — | — | — | — |

## 4. Tenant Bills results

| Case ID | Device | OS | Environment | Page | Scenario | Expected | Actual | Status | Severity | Evidence | Tested At | Tester | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TB-01 | iPhone + Android | — | LINE WebView | `tenant-bills.html` | Page opens | Loading reaches list, empty state or classified error without crash. | — | NOT TESTED | P0 | — | — | — | — |
| TB-02 | iPhone + Android | — | Formal LIFF | `tenant-bills.html` | LIFF initialization | Correct formal tenant loads without login loop or test identity. | — | NOT TESTED | P0 | — | — | — | — |
| TB-03 | iPhone + Android | — | Approved `test=1` | `tenant-bills.html` | Test identity | Only approved test-tenant bills appear. | — | NOT TESTED | P0 | — | — | — | — |
| TB-04 | iPhone + Android | — | Multi-month fixture | `tenant-bills.html` | Month list | Normalized newest-first months appear once and match the fixture. | — | NOT TESTED | P1; P0 if a wrong bill appears | — | — | — | — |
| TB-05 | iPhone + Android | — | Multi-month fixture | `tenant-bills.html` | Month switching | Detail always matches the selected month, bill and amount. | — | NOT TESTED | P0 | — | — | — | — |
| TB-06 | iPhone + Android | — | LINE WebView | `tenant-bills.html` | Open detail | One detail opens at top with the correct bill from both entry paths. | — | NOT TESTED | P1; P0 if the wrong bill appears | — | — | — | — |
| TB-07 | iPhone + Android | — | LINE WebView | `tenant-bills.html` | Close detail | Both close controls remove the modal/lock once and restore the list. | — | NOT TESTED | P1 | — | — | — | — |
| TB-08 | iPhone + Android | — | LINE WebView | `tenant-bills.html` | Backdrop close | Backdrop closes; inner touch does not close or trigger an action. | — | NOT TESTED | P1 | — | — | — | — |
| TB-09 | iPhone + Android | — | Long bill list | `tenant-bills.html` | Scroll after close | List remains interactive at a predictable position after close. | — | NOT TESTED | P1 | — | — | — | — |
| TB-10 | iPhone + Android | — | Long detail | `tenant-bills.html` | Detail scroll reset | Reopened same/different bill starts at top with correct content. | — | NOT TESTED | P1 | — | — | — | — |
| TB-11 | iPhone + Android | — | Long-detail fixture | `tenant-bills.html` | Long content | Every required section and control is reachable and readable. | — | NOT TESTED | P0 if content/action is unreachable | — | — | — | — |
| TB-12 | iPhone + Android | — | Both orientations | `tenant-bills.html` | Modal vs bottom nav | Modal clears nav and prevents unintended navigation. | — | NOT TESTED | P1 | — | — | — | — |
| TB-13 | iPhone + Android | — | LINE WebView | `tenant-bills.html` | Modal safe area | Close and final controls clear system bars and remain tappable. | — | NOT TESTED | P1 | — | — | — | — |
| TB-14 | iPhone + Android | — | Long list/detail | `tenant-bills.html` | Background lock | Underlying page neither scrolls nor receives taps while detail is open. | — | NOT TESTED | P1 | — | — | — | — |
| TB-15 | iPhone + Android | — | Empty fixture | `tenant-bills.html` | Empty bills | Clear empty state remains stable for all filters and nav is usable. | — | NOT TESTED | P1 | — | — | — | — |
| TB-16 | iPhone + Android | — | Safe network interruption | `tenant-bills.html` | API error | Loading ends in a non-sensitive error; retry restores one correct list. | — | NOT TESTED | P1 | — | — | — | — |
| TB-17 | iPhone + Android | — | Normal and slow network | `tenant-bills.html` | Loading timeout | Loading always reaches list, empty state or error. | — | NOT TESTED | P0 if stuck; otherwise P1 | — | — | — | — |
| TB-18 | iPhone + Android | — | Rapid taps | `tenant-bills.html` | Repeat same bill | Only one modal and one selected bill remain. | — | NOT TESTED | P1 | — | — | — | — |
| TB-19 | iPhone + Android | — | Rapid taps | `tenant-bills.html` | Rapid month switching | Final detail deterministically matches the last accepted selection. | — | NOT TESTED | P1; P0 if bill or amount differs | — | — | — | — |
| TB-20 | iPhone | — | LINE WebView and Safari | `tenant-bills.html` | Overscroll | No rubber-band escape, background movement or lost control. | — | NOT TESTED | P1 | — | — | — | iPhone only |
| TB-21 | Android | — | LINE WebView and Chrome | `tenant-bills.html` | System Back | Back behavior is consistent with no stuck overlay, wrong page or lost context. | — | NOT TESTED | P1 | — | — | — | Android only |
| TB-22 | iPhone + Android | — | LINE lifecycle | `tenant-bills.html` | Background/foreground | Resume retains correct tenant/bill without duplicate load or stuck lock. | — | NOT TESTED | P1 | — | — | — | — |
| TB-23 | iPhone + Android | — | Portrait → landscape → portrait | `tenant-bills.html` | Landscape | List/detail remain reachable and portrait shell restores correctly. | — | NOT TESTED | P1 | — | — | — | — |
| TB-24 | iPhone + Android | — | Touch; assistive check if available | `tenant-bills.html` | Focus and scroll reset | List resumes predictably and each detail starts at top. | — | NOT TESTED | P1 for scroll; P2→P1 for focus impact | — | — | — | — |
| TB-25 | iPhone + Android | — | Cross-page navigation | `tenant-bills.html` | Home/Bills consistency | Tenant and nav state stay consistent without stale modal or identity mix. | — | NOT TESTED | P0 if identity differs; otherwise P1 | — | — | — | — |

## 5. Cross-page regression results

| Case ID | Device | OS | Environment | Page | Scenario | Expected | Actual | Status | Severity | Evidence | Tested At | Tester | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TR-01 | iPhone + Android | — | Approved read-only run | `tenant-bind.html` | Bind boundary | Correct state and mobile layout; no binding write occurs. | — | NOT TESTED | P0 if identity differs or write occurs | — | — | — | Do not submit |
| TR-02 | iPhone + Android | — | Approved read-only run | `tenant-payment-report.html` | Payment-report boundary | Correct bill, stable keyboard/safe area, no report created, return works. | — | NOT TESTED | P0 | — | — | — | Do not submit |
| TR-03 | iPhone + Android | — | Approved read-only run | `tenant-contract.html` | Contract page | Correct contract appears and no cancellation/write occurs. | — | NOT TESTED | P0 if data differs; otherwise P1 | — | — | — | Do not cancel |
| TR-04 | iPhone + Android | — | Approved read-only run | `tenant-renewal.html` | Renewal boundary | Correct contract, stable form/modal and no request created. | — | NOT TESTED | P0 if write or wrong contract | — | — | — | Do not submit |
| TR-05 | iPhone + Android | — | Approved read-only run | `tenant-termination.html` | Termination boundary | Correct contract, stable form/modal and no request created. | — | NOT TESTED | P0 if write or wrong contract | — | — | — | Do not submit |
| TR-06 | iPhone + Android | — | Cross-page navigation | Tenant pages | Bottom nav consistency | Labels, placement, target and active state remain consistent. | — | NOT TESTED | P1; P0 if return is impossible | — | — | — | — |
| TR-07 | iPhone + Android | — | Cross-page navigation | Tenant pages | Return Home | Home returns without blank page, loop, stale modal or tenant change. | — | NOT TESTED | P0 | — | — | — | — |
| TR-08 | iPhone + Android | — | Approved unbound identity | Home and Bind | Unbound flow | No tenant data leaks; Bind remains boundary; no write or redirect storm. | — | NOT TESTED | P0 | — | — | — | — |
| TR-09 | iPhone + Android | — | Approved test and formal identities | Home and Bills | Test/formal separation | Test and formal aliases never mix through cache, state or URL. | — | NOT TESTED | P0 | — | — | — | — |
| TR-10 | iPhone + Android | — | Formal LIFF | Home and Bills | Reopen LIFF | Repeated opens resolve to the correct tenant without stale/test state. | — | NOT TESTED | P1; P0 if identity differs or page is stuck | — | — | — | — |

## 6. Security and isolation results

| Case ID | Device | OS | Environment | Page | Scenario | Expected | Actual | Status | Severity | Evidence | Tested At | Tester | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SEC-01 | iPhone + Android | — | Approved `test=1` audit | Home and Bills | Test identity only | Every test request maps only to the approved test identity. | — | NOT TESTED | P0 | — | — | — | Never record full UID |
| SEC-02 | iPhone + Android | — | Approved isolation audit | Home, Bills and Contract | Workspace isolation | Only the current workspace's tenant data appears. | — | NOT TESTED | P0 | — | — | — | Mask all tenant data |
| SEC-03 | iPhone + Android | — | Approved landlord-only account | Tenant entry | Landlord is not tenant | Landlord identity never resolves as tenant and sees no tenant data. | — | NOT TESTED | P0 | — | — | — | BLOCKED if account use is not approved |
| SEC-04 | iPhone + Android | — | Two approved tenant fixtures | Bills | Tenant bill isolation | Tenant A and B never see each other's bills or detail. | — | NOT TESTED | P0 | — | — | — | Never record real bill ID |
| SEC-05 | iPhone + Android | — | All navigation paths | Tenant pages | URL privacy | No complete LINE UID appears in path, query or fragment. | — | NOT TESTED | P0 if exposed | — | — | — | Store only redacted URL evidence |
| SEC-06 | iPhone + Android | — | Approved remote debug | Tenant pages | Console secrecy | Console contains no complete UID, token, credential, property or private key. | — | NOT TESTED | P0 | — | — | — | Stop capture if sensitive data appears |
| SEC-07 | iPhone + Android | — | Safe error path | Home and Bills | Error secrecy | Visible/diagnostic errors contain no secret or personal data. | — | NOT TESTED | P0 | — | — | — | Redact evidence before sharing |
| SEC-08 | iPhone + Android | — | Pre/post read-only audit | Tenant workflow | No formal writes | No payment, binding, contract request, cancellation or notification is created. | — | NOT TESTED | P0 | — | — | — | Stop immediately on any write |

## 7. Failure detail template

Copy this block for every FAIL. Do not put sensitive values in it.

| Field | Value |
|---|---|
| Device | |
| OS | |
| LINE / Browser version | |
| Page URL | |
| Test case ID | |
| Exact operation steps | |
| Actual result | |
| Screenshot / recording filename | |
| Occurrence time and timezone | |
| Reproducibility | |
| Severity | |
| Related case/device | |

## 8. Final sign-off template

Complete only after required iPhone and Android executions and formal smoke are finished.

- Required iPhone cases complete: `NOT TESTED`
- Required Android cases complete: `NOT TESTED`
- Desktop supplement complete: `NOT TESTED`
- Formal LIFF smoke complete: `NOT TESTED`
- Open P0: `NOT EVALUATED`
- Open P1: `NOT EVALUATED`
- Data isolation accepted by: `—`
- Frontend owner accepted by: `—`
- Release recommendation: **NOT EVALUATED**

## 9. No-execution declaration

No real-device, browser or formal LIFF test has been executed or marked PASS in this initial results file. No HTML, Apps Script, route, endpoint, LIFF ID, test UID, Google Sheet, deployment or runtime setting was changed. No commit, push, `clasp push`, `clasp deploy` or deployment was performed.
