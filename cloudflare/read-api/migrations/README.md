# Read replica migrations

C1's `0001_read_replica.sql` is generated from `../schema.json` with `npm run generate:read-replica` at the repository root. Do not edit generated columns independently. It creates the 16 approved projections and synchronization metadata. Field columns retain JSON scalar encodings; source Sheets remain authoritative. Local tests use disposable D1 storage. Remote migration and real three-day test acceptance are separate gates; see `docs/READ-REPLICA-SYNC.md`.
