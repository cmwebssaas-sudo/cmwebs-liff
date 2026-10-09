# Vendor Work Orders Cloud Staging Design

**Status:** proposed for review  
**Date:** 2026-10-10  
**Scope:** isolated vendor work-order staging only

## Goal

Move the existing `_dev/vendor-work-orders` loopback prototype to a separate
Cloudflare Worker deployment so it can be reached at
`https://workorders-test.cmwebs.com`. The deployment must stay separate from
the existing CMWebs, No.88, Libenest, and production LINE resources.

The first cloud deployment is an empty staging environment. It does not import
local fixture data or production data, and it does not enable outbound LINE
notifications until the staging acceptance gate explicitly allows them.

## Decisions

### Runtime and hosting

- Use one Cloudflare Worker with static assets served by the Worker.
- Use native Fetch and Web Crypto APIs; do not carry over Node-only modules,
  filesystem persistence, or loopback host checks.
- Bind only the new hostname `workorders-test.cmwebs.com`.
- Keep the existing Workers and their routes unchanged.

### Persistence

- Use a new D1 database, provisionally named
  `vendor-work-orders-staging`.
- Use a new private R2 bucket, provisionally named
  `vendor-work-orders-attachments-staging`.
- Store business rows and append-only audit/idempotency records in D1.
- Store attachment bytes in R2; store only metadata, ownership, digest, and
  object key in D1.
- Do not migrate the local JSON snapshot. The first deployment starts empty.

### Authentication and LINE boundary

- Store the Login channel ID and channel secret only in Worker Secrets.
- Derive the callback URL from the fixed public origin and reject any other
  origin or redirect target.
- Persist browser authentication transactions and sessions in D1 so a Worker
  instance restart does not invalidate them.
- Verify LINE webhook signatures against the raw request body with Web Crypto,
  and deduplicate webhook event IDs in D1.
- Use the already-created isolated LINE Login channel for this staging app.
- Do not replace or edit the existing Messaging API/Dialogflow webhook for the
  production OA.
- Keep notification sending disabled until cloud smoke tests and a separate
  explicit enablement step are complete.

### Free-tier guardrails

- Use Workers Free, D1, and standard R2 only.
- Do not configure a Workers Paid plan, R2 Infrequent Access, R2 SQL, Queues,
  Workflows, or other billable add-ons.
- Add a health/status response that reports configured state without exposing
  secrets.
- Add deployment documentation for monitoring Workers, D1, and R2 usage.
- Treat free-tier exhaustion as a controlled staging error: do not silently
  retry writes or create duplicate work orders.

## Data model mapping

The local domain remains the source of business rules. Its array tables become
normalised D1 tables with explicit `workspace_id` ownership and uniqueness
constraints. The initial migration covers:

- partners, partner memberships, workspace memberships and partner links;
- partner skills, priority rules, and service agreements;
- work orders, assignments, invitations, quotes and quote revisions;
- completion reports, acceptances, work-order events and notification outbox;
- idempotency records and private attachment metadata;
- LINE binding invites/requests, LINE presence, and webhook event receipts.

Money stays integer TWD (`*_twd`). Timestamps are ISO UTC strings. JSON fields
that are still needed by the pure transition functions are stored as validated
JSON text during the first port, with relational indexes for authorization,
workspace scope, status, and idempotency lookups.

## Request flow

1. A request arrives at the Worker and is checked against the fixed public
   origin, method, route, and body-size limits.
2. API routes load the authenticated session and workspace membership from D1.
3. The existing pure domain transition is applied to a detached state view.
4. The Worker writes the transition, append-only event, and idempotency record
   in one D1 transaction.
5. Attachment uploads write bytes to R2 only after authorization and digest
   validation; the metadata row and access event are committed in D1.
6. LINE callback and webhook handlers use the same D1 transaction boundary.

## Security constraints

- No channel secrets, access tokens, cookies, or bank information in Git,
  Worker responses, logs, or documentation.
- Webhook verification uses the raw body before JSON parsing.
- Session cookies are Secure, HttpOnly, SameSite, short-lived, and backed by
  hashed opaque tokens in D1.
- Every query is scoped by `workspace_id`; request bodies never supply actor
  authority.
- R2 objects are private and are returned only after domain authorization.
- Static assets use a restrictive content-security policy and no-store during
  staging.

## Acceptance gates

### Gate A — cloud plumbing

- New Worker, D1 database, R2 bucket, and DNS/custom-domain binding exist.
- `/api/line/status` reports the isolated staging configuration without
  exposing secrets.
- Existing production Worker routes and OA webhook are unchanged.

### Gate B — safe functional smoke test

- LINE Login start/callback works with the configured test channel.
- A session survives Worker instance changes.
- Create/read/update work-order transitions pass against D1.
- Duplicate idempotency keys return the original result without duplicate rows.
- Webhook signature rejection and event deduplication pass.
- Attachment authorization and private R2 retrieval pass.

### Gate C — notification enablement

This gate is separate. It requires real staging identity and recipient
verification before any LINE push is enabled. Until then, notification events
may be recorded in the outbox but must not be delivered.

## Rollback

- Keep the previous Worker version available in Cloudflare for instant rollback.
- Disable the custom-domain route before any destructive resource change.
- D1 schema changes are additive and versioned; no destructive migration is
  allowed in the first deployment.
- R2 objects are retained during rollback.

## Out of scope

- Production deployment or modification of existing CMWebs Workers.
- Replacing the existing production OA webhook.
- Importing production Sheets, customer data, or local fixture data.
- Automatic outbound LINE messages before Gate C.
- Workers Paid or any billable Cloudflare add-on.
