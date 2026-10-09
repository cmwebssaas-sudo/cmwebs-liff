# Vendor Work Orders Cloud Staging Implementation Plan

**Design:** `docs/superpowers/specs/2026-10-10-vendor-work-orders-cloud-design.md`  
**Branch:** `codex/vendor-work-orders-design-20261007`  
**Target:** Cloudflare Free-tier staging at `workorders-test.cmwebs.com`

## Constraints

- Work only in this isolated worktree.
- Do not change any existing CMWebs, No.88, Libenest, production Worker, or
  production LINE configuration.
- Do not commit secrets, tokens, local state, or fixture data.
- Follow test-first implementation for each new adapter or route.
- Run `npm run validate`, affected tests, and `git diff --check` before each
  implementation commit.

## Phase 1 — Worker skeleton and failing contract tests

1. Add a dedicated Worker package under `_dev/vendor-work-orders-cloud/` with
   a `wrangler.jsonc`, source entrypoint, static assets, and D1 migration
   directory. Keep the existing Node prototype untouched.
2. Add contract tests for the Worker request adapter, Web Crypto helpers, D1
   adapter, R2 adapter, session cookie handling, and route/origin checks. The
   tests must fail before the adapters exist.
3. Add a local mock binding layer implementing the D1 and R2 methods used by
   the tests. It must expose query/write counts so free-tier guardrails can be
   tested without Cloudflare credentials.

## Phase 2 — Portable domain and persistence adapters

1. Port the pure work-order domain to Worker-compatible modules. Replace
   `node:crypto` hashing with Web Crypto and preserve all existing transition,
   authorization, validation, idempotency, and optimistic-version behavior.
2. Add the versioned D1 schema for workspace memberships, vendor directory,
   work orders, assignments, invitations, quotes, events, notification outbox,
   LINE binding/webhook receipts, and attachment metadata.
3. Implement a D1 repository that maps the domain state to workspace-scoped
   rows and performs each business transition plus append-only records in one
   transaction.
4. Implement a private R2 repository for validated attachment bytes and
   metadata. Do not return an object without a successful domain authorization
   check.
5. Add tests for duplicate writes, concurrent version conflicts, workspace
   isolation, webhook event deduplication, and attachment access denial.

## Phase 3 — Authentication, routes, and static shell

1. Implement the Worker router for the existing vendor work-order API surface,
   including `/auth/line/start`, `/auth/line/callback`, `/api/session`, LINE
   binding routes, work-order transitions, inbox, and attachment routes.
2. Store browser transaction state and hashed sessions in D1. Keep cookies
   Secure, HttpOnly, SameSite, and short-lived.
3. Verify the LINE webhook raw-body signature before parsing JSON and persist
   event IDs idempotently.
4. Serve the current vendor UI from Worker static assets and update its API
   origin to the same custom hostname. Keep the local development entrypoint
   available for existing tests.
5. Add `/api/line/status` so it reports only non-secret configuration state.

## Phase 4 — Cloudflare configuration and deployment plumbing

1. Add new-only resource names and bindings for the staging Worker, D1
   database, and private R2 bucket. Do not reuse any existing binding.
2. Add a deployment script that requires an authenticated Wrangler session,
   refuses production-looking names, and prints the target hostname and
   resource identities before mutation.
3. Add migration commands that are additive and stop on schema drift.
4. Add Worker Secret instructions for the isolated LINE Login channel. The
   secret values are supplied interactively or through Cloudflare Secret
   storage and never written to disk or logs.
5. Add custom-domain/DNS instructions for `workorders-test.cmwebs.com`.

## Phase 5 — Verification and cloud smoke test

1. Run the focused Worker contract tests, then the existing
   `node --test tests/vendor-work-orders*.test.mjs` suite, `npm test`,
   `npm run validate`, and `git diff --check`.
2. Deploy the Worker and apply the D1 migrations only after the local suite is
   green.
3. Verify the custom hostname, `/api/line/status`, login start/callback,
   session persistence, a work-order transition, duplicate idempotency, and
   private attachment authorization.
4. Verify invalid LINE webhook signatures are rejected and duplicate events do
   not create duplicate rows.
5. Record deployment version, D1 migration version, resource names, test
   evidence, and rollback steps in the vendor staging runbook. Do not record
   secrets or access tokens.

## Phase 6 — Notification gate

Keep the notification outbox in record-only mode during the first deployment.
Do not enable outbound LINE delivery until a separate acceptance confirms the
recipient identity and an explicit enablement instruction is received.

## Rollback

- Roll back the Worker version from Cloudflare while keeping D1 and R2 intact.
- Disable the custom-domain route before any destructive change.
- Never run a destructive migration in staging; add a new migration instead.
- Re-run the smoke tests after rollback and record the result.

## Completion evidence

The task is complete only when the repository tests pass, the Worker is
reachable at the staging hostname, the cloud smoke checks are recorded, the
resource names and migration version are documented, and the notification gate
remains explicitly closed.
