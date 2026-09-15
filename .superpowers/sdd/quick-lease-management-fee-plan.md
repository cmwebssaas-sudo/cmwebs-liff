# Quick lease management fee field

## Global Constraints

- Change only the existing simple `mode=new` quick lease flow, its focused regression tests/documentation, and the simple-flow validation/default-resolution behavior in `apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js` needed to preserve the submitted management fee correctly.
- The visible management-fee input must use the existing `managementFee` field and existing `management_fee` request payload; do not add an API route, Sheet column, migration, or alternate endpoint.
- The field defaults to the selected room's `management_fee`, updates when the room changes, accepts zero, and rejects negative values through the existing validation behavior.
- Preserve the full/advanced flow and the existing `management_fee` API/schema contract; do not add an API route, Sheet column, migration, or alternate endpoint.
- Use TDD: the focused test must fail before production-code changes and pass after them.

## Task 1: Add editable management fee to simple quick lease

- Add a focused regression test for the simple quick-lease renderer/source contract proving the management fee is visible/editable, defaults from the room, remains in the submit payload, and is not duplicated as a hidden-only field.
- Implement the smallest frontend change in `landlord-tenant-create.html`: render `managementFee` as a visible numeric input in simple mode, keep the room-change defaulting and submit payload, and update nearby copy/summary so the editable fee is clear without changing the advanced flow.
- In `apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js`, keep room fallback only for omitted/blank simple-flow management fees, preserve explicit numeric `0`, and fail closed for negative or malformed non-empty simple-flow values. Do not change the advanced flow or API/schema.
- Add behavior-level simple-flow regression coverage for explicit `0`, negative, and malformed management fees through the existing normalizer/default-resolver harness.
- Run the focused test through RED and GREEN, then run the complete available Node test suite, `npm run validate`, syntax checks relevant to changed files, and `git diff --check` before committing.
