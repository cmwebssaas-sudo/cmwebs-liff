# Phase 47 — Backend Release Review

Date: 2026-07-20  
Branch: `chore/v2-production-consolidation`  
Review baseline: current Git `HEAD` versus the complete local `apps-script/` working tree

## Release verdict

**BACKEND RELEASE: NOT SAFE**  
**Can run direct `clasp push`: NO**

The current backend change set is not a diagnosis-only update. It combines:

- read-only diagnostic functions;
- production Tenant Home, Bills, and Message handler changes;
- centralized `test=1` identity handling;
- ECPay credential lazy loading;
- a new 3,810-line runtime resolver, repair, derived-View synchronization, rollback, and test module;
- six new production write-path calls to the derived-View synchronizer.

The new runtime module is untracked and is a mandatory dependency of several modified production modules. It still fails on the known two-link test-tenant condition with `MULTIPLE_TENANT_LANDLORD_LINKS`; the deterministic selection rule described in Phase 46 has not been implemented. A direct push would therefore publish broad production behavior changes without resolving the known Home/Message blocker.

In addition, Phase 45 showed that the deployment identifier embedded in the repository frontend does not match the deployment exposed by the project configured in `apps-script/.clasp.json`. Backend ownership must be resolved before any source push or deployment.

## Backend change inventory

| File | Change size versus HEAD | Purpose | Formal runtime impact | Test-only | Could affect formal tenants | Must ship together |
|---|---:|---|---|---|---|---|
| `TESTS.js` | +2211 / -1 | Adds read-only tenant diagnostics, dry-run planning, consistency diagnosis, and deployment contract verification | No automatic runtime impact; functions run only when manually selected | Yes, although they read production Sheets when executed | No automatic impact; Logger output can contain tenant identifiers and must remain controlled | Not required for Web App runtime; needed only to run the diagnostics |
| `V2_API.js` | +1397 / -215 | Central test identity resolver; rewrites Home canonical resolution; rewrites Bills identity, fallback, JSON safety, empty-state and response schema; adds tests | Yes: changes `tenant_home` and `tenant_bills` for every tenant | No | Yes | Requires `程式碼.js` and `V2_TENANT_RUNTIME_DATA_REPAIR.js`; frontend compatibility must be reviewed |
| `程式碼.js` | +61 / -16 | Removes eager ECPay property initialization; adds lazy `getEcpayConfig_()`; routes `test=1` tenant actions through Script Property identity | ECPay loading change affects project startup/payment path; test identity branch is only active for `test=1` | Partly | ECPay behavior affects formal payment calls; normal tenant identity remains the submitted UID | Requires `V2_API.js` because the dispatcher calls `resolveTenantRequestLineUserId_()` |
| `V2_TENANT_RUNTIME_DATA_REPAIR.js` | New, 3810 lines | Shared canonical tenant resolver, Home projection, repair planning/apply logic, generic derived-View synchronization, rollback, verification and fixture tests | Yes: resolver is used by Home/Message and synchronizer is called by six formal write paths | No; manual repair entrypoints are test-UID scoped, but resolver/sync are generic production code | Yes, substantially | Mandatory dependency of API, Message, Billing, Contract, Room, Binding and Lease changes |
| `V2_TENANT_MESSAGES.js` | +79 / -74 | Replaces Home-handler chaining and first-link lookup with shared canonical resolver for message initialization and submission | Yes: changes contact resolution and message submission identity | No | Yes; existing LINE push path uses the newly resolved landlord contact | Requires runtime resolver; must be tested with exact Workspace/landlord recipient isolation |
| `V2_BILLING_MANAGEMENT.js` | +88 / -8 | Adds Workspace-aware View lookup, canonical-key conflict checks, and runtime View sync after bill updates | Yes: bill creation/update can perform additional Sheet writes and can now fail on View conflicts | No | Yes | Requires runtime sync module and transactional failure review |
| `V2_CONTRACT_REQUESTS.js` | +35 / -2 | Synchronizes runtime Views after a completed contract request and exposes sync result | Yes: completed-contract workflow gains additional writes/failure mode | No | Yes | Requires runtime sync module; rollback must cover both contract and View effects |
| `V2_PROPERTY_ROOM_MANAGEMENT.js` | +62 / -1 | Synchronizes tenant runtime Views after an existing occupied room is updated; rejects multiple active contracts | Yes: room-save workflow gains additional reads/writes/failure mode | No | Yes | Requires runtime sync module; must verify partial-write behavior |
| `V2_TENANT_BINDING_PHONE.js` | +52 / -2 | Synchronizes runtime Views for already-bound and newly-bound tenants | Yes: binding workflow gains additional Sheet writes and can fail after binding mutations | No | Yes | Requires runtime sync module; must verify idempotency and rollback |
| `V2_TENANT_LEASE_ONBOARDING.js` | +92 / -11 | Synchronizes runtime Views after tenant/lease creation and adds strict Workspace duplicate checks to View upserts | Yes: tenant creation and onboarding gain additional writes and stricter rejection paths | No | Yes | Requires runtime sync module; must verify existing legacy rows do not block onboarding |

