# Synthetic read-authority trial accounting

Recommended implementation model/speed: GPT-6.1 Sol/high; this is existing
V2 performance and authorization stability work, with no Production feature
or release change. The owner approved the replacement accounting on 2026-10-19.

The single replacement owner retains all 53 historical operations in a main
account capped at 160. A separate browser account has 56 ordinary operations
and 16 protected recovery operations; the combined ceiling is 232. This
explicitly increases the old combined ceiling. The main account conservatively
reserves 79 ordinary fixed operations, C2/I17/J2 recovery, and two unused units.
Unused reservations do not authorize additional ordinary operations.

Every actual browser primitive is separately prepaid, including inventory,
claim, navigation, observation, fill, click and submission. A pure local,
unsubmitted edit requires evidence before it may be logged without a debit.
The first readonly positioning phase has at most 16 browser operations and two
charged retries, before any write or RPC. Both accounts share a sliding limit
of ten operations per minute and one pending IO. UNKNOWN debits are never
refunded. The first durable debit fixes one six-hour, same-Taipei-day window.

The new ledger uses the existing canonical lock and one permanent epoch claim.
Old claims, stops, journals and source copies remain immutable. Its registry is
an independent recovery checkpoint; corruption of the ordinary mirror does not
reopen ordinary work. Original C/I debits still go through the original pinned
ledger. Native recovery requires both its protected main reservation and a
finite, ordered browser primitive map; an unknown primitive cannot be resent
under another ID or a reopened cleanup scope. A marker's presence always
vetoes ordinary work, including invalid or dangling markers.

`A:original-cloud-backup` is a native settings projection. Script API project
metadata does not return the GCP project number. The historical policies and
failed owners remain unchanged. The existing full safety driver accepts the
new owner without dropping any of its 32 before/after release checks, identity,
privacy, source, deployment, freshness or credential requirements. Native reads
use browser debits. RPC admission retains the nonrefundable 360-second charge.
A transport error, incomplete operation or malformed response permanently stops
ordinary work; only mapped bounded terminal verification and independent
recovery remain available. A fulfilled transport alone is not remote completion.

Local tests are not execution authority. Before external preparation, require
an immutable source/configuration closure, independent review, local validation
and exact-head CI. Each later stage needs its actual methods, destinations,
readbacks and recovery mapped within both remaining accounts. The complete
actual map and native safety/quota checks precede the one compatibility RPC.
Actual original-resource write eligibility is a separate source-pinned gate;
this accounting mechanism does not authorize restoring an untouched resource.

No Google compatibility, C3 authorization acceptance, daily runtime, Production
performance, device, sync/shadow observation or cutover result follows from
these tests. Flags and T0 remain unchanged. Existing owner-only credential,
login and new-access gates remain. Deploy only after the original acceptance
requirements pass; this change itself requires no Apps Script test execution,
Sheet change, credential, deployment or new service.

Rollback before execution: revert the local trial-controller increment; keep
all used artifacts and stopped claims. After execution begins, stop/drain the
actual owner and use only the pinned, independently reserved recovery map.
Never reset history, delete a claim, replay a write, or reopen an old owner.


## Approved one-time continuation of the expired readonly scope

The owner separately approved one successor on2026-10-19, retaining all65
operations (53 historical main,12 browser preparation) and the original STOP.
An optional strictly pinned continuation links the old journal, independent
registry, claim, STOP and settled drain to the new approval. Same canonical
path/epoch/binding/lock, fixed successor filenames and an independent singleton
prevent another successor or reset through a changed configuration.

Only an expired, drained, readonly predecessor with exactly12 settled browser
preparation events and two failures is eligible. Its event prefix and unknowns
remain byte-identical. The new owner retains failures2/preparation12, so only
four preparation operations remain and its first new read failure stops;
no observation retry is restored. Main160, ordinary browser56, browser recovery16,
combined232 and all protected recovery/unused reservations remain unchanged.
The first new durable debit fixes one six-hour, same-Taipei-day window.

The ordinary suffix differs from the original simple owner; the original
journal/claim/STOP/registry remain immutable and source-verified on every
command. Current recovery can use the independent successor checkpoint even
if its ordinary mirror is damaged, retaining the original C2/I17 reservations.
No RPC is admitted before the actual full map and all original safety gates.
This is local continuation support, not permission to bypass missing UI cost,
freshness, privacy, daily-runtime, provider/device or rollout acceptance.


## Explicit local-admission repair

An optional separately approved admissionRepair config admits only the exact
stopped66-operation incident: the complete13-event predecessor equals the
reviewed12-event prefix plus the one successful fixed trigger projection. Its
claim, registry, STOP, approval and every used source remain pinned/unchanged.
A fixed simple-admission-repair singleton retains the same canonical lock,
main53/browser13, failures2 and preparation13. Only three preparation reads and
zero observation retries remain. No path/epoch/binding/counter reset is allowed.

This repair preserves the originalw0 and expiresAt; it never starts a new
six-hour window. Ordinary admission requires more than the existing six-minute
RPC reserve to remain. Late readiness fails before claim/debit; independent
original C2/I17 recovery remains available after ordinary expiry. New direct
owner approval and exact-source tests/review/CI plus actual inert stage-manager
admission are required before private wiring may invoke this optional entry.

This is a local controller only, not a deployed feature or live-trial pass.
Rollback undeployed source to f2ff40a while preserving all used predecessor and
repair evidence. Local repairs never imply authority to renew an expired window.
