# Accelerated shadow candidate evaluation

Recommended model/speed: GPT-6.1 Sol/high for evidence and release boundaries.
This implements the already approved24h shadow sampling criteria. It does not
start T0, establish C1/C3 acceptance, authorize cutover or change any live flag.
The original seven-window evaluator remains unchanged for its own evidence scope.

## Capture and evaluate

After actual T0 prerequisites pass, obtain a fresh verified private remote export
from the selected account/database/binding, scope, epoch and comparison version.
Record the raw export hash, exact source/deployment identity and cutoff privately.
Do not manually filter or rewrite its rows. Use the five shadowExportQueries;
construct the private input from their actual results:

```js
({ started_at, exported_at, epoch, release,
   rows: results[0].results,
   sample_rows: results[1].results,
   attempt_rows: results[3].results })
```

started_at is the verified actual observation start; exported_at is the exact
query cutoff in canonical UTC ISO. Both must match the selected real evidence,
not local test times. The evaluator requires cutoff<=actual now and at most five
minutes old. Migration0006 must precede the new Worker/export. Its auth_kind is
provider-verified line/email; unknown historical rows cannot prove channel
coverage. Samples use server read timestamps and existing opaque receipt UUIDs,
not delayed report time, self-reported identity, actor hashes or secret values.

```text
node scripts/evaluate-read-accelerated.mjs private-export.json expected-epoch expected-comparison-version rooms
```

The CLI always uses the actual current clock. Exit0 means only shadowEligible;
exit1 means candidate conditions failed; exit2 means malformed invocation/input.
It never changes a resource and always returns cutoverAuthorized:false. Invalid
input errors never print the raw file, secret text or receipt values.

## Candidate conditions

Evaluate the latest complete24h window aligned with actual T0. For example,
at T0+30h use [T0,T0+24h); retain current partial-window issues through cutoff.
Require at least20 real matched paired API observations for the selected page,
LINE>=10 and Email>=10, distributed across all three relative8h periods.
Home's20-page-sample minimum includes both home/actions sections; each section
must contain actual LINE and Email coverage. An ordinary comparison difference,
Worker error, unmatched/missing/pending attempt or unknown login kind in that
window or its current partial successor blocks that page's candidate.

Reconcile every exported sample count with its aggregate and matched attempts,
validate canonical server time/window and bounded timing fields, and reject
receipt reuse or invalid/missing evidence. Approved generation-clock differences
stay counted separately. Earlier and other-page issues remain visible in
excludedIssueGroups; they do not silently become passes or disappear. A page
may accumulate a new complete clean window after a prior defect, in accordance
with the approved per-page restart. Relevant source/comparison changes still
require a new matching epoch. Common synchronization/authority failures require
the shared stop/reset procedure; a local candidate cannot waive that review.

## Mandatory external gates

The function validates only the supplied structure, timing and consistency. It
does not authenticate export provenance, Workspace selection or the fact that
T0 prerequisites passed. All results, including exit0, explicitly require:
verified remote export/source/scope, shared failure review, actual C1 daily900s
and C3 privacy/authority/freshness acceptance, rooms-first ordering and another
stable24h, formal performance/device/rollback, and seven-day postlaunch evidence.
No caller may treat shadowEligible as permission to publish or switch on.
Actual postlaunch seven days require their own verified boundaries/coverage;
this24h result is never a substitute or a claim those days already happened.

Source/cache/comparison changes require new immutable deployment readbacks and
a fresh matching observation identity before real capture. No remote migration,
publication, formal data/credential change, Google operation, flag switch or T0
was performed for this implementation. All evidence here is local synthetic
verification until separately established by real provider/device observation.
Rollback source to the previous C6 candidate, preserving additive schema and
all old samples/failures/history. After real rollout, source revert alone does
not replace off/fallback publication and readback.
