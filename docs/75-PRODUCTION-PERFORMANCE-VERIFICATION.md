# Phase 75 — Production Performance Verification

日期：2026-07-21

狀態：**TEST PLAN ONLY — NOT EXECUTED / NOT DEPLOYED**

## 1. Purpose and release boundary

This plan verifies the observable effect of Phases 69–74 without introducing features,
refactoring runtime code, or changing architecture.

Phase 75 itself does not deploy the local candidate. Therefore:

- Current production measurements cannot be labelled as “after Phase 69–74” until the exact
  candidate files have passed release review and been made available in an approved staging or
  production deployment.
- No result table below is pre-filled as PASS.
- Historical figures are baselines or static estimates, not new production measurements.
- The tested before/after revisions, Apps Script versions, Web App deployment, frontend commit,
  account class, tenant fixture, and timestamps must be recorded before comparing results.

## 2. Changes under verification

| Phase | Expected effect | Important limitation |
|---|---|---|
| 69 | Successful `tenant_home` full-sheet reads decrease from about 8 to 7 by omitting the bill master read. | Actual latency reduction may be smaller than the read-count reduction. |
| 70 | Repeated reads of the same Sheet within one request can reuse a request-level snapshot. | The first normal read of each distinct Sheet remains necessary; state cannot cross HTTP requests. |
| 71B | Reuse one Spreadsheet handle per request/execution key. | Handle reuse is not the same as reducing full-sheet reads. |
| 72 | Identified payload over-fetching and deferred candidates. | Audit only; payload schema and sizes were not changed. |
| 73 | Defined Home critical path and optional contract boundary. | Design only. |
| 74 | `tenant_home` primary content renders without waiting for `tenant_contract_init`; contract/property content updates later. | Both requests still start, and total completion can remain contract-bound. |

## 3. Baseline evidence

### Historical network baseline

Phase 68 measured an unauthenticated, no-Sheet Web App response at an average of **2.361 s**
over three samples. This is evidence of Apps Script/HTTP fixed cost, not a tenant route or
Phase 69–74 after-result.

### Static read-count baseline

| Route | Before estimate | After implementation expectation |
|---|---:|---:|
| `tenant_home` | about 8 full-sheet reads | about 7 first-time reads |
| `tenant_contract_init` | about 9–11 | about 9–11 when all Sheets are distinct |
| `tenant_bills` | about 4 | about 4 when all Sheets are distinct |
| `tenant_message_init` | about 9 | about 9 when all Sheets are distinct |

Phase 70 is expected to save only duplicate reads inside the same request. Phase 71B expects
Spreadsheet handle acquisition to change approximately as follows:

| Route | Before handle acquisitions | Expected created | Expected reused |
|---|---:|---:|---:|
| `tenant_home` | 2 | 1 | 1 |
| `tenant_contract_init` | 2 | 1 | 1 |
| `tenant_bills` | 5 | 1 | 4 |
| `tenant_message_init` | 4 | 1 | 3 |

These counts must be confirmed from the matching Apps Script Execution Logger. They must not be
translated directly into milliseconds.

## 4. Before/after test controls

Use two explicitly identified builds:

| Field | Before | After |
|---|---|---|
| Frontend commit/revision | To record | To record |
| Apps Script version | To record | To record |
| Deployment token, masked | To record | To record |
| Web App host/path type | To record | To record |
| Test tenant/data snapshot | Same fixture | Same fixture |
| Chrome version | Same major version | Same major version |
| Network profile | Same | Same |
| Run time window | To record | Comparable window |

Required controls:

1. Use the same test tenant, Workspace, contract, property, room, bill count, and message count.
2. Do not create bills, messages, payments, notifications, or contract requests during timing.
3. Clear the browser cache only for the cold-cache series; retain it for the warm series.
4. Keep DevTools network throttling either disabled for both builds or set to the same profile.
5. Disable unrelated extensions or use the controlled Incognito profile.
6. Record one cold-start sample after an idle period separately; do not mix it into warm p50.
7. Collect at least 10 warm samples per build and scenario. Report median, p95, minimum, and
   maximum; never compare only the fastest run.
8. Preserve the Network log and export a HAR with sensitive query values removed. Do not place
   complete LINE UID, callback values, tokens, credentials, or Script Properties in evidence.

Tenant read routes may create existing access-log records even though the business payload is
read-only. Testing must use the approved test identity and must not be described as a zero-write
exercise unless the exact deployed handlers have been verified not to log access.

## 5. Metric definitions

Use one navigation origin and the following timestamps:

