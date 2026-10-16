# C3 authority decision — owner approved

Recommended model/speed: GPT-6.1 Sol/high. This is a proposed amendment to the
approved C3 design. On 2026-10-12 the owner approved adding the GAS confirmation
and required actual performance acceptance before enabling a read flag. This
document records design authorization, not implementation or production proof.

The current implementation verifies LINE provider claims, Email session HMAC,
and current primary D1 user/Workspace/membership/principals for each request.
The production dispatcher remains closed. A successful session revocation
patch is immediately enforced by subsequent primary D1 reads.

There is an unresolved failure boundary: if an authoritative GAS revocation or
access change happens and its synchronization request never reaches D1, a
Worker sees the same stored state as when the source has no changes. Snapshot
timestamps, a later unrelated session patch, or the daily full reconciliation
cannot prove that a particular credential is still authorized. The existing
two-minute write guard protects the writing browser; it cannot invalidate an
old credential replayed in another browser. Tests must cover this boundary.

## Proposed minimum amendment

For each actual user read, Worker first obtains an uncached, request-bound GAS
authorization confirmation. Background idle triggers remain unchanged and
perform no new network, Sheet or Properties operations.

1. Add one internal POST action to the existing GAS deployment, documented in
   the API matrix. Accept only a strict request body and a timestamp/nonce/HMAC
   envelope from the Worker. Reuse the configured synchronization HMAC secret
   with separate request/response domain prefixes; values stay in Properties
   and Worker Secrets. Verify freshness and reject replay. Never log the body,
   credential, HMAC, session hash, or returned identity.
2. GAS independently verifies the existing LINE ID token or Email session with
   the current authoritative modules. It resolves the current user, active
   Workspace, membership, role, permissions and landlord principals. Identity
   and Workspace are never accepted from client query fields or Worker claims.
   A revoked/inactive/expired/ambiguous identity returns a sanitized denial.
3. Return only the minimum authorization fingerprint, signed over the exact
   serialized response and bound to the Worker nonce, credential digest and
   requested read route: actor user/LINE IDs,
   Workspace ID/status, membership ID/status/role, existing permission booleans,
   and ordered principal IDs/LINE IDs. No operational rows, contact information, payment
   data or contract content are returned. Do not cache positive authorization.
4. Worker still verifies its provider/session path and current primary D1
   policy. It compares the signed authoritative fingerprint with the resolved
   D1 fingerprint. Any mismatch, invalid signature, timeout or failure produces
   a controlled error for the existing frontend GAS fallback. The two-minute
   write guard still forces GAS before any Worker request; authorization does
   not prove that operational data has synchronized or cancel that guard. It must never
   use a broader replica role or scope than the authoritative confirmation.
5. Only after both checks agree may D1 run the existing read calculator. A
   concurrent authoritative change after confirmation has the normal boundary
   of an in-flight authorized request. The next request must confirm again.

This adds one GAS round trip per attempted Worker read and therefore changes
the original direct Worker/D1 performance assumption. It may still reduce GAS
work by avoiding the large operational-data calculations; that benefit is
unverified. Measure authenticated end-to-end latency, GAS usage and the existing
three-second fallback before enabling a page. If those gates fail, keep the
affected page off or shadow and do not declare C6 complete.

Required tests include an undelivered revocation patch, undelivered user/member/
Workspace disable or role change, unrelated newer sync runs, forged/replayed
confirmations, wrong actor/Workspace fingerprints, unavailable GAS, and a change
between confirmation and the next read. Both LINE and Email must be covered.

Alternative: keep the current operational Worker routes closed and continue
independent C4 flag/fallback and C5 instrumentation preparation. A different
short-lived credential or ACK-before-commit protocol requires its own approved
design and must not be implemented implicitly.

Rollback: disable all read flags, return to existing GAS reads, close the Worker
read dispatcher, restore the previous Worker/GAS version and remove only the
new internal action configuration if necessary. Retain replica data, exports,
existing Properties and existing trigger definitions.
