# Task 1 Report — Landlord Email OTP RED Contract

## Recommended model / speed

- Model: `gpt-5.6-terra`
- Speed: `medium`

## Scope

Task 1 was implemented as a RED-only contract slice in the isolated worktree
`/Users/hans/CMWebs/cmwebs-liff/.worktrees/desktop-responsive-email-otp-20260904`.
No backend runtime module, no frontend behavior, and no parent/root worktree
files were modified.

## Changed files

- `tests/phase217-landlord-email-auth.runtime.test.mjs`
- `tests/phase218-landlord-email-auth-routes.test.mjs`
- `docs/04-API-ROUTES.md`
- `docs/05-DATA-MODEL.md`
- `.superpowers/sdd/2026-09-04-desktop-responsive-email-otp/task-1-report.md`

## Implementation summary

1. Added a RED runtime contract test for the future
   `apps-script/V2_LANDLORD_EMAIL_AUTH.js` module.
2. Added a RED dispatcher contract test for the six fixed Email auth actions in
   `apps-script/程式碼.js`.
3. Documented the six POST-only actions, request fields, shared auth/session
   response-code boundary, and the exact schema headers for the two new Email
   auth sheets plus the two appended `V2_users` headers.
4. Created `docs/05-DATA-MODEL.md` in this worktree because it was not present
   on the current branch; the file was seeded from the repository’s existing
   data-model convention and extended only with the approved Email OTP contract
   headers.

## Exact test commands and output

### 1. Required RED tests

Command:

```bash
node --test tests/phase217-landlord-email-auth.runtime.test.mjs tests/phase218-landlord-email-auth-routes.test.mjs
```

Exit code: `1`

Output:

```text
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: landlord email auth module must exist before the Email OTP contract can be released

false !== true

    at file:///Users/hans/CMWebs/cmwebs-liff/.worktrees/desktop-responsive-email-otp-20260904/tests/phase217-landlord-email-auth.runtime.test.mjs:7:8
    at ModuleJob.run (node:internal/modules/esm/module_job:569:25)
    at async node:internal/modules/esm/loader:650:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: false,
  expected: true,
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v26.5.0
✖ tests/phase217-landlord-email-auth.runtime.test.mjs (34.697917ms)
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: landlord_email_verify_request must be registered in the dispatcher contract

false !== true

    at file:///Users/hans/CMWebs/cmwebs-liff/.worktrees/desktop-responsive-email-otp-20260904/tests/phase218-landlord-email-auth-routes.test.mjs:16:10
    at ModuleJob.run (node:internal/modules/esm/module_job:569:25)
    at async node:internal/modules/esm/loader:650:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: false,
  expected: true,
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v26.5.0
✖ tests/phase218-landlord-email-auth-routes.test.mjs (32.740916ms)
ℹ tests 2
ℹ suites 0
ℹ pass 0
ℹ fail 2
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 38.428541

✖ failing tests:

test at tests/phase217-landlord-email-auth.runtime.test.mjs:1:1
✖ tests/phase217-landlord-email-auth.runtime.test.mjs (34.697917ms)
  'test failed'

test at tests/phase218-landlord-email-auth-routes.test.mjs:1:1
✖ tests/phase218-landlord-email-auth-routes.test.mjs (32.740916ms)
  'test failed'
```

### 2. Diff whitespace / patch integrity

Command:

```bash
git diff --check
```

Exit code: `0`

Output:

```text

```

### 3. Repository validation

Command:

```bash
npm run validate
```

Exit code: `0`

Output:

```text
> cmwebs-codex-handoff@0.0.0 validate
> node scripts/validate-project.js --root . --apps-dir apps-script --html-dir . --expected-routes 71

Apps Script files: 35
HTML files: 46
Routes: 71 (unique 71, duplicates 0)
Handler coverage: 71/71
Common helper coverage: 7/7
Duplicate top-level declarations: function=0, const=0, let=0, var=0
Credential scan: blocking=0, review-only=0
Hardcoded LINE UID: 0
Manifest: PASS
HTML links: checked=202, missing=0
WARNING: Local .clasp.json is present but must remain ignored: apps-script/.clasp.json
Validation: PASS
CMWebs validation passed.
```

## Self-review notes

- The RED runtime test intentionally fails first on the missing
  `apps-script/V2_LANDLORD_EMAIL_AUTH.js` module so the contract stays red
  until Task 2 starts.
