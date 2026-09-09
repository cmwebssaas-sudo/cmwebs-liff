# Manual settlement timeout investigation

Recommended model/speed: gpt-5.6-terra / medium.
Base: c7fc2df5e2595e4637392fdd7842995484c11d42, isolated branch
codex/manual-settlement-timeout-20260909. Root dirty WIP untouched.

Authenticated Apps Script execution listing: version178 doGet at 16:41:01
took 62.84 seconds, followed by six reads at 16:42:01–16:42:30 taking
16–24 seconds each. Timing correlates with the user's manual-settlement
screenshot and the old recovery loop (3 rounds × 2 shared read attempts).
The listing does not identify the action or prove the payment committed.
Cloud log payload was unavailable. Actual room302 settlement remains UNKNOWN.

Proven flaw: client writes time out at60s; recovery then retries the entire
arrears projection with5s deadlines and treats disappearance as paid. Replace
with one authorized canonical bill/payment check. Keep writes blocked in the
current page while outcome is uncertain. Existing backend idempotency remains.
Add stage-only elapsed logs; no financial data in logs. No schema change,
financial mutation, LINE send or subscription integration during verification.

Local tests188/188. Targeted test was red before the status handler existed.
Explicit static validation has a preexisting nested cover-handler detection
failure; syntax, unique declarations, 88 unique routes and links pass.
Parent npm validator targets legacy files and is not candidate evidence.

Deployment authorized by the user on 2026-09-09 and completed below. This is uncertainty/retry protection, not proof that the original
write is faster. Follow-up needs serving phase timing and a genuine authorized
operation. Do not mark original performance issue resolved yet.

Release order when authorized: export and compare serving178/editor first,
deploy a new immutable backend version on the same URL, then publish frontend
and advance its release/cache marker. Roll back frontend before reverting
backend to178 (new frontend requires the new read route). Do not run a financial
write merely to test deployment. Reverting code does not undo payment records.

Pre-release: serving deployment is version178; independently exported editor
and immutable178 match each other and origin/main, 56/56 source files.
Release marker: 20260909-settlement-status-v1. Full188 tests and static release
cache validation passed again after advancing the marker. No financial testing
or messages authorized by this deployment.

## Deployment evidence

- Source commit ca5c8396725d94d867c45a0aaf9cb16c07a5bc9b.
- PR138 merged as e9007776bf71242185bb5bc154e9704c6fcfb29b.
- Existing Web App now serves immutable179; rollback178 retained. Export179
  matches all56 candidate files exactly. No URL or deployment permissions change.
- Read-only anonymous new-route probe returned MISSING_ID as expected, not
  account/financial data. This is not authenticated payment acceptance.
- Pages run34333318588 succeeded. Public landlord-arrears.html,
  frontend-release.js and landlord-home.html returned HTTP200 and their SHA256
  matched this candidate byte-for-byte.
- Full188 tests and static release-cache validation passed. Known legacy
  validator limitation remains documented above; no claim of a clean candidate
  npm validator or a live Apps Script transaction test.
- No payment, bank, account, schema, Properties, trigger or LINE-send operation
  performed. Mobile acceptance and actual write latency remain UNVERIFIED.
