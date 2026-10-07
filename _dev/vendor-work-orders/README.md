# Local vendor work-order API foundation

Run from the repository root with Node.js 22 or newer:

```sh
node _dev/vendor-work-orders/server.mjs --development
```

The API listens at `http://127.0.0.1:8787`. Stop with Ctrl+C. Omitting
`--development` disables fixture login and synthetic-state seeding.
No external services, LINE, Apps Script or Sheets are connected.

Task 2 exposes only `POST /api/dev/session` and `GET /api/session`. Later tasks
add partner/work-order actions and UI. Static paths `/`, `/index.html`,
`/app.js`, `/app.css` are allowlisted; until those assets exist they return 404.
Host must match `127.0.0.1:<listening port>`; any supplied Origin must match
that exact HTTP origin. Other paths/methods return safe JSON errors.

Fixture login accepts JSON `{"principal":"landlord_a"}` and an
`Idempotency-Key` header (1–128 printable non-space ASCII characters).
Available synthetic keys: `landlord_a`, `landlord_b`, `company_a_manager`,
`company_a_worker`, `company_b_worker`, `individual_worker`.
It sets an 8-hour HttpOnly, SameSite=Strict cookie. Sessions and bootstrap
idempotency records are process-local and expire together; restarting logs
everyone out. The pre-session bootstrap key is scoped to this local server;
same key/principal replays the cookie, a different principal returns 409.
Use a fresh unpredictable key for each deliberate login. Future authenticated
mutation keys will be scoped by trusted Workspace/actor/resource/action.

State defaults to `.codex-local/vendor-work-orders/state.json`; the reserved
private attachment directory is `.codex-local/vendor-work-orders/attachments/`.
The exact directory is ignored by Git. Store tests inject temporary directories.
`createWorkOrderStore({filePath})` exposes detached `readSnapshot()` and
serialized `transact(mutator)`; the mutator returns a complete next snapshot.
It validates all tables/JSON values and money before writing an exclusive unique
adjacent temporary file, syncing/closing it, then atomically renaming it.
Rejected transactions leave the previous memory/disk state unchanged. A single
store instance/process must own a file; this is not a multiprocess database.
Action-specific relationship and permission validation remains in the domain.

For local recovery, stop the server and move the exact local state file to a
backup location before restarting with `--development`. Never point this tool
at real customer data. No cleanup command runs automatically.

```sh
node --test tests/vendor-work-orders-api.test.mjs
npm test
npm run validate
```

This foundation is local-only. Browser workflow, attachments, real login,
staging, LINE/device acceptance and publication have not been implemented here.
