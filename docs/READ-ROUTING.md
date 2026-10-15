# C4 centralized read routing

Recommended default: gpt-5.6-terra/medium. Current implementation keeps
GPT-6.1 Sol/high for the authorization, fallback and write-race boundaries.
Independent branch `codex/c4-read-routing-20261012`, stacked on C3. The owner
approved continuous execution; preceding actual release gates still apply.

`frontend-release.js` is the only Worker endpoint/flag source. Endpoint is blank
and all six flags are off in this candidate. Missing, invalid or unsupported
configuration is GAS-only. Test mode and unsupported detail/scope parameters
also remain GAS-only. Existing snapshot action/parameter keys are unchanged.

- off: existing GAS transport only.
- shadow: concurrent Worker/GAS reads; only GAS reaches the page. Background
  telemetry contains fixed route/outcome, redacted bounded field paths, header
  arrival milliseconds and full response/validation milliseconds. No compared
  values, UID, Workspace identifier, credential or arbitrary dynamic key is
  reported. Worker errors are distinct from a completed zero-difference read.
- on: Worker first, bearer only in Authorization, no credentials/caching or
  redirects. The three-second deadline includes body decoding/validation;
  HTTP, network, shape or timeout failure immediately falls back to GAS.

Successful writes persist a two-minute numeric deadline in local/session
storage and shared in-page state before resolving. Large read snapshots are
removed before saving the deadline to avoid quota-recovery gaps. This protects
the same Workspace across navigation and conservatively protects other
Workspaces in the browser for the same short interval; unknown Workspace state
cannot bypass it. Unusable guard storage fails closed to GAS. The API rechecks
the deadline after an in-flight Worker read, preventing a concurrent successful
write from accepting its older result.

Protected bridge POST observes success even on pages without the shared API.
Legacy LINE JSONP observes only its own already-declared callback through the
shared LIFF transport, preserving callback arguments and result. Read actions
follow the canonical sync policy; failed operations do not create a deadline.
The six actual page wrappers reach the shared API for both LINE and Email;
the existing arrears desktop write restriction runs before dispatch.

Candidate frontend release: `20261012-read-routing-v1`, synchronized across40
root HTML pages, shared assets, validator and affected release tests. No live
Pages publication or flag change occurred. C5 owns authenticated telemetry
storage/reporting and the actual seven-day shadow observation; C4's background
report transport alone does not prove remote report acceptance.

Release: finish C1, C2 and C3 gates; preserve prior immutable GAS/Worker/Pages
records, merge reviewed per-order PRs, publish this off candidate and read back
every changed public asset. Verify both credential flows and fallbacks before
setting one verified centralized endpoint. Start shadow only with the C5 report
receiver and recorded coverage. Every on flag additionally requires the agreed
actual authorization performance and device acceptance.

Rollback: set a page or all six flags off and republish/read back Pages; restore
the prior Pages release if needed. GAS remains the fallback and writes remain
on GAS. Retain D1 rows, additive schema, remote versions and observation records;
no formal data deletion is part of rollback.

## 2026-10-15 — Current C3 dependency composition

C4 retains its original routing, fallback,120000ms write protection, release
and off configuration while inheriting C3 source9b1af93. C4's54 own source/test
paths are byte-identical to2ed69c7; Worker/Apps Script/read fixtures match9b1af93.
The new full root regression is1731/1731; actual authenticated latency,72-hour
sync/seven-day shadow/device acceptance remain separate gates. No formal
publication or flag change. Local integration rollback target2ed69c7.
