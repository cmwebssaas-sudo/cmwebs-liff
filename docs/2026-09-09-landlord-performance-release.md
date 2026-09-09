# Current-system performance repair

Recommended model/speed: gpt-5.6-terra / medium.

Scope: current Apps Script/Sheets stability. Dedicated API/database and Unified
Platform integration remain deferred. No financial records or notification
configuration changes.

Baseline: origin/main dad3771. Production serving Apps Script version 177 was
exported and all 56 files matched origin/main exactly. Editor HEAD separately
exported for comparison before release. Root checkout is dirty and untouched.

Changes: POST request-local sheet read reuse; home/actions split on existing
bootstrap; remove redundant serial Email status request (protected route still
validates session); shared frontend read deduplication; immediate refresh busy
feedback; transient failures preserve current-page contents with warning;
authorization failures clear content. No browser persistence of financial data.

Verification: full Node suite 187/187; dedicated runtime mocks cover both sections,
duplicate refreshes, failed optional modules, and POST snapshot isolation.
The legacy parent validator cannot be used as a clean candidate validation:
expected 71 routes vs current 87 and nested cover handler detection is stale.
Actual authenticated latency is UNVERIFIED; Chrome automation dispatch itself
timed out. No claim of App-like speed from source/HTTP checks alone.

Release order: deploy immutable backend version first (old frontend compatible),
then merge/publish frontend. Rollback backend to version 177 on the same deployment
URL; revert this PR for Pages. If rolling backend back first, section-less old
behavior remains compatible, though reads become heavier again.

## Deployment evidence

- PR #136 merged as `4dda11ae77504eff405a7e09bbf3434212db65ee`.
- Serving Apps Script deployment updated to immutable version **178**, with the
  existing Web App URL unchanged. Re-export of version 178: 56/56 files exactly
  match candidate source. Editor HEAD before push matched serving v177.
- GitHub Pages run **34328288321** completed successfully.
- Public `landlord-home.html` and `frontend-release.js` return HTTP 200 with the
  new progressive-home markers. Source identity is not authenticated acceptance.
- Final full Node suite 187/187; static release-cache validator passed after
  advancing its release marker with this approved release.
- Still UNVERIFIED: logged-in first-render latency, real mobile LIFF interaction,
  and other pages' timeout rates. This is the first scoped repair, not a claim
  that all Apps Script latency or timeout sources have been eliminated.
