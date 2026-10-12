# CMWebs Architecture Decisions

**Status: AUTHORITATIVE**
**Last updated: 2026-08-27 (Asia/Taipei)**

## Supersedes

These decisions supersede any older V3/V4 proposal that assumes a shared CMWebs
LINE OA, customer-specific branches, or feature customization.

## Permanent decisions

1. The landlord owns its LINE OA, brand, and customer relationship.
2. CMWebs owns core software, deployment, updates, automation, subscription,
   and module licensing.
3. V3 uses BYO LINE OA. CMWebs does not impersonate a landlord through a
   shared OA; personal LINE is manual communication only.
4. Branding may be configured only through standardized name, logo, approved
   colors, and contact information. Functionality is not customizable.
5. A single core program, UI structure, business-rule set, and upgrade stream
   serve all customers. A release must upgrade all customers.
6. `workspace_id`, RBAC, and Workspace isolation are mandatory control points
   for centralized multi-tenant data. Enterprise physical isolation is a later,
   optional deployment model.
7. Production secrets live in Apps Script Properties and must never be stored
   in Git, documentation, URLs, browser storage, or console output.
8. Existing V2 Production is isolated from V3 construction. Apps Script and
   GitHub Pages are independently released and independently rolled back.
9. New customers and new modules must remain standardized; no customer-specific
   code branch, workflow, field, or layout is allowed.
10. Every future Codex handoff states recommended model and speed, current
    authoritative source, release surface, risk, and rollback reference.

## Canonical source decision

The immutable Apps Script Version 85 snapshot is retained in GitHub `main`
under `apps-script/` as the V2 internal-beta canonical backend baseline. It is
not permission to deploy the current editor source. Serving deployment identity
and immutable rollback remain separate Production evidence.

## V2.1 native contract-signing boundary

- The backend-derived `signing_mode` is the only source of truth for a signing
  session. The browser must not select the mode or supply tenant, Workspace,
  landlord, or LINE identity as write authority.
- A normal renewal is a condition-confirmation and signature flow. It does not
  repeat new-tenant onboarding, identity-image upload, tenant/room/Workspace
  creation, or LINE binding.
- A future renewal record/version links to its immutable predecessor through
  `previous_contract_id` or `renewed_from_contract_id`; a changed actual
  tenant, name, or identity is a re-contract exception, not normal renewal.
- New-tenant signing may require the approved identity artifacts and signature;
  renewal permits only the signature artifact. Identity or actual-tenant
  changes are exception/re-sign flows, not normal renewal.
- Tokens, identity images, signatures, Drive identifiers, and internal metadata
  stay out of URLs, browser storage, and console output. Private artifact
  storage must fail closed when its required schema is absent.
- The signing read model returns only fields from the server-resolved signable
  contract and, for a renewal, its same-tenant, same-Workspace linked
  predecessor. Missing full-contract content or predecessor linkage is shown as
  unavailable; the browser must not invent either.
- The native final action records a tenant signing submission only after a
  verified session, consent, and required stored artifacts. It preserves
  `contract_status`, is idempotent after a successful submission, and fails
  closed when the explicit signing-audit schema is absent. It is not a contract
  activation, approval, or status-transition mechanism.
- The contract content source is the configured fixed Google Docs template,
  selected by `CMWEBS_CONTRACT_TEMPLATE_DOCUMENT_ID`. Preview replaces only
  canonical placeholders and fails closed when the template cannot be read;
  submission copies the template into the private folder selected by
  `CMWEBS_CONTRACT_SIGNING_DRIVE_ROOT_FOLDER_ID`, writes the signature into the
  supplied text or image signature slot, and records the copy in
  `V2_contract_signing_documents` plus `tenant_signed_document_record_id`.

## V2.1 native landlord signing-review candidate

This local candidate adds the post-submission review step without changing the
native queue object: a submitted item remains the canonical `V2_contracts` row,
not a `V2_contract_requests` or legacy-integration record.

- The `V2_contracts` review audit schema is append-only and idempotent. Its
  required fields are `tenant_signing_reviewed_at`,
  `tenant_signing_reviewed_by_user_id`,
  `tenant_signing_reviewed_by_membership_id`, and
  `tenant_signing_review_note`. A missing schema fails closed; this document
  does not authorize migration of any Production spreadsheet.