- The RED dispatcher test intentionally fails on the first missing action string
  in `apps-script/程式碼.js`, proving the POST-only route contract is not wired
  yet.
- I kept the route and schema docs aligned to the approved spec/plan without
  implementing any behavior.
- I did not invent alternate action names, alternate auth flows, or a GET/JSONP
  transport for OTP or session tokens.
- I limited exact response-code documentation to the shared approved auth/session
  boundary: `AUTH_REQUIRED`, `SESSION_EXPIRED`, and `WORKSPACE_FORBIDDEN`.
  I did not lock additional action-specific error-code strings that are not
  explicitly named in the approved spec.

## Concerns / rulings

1. `docs/05-DATA-MODEL.md` was absent on this feature branch, so this task adds
   it as a new file in order to satisfy the approved brief’s requirement to
   record the Email OTP schema headers.
2. The brief asked for “response codes,” but the approved spec only names the
   shared auth/session codes above. Ruling: this task documents only those exact
   approved codes and leaves action-specific code names for the runtime slice.
3. The runtime RED test includes deeper future assertions behind the module
   existence gate; those assertions are intentionally unreachable until the
   module is created in Task 2.

## Commit hash

- `COMMIT_HASH: d211ab636aff356a02bcea03c0c0362c97d56b93`

---

## Fix Round 1 — 2026-09-04

### Changed files

- `tests/phase217-landlord-email-auth.runtime.test.mjs`
- `tests/phase218-landlord-email-auth-routes.test.mjs`
- `.superpowers/sdd/2026-09-04-desktop-responsive-email-otp/task-1-report.md`

### Fix summary

1. Reworked `phase218` from generic action-string presence checks into a
   per-action dispatcher contract. Each of the six fixed actions now requires
   exactly one explicit `doPost` action mapping, must remain absent from
   `doGet`, and must forward the expected request body fields to the matching
   handler signature.
2. Expanded `phase217` to cover the missing verification contract:
   `requestLandlordEmailVerificationByLineUid_`,
   `verifyLandlordEmailVerificationCodeByLineUid_`, and successful login
   session issuance with an observable persisted-session hash boundary.
3. Kept the suite RED and still free of production route/runtime code.

### Exact commands and output

#### 1. Covering RED tests

Command:

```bash
node --test tests/phase217-landlord-email-auth.runtime.test.mjs tests/phase218-landlord-email-auth-routes.test.mjs
```

Exit code: `1`

Output:

```text
✖ Phase 217 requires the landlord Email auth runtime module (0.787083ms)
﹣ Phase 217 exposes the fixed Email auth runtime surface (0.072125ms) # SKIP
﹣ Phase 217 normalizes verification Email and stores only challenge hashes (0.03875ms) # SKIP
﹣ Phase 217 verifies Email codes through the verification handler contract (0.038083ms) # SKIP
﹣ Phase 217 normalizes login Email and stores only hashed login challenge values (0.034875ms) # SKIP
﹣ Phase 217 stores only a session-token hash when login verification issues a session (0.030291ms) # SKIP
﹣ Phase 217 rejects consumed challenges, sixth failed attempts, resend floods, expired sessions, revoked sessions, and Workspace mismatches (0.339041ms) # SKIP
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: landlord_email_verify_request must have exactly one explicit doPost action mapping

0 !== 1

    at file:///Users/hans/CMWebs/cmwebs-liff/.worktrees/desktop-responsive-email-otp-20260904/tests/phase218-landlord-email-auth-routes.test.mjs:78:10
    at ModuleJob.run (node:internal/modules/esm/module_job:569:25)
    at async node:internal/modules/esm/loader:650:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: 0,
  expected: 1,
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v26.5.0
✖ tests/phase218-landlord-email-auth-routes.test.mjs (30.961375ms)
ℹ tests 8
ℹ suites 0
ℹ pass 0
ℹ fail 2
ℹ cancelled 0
ℹ skipped 6
ℹ todo 0
ℹ duration_ms 44.717209

✖ failing tests:

test at tests/phase217-landlord-email-auth.runtime.test.mjs:298:1
✖ Phase 217 requires the landlord Email auth runtime module (0.787083ms)
  AssertionError [ERR_ASSERTION]: landlord email auth module must exist before the Email OTP contract can be released

  false !== true

      at TestContext.<anonymous> (file:///Users/hans/CMWebs/cmwebs-liff/.worktrees/desktop-responsive-email-otp-20260904/tests/phase217-landlord-email-auth.runtime.test.mjs:299:10)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1382:25)
      at Test.start (node:internal/test_runner/test:1242:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:387:17) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at tests/phase218-landlord-email-auth-routes.test.mjs:1:1
✖ tests/phase218-landlord-email-auth-routes.test.mjs (30.961375ms)
  'test failed'
```

