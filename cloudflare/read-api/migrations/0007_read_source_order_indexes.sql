-- Additive, nonunique ordering indexes for existing room/contract/bill reads.
-- Keep the exact numeric source-row cast, row-key tie break and Workspace
-- expression used by the shared loader. No rows or query rules are changed.

CREATE INDEX "idx_read_order_V2_rooms" ON "V2_rooms"
  (CAST(replica_source_row AS INTEGER),row_key);

CREATE INDEX "idx_read_order_V2_contracts" ON "V2_contracts"
  (CAST(replica_source_row AS INTEGER),row_key);

CREATE INDEX "idx_read_order_V2_bills" ON "V2_bills"
  (CAST(replica_source_row AS INTEGER),row_key);

CREATE INDEX "idx_read_workspace_order_V2_rooms" ON "V2_rooms"
  (upper(trim(COALESCE(json_extract("workspace_id",'$'),''))),CAST(replica_source_row AS INTEGER),row_key);

CREATE INDEX "idx_read_workspace_order_V2_contracts" ON "V2_contracts"
  (upper(trim(COALESCE(json_extract("workspace_id",'$'),''))),CAST(replica_source_row AS INTEGER),row_key);

CREATE INDEX "idx_read_workspace_order_V2_bills" ON "V2_bills"
  (upper(trim(COALESCE(json_extract("workspace_id",'$'),''))),CAST(replica_source_row AS INTEGER),row_key);
