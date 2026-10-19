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


## Approved clock for the same unused admission repair

The owner separately approved a clock-only amendment on2026-10-20. An optional
admissionWindow requires its own pinned direct approval in addition to the
unchanged original repair approval and exact stopped66-operation predecessor.
It uses the same simple-admission-repair singleton, canonical path/epoch/
binding/lock and all13 historical events. A consumed repair singleton cannot
be reopened by switching clock modes. Without the additional approval, the
original033 clock and expiry remain unchanged.

The amended entry starts with w0/expiresAt unset. Inspection, preparation and
waiting for CI do not start a clock; the first durable debit fixes at most six
hours, capped at that Taipei day's midnight. If six minutes or less remain at
admission, it creates no repair claim/journal/registry and may wait until the
next Taipei day. Once admitted, the same unique owner cannot be recreated or
automatically renewed, even if it has not yet debited. Expiry and any first
failed remote read still stop ordinary work permanently.

Imported main53/browser13, preparation13, failures2, combined232 and zero
remaining observation retries are unchanged. All source/test/review/exact-head
CI/inert-manager, actual full UI/recovery cost, privacy/freshness,900s/day,
formal performance/device and approved rollout observation gates remain.
Independent recovery retains the original C2/I17 reservations after ordinary
expiry or a damaged mirror. This local clock mode provides no live acceptance,
new credential/access, paid resource, formal data access or Production change.

Rollback the undeployed clock-only increment to0c28e31; retain all historical
and consumed artifacts. A local mode change does not authorize an expired or
consumed actual owner to resume.

## Approved bounded readonly diagnostic successor

A separately approved readonlyDebug mode admits exactly one new singleton from
stopped68 (main53/browser15), preserving all15 events, failures3, old sources,
claims, STOPs and the verified drained owner. It uses the same canonical lock,
path, epoch and binding. Admission/inspection do not start its clock; its first
durable debit starts at most six hours, capped at Taipei midnight, with the
existing six-minute preclaim reserve. Consumed namespaces never reopen.

Only eight additional readonly preparation primitives are available: total
preparation23, within ordinary browser56, separate recovery browser16 and total232.
HTTP/API operations still use their original main-account fixed aliases and
reservations. Imported IDs cannot be replayed and all debits/failures remain.
At most two new settled UI-preparation failures can remain eligible, only with
an exact fixed proof of verified target and a projection failure after URL,
ready-state and section guards passed. PAGE/HEADINGS/DECODE, generic POSTCHECK,
unclassified evaluate rejection, missing target proof, non-readonly operations,
unknown IO, source/binding drift and any mutation/RPC failure never qualify.
The third qualifying failure or an exhausted preparation cap stops work.

The private fixed producer emits only enum diagnostics and rethrows qualified
failure through the holder as READ_FAILED; it never turns a failed observation
into success. Each used source stays immutable; a reviewed unused stage needs
its own unused event ID. A diagnostic mode does not authorize RPC retries,
new API probes, credentials or formal access. Full actual stage/cost/recovery
mapping and every live privacy/freshness/runtime/performance/device/observation
gate still apply. Independent C2/I17 recovery remains available after expiry or
ordinary-mirror damage. Undeployed source rollback is494c592a; never roll back
or rewrite consumed counters, source packages or failure history.