#### 2. Diff whitespace / patch integrity

Command:

```bash
git diff --check
```

Exit code: `0`

Output:

```text

```

#### 3. Repository validation

Command:

```bash
npm run validate
```

Exit code: `0`

Output:

```text
> cmwebs-codex-handoff@0.0.0 validate
> node scripts/validate-project.js --root . --apps-dir apps-script --html-dir . --expected-routes 71

Apps Script files: 35
HTML files: 46
Routes: 71 (unique 71, duplicates 0)
Handler coverage: 71/71
Common helper coverage: 7/7
Duplicate top-level declarations: function=0, const=0, let=0, var=0
Credential scan: blocking=0, review-only=0
Hardcoded LINE UID: 0
Manifest: PASS
HTML links: checked=202, missing=0
WARNING: Local .clasp.json is present but must remain ignored: apps-script/.clasp.json
Validation: PASS
CMWebs validation passed.
```

### Self-review

- `phase218` now checks the doPost contract at the level the approved route
  plan described: explicit per-action mapping plus exact forwarded body fields.
- `phase217` now names and covers both verification functions and the hashed
  session-token persistence boundary without adding a new production interface.
- I intentionally kept the runtime subtests skipped while the module file is
  absent, so the suite stays RED for the real missing implementation instead of
  failing on speculative harness setup.
- I did not alter the earlier report’s Task 1 change list to include approved
  plan/spec commits; this fix round only appends new evidence and review notes.

### Fix-round concerns

1. The session issuance assertion assumes the successful login verification
   result exposes an opaque `data.session_token` to the client, because the
   approved spec says the browser stores a token but does not name the response
   field. This is the smallest contract assumption that makes the storage
   boundary observable.
2. The route contract now fixes `request.landlord_session_token` as the
   desktop POST body field for session status/revoke because the approved route
   plan names that request-side token, while the earlier API doc draft used the
   more generic `session_token`.

### Final rerun before commit

After appending this fix report, the same commands were rerun unchanged.

- `node --test tests/phase217-landlord-email-auth.runtime.test.mjs tests/phase218-landlord-email-auth-routes.test.mjs`
  exited `1` again, with the same two intended RED failures:
  missing `V2_LANDLORD_EMAIL_AUTH.js`, and missing explicit `doPost`
  `landlord_email_verify_request` mapping.
- `git diff --check` exited `0`.
- `npm run validate` exited `0` and repeated the same PASS output as above.

---

## Fix Round 2 — 2026-09-04

### Changed files

- `tests/phase218-landlord-email-auth-routes.test.mjs`
- `.superpowers/sdd/2026-09-04-desktop-responsive-email-otp/task-1-report.md`

### Fix summary

1. Reworked `phase218` so the RED dispatcher contract no longer requires one
   exact implementation shape.
2. The test now accepts either a normalized local `action` variable or the
   repository’s current inline `String(request.action || request.v2_action)`
   comparison style, while still requiring:
   - each fixed action name appears in exactly one explicit `doPost` mapping,
   - no fixed action appears in `doGet`,
   - each mapping forwards the expected POST body fields to the matching
     handler in order,
   - no Email/code/challenge/session secret is read from GET parameters, and
   - no client `workspace_id` or `role` override is accepted from the POST
     body.

### Exact commands and output

#### 1. Covering RED tests

Command:

```bash
node --test tests/phase217-landlord-email-auth.runtime.test.mjs tests/phase218-landlord-email-auth-routes.test.mjs
```

Exit code: `1`

Output:

