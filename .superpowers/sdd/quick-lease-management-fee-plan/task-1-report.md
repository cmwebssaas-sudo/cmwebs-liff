# Task 1 report — editable management fee in simple quick lease

## Scope and boundary

- Recommended execution model/speed: `gpt-5.6-terra`, `medium`.
- Changed only the simple `mode=new` renderer in `landlord-tenant-create.html`
  plus its focused static regression coverage and the existing simple-flow copy
  assertion.
- The advanced renderer, room-defaulting handler, submit action, and backend
  `management_fee` contract were preserved. No Apps Script, schema, deployment,
  external account, or Production-data action was performed.

## TDD evidence

### RED

1. Added `簡易快速租約讓房東編輯房間預設管理費並保留送出契約` to
   `tests/phase261-landlord-more-quick-lease.test.mjs` before modifying
   production code.
2. Ran `node --test tests/phase261-landlord-more-quick-lease.test.mjs`.
3. Result: `2` passed, `1` failed as expected. The new test could not find the
   required visible numeric `managementFee` input because simple mode rendered
   `<input id="managementFee" type="hidden" ... />`.

### GREEN

1. Replaced only that simple-mode hidden field with a visible numeric
   `managementFee` input (`min="0"`, `step="1"`) initialized from
   `roomDefaults.management_fee`.
2. Kept `handleSimpleRoomChange()` defaulting through
   `setInputValue('managementFee', defaults.management_fee)` and kept the
   existing `management_fee: inputValue('managementFee')` submit payload.
3. Clarified the simple-flow hero, section text, confirmation, and room summary
   that management fee is room-defaulted but editable.
4. Corrected the test's source slice assertion to inspect the existing
   room-change handler outside the renderer; this did not change production
   code or the asserted behavior.
5. Ran `node --test tests/phase261-landlord-more-quick-lease.test.mjs`:
   `3/3` passed. Then ran the focused pair including Phase 208:
   `4/4` passed.

## Verification

| Command | Result |
| --- | --- |
| `node --test tests/phase261-landlord-more-quick-lease.test.mjs` (RED) | Expected failure: hidden-only management fee field. |
| `node --test tests/phase261-landlord-more-quick-lease.test.mjs` (GREEN) | Pass: `3/3`. |
| `node --test tests/phase208-simple-landlord-contract-flow.test.mjs tests/phase261-landlord-more-quick-lease.test.mjs` | Pass: `4/4`. |
| `npm test` | `243` tests: `241` passed, `2` pre-existing failures unchanged. |
| `npm run validate` | Pass: `57` backend files parsed, `37` endpoint references matched, static release-cache validation passed. |
| Extracted inline script + `node --check` | Pass. |
| `git diff --check` | Pass. |

## Known baseline failures

The complete Node suite retains the two documented pre-existing failures from
`docs/09-TEST-MATRIX.md`; neither intersects this frontend quick-lease change:

1. `tests/landlord-post-read-snapshot.test.mjs`: expected `true`, got
   `undefined`.
2. `tests/phase246-landlord-post-read-bridge.test.mjs`: `landlord_arrears`
   expected `bridge`, got `fallback`.

## Commit and release boundary

- In-scope files are `landlord-tenant-create.html`,
  `tests/phase208-simple-landlord-contract-flow.test.mjs`,
  `tests/phase261-landlord-more-quick-lease.test.mjs`, and this report.
- The task commit is local only. No push, merge, deployment, or release action
  is authorized by this task.
