# Room 202 recovery, meter keyboard avoidance, and initial-rent proration

> **Execution model:** `gpt-5.6-terra`, medium. This is a V2.0 Production
> correctness and stability repair. It does not authorize a production deploy,
> schema migration run, or any change to room 302's live bills/payments.

## Scope and safety boundary

- Restore the paper-contract recovery schema migration so an orphan recovery
  can append a replacement contract with its required `previous_contract_id`
  link. The migration must remain additive, idempotent, and header-row only.
- Make `landlord-billing.html` reflow around the iOS virtual keyboard. While
  editing an input, hide the fixed action bar and bottom navigation, then bring
  the focused field into the visible scroll area.
- Make newly generated monthly rent reflect the inclusive overlap between the
  lease and bill month. This corrects a new lease starting or ending part-way
  through a month without overwriting an existing bill.
- Existing paid bills remain immutable. For room 302, an authorised landlord
  applies the proven August overcharge as a September `discount_amount` with an
  audit note; this plan never infers a refund or writes that adjustment.

## Tasks

- [x] Add a failing migration regression: a legacy `V2_contracts` header row
  without `previous_contract_id` must receive that header once, at the end,
  while contract rows stay unchanged.
- [x] Extend the canonical paper-backfill header constant and the release/API
  documentation, then run the focused migration regression.
- [x] Add a failing billing-page UI regression for keyboard-open action-bar and
  navigation hiding plus focused-input scrolling.
- [x] Apply the established keyboard handling pattern to `landlord-billing.html`
  without changing its normal desktop/mobile layout when no keyboard is open.
- [x] Add a failing runtime calculation regression for a 2026-08-07 lease start:
  an August 31-day bill uses 25 occupied days and a September bill uses the
  normal full monthly rent.
- [x] Add a pure calendar-overlap rent helper, integrate it into billing init
  and generation, preserve the monthly rent snapshot, and expose a clear
  calculation label for operator review.
- [x] Run focused tests, `npm run validate`, the full Node suite, and
  `git diff --check`. Report deployment and live UAT separately; do not deploy
  or migrate production without a new explicit request.

## Test examples

```js
assert.equal(result.data.added_headers.contracts.at(-1), 'previous_contract_id');
assert.equal(sheet.rows[0][0], 'contract-1');

assert.equal(proration.rent_amount, 25000 * 25 / 31 rounded to NTD);
assert.equal(september.rent_amount, 25000);
```
