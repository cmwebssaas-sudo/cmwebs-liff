# V3 Core subscription integration

User approved design and implementation 2026-10-10. Recommended model/speed:
gpt-5.6-terra / medium; current session model preserved. Separate worktree
from origin/main9388ab9; historical checkpoint be2cefe is backup only.

Core owns Company/Product/Subscription authority. CMWebs retains original
landlord login, Workspace, roles, rooms, leases, billing and repair system.
This release adds a read-only subscription card to the original More page.
It does not implement subscription checkout or payment collection.

## Mapping and secure configuration

Additive editor-only helper `provisionPlatformCoreWorkspaceLink(options)`
requires explicit staging environment, canonical workspace_id,
platform_company_id, product_id, mode legacy/observe and a reason. It records
an audit through the existing operation audit module before binding; audit
failure denies provisioning. No browser route changes mappings. Provisioning
cannot choose enforce. An operator must first prove an isolated observe and
room-capacity round-trip before explicitly setting a validated row to enforce.
The helper has run only against the new isolated acceptance Sheet, with no
real rental records. No formal landlord Workspace has been provisioned.

`V3_platform_core_workspace_links` columns: workspace_id, platform_company_id,
product_id, status, mode, linked_at, updated_at. Missing Sheet or missing row
means legacy. Duplicate rows, malformed columns, status/mode or incomplete
linked mapping fail closed. Reads never create schema. ProductCompanyLink in
Core must have external_company_id equal to exact canonical Workspace ID.

Server-only Properties: CMWEBS_PLATFORM_CORE_ENVIRONMENT (staging),
CMWEBS_PLATFORM_CORE_BASE_URL (HTTPS origin), CMWEBS_PLATFORM_CORE_PRODUCT_ID,
CMWEBS_PLATFORM_CORE_SERVICE_TOKEN. The service token is an opaque ACTIVE
ServiceClient for that Product with exact product.access.read scope. It exists
only in Properties and Core digest storage; do not copy it to Sheet/browser/
Git/logs. Redirects are disabled. Source changes provision none of these.

Legacy preserves existing behavior. Observe queries but does not deny growth
when Core is unavailable. Enforce requires an enabled, timely TRIAL/ACTIVE
grant and nonnegative integer rental.rooms.max. Zero permits no active rooms.
No grace period or unlimited default exists. Safe error messages omit raw
Core/SQL/provider errors. Shared property-guard fallback denies growth if Core
mapping schema exists while the new module is missing.

## Capacity entry-point inventory

- saveLandlordRoomByLineUid_: new room or reactivation through editing. Auth
  and role check precede Core fetch; fetch precedes ScriptLock. Inside the lock,
  re-read mapping and whole canonical Workspace V2_rooms count, check expiry
  both before and after counting, then mutate using existing write machinery.
- setLandlordRoomAccountToggleByLineUid_: only transition to active from another
  status grows capacity; idempotent active, disable and existing edit stay usable.
- onboardingSaveRoom_: legacy online onboarding already holds a ScriptLock;
  enforced new/reactivated room is refused and directed to room management.
  No HTTP request is made while locked. Legacy/observe keep old behavior.
- V2_LEGACY_BILL_IMPORT reads rooms to match bills; it creates no rooms.
- V2_WORKSPACES, V2_WORKSPACE_LANDLORD_ACCESS and RC1 migrations establish
  identities/Workspace/schema or compatibility fields; no room insertion.
- Signing review, contract backfill and contract activation write existing room
  financial/occupancy links, without room insert/account activation. Historical
  editor fixtures/migration functions are not online onboarding entrypoints and
  must not be run against an enforced Workspace as a bulk provisioning bypass.

Count is independent of property-member visibility and lease/tenant occupancy.
Blank or active account_status counts; inactive/archived does not. Rooms with
another explicit Workspace do not count. Canonical Workspace migration and
legacy blank-workspace reconciliation must be complete before enabling enforce;
never infer Company capacity from a member's visible property list.

