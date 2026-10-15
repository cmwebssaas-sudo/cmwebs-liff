# C3 standalone synthetic trial

Recommended model/speed: GPT-6.1 Sol / high. Owner approved the single isolated
synthetic script on 2026-10-16, replacing the wrapper/library entry and the
previous rule that prohibited another execution after STOP. This is a bounded
C3 feasibility step, not permission to connect production data or activate reads.

## Approved change

Use one isolated API-executable script containing the existing guarded canonical
authorization closure. It has no Apps Script library dependency. Only the
synthetic script may be made visible to the designated test actor; no access to
the original project, library, production spreadsheet or original secrets is
introduced. The original projects do not need a temporary source replacement.
Provision a separate synthetic signing key through the owner; do not copy or
read back an existing secret. Account details and resource IDs remain private.

The generator retains the original three OAuth scopes, fixed caller and project
checks, canonical signed-envelope validation, and a single public authorizeTrial
entry. First-phase operation is compatibility only: authority, other operations
and extra arguments are rejected before business IO. Success returns only
compatible:true and does not read rows, cache, locks or external endpoints.
Execution API access ANYONE is not public anonymous access, nor sufficient
access control: OAuth Testing membership, actual caller identity and runtime
guards must all be verified. Local VM results do not prove Google's access model.

Historical wrapper/library artifacts and failure evidence stay intact. Their
generation remains supported for evidence and rollback comparisons; they are
not the new execution target. No old STOP, UNKNOWN or claim is edited or reopened.

## Accounting and execution

The cumulative limit remains 160, with 31 already spent and 129 remaining.
Existing original, continuation and diagnosis records remain byte-identical.
Any new execution record must link all three histories under the same canonical
lock and include their debits; it cannot reset or refill a separate counter.
Keep the original independent cleanup reserve (17) and any still-applicable
restore obligations separate and unavailable to normal operations. Do not
duplicate a cleanup that the original canonical ledger already records.

Before remote changes, finish the actual endpoint/UI operation map, including
account/tab verification, backup, deployment, owner-only credential work, full
before/after checks, one RPC, unknown-result readback and independent cleanup.
Count every actual HTTP request and UI read/write, including failures, before
execution. Reusing one response for several checks does not erase the request.
No unbounded navigation, retry or extra account/resource discovery is allowed.
Verify the correct actor/tab before starting the bounded trial window. Keep the
existing six-hour/same-Taipei-day bound, 10/minute, single in-flight, and the
non-refundable 360-second RPC charge. New grant/credential input stays owner-only.
Unknown RPC results are not retried or counted as success.

The fifteen pre/post safety checks must be mapped to real current observations,
not hardcoded booleans: original-project access, original-sheet access, fixed
synthetic ACL and metadata, source/closure and manifest pins, deployment/version
and access, GCP binding, OAuth client/Testing membership, caller and publisher
identity, fixed guard configuration and trigger state. Checks formerly about
the library now apply to the single synthetic artifact; original privacy and
unchanged-source checks remain. Freeze the explicit mapping and actual costs
before execution. Secret key presence is not proof that its value is correct;
use owner input and the signed compatibility result, without logging values.

If the complete operation map cannot fit the remaining 129 including cleanup,
or a required privacy check cannot be performed safely, stop before mutation
and report the exact missing condition. Do not invent another control framework
or spend the reserve to get a result. No paid service is opened by this change.

## Delivery and rollback

Work in the existing C3 worktree/PR. First add VM rejection/success tests, then
the smallest generator change, affected regression, independent review, full
regression, validate and provider CI. Existing artifacts must remain identical.
Only after these and the operation map pass may the synthetic script be
deployed and its immutable content read back. Send one compatibility RPC and
inspect its actual result and complete postchecks. Passing is only proof of
this entry; it does not prove authorization parity, privacy races or latency.

Cleanup disables the new deployment, removes only newly granted test access,
restores changed synthetic settings, revokes the trial credential, and reads
back the result under the retained independent cleanup path. Preserve synthetic
data and evidence. Unknown remote execution remains unknown after revocation.
No production data deletion, trigger, property, deployment or flag is needed.

After actual compatibility, continue C3 authority/privacy/revocation/freshness
and performance gates, C1's real daily-runtime gate, and C6 performance. Then
follow the approved READ-ACCELERATED-ROLLOUT.md: 24-hour parallel sync/shadow,
rooms first, another stable 24 hours before remaining pages, physical-device
acceptance and seven-day postlaunch observation. No observation window has
started merely because this design was approved or local tests passed.

## Current evidence

Generator and existing publication adapter now support the standalone artifact.
New VM cases and publication cases were observed RED then GREEN; affected
regression 116/116 passes. Independent review of both increments found no
actionable issues. Complete Node22/actual Core/owned PostgreSQL regression
2165/2165 passes without skip; isolated database/role cleanup and stopped
PostgreSQL were verified. Validate and provider CI are recorded in the execution
ledger. An earlier complete run was 2159/2161 with two existing realm-child
20-second timeouts; focused diagnosis passed both, but cause is unresolved.
Neither history is discarded. No new Google/browser operation, credentials,
resource, deployment, claim or counter debit. Actual operation mapping and
append-only execution wiring remain pending; there is no remote readiness claim.
