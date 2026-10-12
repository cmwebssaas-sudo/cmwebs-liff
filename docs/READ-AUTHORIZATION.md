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


## 2026-10-12 — Real Google feasibility and workerd redirect correction

Recommended GPT-6.1 Sol/high. The owner confirmed both new synthetic Secrets
saved. The independent bound test project was published as immutablev1, with
fresh editor/serving-version comparison of all10 files, fixed Sheet/project
identity, original test Web App readback and zero timers. Matching request and
response HMACs were verified by actual Email authority replies; Secret values
were never read back or logged. This changes no formal project or C1 environment.

Direct Node feasibility: all three canonical1500ms requests timed out; separate
15000ms diagnostics verified signatures/access successfully at3346.695,
4523.920 and5469.426ms full roundtrip. A separate protected Cloudflare test
Worker uses canonical identity/access/authority and a static33-row synthetic
fixture, no D1. Initial strict requests likewise all timed out; diagnostics
exposed an immediate failure constructing the second Google GET. Only changing
that diagnostic GET to manual yielded verified replies in2311–3294ms authority
time, while retaining every earlier failure and the unchanged acceptance limit.

Actual [workerd source](https://github.com/cloudflare/workerd/blob/main/src/workerd/api/http.c%2B%2B)
rejects redirect mode error. The canonical Google final GET and LINE provider
POST now use manual, followed by their existing exact200 check. No extra
redirect is followed, no token is forwarded, and the same1500ms deadline,
Google host/path allowlist, MAC/freshness/fingerprint and LINE claims remain.
Five actual-workerd transport regressions reproduced both former defects, then
passed: allowed Google reply, foreign first redirect, forbidden third hop,
LINE claims and LINE redirect rejection. Node identity/authority13, complete
Worker24, validate72 and independent review passed. This is a transport
correctness fix, not a timeout relaxation or provider/device acceptance.

The corrected canonical C3 modules were published only in the private test
Worker and its sole100% version/bindings/GAS URL read back. Strict1500ms still
failed3/3. Ordinary diagnostic replies passed3/3 at3073/3304/3386ms authority
and3241.605/3472.335/3553.702ms client time. Worker entry requests were served
from SJC; samples are not p95, full page latency,500-room capacity or formal
binding. The test-only GAS openById/getName/Property adapter and33-row fixture
remain explicit boundaries. Performance NOT_ACCEPTED; formal flags remain off.

Source-only tests used just the new synthetic Sheet, retained a narrow restore
plan and kept the deployed Worker fixture unchanged. Revoked Email session,
changed membership role and disabled user each produced three fresh signed
AUTH_REQUIRED denials over real Google HTTPS. These are15000ms diagnostics;
the normal1500ms path remains unavailable. They demonstrate current source
confirmation against stale static fixture access, not an actual remote D1
revocation, real LINE provider/device or shadow/cutover gate. All three edited
cells were restored and native bounded readback confirmed active/owner/active;
post-restore positive verification is recorded separately. No formal data,
configuration, source, deployment, triggers or C1 observation clock changed.