`appsscript.json` is present but is not modified. No other Apps Script module is currently modified or untracked.

## Function and safety checks

### `diagnoseTestTenantRuntimeData()` location

- Exact function name found once.
- Location: `apps-script/TESTS.js` only.
- A separate `diagnoseTestTenantRuntimeDataDetailed()` exists in the new runtime module; it is not the same function name.

### Google Sheets writes

Claim that the backend diff contains no Sheet writes: **FALSE**.

The new runtime module contains:

- `setValue()` write application;
- `setValues()` derived-row insertion;
- `clearContent()` rollback;
- ScriptLock-protected repair entrypoints;
- generic `syncTenantRuntimeViewsForTenant_()` production synchronization.

Six modified formal workflows now call the generic synchronizer:

1. bill View synchronization;
2. completed contract request handling;
3. room update;
4. already-bound tenant handling;
5. new tenant binding;
6. tenant/lease onboarding.

Although the synchronization helper contains rollback logic for its own View operations, several callers invoke it after their primary domain mutation. The complete cross-module transaction boundary has not been proven. A sync failure may return or throw after bill, room, binding, contract, or onboarding data has already changed.

### LINE push

New LINE push call added by this diff: **NO**.

However, `V2_TENANT_MESSAGES.js` changes how the landlord recipient is resolved before the existing `pushLineTextMessage_()` call. This is a production recipient-selection change and must be treated as LINE-impacting even though the push invocation itself already existed.

No diagnostic or runtime repair function directly sends LINE messages.

### Migration

New migration entrypoint or migration invocation in the diff: **NO**.

The word `migration` appears in TESTS comments and safety restrictions only. Existing migration functions in unchanged modules are outside this diff.

### Repair

Claim that the diff contains no repair functionality: **FALSE**.

The new runtime module exposes at least:

- `repairTestTenantRuntimeData()`;
- `repairTestTenantRuntimeViews()`;
- lower-level repair-plan and apply helpers.

The two public repair entrypoints are designed to use `TEST_TENANT_LINE_UID` and are not routes, but they perform actual Sheet writes when manually executed. Their inclusion must be explicitly approved or separated from the production runtime module before release.

### Routes

- Existing direct dispatcher route names before change: 61.
- Existing direct dispatcher route names after change: 61.
- Route-name set difference: none.
- Full validator expectation remains 68 unique `v2_action` values with 68/68 handler coverage.

No route was added, removed, or renamed.

### Formal handler behavior

Claim that formal handler behavior is unchanged: **FALSE**.

Intended but material formal behavior changes include:

- Home now resolves through the new canonical master-data resolver instead of reading only `V2_tenant_home_view` by LINE UID.
- Bills now resolves tenant and active contract, scopes by Workspace, supports bill-master fallback, normalizes dates, returns empty bills as success, and changes the response envelope.
- Message initialization and submission now use the shared resolver and a different landlord-link selection path.
- Billing, contract completion, room updates, tenant binding, and onboarding now perform derived-View synchronization and can reject conflicts.
- ECPay properties are loaded only when the payment fallback path is executed rather than at Apps Script load time.

These changes are not limited to `test=1`.

## Known release blockers

### P0 — Deployment target ownership is unresolved

The current clasp project deployment and the Web App endpoint used by repository HTML do not match. A push could update a project that is not the backend currently serving Tenant pages. Do not push until the canonical project and existing Web App deployment are verified privately.

### P0 — Known Home/Message resolver failure remains

The runtime resolver still uses:

```text
if landlordLinks.length > 1 → MULTIPLE_TENANT_LANDLORD_LINKS
```

