# C3 bounded continuation implementation

Recommended model/speed: GPT-6.1 Sol / high for authorization, durable accounting,
and rollback. V2 read-performance work only. Execute in the existing C3 worktree
and draft PR; preserve the root WIP and all earlier trial history.

## Authority and constraints

The owner approved the separately retained decision with SHA-256
`f227ebbf2ca791d521e0008a639c2fa4ecb31e5be793478c45ffee47b420c92d`.
This plan implements that decision; it grants no additional access or execution.
The cumulative management-operation cap remains 160. The stopped original claim,
deadline, unknown outcomes, stop artifacts, controller and recovery remain.
There may be exactly one linked continuation segment under the original lock.
No second attempt, refund, new scope, source Viewer, production data or fee.

One ordinary compatibility RPC has a durable, non-refundable 360000ms upper-bound
charge. This is not measured native runtime, available quota, proof of no other
executions, or acceptance of the later actual daily-runtime gate. The sole RPC
requires the complete fixed source closure to exclude nested RPCs, Web Apps,
triggers and external background work. Success requires done:true, no error,
compatible:true and all fifteen postchecks. Missing proof means STOP/UNKNOWN.

One W0 starts durably before the first new Google IO. All preparation, readonly
preflight, offline wiring, owner credential work and the RPC share its deadline:
at most six hours, within the same Taipei day. Do not renew or extend it.
Formal flags remain off, endpoint blank, rollout T0 not started. The approved
24h parallel sync/shadow and seven-day post-launch observations still apply.

## Task 1: Offline operation-cost compiler

Files: `scripts/read-authority-continuation-plan.mjs` and its focused test.

Produces: an immutable explicit policy and a pure compiler for the proposed
one-unit low-level IO map. It must distinguish local/preflight readiness from
actual authorization. Fixed A-E48, F30, H1 and I17 remain; original C restoration
aliases are included in C9. Add P4, same-token G4, N24 (at most8 research), T3,
and two unused units. Historical spent is retained, not reset or refunded.

1. Write behavioral failure tests for wrong decision/history, missing fixed IO,
   unknown or aggregated low-level costs, duplicate aliases, wrong actor/target,
   mutation paid by N, research overflow, and claims that upper-bound runtime
   satisfies actual runtime/quota gates. Run them before implementation.
2. Implement the compiler without changing any old decision selector or driver.
3. Run focused tests and existing budget-plan tests. Expected: all pass; unknown
   actual UI costs remain explicitly ineligible for credential/RPC admission.

## Task 2: Canonical linked accounting and stop ownership

Consumes: Task1 policy; original counter and authoritative checkpoint.
Produces: exactly one linked journal under the same canonical lock; a preparation
control facade for the new segment and independent C2/I17 recovery.

Before code, resolve old cleanup versus frozen-history/global-once accounting.
Use real disposable files/child processes to test locking, lost ownership,
checkpoint rollback, torn writes, history drift, second claims, duplicate IO,
both old/new stop paths, timeout/day boundary, and cleanup after failure.
No test may use or modify the actual private counter. Every debit is durable
UNKNOWN before the external callback; a callback ACK is not remote acceptance.
Reserve cleanup independently, preserve all original artifacts and exclude a
second global use of fixed cleanup aliases. Owner stop must deny new ordinary
IO while permitting only already-authorized independent recovery.

## Task 3: One-RPC driver and actual adapter wiring

Consumes: Tasks1/2; the retained source, privacy and original restoration adapters.
Produces: a separately selected bounded driver that preserves every pre/post
source check and same-token identity check, signed transport and independent
recovery, replacing only the explicitly retired first-stage native windows.

Test real control/driver compositions including stop races, source drift,
transport rejection, done:false, incompatible result and incomplete postchecks.
Do not synthesize native proofs to satisfy the old driver. Prepare and pin the
independent recovery copy before any Google IO. After one review and local
validation, start W0 and perform only two P bindings and at most eight counted N
readonly preflights. No credentials, grant, Properties, publication or RPC until
the remaining actual low-level IO is completely mapped, wired and fits160.
If it does not fit or the single preflight fails, stop this method and recover.

## Validation, review and release boundary

Use focused RED/GREEN tests per behavior and one full root regression after the
coherent change with the existing isolated Core/owned PostgreSQL fixture.
Run npm run validate and git diff --check. One independent review of the coherent
implementation, then one tested correction pass for material findings. Record
test matrix and execution evidence without private identifiers or values.
No unchanged repeated capacity runs; existing C6 CI failures remain evidence.
Commit/push the C3 draft only after observed verification. No merge, production
deployment or flag change until all actual upstream acceptance gates pass.

Rollback: stop new admissions, drain already-entered IO, use the pinned independent
C2/I17 recovery, retain all charges and unknown outcomes. Software rollback is a
revert of this C3 change; it cannot remove the private continuation history or
re-authorize the stopped original trial.