```text
✖ Phase 217 requires the landlord Email auth runtime module (0.702709ms)
﹣ Phase 217 exposes the fixed Email auth runtime surface (0.07ms) # SKIP
﹣ Phase 217 normalizes verification Email and stores only challenge hashes (0.036792ms) # SKIP
﹣ Phase 217 verifies Email codes through the verification handler contract (0.036ms) # SKIP
﹣ Phase 217 normalizes login Email and stores only hashed login challenge values (0.038542ms) # SKIP
﹣ Phase 217 stores only a session-token hash when login verification issues a session (0.03175ms) # SKIP
﹣ Phase 217 rejects consumed challenges, sixth failed attempts, resend floods, expired sessions, revoked sessions, and Workspace mismatches (0.029583ms) # SKIP
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: landlord_email_verify_request must have exactly one explicit doPost action mapping

0 !== 1

    at file:///Users/hans/CMWebs/cmwebs-liff/.worktrees/desktop-responsive-email-otp-20260904/tests/phase218-landlord-email-auth-routes.test.mjs:84:10
    at ModuleJob.run (node:internal/modules/esm/module_job:569:25)
    at async node:internal/modules/esm/loader:650:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: 0,
  expected: 1,
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v26.5.0
✖ tests/phase218-landlord-email-auth-routes.test.mjs (31.728083ms)
ℹ tests 8
ℹ suites 0
ℹ pass 0
ℹ fail 2
ℹ cancelled 0
ℹ skipped 6
ℹ todo 0
ℹ duration_ms 46.063666

✖ failing tests:

test at tests/phase217-landlord-email-auth.runtime.test.mjs:298:1
✖ Phase 217 requires the landlord Email auth runtime module (0.702709ms)
  AssertionError [ERR_ASSERTION]: landlord email auth module must exist before the Email OTP contract can be released

  false !== true

      at TestContext.<anonymous> (file:///Users/hans/CMWebs/cmwebs-liff/.worktrees/desktop-responsive-email-otp-20260904/tests/phase217-landlord-email-auth.runtime.test.mjs:299:10)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1382:25)
      at Test.start (node:internal/test_runner/test:1242:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:387:17) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at tests/phase218-landlord-email-auth-routes.test.mjs:1:1
✖ tests/phase218-landlord-email-auth-routes.test.mjs (31.728083ms)
  'test failed'
```

#### 2. Diff whitespace / patch integrity

Command:

```bash
git diff --check
```

Exit code: `0`

Output:

```text

```

#### 3. Repository validation

Command:

```bash
npm run validate
```

Exit code: `0`

Output:

```text
> cmwebs-codex-handoff@0.0.0 validate
> node scripts/validate-project.js --root . --apps-dir apps-script --html-dir . --expected-routes 71

Apps Script files: 35
WARNING: Local .clasp.json is present but must remain ignored: apps-script/.clasp.json
HTML files: 46
Routes: 71 (unique 71, duplicates 0)
Handler coverage: 71/71
Common helper coverage: 7/7
Duplicate top-level declarations: function=0, const=0, let=0, var=0
Credential scan: blocking=0, review-only=0
Hardcoded LINE UID: 0
Manifest: PASS
HTML links: checked=202, missing=0
Validation: PASS
CMWebs validation passed.
```

### Self-review

- The dispatcher test is now stricter about behavior and looser about syntax,
  which fits the re-review finding: it still fails only when the required Email
  auth route contract is absent, not because a conforming implementation uses a
  different comparison style.
- The two prior fix-round requirements remain preserved: `phase217` still
  covers both verification functions and hashed session persistence, and
  `phase218` still enforces POST-only, exact-once, field-forwarding, no-GET
  secret, and server-principal protections.

### Fix-round concerns

1. The tolerant matcher still assumes the comparison remains explicit in
   `doPost`; if a later implementation factors each action into a data-driven
   table, this test will intentionally fail until that new explicit contract is
   reviewed and approved.

---

## Fix Round 3 — 2026-09-04

### Changed files

- `tests/phase218-landlord-email-auth-routes.test.mjs`
- `.superpowers/sdd/2026-09-04-desktop-responsive-email-otp/task-1-report.md`

### Fix summary

1. Reworked the `doGet` prohibition in `phase218` so it no longer depends on
   the lexical form `v2Action === '<action>'`.
2. The test now extracts the actual `doGet` source region and asserts that none
   of the six fixed Email auth action names appears anywhere inside that
   function body, independent of variable name or comparison style.
3. The existing exact-once explicit `doPost` mapping, expected POST body-field
   forwarding, no-GET-secret, and server-principal protections remain intact.

### Exact commands and output

#### 1. Covering RED tests

Command:

```bash
node --test tests/phase217-landlord-email-auth.runtime.test.mjs tests/phase218-landlord-email-auth-routes.test.mjs
```

Exit code: `1`

Output:

