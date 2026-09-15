# SDD ledger — plan: /Users/hans/CMWebs/cmwebs-liff/.worktrees/quick-lease-management-fee-20260915/.superpowers/sdd/quick-lease-management-fee-plan.md

## Preflight scan

| Item | Shared files/interfaces | Check | Ruling |
| --- | --- | --- | --- |
| Task 1 self-consistency | `landlord-tenant-create.html`, `apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js`, focused regression tests, existing `managementFee` / `management_fee` interface | The task tests the visible simple-mode field, room defaulting, payload, and simple-flow backend normalization/default resolution; no API/schema/interface change is required. | Proceed; preserve advanced mode and the existing backend contract. |

## Rulings

- Ruling: treat the existing simple `mode=new` form as the quick-lease surface and keep the current room-level management fee as its initial value. The approved scope also includes the corresponding simple-flow backend validation/default-resolution guard so explicit numeric `0` is preserved and negative or malformed non-empty values fail closed. This avoids changing API or schema while preserving the advanced flow.

- Baseline evidence: `npm test` currently reports 240 passing and 2 pre-existing failures in `tests/landlord-post-read-snapshot.test.mjs` and `tests/phase246-landlord-post-read-bridge.test.mjs`; neither touches the quick-lease management-fee surface. Continue the focused task and report these unchanged baseline failures separately.

- Task 1 review: ❌ important finding — the simple backend default resolver uses `> 0` for `management_fee`, so a landlord-entered zero can be replaced by the room default; the simple frontend validator does not reject negative management fees, and the static test does not cover either behavior. Resume the original implementer for fix round 1.

- Task 1 fix round 1 re-review: zero preservation and negative rejection are addressed, but the fix introduces an important invalid-input path: a non-numeric non-empty management fee such as `abc` is treated as an explicit zero. Resume the original implementer for fix round 2 and fail closed on malformed values.

- Task 1 fix round 2 re-review: ✅ addressed — simple-flow non-empty management fee text is checked as a finite number after comma normalization; malformed values fail with `CONTRACT_INITIATION_INVALID`, while omitted/blank values still use the room default and explicit `0` remains valid. No new findings. Proceed to whole-branch review and final verification.

- Documentation scope correction: the completed Task 1 scope includes the approved simple-flow-only changes in `apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js` for management-fee presence, malformed/negative rejection, and default resolution. It does not alter the advanced flow, API route, request field, Sheet schema, or migration surface.
