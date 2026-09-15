# Task 3 — Server-authorized repair-ticket routes

## Implementation commit

- `1d1c493abea2e5b86b8423202045e07bc4f2d38c` — `feat: enforce repair ticket workspace projections`

## Changed files

- `apps-script/V2_WORKSPACE_LANDLORD_ACCESS.js`
- `apps-script/V2_RUNTIME_SNAPSHOT.js`
- `apps-script/程式碼.js`
- `apps-script/V2_LANDLORD_MANAGEMENT.js`
- `apps-script/V2_TENANT_MESSAGES.js`
- `tests/phase263-repair-ticket-runtime.test.mjs`
- `docs/04-API-ROUTES.md`

## Contract decisions

- `tenant_repair_tickets_init` derives `workspace_id`, `room_id`, and `tenant_id`
  only from the canonical LINE runtime, filters before serialization, and emits
  only the frozen tenant projection allowlist. Browser identity fields cannot
  widen scope; mismatches are rejected as `TENANT_ACCESS_DENIED`.
- `landlord_repair_tickets_init` uses the existing Workspace read proxy. Its
  only optional filters are `room_id` and `status`; client Workspace and
  landlord identifiers are discarded.
- `landlord_repair_ticket_update` uses the existing `message_write` policy and
  forwards only `status`, `public_reply`, `responsibility_party`,
  `estimated_cost`, and `actual_cost`. The event actor comes from the resolved
  principal; original tenant and lease snapshots are never changed.
- The runtime snapshot allowlist adds only the tenant-safe read action.
  Landlord repair reads and all writes remain outside it.
- The centralized dispatcher retains its JSONP and HTML bridge envelopes for
  all three routes.

## Verification

| Command | Result |
| --- | --- |
| `node --test tests/phase263-repair-ticket-runtime.test.mjs` | PASS — 8 tests, 0 failures |
| `node --test tests/phase262-repair-ticket-contract.test.mjs` | PASS — 2 tests, 0 failures |
| `node --check` for all five affected Apps Script files | PASS |
| `npm run validate` | PASS — 57 backend files parsed; 37 endpoint references; static cache validation passed |
| `git diff --check` | PASS |

## Open risks and acceptance boundary

- No deploy, push, merge, Sheet migration, Properties change, LINE send, or
  external-account action was performed.
- Authenticated tenant and landlord acceptance on the serving Apps Script/LIFF
  surfaces remains `HUMAN_REQUIRED`; local tests do not establish Production
  identity, data, or bridge behavior.
- The tenant adapter tests the forged-identity guard and the server-side
  projection boundary. Future UI work must consume only the documented tenant
  projection and must not introduce an alternate room-history endpoint.

## Fix round 1 — review auth and raw-body remediation

### Fix commit

- `b01dadf018caec1baba42f18e857db5a1060722c` — `fix: require verified repair route principals`

### Root cause and repair

- The initial three `doGet` branches were reached after the generic tenant
  fallback had accepted `e.parameter.line_user_id`. The repair actions now
  return before that fallback and require route-specific verified principals:
  `landlord_session_token` resolves through `resolveLandlordPrincipal_`; tenant
  access requires `tenant_session_token` through
  `verifyTenantLiffSessionToken_` or a verified `id_token` through
  `tenantLiffSigningVerifyIdTokenClaims_`, followed by canonical tenant
  resolution. Missing authentication returns `AUTH_REQUIRED`; unavailable
  helpers return explicit route module-required errors.
- `description` remains in the frozen storage/header contract but is always an
  empty string in tenant projections. The canonical source message body stays
  in protected ticket storage for authorized landlord history only.
- Focused tests now cover bare browser UID rejection, verified principal
  propagation into repair handlers, forged query isolation, and raw-body
  exclusion. Existing landlord update allowlisting and snapshot scope remain
  unchanged.

### Fix-round verification

| Command | Result |
| --- | --- |
| `node --test tests/phase263-repair-ticket-runtime.test.mjs` | PASS — 10 tests, 0 failures |
| `node --test tests/phase262-repair-ticket-contract.test.mjs` | PASS — 2 tests, 0 failures |
| `node --check` for `V2_REPAIR_TICKETS.js` and all Task 3 affected Apps Script files | PASS |
| `npm run validate` | PASS — 57 backend files parsed; 37 endpoint references; static cache validation passed |
| `git diff --check` | PASS |

### Remaining risks

- No live authenticated session, LIFF id token, deployment, push, merge, or
  external write was used. The deployed module inventory and real browser
  session compatibility remain `HUMAN_REQUIRED`.
