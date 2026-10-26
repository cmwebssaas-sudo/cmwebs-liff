-- Additive, nonunique indexes for the unchanged scoped-loader Workspace expression.
-- JSON text, SQL NULL, blank/legacy Workspace values retain their existing semantics.

CREATE INDEX "idx_read_scope_V2_workspaces" ON "V2_workspaces"
  (upper(trim(COALESCE(json_extract("workspace_id",'$'),''))));

CREATE INDEX "idx_read_scope_V2_workspace_members" ON "V2_workspace_members"
  (upper(trim(COALESCE(json_extract("workspace_id",'$'),''))));

CREATE INDEX "idx_read_scope_V2_member_scopes" ON "V2_member_scopes"
  (upper(trim(COALESCE(json_extract("workspace_id",'$'),''))));

CREATE INDEX "idx_read_scope_V2_landlords" ON "V2_landlords"
  (upper(trim(COALESCE(json_extract("workspace_id",'$'),''))));

CREATE INDEX "idx_read_scope_V2_properties" ON "V2_properties"
  (upper(trim(COALESCE(json_extract("workspace_id",'$'),''))));

CREATE INDEX "idx_read_scope_V2_rooms" ON "V2_rooms"
  (upper(trim(COALESCE(json_extract("workspace_id",'$'),''))));

CREATE INDEX "idx_read_scope_V2_tenants" ON "V2_tenants"
  (upper(trim(COALESCE(json_extract("workspace_id",'$'),''))));

CREATE INDEX "idx_read_scope_V2_contracts" ON "V2_contracts"
  (upper(trim(COALESCE(json_extract("workspace_id",'$'),''))));

CREATE INDEX "idx_read_scope_V2_bills" ON "V2_bills"
  (upper(trim(COALESCE(json_extract("workspace_id",'$'),''))));

CREATE INDEX "idx_read_scope_V2_payments" ON "V2_payments"
  (upper(trim(COALESCE(json_extract("workspace_id",'$'),''))));

CREATE INDEX "idx_read_scope_V2_contract_requests" ON "V2_contract_requests"
  (upper(trim(COALESCE(json_extract("workspace_id",'$'),''))));

CREATE INDEX "idx_read_scope_V2_payment_reports" ON "V2_payment_reports"
  (upper(trim(COALESCE(json_extract("workspace_id",'$'),''))));

CREATE INDEX "idx_read_scope_V2_tenant_messages" ON "V2_tenant_messages"
  (upper(trim(COALESCE(json_extract("workspace_id",'$'),''))));

CREATE INDEX "idx_read_scope_V2_contract_invites" ON "V2_contract_invites"
  (upper(trim(COALESCE(json_extract("workspace_id",'$'),''))));

CREATE INDEX "idx_read_scope_V2_workspace_settings" ON "V2_workspace_settings"
  (upper(trim(COALESCE(json_extract("workspace_id",'$'),''))));

CREATE INDEX "idx_read_scope_V2_property_owners" ON "V2_property_owners"
  (upper(trim(COALESCE(json_extract("workspace_id",'$'),''))));

CREATE INDEX "idx_read_scope_V2_payment_accounts" ON "V2_payment_accounts"
  (upper(trim(COALESCE(json_extract("workspace_id",'$'),''))));

CREATE INDEX "idx_read_scope_V2_landlord_email_sessions" ON "V2_landlord_email_sessions"
  (upper(trim(COALESCE(json_extract("workspace_id",'$'),''))));

CREATE INDEX "idx_read_scope_V2_landlord_tenant_list_view" ON "V2_landlord_tenant_list_view"
  (upper(trim(COALESCE(json_extract("workspace_id",'$'),''))));