```text
✖ Phase 217 requires the landlord Email auth runtime module (0.767041ms)
﹣ Phase 217 exposes the fixed Email auth runtime surface (0.222709ms) # SKIP
﹣ Phase 217 normalizes verification Email and stores only challenge hashes (0.117458ms) # SKIP
﹣ Phase 217 verifies Email codes through the verification handler contract (0.052ms) # SKIP
﹣ Phase 217 normalizes login Email and stores only hashed login challenge values (0.042958ms) # SKIP
﹣ Phase 217 stores only a session-token hash when login verification issues a session (0.0365ms) # SKIP
﹣ Phase 217 rejects consumed challenges, sixth failed attempts, resend floods, expired sessions, revoked sessions, and Workspace mismatches (0.033166ms) # SKIP
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: landlord_email_verify_request must have exactly one explicit doPost action mapping

0 !== 1

    at file:///Users/hans/CMWebs/cmwebs-liff/.worktrees/desktop-responsive-email-otp-20260904/tests/phase218-landlord-email-auth-routes.test.mjs:84:10
    at ModuleJob.run (node:internal/modules/esm/module_job:569:25)
    at async node:internal/modules/esm/loader:650:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: 0,
  expected: 1,
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v26.5.0
✖ tests/phase218-landlord-email-auth-routes.test.mjs (30.602667ms)
ℹ tests 8
ℹ suites 0
ℹ pass 0
ℹ fail 2
ℹ cancelled 0
ℹ skipped 6
ℹ todo 0
ℹ duration_ms 45.294166

✖ failing tests:

test at tests/phase217-landlord-email-auth.runtime.test.mjs:298:1
✖ Phase 217 requires the landlord Email auth runtime module (0.767041ms)
  AssertionError [ERR_ASSERTION]: landlord email auth module must exist before the Email OTP contract can be released

  false !== true

      at TestContext.<anonymous> (file:///Users/hans/CMWebs/cmwebs-liff/.worktrees/desktop-responsive-email-otp-20260904/tests/phase217-landlord-email-auth.runtime.test.mjs:299:10)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1382:25)
      at Test.start (node:internal/test_runner/test:1242:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:387:17) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at tests/phase218-landlord-email-auth-routes.test.mjs:1:1
✖ tests/phase218-landlord-email-auth-routes.test.mjs (30.602667ms)
  'test failed'
```

#### 2. Diff whitespace / patch integrity

Command:

```bash
git diff --check
```

Exit code: `0`

Output:

```text

```

#### 3. Repository validation

Command:

```bash
npm run validate
```

Exit code: `0`

Output:

```text
> cmwebs-codex-handoff@0.0.0 validate
> node scripts/validate-project.js --root . --apps-dir apps-script --html-dir . --expected-routes 71

Apps Script files: 35
HTML files: 46
Routes: 71 (unique 71, duplicates 0)
Handler coverage: 71/71
Common helper coverage: 7/7
Duplicate top-level declarations: function=0, const=0, let=0, var=0
Credential scan: blocking=0, review-only=0
Hardcoded LINE UID: 0
Manifest: PASS
HTML links: checked=202, missing=0
WARNING: Local .clasp.json is present but must remain ignored: apps-script/.clasp.json
Validation: PASS
CMWebs validation passed.
```

### Self-review

- The `doGet` contract is now implementation-shape-tolerant in the same spirit
  as the `doPost` matcher: any future GET exposure of a fixed Email auth action
  name inside `doGet` will fail the test regardless of the comparison variable
  or syntax used.
- The test remains RED for the actual missing production work, not for the
  comparison style.

### Fix-round concerns

1. The `doGet` prohibition now keys off the absence of the six fixed action
   names anywhere in the `doGet` function body. That is intentionally strict
   for this contract slice; if a later implementation mentions those names in a
   comment or dead string inside `doGet`, this RED test will fail until the
   contract is revisited.

---

## Fix Round 4 — 2026-09-04

### Changed files

- `tests/phase218-landlord-email-auth-routes.test.mjs`
- `.superpowers/sdd/2026-09-04-desktop-responsive-email-otp/task-1-report.md`

### Fix summary

1. Replaced the brittle `doGet` region detection with a balanced-brace
   function-source extractor, matching the existing helper style used in other
   route contract tests.
2. Replaced the quote-specific `doGet` prohibition with direct
   `doGetSource.includes(mapping.action)` assertions for all six fixed Email
   auth action names.