| Metric | Start | End |
|---|---|---|
| Navigation shell time | Browser navigation start | Static HTML `load` event |
| Identity initialization | Start of page bootstrap | Test/LIFF identity becomes available |
| `tenant_home` API latency | JSONP request start | Callback received |
| Home first render time | Browser navigation start | Tenant identity, room, payment state, and balance are visibly rendered |
| Home total completion time | Browser navigation start | Contract/property state is `ready` or terminal `error`, with no optional loading indicator |
| `tenant_contract_init` route latency | JSONP request start | Callback received |
| Contract lazy-load time | Home first render | Property/contract section reaches `ready` or terminal `error` |
| `tenant_bills` lazy-load time | Click/navigation to Bills | Bill list or terminal empty/error state is rendered |
| `tenant_message_init` lazy-load time | Click/navigation to Message | Landlord contact/message content or terminal empty/error state is rendered |

For Bills and Message, “lazy” means navigation-triggered page loading; Phase 74 intentionally
does not call these APIs from Home.

## 6. Measurement procedure

### 6.1 Common setup

1. Record the build identifiers and masked deployment information from Section 4.
2. Open Chrome DevTools → Network and Performance.
3. Enable Preserve log; disable cache only for the cold series.
4. Filter Network by `tenant_home`, `tenant_contract_init`, `tenant_bills`, and
   `tenant_message_init` as appropriate.
5. Start a Performance recording before navigation.
6. Do not click payment, submit, repair, notification, or other write actions.
7. Stop recording only after the target page reaches its terminal ready/error state.
8. Record request timing, visual milestone, payload transfer size, and the matching Apps Script
   execution counters.

### 6.2 Tenant Home

For each run:

1. Navigate to Home from a fresh page navigation.
2. Record `tenant_home` request start/end.
3. Capture the first frame containing tenant identity, room, payment state, and balance.
4. Confirm property/contract is still a loading placeholder if its request is pending.
5. Record `tenant_contract_init` request start/end.
6. Capture the frame where property/contract becomes ready or terminal error.
7. Confirm the Home first render occurred before contract completion when contract is slower.
8. Record request-level counters from the corresponding Apps Script executions.

### 6.3 Tenant Bills

1. From Home, click Bills once.
2. Confirm Home did not prefetch `tenant_bills`.
3. Record navigation start, route request timing, list render, payload size, and bill count.
4. Confirm the empty state is terminal success when the controlled fixture has zero bills.
5. Confirm repeated clicks were not required to render data.

### 6.4 Tenant Message

1. From Home, click Contact/Message once.
2. Confirm Home did not prefetch `tenant_message_init`.
3. Record navigation start, route request timing, content render, payload size, and message count.
4. Confirm the landlord recipient/context belongs to the same Workspace without exposing IDs in
   evidence.

## 7. Browser test checklist

### Chrome desktop — canonical signed-in account

- [ ] Record Chrome and macOS versions.
- [ ] Confirm the intended LINE/Google test session before starting.
- [ ] Run one cold and at least 10 warm Home samples.
- [ ] Run at least 10 Bills navigation samples.
- [ ] Run at least 10 Message navigation samples.
- [ ] Capture Home first render separately from total completion.
- [ ] Confirm property/contract loading state never displays false “no contract”.
- [ ] Confirm no duplicate requests on one navigation.
- [ ] Save sanitized HAR, Performance trace, screenshots, and counter summary.

### Chrome — different account

- [ ] Use an explicitly approved secondary test account; do not use an unrelated production user.
- [ ] Confirm it resolves only its authorized tenant/Workspace context.
- [ ] Record login/identity initialization separately from route latency.
- [ ] Repeat Home, Bills, and Message timing with the same network profile.
- [ ] Confirm no data from the canonical account remains after account switching.
- [ ] Classify login redirect or permission delay separately from runtime regression.
- [ ] Do not compare results if the account has different tenant/bill/message data volume.

### Chrome Incognito

- [ ] Disable extensions unless explicitly required.
- [ ] Record the first uncached/static-shell and first Apps Script request as cold samples.
- [ ] Complete the approved test login without storing sensitive evidence.
- [ ] Repeat warm samples within the same Incognito session.
- [ ] Confirm cache/cookie differences do not break binding or redirect flow.
- [ ] Close the Incognito session after exporting sanitized evidence.

## 8. Result tables

Initial status for every row is **NOT TESTED**.

### Route and render comparison

| Metric | Browser scenario | Before p50 | Before p95 | After p50 | After p95 | Delta | Status | Evidence |
|---|---|---:|---:|---:|---:|---:|---|---|
| Home first render | Canonical account | — | — | — | — | — | NOT TESTED | — |
| Home total completion | Canonical account | — | — | — | — | — | NOT TESTED | — |
| `tenant_home` API | Canonical account | — | — | — | — | — | NOT TESTED | — |
| Contract lazy-load | Canonical account | — | — | — | — | — | NOT TESTED | — |
| `tenant_contract_init` API | Canonical account | — | — | — | — | — | NOT TESTED | — |
| Bills lazy-load | Canonical account | — | — | — | — | — | NOT TESTED | — |
| `tenant_bills` API | Canonical account | — | — | — | — | — | NOT TESTED | — |
| Message lazy-load | Canonical account | — | — | — | — | — | NOT TESTED | — |
| `tenant_message_init` API | Canonical account | — | — | — | — | — | NOT TESTED | — |

