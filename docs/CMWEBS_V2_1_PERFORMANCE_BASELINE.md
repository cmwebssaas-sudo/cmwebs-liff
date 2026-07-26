# CMWebs V2.1 P0 — Stable Frontend Release Cache

Release candidate: `v2.1-p0-1`

## Scope

This P0 change replaces only static page-navigation cache-bust timestamps with
the stable frontend release version. API/JSONP anti-cache keys, callback
timestamps, LIFF IDs, API URLs, routes, query parameters, and hash fragments
remain unchanged.

Every static navigation lookup uses:

```js
(window.CMWEBS_RELEASE_VERSION || 'v2.1-p0-1')
```

`frontend-release.js` provides the shared value. The fallback preserves
navigation if that file is delayed, blocked, or unavailable.

## Verification

Run `node scripts/validate-static-release-cache.js`, `npm run validate`, and
`git diff --check`. The validator checks release-version fallback behavior,
query/hash preservation, retained API anti-cache keys, no bare release-version
identifier, zero static navigation `Date.now()` cache busts, and preservation
of `landlord-payment-report-review.html`.