- Native landlord-review read and write routes require a short-lived,
  server-verified LINE session bound to the active V2 user, Workspace membership
  and Workspace. A raw URL `line_user_id` cannot authorize these routes.
- The approval/rejection write obtains `ScriptLock`, re-reads the contract
  inside the lock, enforces the existing Workspace `contract_write` policy and
  preserves the final-decision idempotency boundary. Approval revalidates the
  required stored artifacts before changing `contract_status` to `active`.
- Rejection preserves the existing signable contract status and records
  `tenant_signing_submission_status=rejected`; the tenant may resubmit through
  the existing verified native session and artifact path. Neither outcome calls
  LINE, Make, the legacy signed-contract bridge, or an external e-sign service.

## 2026-08-30 expiry-review renewal candidate

For an active contract ending within 60 calendar days, a daily scheduler may
append exactly one renewal draft with `contract_status=pending_landlord_review`.
The draft inherits the predecessor's stored financial and payment snapshot and
keeps the existing append-only version chain. It is a landlord notification and
review aid only: it does not contact the tenant, replace the previous contract,
or change room pointers. At 30 days, an unconfirmed draft receives one retained
Workspace reminder. The landlord's explicit Workspace-scoped confirmation is
the only step that creates the tenant signing invite. The tenant list exposes
the current contract end date and remaining days; visual warning changes at 60
and 30 days, without altering contract data.

The additive `V2_contracts` fields are `renewal_review_status`,
`renewal_review_prepared_at`, `renewal_review_confirmed_at`, and
`renewal_review_reminded_30d_at`. Missing fields are appended only; existing
headers and historic rows are never rewritten.
The time trigger is installed only by the explicit, idempotent
`installContractExpiryRenewalDailyTrigger` release step; source publication
alone does not create scheduling state.

## 2026-08-27 renewal contract-history candidate

The approved local candidate uses an append-only contract version chain for
existing tenants. A renewal appends a new `V2_contracts` row with a new
`contract_id`, keeps the same `contract_family_id`, increments
`renewal_sequence`, and links `renewed_from_contract_id`／
`renewed_to_contract_id`. The predecessor's dates, amounts, terms, documents,
and signature evidence are never overwritten or deleted; its lifecycle status
may become `renewed`／`archived` only after the new version is created.

The renewal version carries a complete snapshot of rent, management fee,
deposit, other fixed fee, payment day, terms, and the 30-day expiry
non-renewal offer. The offer is waived only when the non-renewal notice is at
least 30 calendar days before expiry. A notice under 30 days is
`landlord_review`; it does not auto-charge or auto-waive a penalty. Mid-term
early termination remains outside this offer.

Renewal identity documents are optional. When the tenant does not re-upload,
the new version stores immutable `carried_forward` references through
`source_document_id`; a renewal still requires a new signature artifact. New
tenant signing keeps identity documents required. The landlord and tenant
read models expose `contract_history`, and selected landlord history versions
are served as read-only complete contract/signature views.

This is a local V2.1 implementation candidate only. It does not authorize
Production Sheet migration, Apps Script deployment, GitHub Pages publication,
or LINE/mobile UAT.

## 2026-08-31 landlord-home dashboard loading candidate

The landlord homepage uses a two-stage read path. Existing
`landlord_home_bootstrap` remains the critical source for the greeting, KPI,
action queue, and shortcuts. After the browser resolves the LINE identity, it
starts the existing `landlord_revenue_dashboard_init` read with `range=12m` in
parallel with the bootstrap request; the chart result is rendered only after
the shell is available. The chart area has its own loading and error boundary,
so a report timeout does not erase usable homepage content while the two
read paths avoid unnecessary serial latency.

The browser JSONP layer separates one request from its retry wrapper. Only
the exact read timeout `API 載入逾時` may retry once, while write-like calls
remain single-attempt. Script errors clean up the callback and script and
reject immediately. A monotonically increasing homepage request token blocks
late responses from an earlier refresh from replacing newer content.