3. Preserved the exact-once explicit `doPost` mapping, expected POST body-field
   forwarding, no-GET-secret checks, and server-principal protections.

### Exact commands and output

#### 1. Covering RED tests

Command:

```bash
node --test tests/phase217-landlord-email-auth.runtime.test.mjs tests/phase218-landlord-email-auth-routes.test.mjs
```

Exit code: `1`

Output:

```text
✖ Phase 217 requires the landlord Email auth runtime module (0.652959ms)
﹣ Phase 217 exposes the fixed Email auth runtime surface (0.065834ms) # SKIP
﹣ Phase 217 normalizes verification Email and stores only challenge hashes (0.032584ms) # SKIP
﹣ Phase 217 verifies Email codes through the verification handler contract (0.03975ms) # SKIP
﹣ Phase 217 normalizes login Email and stores only hashed login challenge values (0.043042ms) # SKIP
﹣ Phase 217 stores only a session-token hash when login verification issues a session (0.025459ms) # SKIP
﹣ Phase 217 rejects consumed challenges, sixth failed attempts, resend floods, expired sessions, revoked sessions, and Workspace mismatches (0.31575ms) # SKIP
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: landlord_email_verify_request must have exactly one explicit doPost action mapping

0 !== 1

    at file:///Users/hans/CMWebs/cmwebs-liff/.worktrees/desktop-responsive-email-otp-20260904/tests/phase218-landlord-email-auth-routes.test.mjs:128:10
    at ModuleJob.run (node:internal/modules/esm/module_job:569:25)
    at async node:internal/modules/esm/loader:650:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: 0,
  expected: 1,
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v26.5.0
✖ tests/phase218-landlord-email-auth-routes.test.mjs (28.420834ms)
ℹ tests 8
ℹ suites 0
ℹ pass 0
ℹ fail 2
ℹ cancelled 0
ℹ skipped 6
ℹ todo 0
ℹ duration_ms 40.92

✖ failing tests:

test at tests/phase217-landlord-email-auth.runtime.test.mjs:298:1
✖ Phase 217 requires the landlord Email auth runtime module (0.652959ms)
  AssertionError [ERR_ASSERTION]: landlord email auth module must exist before the Email OTP contract can be released

  false !== true

      at TestContext.<anonymous> (file:///Users/hans/CMWebs/cmwebs-liff/.worktrees/desktop-responsive-email-otp-20260904/tests/phase217-landlord-email-auth.runtime.test.mjs:299:10)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1382:25)
      at Test.start (node:internal/test_runner/test:1242:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:387:17) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at tests/phase218-landlord-email-auth-routes.test.mjs:1:1
✖ tests/phase218-landlord-email-auth-routes.test.mjs (28.420834ms)
  'test failed'
```

#### 2. Diff whitespace / patch integrity

Command:

```bash
git diff --check
```

Exit code: `0`

Output:

```text

```

#### 3. Repository validation

Command:

```bash
npm run validate
```

Exit code: `0`

Output:

```text
> cmwebs-codex-handoff@0.0.0 validate
> node scripts/validate-project.js --root . --apps-dir apps-script --html-dir . --expected-routes 71

Apps Script files: 35
HTML files: 46
Routes: 71 (unique 71, duplicates 0)
Handler coverage: 71/71
Common helper coverage: 7/7
Duplicate top-level declarations: function=0, const=0, let=0, var=0
Credential scan: blocking=0, review-only=0
Hardcoded LINE UID: 0
Manifest: PASS
HTML links: checked=202, missing=0
WARNING: Local .clasp.json is present but must remain ignored: apps-script/.clasp.json
Validation: PASS
CMWebs validation passed.
```

### Self-review

- The `doGet` contract now extracts the real `doGet` function by balanced
  braces instead of assuming it ends immediately before `doPost`.
- The assertion checks each fixed action name as a raw substring in the actual
  `doGet` function source. This is independent of quotes, variable names,
  comparison style, comments, or dead strings, and intentionally fails if any
  action name is mentioned in `doGet`.
- The earlier `doPost` mapping, body forwarding, no-GET-secret, and
  server-principal protections were left in place.
- No production route/runtime code, frontend code, or docs were changed.

### Fix-round concerns

1. The covering suite remains intentionally RED because Task 2 has not created
   the runtime module or the explicit Email auth `doPost` mappings. This round
   fixed only the unresolved `doGet` contract-test shape concern.
