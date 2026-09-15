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

## Fix round 1 — preserve zero and reject negatives

### Reviewer finding and root cause

The visible simple-flow input allowed `0`, but the simple backend resolver used
one `> 0` fallback rule for management fee and replaced a submitted `0` with
the room default. The simple frontend validator did not inspect management fee,
and the backend normalizer did not reject a negative value. This affected only
the new simple-flow management-fee path; the advanced flow remains unchanged.

### TDD evidence

1. Before production edits, added behavior-level cases to
   `tests/phase208-simple-landlord-contract-flow.test.mjs` that run the real
   normalizer and simple default resolver. They assert a submitted `0` remains
   `0` (including the initial-paid total) and `-1` returns
   `CONTRACT_INITIATION_INVALID`.
2. Also extended the focused simple-renderer test to require the simple
   frontend management-fee validation branch.
3. RED command:
   `node --test tests/phase208-simple-landlord-contract-flow.test.mjs tests/phase261-landlord-more-quick-lease.test.mjs`.
   It failed as expected: submitted `0` resolved to room default `500`, and the
   frontend validation was absent.
4. GREEN implementation:
   - The normalizer records whether simple input explicitly supplied a
     management fee and rejects simple values below `0`.
   - The simple resolver uses the room default only when management fee was not
     supplied, preserving explicit `0`.
   - The simple frontend rejects non-finite or negative management fee before
     submit. The advanced flow and API/schema fields were not changed.
5. GREEN command rerun passed `4/4`.

### Fix-round verification

| Command | Result |
| --- | --- |
| Focused Phase 208 + Phase 261 tests | Pass: `4/4`. |
| `npm test` | `243` tests: `241` passed; only the two documented baseline POST/read bridge failures remain. |
| `npm run validate` | Pass: `57` backend files parsed, `37` endpoint references matched, static release-cache validation passed. |
| `node --check apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js` | Pass. |
| Extracted `landlord-tenant-create.html` inline script + `node --check` | Pass. |
| `git diff --check` | Pass. |

The unchanged full-suite baseline failures are
`tests/landlord-post-read-snapshot.test.mjs` (`undefined` vs `true`) and
`tests/phase246-landlord-post-read-bridge.test.mjs` (`fallback` vs `bridge`).
They do not intersect the amended simple-lease management-fee path.

## Fix round 2 — reject malformed management fee

### Root cause and TDD evidence

`management_fee_provided` correctly distinguished explicit `0` from a missing
value, but `landlordInitiatedContractNumber_` intentionally converts malformed
text to `0` for legacy normalization. Thus a non-empty simple-flow value such
as `abc` was marked provided and silently treated as explicit zero.

1. Before production edits, added a real normalizer behavior case in
   `tests/phase208-simple-landlord-contract-flow.test.mjs` for
   `management_fee: 'abc'`. It expects
   `CONTRACT_INITIATION_INVALID`.
2. RED command: `node --test tests/phase208-simple-landlord-contract-flow.test.mjs`.
   It failed as expected because the malformed input returned `success: true`.
3. The minimal fix retains the shared legacy number normalizer and adds a
   simple-flow-only finite-number check for non-empty management-fee text,
   after comma removal to match the existing parser. It now fails closed with
   `CONTRACT_INITIATION_INVALID`; explicit numeric `0`, negative-value
   rejection, advanced flow, API fields, and schema remain unchanged.
4. GREEN command:
   `node --test tests/phase208-simple-landlord-contract-flow.test.mjs tests/phase261-landlord-more-quick-lease.test.mjs`.
   Result: `4/4` passed.

### Fix-round verification

| Command | Result |
| --- | --- |
| Focused Phase 208 + Phase 261 tests | Pass: `4/4`. |
| `npm run validate` | Pass: `57` backend files parsed, `37` endpoint references matched, static release-cache validation passed. |
| `node --check apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js` | Pass. |
| `git diff --check` | Pass. |
