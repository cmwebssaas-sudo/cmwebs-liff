# Durable readonly preparation

Recommended model/speed: GPT-6.1 Sol/high for accounting and authorization controls.

The owner-approved continuity mode replaces the previous preparation sublimit
and single preparation window. It imports the settled72 checkpoint once into
`.simple-readonly-continuity`, retaining every old stopped file and failed event.
It does not reopen any historical owner. Main160, ordinary UI56 and independent
recovery UI16 remain separate; imported usage is main53/UI19. No remote IO is
performed by the ledger or by constructing the live holder.

## Preparation and trial

`prepareReadonly` declares a named finite list of fixed readonly UI operations
and a remaining ordinary UI reserve before any such IO. Every operation is
predebited and unique; declarations, unspent observations and the largest
retained reserve must fit ordinary UI56. Only the eight previously approved
settings/triggers/OAuth/executions targets and N:preparation/N:navigation are
eligible. Exact private tab/profile/account/URL guards and source review remain
required. This declaration is a bounded preparation allocation, not proof that
the complete actual trial map is ready.

PREP may cross days. It does not start or extend the trial clock. A NOT_READY
observation must return at the readiness guard before fields are read, after
exact target/account/binding proof. It remains unsuccessful, is charged, gives
no baseline credit and consumes no technical repair allowance. At most two new
settled fixed-projection/decoder technical failures may remain recoverable with
complete target/account/binding/pure-read/terminal proof. That count survives
pauses, holder changes and days. Raw errors or legacy error tags alone never
qualify. Unknown IO, target/account drift, a third technical failure and any
write/RPC failure hard stop ordinary work.

The complete actual map, reviewed stage costs/time/freshness and independent
recovery reserves must fit before non-PREP IO. Main HTTP/API, credentials and
mutations cannot be labelled PREP. The first ordinary non-PREP durable debit
atomically starts TRIAL: at most six hours and the Taipei-day midnight. With
six minutes or less remaining it is refused without that debit. TRIAL cannot
pause back into PREP, reset its clock or retry a write/RPC. Existing credential,
identity, quota, privacy, freshness and360s RPC reservation checks still apply;
PREP evidence does not substitute for fresh trial prechecks.

## Safe holder handoff

`pausePreparation` requires no pending IO and every event settled, with no
mutation/RPC or hard stop. It closes the current capability to further IO and
records CLEAN_PAUSE. The live holder drains owned tasks, closes the ledger child
and releases its canonical lock before writing a unique HANDOFF_CLOSED receipt.
The receipt pins the latest journal, independent registry, event count and old
holder. Merely exiting a process, releasing a lock, or having an old screenshot
is insufficient.

A replacement holder takes the same exclusive canonical lock and validates
those exact current bytes, claim identity, original sources/approval/epoch/
binding, high-water mark and settled state. It appends its owner hash in the
same namespace and continues the latest spend and repair count. It never
reimports72. Stale receipts, pending IO, mismatched mirrors or HARD_STOP cannot
resume. Reclaim/navigation/read operations remain separately charged; this
mechanism grants no new browser inventory, target or account access.

## Verification and rollback

Real disposable-ledger tests exercise accounting, clocks, qualified failures,
handoff and independent cleanup; live-holder tests prove actual callback drain
before a receipt. Exact source HEAD CI, independent review, private source pins,
private affected tests and inert admission are prerequisites to real IO. Tests
and this protocol are not actual Google acceptance. Apps Script and Worker
runtime are unchanged in this patch, so no cloud test function is introduced.

Independent cleanup retains its existing main/UI reserves and remains usable
after STOP/expiry or damaged ordinary mirror. It never grants a new trial clock.
Rollback an unused controller candidate to the prior source commit; retain all
used source, ledgers, STOP markers and receipts. A used persistent session cannot
be migrated to changed runtime merely by editing its source pins. Formal daily
quota, performance, real-device, rollback and approved rollout observation gates
remain required before enabling any production page.