Duplicate the table for Different Account and Incognito. Do not average across these scenarios.

### Runtime counters

| Route | Build | full reads before | full reads after | snapshot hits | handle created | handle reused | Status |
|---|---|---:|---:|---:|---:|---:|---|
| `tenant_home` | Before | — | — | — | — | — | NOT TESTED |
| `tenant_home` | After | — | — | — | — | — | NOT TESTED |
| `tenant_contract_init` | Before | — | — | — | — | — | NOT TESTED |
| `tenant_contract_init` | After | — | — | — | — | — | NOT TESTED |
| `tenant_bills` | Before | — | — | — | — | — | NOT TESTED |
| `tenant_bills` | After | — | — | — | — | — | NOT TESTED |
| `tenant_message_init` | Before | — | — | — | — | — | NOT TESTED |
| `tenant_message_init` | After | — | — | — | — | — | NOT TESTED |

## 9. Expected improvement

Expected, but not yet measured:

1. **Home first render:** should no longer equal the slower of `tenant_home` and
   `tenant_contract_init`; it should occur shortly after `tenant_home` and synchronous DOM work.
2. **Home total completion:** may remain similar because `tenant_contract_init` still runs and
   supplies property/contract content.
3. **`tenant_home` backend:** one fewer full-sheet read is expected than the Phase 68 baseline.
4. **Spreadsheet handle acquisition:** one created handle per normal request key, with the reuse
   counts estimated in Section 3.
5. **Bills/Message:** backend fixed work may improve from handle reuse, but no frontend payload or
   route schema reduction occurred. Large wall-clock gains are not assumed.

No millisecond or percentage improvement is accepted until before/after samples use the controls
defined above.

## 10. Regression risks

| Risk | Severity | Verification |
|---|---:|---|
| Home renders a false no-contract state while optional data is pending | P1 | Slow `tenant_contract_init`; loading label must remain until terminal state. |
| Old optional response overwrites a newer refresh | P1 | Trigger rapid refresh; generation guard must ignore the old response. |
| Optional update resets scroll/focus | P1 | Scroll before contract completion and compare after update. |
| Binding or Workspace isolation changes | P0 | Test canonical and approved secondary account; fail on cross-tenant data. |
| Bills/Message accidentally prefetched by Home | P1 | Network log must contain neither request before navigation. |
| Snapshot reuses stale values after a write | P0 | Out of scope for this read-only plan; release audit must keep snapshot restricted to approved read routes. |
| Access logs alter timing or data | P2 | Use the same logging behavior in before/after builds and classify it separately. |
| Cold start variance hides the change | P2 | Separate cold sample and compare warm p50/p95. |

Any P0 result stops verification and blocks release. P1 results require investigation before an
improvement can be accepted.

## 11. Remaining bottlenecks

Even if Phase 69–74 performs as designed, the following remain:

1. Apps Script startup/HTTP serving fixed cost; Phase 68 no-Sheet baseline averaged 2.361 s.
2. `tenant_contract_init` still reads approximately 9–11 full Sheets and is a separate HTTP
   execution from `tenant_home`.
3. Request-level snapshots cannot share data across the parallel Home and Contract requests.
4. Normal first resolution often reads distinct Sheets, producing few or no snapshot hits.
5. `tenant_bills` retains compatibility duplication (`bills`, `items`, `data.bills`).
6. Contract requests and message history remain unbounded and can grow with tenant history.
7. JSONP, LIFF initialization, network variance, and access-log behavior remain outside the
   snapshot optimization.

## 12. Acceptance criteria

Phase 69–74 performance is accepted only when:

- The exact after build is proven to contain the reviewed changes.
- Home first render occurs before slower contract completion in the relevant samples.
- No P0/P1 functional or isolation regression is observed.
- Route schemas and tenant navigation remain compatible.
- Expected read/handle counters match the request being tested or deviations are explained.
- Warm after p50 does not regress for any core route beyond the agreed noise threshold.
- Evidence contains no secrets or complete user identifiers.

Recommended statistical threshold before testing: flag a warm p50 regression greater than 10%
or 300 ms, whichever is larger, and any p95 regression greater than 15% for investigation. These
are test gates, not a promise of improvement.

## 13. Completion statement

This Phase 75 deliverable is a verification plan only. It does not claim production after-results,
does not change architecture or code, and does not perform a commit, push, clasp push, deployment,
Sheet write, or LINE action.
