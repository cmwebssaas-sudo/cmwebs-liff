# Billing Submit Lock and LIFF Renewal Design

**Goal:** Prevent any repeat submission from changing an already-created monthly bill, and recover the landlord bill-notification page from an expired LIFF access token without losing its selected month.

## Scope

- Local candidate only. No Apps Script deployment, GitHub Pages publication, Git push, Production-data mutation, LINE message, Property, or trigger change.
- Preserve the existing `landlord_bills_generate` route and its Workspace/RBAC checks.
- Treat a bill as already created when an existing bill row has the same Workspace-visible `room_id` and normalized `bill_month`, regardless of its payment state or which authorized landlord submits the request.

## Architecture

### Immutable bill-generation boundary

`generateLandlordBillsByLineUid_` already resolves the caller's Workspace access and holds a script lock. Before calculating a selected item, it will inspect the existing bill index for that room and month. If a row exists, the item will enter `skipped` with `BILL_ALREADY_CREATED_LOCKED`; it will not calculate or write the bill, sync bill views, update the room meter fields, or emit a bill-created notification for that item.

The response retains `generated`, `skipped`, and count fields. A fully locked selection returns a successful explicit `BILLS_ALREADY_CREATED_LOCKED` result with a message that no data was changed. A mixed selection creates only rooms without an existing monthly bill and reports the locked count. Existing explicit correction, cancellation, or payment workflows remain the only way to change a historical bill; this change does not create a new edit route.

### Frontend success state

`landlord-billing.html` will display distinct result text for a fully locked selection and include the skipped count for a mixed response. It will reload the page data after a successful response, as today. The create button is still disabled while a request is outstanding; repeat submission after completion is harmless because the server remains the enforcement point.

### LIFF expired-session recovery

`landlord-bill-notifications.html` will preserve the current page path and query parameters with its existing `buildLandlordLoginRedirectUri`. If `liff.getProfile()` rejects because its access token is expired, the page will call `liff.logout()` when available and begin one LIFF login redirect using that same sanitized return URL. A per-tab one-attempt guard prevents an unexpected non-token error from becoming an infinite login loop. Other initialization errors remain visible through the existing error renderer.

## Error Handling

- Repeated bill creation is a normal, successful no-write outcome, not an error and not an update.
- A partial batch can contain newly created and locked items; only newly created items are counted for team notification and audit metadata.
- Any token error that is not clearly expiry-related remains an explicit load error.
- If the one renewal attempt has already occurred, the token error is rendered rather than redirecting again.

## Testing

- A runtime-focused Apps Script fixture will prove that re-submitting a bill for the same room/month returns `BILL_ALREADY_CREATED_LOCKED`, makes no write, and does not alter meter values.
- The same fixture will prove a mixed batch creates only the new room and preserves the historical one.
- A frontend-focused test will simulate an expired `getProfile()` rejection and assert a single re-login redirect that retains `bill_month`; it will also prove non-expiry errors do not force a login loop.
- Existing route compatibility, Workspace filtering, and syntax checks will be included in the final local validation.

## Non-goals

- No actor-specific exception: even the original creator cannot resubmit through the meter-reading entry page.
- No change to existing bill correction, cancellation, payment, notification configuration, LIFF settings, Sheets schema, or historical records.
- No deployment or external verification in this candidate.