No financial snapshot is stored in browser storage or a cross-request Apps
Script cache. This avoids briefly showing another account or Workspace's
stale aggregate while improving perceived speed through progressive
rendering. This is a local V2.1 candidate only; it does not authorize
Production deployment or LIFF/mobile UAT.

## 2026-09-01 landlord-home KPI width correction

The landlord homepage KPI row uses two equal columns at the base LIFF width,
rather than relying on a `max-width: 390px` override. KPI currency values do
not use `overflow: hidden` or ellipsis, so the receivable and collected totals
remain readable when the embedded LINE viewport reports a wider CSS width than
the physical phone screenshot suggests. The existing mobile override remains
compatible and can enlarge the value text on narrower screens.

This is a frontend-only correction. It does not change the bootstrap/report
payloads, Apps Script, Sheet schema, or financial data. It requires the normal
GitHub Pages publication and a fresh LIFF/mobile visual check before being
called Production-verified.

## 2026-09-01 landlord-home trend summary semantics

The three values below the landlord-home 12-month trend chart represent the
sum of every month currently plotted, not the final row in the series. The
summary is explicitly labelled `近 12 個月合計`, while the separate top KPI
cards continue to represent the current bill month. This keeps the chart
summary consistent with the selected report range and prevents a current-month
value from being mistaken for a 12-month aggregate.

The total is derived from the already authorized monthly aggregate rows in the
existing report response. No route, schema, Apps Script, or financial data
change is required; a fresh GitHub Pages publication and LIFF/mobile visual
check remain required for Production verification.

## 2026-10-11 landlord-home redesign, parallel reads and browser snapshot

Supersedes the 2026-08-31 statement that no financial snapshot is stored in
browser storage, and the 2026-09-09 ordering in which the chart read waited
for the first render. The owner explicitly approved a guarded snapshot.

- Reads: `landlord_home_bootstrap` `section=home`, `section=actions` and
  `landlord_revenue_dashboard_init` `range=12m` now start together. Painting
  order is unchanged: the hero renders first, then counts and charts. The
  serial start added roughly one homepage round trip (about 9 seconds in the
  2026-10-11 v229 measurement) before the secondary reads could begin.
- Snapshot: after a successful read, the homepage stores the home payload,
  normalised 12-month report and action counts in `localStorage` key
  `cmwebs_landlord_home_cache_v1`. It is bound to a SHA-256 hash of the
  signed-in identity (Email session token or verified LINE user ID; the raw
  value is never stored), shown only to the same identity, expires after 24
  hours, and is labelled on screen as old data until fresh figures replace
  it. Logout, any authorization failure and any non-transient homepage error
  remove it (`landlord-auth.js` clears it centrally). Test mode never caches.
  Residual risk: within 24 hours the aggregates remain readable through
  browser developer tools on that device; no bank account, tenant contact or
  bill detail is stored.
- Presentation: navy hero with a counter-clockwise collection-rate ring,
  rolling amounts reusing `CMWebsAssetValuation.rollingMoney`, and a single
  collected-income curve with pointer, touch and arrow-key month inspection.
  All new motion stops under `prefers-reduced-motion`.
- Title: the homepage heading shows the Workspace name. Owners and admins get
  an edit button that opens the existing settings page; no new route is added
  because `landlord_settings_save_workspace` also overwrites timezone,
  currency and note.

No Apps Script, schema, route or Production data change. GitHub Pages
publication and real LIFF/mobile acceptance require separate authorization.

## 2026-10-11 inner-page snapshots, prefetch and on-demand LINE SDK

Extends the homepage snapshot decision to the main inner pages, with owner
approval ("A then C"; C is the AI-00 read path).

- `CMWebsLandlordApi.snapshot(action, params, freshPromise, onCached)` paints
  the last successful result for the same identity while the real request
  runs, shows a fixed "顯示 HH:MM 的資料・更新中" notice, then stores the fresh
  result. Allowlist: `landlord_tenants`, `landlord_room_center_init`,
  `landlord_arrears`, `landlord_properties_init`,
  `landlord_revenue_dashboard_init`. Storage key
  `cmwebs_landlord_read_cache_v1`, one book per SHA-256 identity hash, 24-hour
  entries, 400 KB per entry and 1.5 MB total with oldest-first eviction.
