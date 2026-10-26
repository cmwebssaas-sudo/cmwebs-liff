# Rooms-first read path: deployment runbook

Scope: serve the landlord rooms page from Cloudflare Workers + D1 with
automatic fallback to Apps Script. Decision record:
`CMWEBS_ARCHITECTURE_DECISIONS.md` (2026-10-26). No secret values belong in
this file or in Git.

Each step below needs the owner's go-ahead at the time it is run.

## 1. Cloudflare

1. Create the production D1 database `cmwebs-read-replica` (location hint
   `apac`) and put its ID in `cloudflare/read-api/wrangler.toml`.
2. Apply `cloudflare/read-api/migrations/0001`–`0008` to that database.
3. Worker variables and secrets:
   - `LINE_LOGIN_CHANNEL_ID` = the LINE Login channel that owns the LIFF apps
     (public value).
   - `READ_REPLICA_SYNC_SECRET`: a new random value of at least 32 bytes. The
     same value goes into Apps Script below.
   - `EMAIL_SESSION_HMAC_SECRET`: the same value as the Apps Script property
     `CMWEBS_EMAIL_LOGIN_HASH_SECRET`. The owner enters it; it is never shown.
4. Give the Worker a public origin: the `workers.dev` address (set
   `workers_dev = true`) unless a custom domain is preferred.
5. Deploy the Worker and confirm `GET /health` reports the database ready.

## 2. Apps Script

1. Push the source and create a new version on the existing Web App
   deployment (the URL does not change).
2. Script Properties: `READ_REPLICA_URL` (the Worker origin) and
   `READ_REPLICA_SYNC_SECRET` (same as the Worker secret).
3. Run `runV2ReadReplicaFullSync` once from the editor, then
   `installV2ReadReplicaTriggers`.
4. Check the D1 row counts for the synced tables against the Sheets.

## 3. Frontend (GitHub Pages)

1. In `frontend-release.js`, set `CMWEBS_READ_API_URL` to the Worker origin
   and `CMWEBS_READ_PATH.rooms` to `'on'`. Leave the other pages `'off'`.
2. Publish and confirm the public file matches.

## 4. Owner check

Open the rooms page in LINE on a phone and on the desktop. Compare the room
list with the Apps Script version and note how long it takes to appear.

## Rollback

| Layer | Action |
| --- | --- |
| Rooms page | Set `CMWEBS_READ_PATH.rooms = 'off'` and publish Pages. |
| Sync | Run `removeV2ReadReplicaTriggers()`; remove the two Script Properties. |
| Apps Script | Point the Web App deployment back to the previous version. |
| Worker/D1 | Leave in place or delete; Sheets remain the source of truth. |