## Evidence and activation gate

Local VM tests check scope, states, expiry, malformed grants, credentials,
legacy/observe behavior, last-slot contention, UI safe text, and existing room
regressions. Cross-repo test invokes the actual Core Fastify service, opaque
verifier and repository with temporary in-memory SQL fixtures; its generated
HTTP response flows through the actual Apps Script adapter and capacity guard.
This proves executable contracts, not live network/PostgreSQL deployment.

Core disposable PostgreSQL16 CI must additionally pass migrations, DB tests
and a separate SELECT-only product runtime with credential revocation.
Run CMWebs integration test with PLATFORM_CORE_TEST_WORKTREE set to the Core
checkout. Otherwise its four round-trip tests explicitly skip.

2026-10-11: Core product-read-only staging runtime and an independent PostgreSQL
database are installed on the verified AI-00 host. HTTPS origin is
https://core-staging.cmwebs.com; readiness200, scoped access200, anonymous401,
Company/Product403, suspension/revocation and SELECT-only SQL checks passed.
After the user completed Google consent, the actual Apps Script adapter ran
against AI-00 through Google UrlFetchApp and a separate, owner-bound test Sheet.
The canonical isolated Workspace WS_CORE_STAGING_20261011 is synthetic.
Secure Properties injection, audited observe mapping, last-slot allowance,
over-capacity refusal, scope/expiry refusal and existing-room edit checks passed.
Suspending the Core fixture denied capacity growth while allowing existing
edits; the fixture was restored ACTIVE and the round-trip passed again.
The test credential was rotated after an accidental tool-output exposure;
the old credential now returns401 and the replacement returns200. No credential
values are retained in this record. Formal Sheet and Properties were untouched.
Production subscription activation and authenticated phone/browser UI remain
UNVERIFIED. See Core docs/AI00_PRODUCT_READ_DEPLOYMENT.md for host
identity, private configuration paths, local backup/restore and rollback.
Default mapping absence keeps production legacy; do not set enforce from local
suite success. Existing rent, tenant payments, leases, repairs and LINE sends
are unaffected by subscription denial. No real financial/tenant test writes.

## Release and rollback

2026-10-11 backend publication: fresh serving225 and editor HEAD matched all61
files from main9388ab9. Candidate HEAD and immutable226 match all63 intentional
files; the original Web App now reads226 at the same URL and the other four
deployment configurations are unchanged. Manifest/scopes, formal Sheet,
Properties, triggers and LINE configuration were not changed. No formal mapping
exists, so the production Workspace remains legacy. Pages publication is tracked
separately in production-baseline.json. New frontend module
uses its own fixed cache tag; existing shared release tag is preserved because
no existing static module changes. Separate Core runtime leaves admin unchanged.

Rollback: first set the explicitly provisioned row mode to legacy under an
operator-controlled write (never delete business rows), then restore verified
previous backend immutable version and Pages revision independently. Stop the
product runtime if needed; no schema removal or historical version deletion.

2026-10-11 local verification: Core359 tests/typecheck/Admin build; CMWebs768
passing tests including cross-repo4, validate63 backend files/38 endpoint refs.
Actual reactivation checks fetch-before-lock, count-inside-lock, last-slot denial
and lock release. Existing active/idempotent/disable and ordinary edit do not
contact Core. Prior root WIP unchanged. Core PostgreSQL16 CI and real AI-00/GAS
staging acceptance pass; only inline self-review, no independent agent review.

The user identified themselves as the first landlord. A metadata-first bounded
read of the formal V2_workspaces table resolves the only existing Workspace to
W000001, 朱文漢的管理團隊, active/completed. This is the intended first observe
target. The current Core runtime and CM adapter intentionally reject production
environment configuration; do not disguise a real Workspace as a staging fixture
or assign the fixture's two-room quota. Formal environment promotion, secure
credential injection and the authenticated summary still require completion.
