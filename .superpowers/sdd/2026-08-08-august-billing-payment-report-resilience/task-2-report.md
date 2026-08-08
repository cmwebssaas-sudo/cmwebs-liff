# Task 2 Report — Preserve fractional display for per-unit rates

## Scope and boundary

- Worktree: `/private/tmp/cmwebs-v2_1-august-billing-fix`
- Branch: `codex/v2_1-august-billing-fix`
- Local-only UI display correction in `tenant-bills.html`.
- No Production data/configuration, deployment, push, LINE, LIFF, payment, API,
  calculation, or stored-rate change was made.

## TDD evidence

### RED

Command:

```bash
node --test tests/phase140-tenant-bill-rate-format.test.mjs
```

Observed result before the formatter/UI change:

```text
✖ tenant bill totals stay rounded while unit rates preserve stored fractions
✖ tenant bill rate labels and calculation sentences use the rate formatter only
ℹ tests 2
ℹ pass 0
ℹ fail 2
```

The primary expected failure was:

```text
'NT$ 4' !== 'NT$ 3.5'
```

This confirmed that the previous per-unit presentation reused `money()` and
rounded a stored rate of `3.5`.

### GREEN

Command:

```bash
node --test tests/phase140-tenant-bill-rate-format.test.mjs
```

Observed result after the formatter/UI change:

```text
✔ tenant bill totals stay rounded while unit rates preserve stored fractions
✔ tenant bill rate labels and calculation sentences use the rate formatter only
ℹ tests 2
ℹ pass 2
ℹ fail 0
```

## Change summary

1. Kept `money(value)` unchanged, so total monetary values continue to round
   (including `money(806.75) === 'NT$ 807'`).
2. Added `unitRateMoney(value)` immediately beside `money()`. It reuses
   `numberValue`, formats with `zh-TW`, keeps no forced trailing zeroes, and
   bounds precision at four fractional digits.
3. Replaced only four unit-rate presentations in bill detail:
   - `每度電費`
   - electricity `度 × 單價` explanation
   - `每度設備費`
   - equipment `度 × 單價` explanation
4. Added a focused VM/static test that evaluates the real local formatters and
   verifies the four detail render points retain `money()` for calculated totals.

## Verification and self-review

Commands:

```bash
node --test tests/phase140-tenant-bill-rate-format.test.mjs
git diff --check
```

Results: focused test passed (`2/2`); `git diff --check` returned no output.

`package.json` is absent in this checkout, so `npm run validate` is not
applicable.

Self-review confirmed that the total amount formatter, stored data, unit-price
retrieval, multiplication/rounding, payment workflow, bill filtering, and page
endpoint configuration remain unchanged.

## Risk, deployment, and rollback

- Risk is limited to frontend display of unit rates. Rates with more than four
  fractional digits display to four decimal places; existing stored `3.5`
  displays as `NT$ 3.5` without padding.
- No deployment was performed or authorized. Any later GitHub Pages release is
  a separate surface and requires an authorized target/revision check.
- Local rollback: revert this task's local commit; no data rollback is needed.
