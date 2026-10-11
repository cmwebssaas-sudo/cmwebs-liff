# C3 authorization implementation plan

Recommended model/speed: GPT-6.1 Sol/high, per the approved work plan. Independent
branch `codex/c3-read-api-auth-20261012`, base C2 `91da898`. C1 actual observation
continues; no production/auth credential publication is authorized by this
document alone. The user's current batch authorization controls release gates.

Implement and test before enabling an operational path:

1. Strict Authorization header parsing. Verify LIFF ID tokens with LINE's
   provider endpoint and the configured login channel, checking issuer, audience,
   expiry and subject. Cache only successful claims under credential SHA-256,
   at most five minutes and never beyond actual expiry. Do not cache access.
2. Email session hashing must exactly match GAS HMAC-SHA256 of `session:` plus
   trimmed token. Worker secret name `EMAIL_SESSION_HMAC_SECRET` corresponds to
   the existing `CMWEBS_EMAIL_LOGIN_HASH_SECRET`; values are never read/logged
   in this work order. Resolve one session, status, expiry, revocation, current
   user Email eligibility and matching active Workspace/role on every request.
3. Reuse canonical read-only Workspace/context/principal/permission helpers.
   Reject missing/inactive users, Workspace, membership, incomplete onboarding,
   and roles outside the existing six landlord membership roles. Use only
   server-verified identity and current stored active Workspace. No client
   query field can choose identity or widen scope.
4. D1 queries load authorization rows first, then only approved Workspace rows
   and explicit existing legacy ownership/property relationships. Users are
   global identities, selected only by referenced IDs. Retain source order and
   scalar/Date types. Tests include malicious cross-Workspace shared-ID fields.
5. Owner approved `READ-AUTHORITY-DECISION.md` on2026-10-12. Each user read now
   requires an uncached, request-bound GAS confirmation, identical to the
   primary D1 authorization fingerprint. A successful revocation patch is
   enforced by D1 immediately; a patch that never arrives is denied by the next
   authoritative confirmation. Incomplete snapshots, a newer receiving run,
   snapshots older than26 hours, or source dirty/sync markers produce fallback.
   No new idle trigger IO is introduced. This is not proof of synchronization
   of manual Sheet edits. Re-measure actual authenticated latency and usage.
6. CORS allowlist is only `https://cmwebssaas-sudo.github.io`; JSON failures
   contain no credential, row or stack. Test missing/forged/other-user/expired/
   revoked/replayed tokens, disabled accounts/Workspaces/memberships, role and
   scope tampering, provider/cache/network failure, and repeated access changes.

No live secret, OTP, formal row or production setting is read or modified during
local implementation. Use synthetic credentials and actual local workerd/D1
tests. Cloud publication needs completed preceding gates, independent review,
credential presence/binding readback and authenticated/device acceptance.
Rollback keeps C4 flags off/GAS and restores the prior Worker version; retain
replica/export/schema data. If source-derived room bridge capability is false or
missing, rooms remains a controlled503 for GAS fallback.

Implementation uses primary D1 sessions, bound query values and static schema
identifiers. Operational tables never enter JS before authorization. Explicit
foreign Workspace rows and legacy rows anchored to a known foreign property,
room or contract are excluded. Corresponding canonical GAS scope helpers share
the same parent rule so fallback and field parity retain the boundary. A
request-local parent map avoids repeated Sheet scans; it is never shared across
requests. Pure fingerprint extraction reuses the canonical GAS permission
helper rather than a separate permission table.

Write-mode property/room filters build a lazy three-table parent map once per
filter invocation. A later filter rereads the parents, including after a write;
write snapshot/shared cache stays disabled. Counted-read regression covers ten
legacy rows, a subsequent foreign-parent change, and all-explicit rows.

Schema extension0003 adds existing Email eligibility metadata. The generator
reads all existing migrations and appends only uncovered additions; it never
rewrites a previously provisioned migration. Production configuration and real
credentials remain untouched. Source completion, CI, remote readback and real
device/performance acceptance are separate gates.

Release sequence and readback:

1. Finish C1's actual72-hour correctness/runtime gate, then provision and verify
   the approved C2 projection. Apply additive migrations in order; retain the
   current replica and deployment records before changing any binding.
2. Publish the reviewed canonical GAS source as a new immutable version on the
   existing Web App URL. Read back editor and serving-version bytes, route
   presence, authorization failures and unchanged operational reads. Retain
   the previously serving immutable version and all other deployment URLs.
3. Use an independent synthetic C3 candidate to verify real Google redirects,
   request/response HMAC, immediate source-only LINE/Email revocation and current
   permissions. Do not change the ongoing C1 observation environment.
4. Configure the original verified GAS URL/channel and required secrets through
   approved credential handling. Verify presence and bindings without reading
   or logging values. Publish/read back Worker version, D1 schema and closed
   flags, then measure authenticated latency and usage before enabling any read.

Rollback: keep all frontend flags off or republish the recorded off release;
restore the prior Worker version and prior GAS immutable serving version on
the same URLs. Retain additive D1 schema/rows and exports for diagnosis. Do not
delete formal Sheets data. Configuration removal is unnecessary to fall back.
