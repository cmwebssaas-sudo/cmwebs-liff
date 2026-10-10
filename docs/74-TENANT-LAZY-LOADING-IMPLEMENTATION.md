# Phase 74 — Tenant Portal Lazy Loading Implementation

## Status

- Implementation: complete in the local repository
- Deployment: not performed
- Commit/push: not performed
- API routes and response schemas: unchanged
- Google Sheets schema and data: unchanged

## Objective

Decouple the tenant Home primary render from optional contract content while preserving all existing APIs and page-level tenant routes.

## Files changed

| File | Change |
|---|---|
| `tenant-home.html` | Removed the `Promise.allSettled()` first-render barrier, introduced staged contract states and stale-response protection. |
| `docs/74-TENANT-LAZY-LOADING-IMPLEMENTATION.md` | Records the implementation, validation, risks, and rollback procedure. |

No Apps Script, manifest, route, endpoint, LIFF ID, or other tenant HTML was changed by Phase 74.

## Loading flow before

```text
Identity
  ↓
tenant_home ───────────────┐
                          ├─ Promise.allSettled → one full render
tenant_contract_init ─────┘
```

Although contract failure was handled as optional, the page still waited for its success, failure, or 30-second timeout before showing primary tenant data.

## Loading flow after

```text
Identity
  ↓
start tenant_contract_init ────────────────┐
  ↓                                       │
await tenant_home                         │
  ↓                                       │
validate binding                         │
  ↓                                       │
render identity + room + balance         │
render property/contract loading state   │
                                          ↓
                              contract response settles
                                          ↓
                              render ready or section error
```

The existing requests still start in parallel, but the browser awaits only `tenant_home` before the first useful render. Awaiting `tenant_contract_init` happens after the primary DOM has been rendered and yields control back to the browser.

## Primary content

The primary render now includes:

- Tenant name and tenant ID.
- Room identity.
- Current payment state.
- Latest bill and unpaid balance summary.
- Quick navigation and system information.
- Explicit loading placeholders for property and contract status.

The current `tenant_home` response does not contain property or contract metadata. To preserve the API schema, these fields initially show a loading state and are populated only from the existing `tenant_contract_init` response. The UI never treats “still loading” as “no contract”.

## Optional content states

`renderPage(home, contractData, contractState)` supports three states:

| State | Property/status behavior | Contract section behavior |
|---|---|---|
| `loading` | Shows an explicit loading label. | Shows spinner and confirms other Home features remain usable. |
| `ready` | Shows property and calculated contract status. | Shows the existing contract summary, request status, and navigation. |
| `error` | Shows a non-blocking unavailable label. | Shows a section-level retry action without replacing primary Home content. |

`renderOptionalContract()` preserves the current page scroll position while applying the optional state update.

## Stale response protection

Every `loadPage()` call increments `pageLoadGeneration`.

- Primary and contract responses update the page only if they belong to the latest generation.
- An older contract response cannot overwrite a newer refresh.
- Rejected contract requests are converted to a handled outcome immediately, avoiding unhandled promise rejection while Home is still loading.

## Bills and message isolation

Home does not call either of these APIs:

- `tenant_bills`
- `tenant_message_init`

Their existing independent loading behavior remains in:

- `tenant-bills.html`
- `tenant-message.html`

Home continues to provide navigation only. No bill detail or message history was added to the Home critical path.

## API compatibility

Unchanged:

- `tenant_home` route name, parameters, callback behavior, and payload.
- `tenant_contract_init` route name, parameters, callback behavior, and payload.
- `tenant_bills` independent route and response handling.
- `tenant_message_init` independent route and response handling.
- Binding redirect behavior.
- `test=1` forwarding behavior already present in the working baseline.

## Validation performed

### Local render fixture

An ephemeral, non-repository Node fixture loaded the actual inline JavaScript and checked:

- `tenant_home` primary render occurs before awaiting the optional contract result: PASS.
- Contract `loading`, `ready`, and `error` render states: PASS.
- `Promise.allSettled()` barrier is absent: PASS.
- Home does not invoke `tenant_bills` or `tenant_message_init`: PASS.
- `tenant-bills.html` retains `tenant_bills`: PASS.
- `tenant-message.html` retains `tenant_message_init`: PASS.

### Repository validation

- Inline JavaScript syntax: checked by the repository validator.
- Route count and handler coverage: checked by the repository validator.
- HTML link integrity: checked by the repository validator.
- Final result: see the Phase completion output; deployment was not part of this phase.

## Manual browser test checklist

Before release, verify with throttled network and real LINE WebViews:

1. Home identity and balance appear while contract initialization is still pending.
2. Property and contract status display loading text rather than a false missing-contract state.
3. A successful contract response updates property, status, contract detail, and request badge.
4. A contract error leaves tenant identity, balance, quick links, and navigation usable.
5. Rapid refresh does not allow an older response to overwrite newer data.
6. Scroll position remains stable when optional content updates.
7. `tenant-bills.html` independently loads bills.
8. `tenant-message.html` independently loads message initialization data.
9. `test=1` and formal LIFF identity behavior remain isolated.

## Risks

| Risk | Level | Mitigation |
|---|---:|---|
| Optional update rebuilds the Home markup | P1 | Preserve scroll position and reject stale generations. Real-device focus/scroll testing remains required. |
| Property is not in the primary payload | P1 | Show an honest loading state and patch only from existing contract data. |
| Contract request reaches its timeout | P1 | Convert it to section-level error; primary content remains available. |
| Layout changes when contract data arrives | P2 | Existing card remains present during loading; verify on small screens. |
| Two parallel backend requests still execute | P2 | This phase targets perceived first-render latency, not request-count reduction. |

## Rollback

1. Restore the prior `tenant-home.html` implementation.
2. Restore the `Promise.allSettled([tenant_home, tenant_contract_init])` single-render flow.
3. Republish the previous GitHub Pages revision only after review.

No Apps Script rollback, Web App deployment rollback, or Sheet change is required because Phase 74 did not modify those systems.

## Completion statement

Phase 74 changed only the tenant Home frontend loading orchestration and this document. It did not change APIs, routes, Apps Script, Sheet schema/data, LIFF configuration, or deployment state.