- Invalidation: logout and auth failures (`landlord-auth.js`), auth-coded read
  failures, and any successful non-read request through `CMWebsLandlordApi`.
  Writes sent directly through the Email bridge do not clear it; the notice and
  the immediate fresh read keep such views short-lived.
- Prefetch: after the homepage settles it warms tenants, rooms and (LINE only)
  arrears one at a time, skipping any snapshot younger than ten minutes. This
  adds at most three Apps Script reads per homepage visit.
- Tenants, rooms, arrears, properties and revenue pages load the LINE SDK only
  when a LINE session needs it; Email sessions never download it. A thin top
  progress bar appears on page-link taps.
- Contract requests are excluded: the page merges several sources and a
  partial snapshot could show an inconsistent signing state.
- Frontend release version advanced to `20261011-fast-navigation-v1` so every
  page fetches the new shared scripts together.

No Apps Script, route, schema or Production data change.
# 2026-10-12 C0 local read API boundary

The read-path environment lives under `cloudflare/read-api/` with pinned,
matching Wrangler/Miniflare dependencies and its own credential-free CI job.
C0 exposes only a read-only local health probe, with an all-zero D1 placeholder
and disabled public deployment routes. Schemas, synchronization, identity and
operational reads follow in their assigned work orders. Account login alone
does not establish paid-plan readiness or the correct provisioning account.
Google Sheets remains authoritative. Rollback of C0 only reverts source/CI.
# 2026-10-12 C1 candidate: signed snapshots and bounded projections

One JSON whitelist generates both Apps Script projection schema and D1 SQL.
The replica stores approved operational fields and scalar encodings; raw tokens,
bank data, identity documents and contract files remain excluded. Sheets retain
write authority. Exact-byte HMAC, bounded request bodies, atomic nonce reservation
and complete snapshot manifests protect ingestion. Batch staging does not expose
partial replacement; transaction guards recheck source ordering before deletion.

Dirty generations use brief ScriptLock sections, never network operations under
the lock. A changed marker survives a concurrent synchronization; failed tables
remain queued while independent tables continue. Successful dispatcher actions
use an explicit classification and dependency map instead of spelling-based
mutation detection. Unknown actions conservatively invalidate all projections.
Immediate session revocation is a patch with a pending failure result. Operational
authorization is gated on C3's freshness and fail-closed design. Remote three-day
acceptance, then seven-day shadow acceptance, remain independent requirements.

## 2026-10-12 approved read-replica boundaries and C6 acceptance

The owner authorized the bounded R0/S1/C0–C6 read-path plan and continuous
plan-scoped release after each gate. GAS/Sheets retain canonical writes and
access authority; D1 serves only approved sanitized read projections. Existing
rental identity/Workspace/RBAC remains canonical, without a second product login.
Summary opt-in for home/actions and tenants is approved; default/detail remains
full GAS. See `READ-PARITY-DECISION.md`.

Each Worker read requires uncached request-bound GAS authority confirmation,
matching current primary-D1 policy; mismatch/failure falls back to GAS. Actual
performance must pass before enabling a page. See `READ-AUTHORITY-DECISION.md`.
Only exact canonical ISO generation-clock paths within60s are separately visible
clock observations under owner approval; all business/source-row fields remain
exact. See `READ-CLOCK-DECISION.md`. Receipt-backed seven actual days are mandatory.

C6 switches rooms→tenants→properties→arrears→revenue→home with published-build
readback, authenticated timing, physical LINE/desktop and fallback/write-guard
evidence for each page. `READ-CUTOVER.md` is preparation, not acceptance. Keep
flags off/shadow when gates fail; preserve prior versions, additive metadata and
original formal data for rollback. These approvals do not weaken privacy, alter
billing/contract workflows or add V3/V4 functionality.

C6 comparison identity is generated from the browser/GAS/Worker/source-contract
closure and checked by validation and the bundled receiver. Asset cache/flag
releases are separate. Source changes invalidate observation; flags-only changes
retain the verified comparison epoch. Initial all-page qualification is saved;
later page checks require only that page's seven complete windows, including both
home sections, while all epoch failures remain blocking. Accepted on pages need
not continue producing shadow rows. Private acceptance ledger/readback/device
proof remains required; a source fingerprint does not prove live bindings.