The diagnosed test tenant has one incomplete legacy-style link and one complete canonical link. Phase 46's deterministic candidate selection has not been implemented, so publishing current Home/Message code does not resolve the incident.

### P0 — Mixed read-only and write-capable module

`V2_TENANT_RUNTIME_DATA_REPAIR.js` combines production resolver/synchronizer code with manually executable repair functions. The runtime dependencies require the file, but release approval has not been given for its write entrypoints.

### P1 — Production transactions are broader and insufficiently proven

Six formal workflows now add derived-View writes. Failure and rollback behavior has not been validated with Apps Script integration tests for partial mutations, lock behavior, duplicate legacy rows, and concurrent updates.

### P1 — Message recipient behavior changed

Message submission uses the new canonical landlord resolution before the existing LINE push. It requires exact Workspace and landlord-recipient verification. A wrong selection could notify the wrong landlord.

### P1 — Frontend and backend release are not yet aligned

The canonical Bills envelope is compatible with the modified repository Bills frontend, but the serving frontend endpoint is not linked to the reviewed canonical Apps Script project. `tenant-message.html` also still fails to append `test=1` to its JSONP request.

### P1 — Complete clasp push set is larger than the incident fix

`clasp push` operates on the full Apps Script project. The current set includes formal billing, contract, room, binding, onboarding, messaging and repair changes, not just TESTS or the Tenant Bills incident fix.

## Required corrections before release

1. Verify the Apps Script project and deployment that own the endpoint used by the repository frontend.
2. Implement and fixture-test Phase 46 deterministic landlord-link selection:
   - unique tenant and active contract first;
   - exact Workspace/tenant/contract/room/landlord candidate selection;
   - compatible incomplete legacy rows may not block one exact candidate;
   - genuine conflicts still fail closed;
   - never first-row-wins.
3. Decide whether to split manual repair functions from the production resolver/sync module. If retained, document authorization, test-UID scope, rollback, and operator controls.
4. Add integration tests for all six formal sync call sites, including primary-write failure, sync rollback, concurrency, duplicate canonical keys and Workspace isolation.
5. Verify Message initialization and submission resolve the same landlord and that LINE push cannot cross Workspace boundaries.
6. Review the complete `clasp status` push set from a clean, isolated source tree. Do not push the current dirty directory directly.
7. Re-run `npm run validate`, Apps Script syntax checks, resolver fixtures, Bills payload tests and read-only deployment verification.
8. Record a source pull, immutable Apps Script version, deployment mapping and rollback point before any approved deployment.

## Recommended release grouping

### Group A — Read-only diagnostics

- `TESTS.js`

May be pushed separately only from an isolated source tree that is byte-identical to the intended Apps Script source except for the approved TESTS addition. No Web App deployment is required.

### Group B — Tenant read runtime

- `程式碼.js`
- `V2_API.js`
- resolver-only portion of `V2_TENANT_RUNTIME_DATA_REPAIR.js`
- `V2_TENANT_MESSAGES.js`

Do not release until deterministic landlord-link selection and message recipient tests pass.

### Group C — Derived-View write integration

- sync-only portion of `V2_TENANT_RUNTIME_DATA_REPAIR.js`
- `V2_BILLING_MANAGEMENT.js`
- `V2_CONTRACT_REQUESTS.js`
- `V2_PROPERTY_ROOM_MANAGEMENT.js`
- `V2_TENANT_BINDING_PHONE.js`
- `V2_TENANT_LEASE_ONBOARDING.js`

Release only after transactional and Workspace-isolation integration testing. It should not be bundled into an emergency Tenant read fix unless explicitly approved.

### Group D — Manual repair tools

- repair-only portion of `V2_TENANT_RUNTIME_DATA_REPAIR.js`

Keep separate from runtime deployment when practical. If retained in the Apps Script project, require explicit manual execution controls and never expose it as a route.

## Validation evidence

The final validator and diff checks must be rerun after this document is created. A passing static validator is necessary but does not clear the release blockers above: route completeness and syntax cannot prove deployment ownership, transactional rollback, recipient isolation, or deterministic duplicate-link resolution.

## Final decision

**BACKEND RELEASE: NOT SAFE**  
**Can run direct `clasp push`: NO**

Stop at human review. Do not commit, push, `clasp push`, or deploy this combined backend change set.
