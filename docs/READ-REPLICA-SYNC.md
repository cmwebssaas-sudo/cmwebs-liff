# Read replica synchronization (C1)

Recommended model/speed: `GPT-6.1 Sol` / high. Sheets remains authoritative.
No operational read API or frontend switch is enabled by this source change.

## Schema and privacy authority

`cloudflare/read-api/schema.json` is the sole table/field allowlist. Run
`node scripts/generate-read-replica-schema.mjs` after reviewed schema changes;
it generates the D1 migration and Apps Script constant. Sixteen tables cover
approved read dependencies and authorization rows. Every table has a stable
source key, `row_key`, SHA-256 `row_hash` and `synced_at`. Columns store scalar
JSON text to preserve numbers, booleans, strings, null and missing fields.

Projection drops unlisted fields. Bank values, identity documents, contract
files, challenge codes, invitation credentials, raw session/LINE tokens and
Properties are excluded. Email session hashes are the approved authentication
exception; bank-edit permission is only a boolean. Nested objects are rejected.
Missing sheets/keys or duplicate keys never produce a deleting snapshot.

## Signed protocol and complete snapshots

`POST /sync` signs exact UTF-8 bytes with HMAC-SHA256 over
`timestamp + "\n" + nonce + "\n" + body`. Headers:
`X-CMWebs-Timestamp` (Unix seconds), `X-CMWebs-Nonce` and
`X-CMWebs-Signature` (lowercase hex). Timestamp age/future skew must be at most
300 seconds. Nonces are atomically reserved in D1 for ten minutes. Missing
configuration fails closed. Bodies are capped at1 MiB and batches at500 rows;
row hashes are recomputed after strict whitelist validation.

The approved `{sheet, rows, complete}` payload additionally requires a complete
manifest: `mode`, `snapshot_id`, `source_version` (Unix milliseconds captured
before the source read), `batch_index`, `batch_count`, `row_count` and
`snapshot_hash`. The digest covers sorted `[row_key,row_hash]` pairs for the
whole snapshot. Only the last batch sets `complete=true`. This metadata prevents
a last batch from deleting rows belonging to an earlier batch.

Receiving batches only stage rows. Finalization checks all batches, unique rows,
count and digest. Changed rows upsert and missing rows delete in one D1 batch
transaction; unchanged rows retain their prior `synced_at`. SQL rechecks the
latest committed source version to reject older concurrent runs. Manifest or
batch changes are rejected. One-batch `mode=patch` is restricted to Email
sessions and cannot delete unrelated sessions.

## Apps Script scheduling

Both `READ_REPLICA_URL` (Worker base HTTPS URL) and
`READ_REPLICA_SYNC_SECRET` must be configured. Report only presence, never
values. With either absent, synchronization is disabled. The dispatcher observes
successful JSON, JSONP and iframe responses after business functions finish,
then queues affected tables with generation markers. Failure responses and
reads do not queue writes. Dirty marking performs no network request.

`runV2ReadReplicaDirtySync`: one-minute timer; idle performs no Sheet reads.
`runV2ReadReplicaFullSync`: daily timer at hour03, timezone Asia/Taipei.
No trigger is installed by committing this code. Set the daily timer timezone
explicitly; Apps Script timers run within the hour, not exactly03:00.
Runs lease execution for six minutes with a four-minute send deadline. Each
table exports once per run; failed tables remain pending while others proceed.
A newer dirty generation is never cleared by an older run. Cache loss or marker
contention is recovered by daily reconciliation. Logs contain only result codes,
whitelisted table names, counts and duration.

Email logout writes local revoked state before a synchronous one-row patch.
On failure, the session table remains dirty and the response explicitly reports
`READ_REPLICA_REVOCATION_PENDING`. Later read authentication must account for
synchronization health; no operational Worker route is exposed in C1.

## Release and three-day acceptance

1. Finish S1 staged physical and authenticated acceptance first.
2. Verify intended Cloudflare account, Workers Paid readiness and account-scoped
   credential. New costs/payment require the owner.
3. Create replica D1 with APAC placement hint; read back account/database identity
   and location. Replace the placeholder, apply reviewed migration, configure
   encrypted sync Secret and deploy. Record version/binding readback; probe
   health and signed synthetic sync.
4. Use a separate test Sheet/Apps Script project with synthetic whitelist rows.
   Export its baseline; verify no formal Sheet or messaging credential. Configure
   its replica properties and two timers; read back presence, handlers/timezone.
5. Run three consecutive actual days, recording trigger runtime, projection,
   changed rows/daily repair and immediate revocation. Verify actual Apps Script
   account quota; unknown means HUMAN_REQUIRED. Target below15 minutes/day.
6. Only after three-day acceptance may production properties/timers be configured.
   Retain serving version/editor export, create immutable version, preserve the
   original Web App URL and read back source/version/bindings/timers/results.

Current remote/day gate: **NOT_STARTED**. Local/CI tests do not satisfy it.

| Actual day | Runtime total | Correctness/revocation | Status |
| --- | --- | --- | --- |
| 1 | Not measured | Not run | NOT_STARTED |
| 2 | Not measured | Not run | NOT_STARTED |
| 3 | Not measured | Not run | NOT_STARTED |

## Rollback

Stop only the two replica timers, disable only replica URL configuration, and
restore the verified prior Apps Script serving/editor source if necessary.
Restore prior Worker version/configuration if one exists, otherwise disable
the new endpoint. Keep frontend flags off. Retain Sheets and operational rows;
replica rebuild never deletes or rewrites formal data. Retain migration, D1
export and sanitized version/configuration evidence before changes. Account for
retained Worker versions before removing any shared Secret they depend on.
