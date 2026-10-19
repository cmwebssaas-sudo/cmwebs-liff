-- Generated additive projection extension; never stores an unmasked bank account.
ALTER TABLE "V2_workspaces" ADD COLUMN "created_by_user_id" TEXT;

ALTER TABLE "V2_workspaces" ADD COLUMN "replica_source_row" TEXT;

ALTER TABLE "V2_workspaces" ADD COLUMN "replica_date_fields" TEXT;

ALTER TABLE "V2_workspace_members" ADD COLUMN "joined_at" TEXT;

ALTER TABLE "V2_workspace_members" ADD COLUMN "replica_source_row" TEXT;

ALTER TABLE "V2_workspace_members" ADD COLUMN "replica_date_fields" TEXT;

ALTER TABLE "V2_member_scopes" ADD COLUMN "replica_source_row" TEXT;

ALTER TABLE "V2_member_scopes" ADD COLUMN "replica_date_fields" TEXT;

ALTER TABLE "V2_users" ADD COLUMN "replica_source_row" TEXT;

ALTER TABLE "V2_users" ADD COLUMN "replica_date_fields" TEXT;

ALTER TABLE "V2_landlords" ADD COLUMN "replica_source_row" TEXT;

ALTER TABLE "V2_landlords" ADD COLUMN "replica_date_fields" TEXT;

ALTER TABLE "V2_properties" ADD COLUMN "replica_source_row" TEXT;

ALTER TABLE "V2_properties" ADD COLUMN "replica_date_fields" TEXT;

ALTER TABLE "V2_rooms" ADD COLUMN "replica_source_row" TEXT;

ALTER TABLE "V2_rooms" ADD COLUMN "replica_date_fields" TEXT;

ALTER TABLE "V2_rooms" ADD COLUMN "replica_room_bridge_supported" TEXT;

ALTER TABLE "V2_tenants" ADD COLUMN "replica_source_row" TEXT;

ALTER TABLE "V2_tenants" ADD COLUMN "replica_date_fields" TEXT;

ALTER TABLE "V2_contracts" ADD COLUMN "replica_source_row" TEXT;

ALTER TABLE "V2_contracts" ADD COLUMN "replica_date_fields" TEXT;

ALTER TABLE "V2_bills" ADD COLUMN "replica_source_row" TEXT;

ALTER TABLE "V2_bills" ADD COLUMN "replica_date_fields" TEXT;

ALTER TABLE "V2_payments" ADD COLUMN "replica_source_row" TEXT;

ALTER TABLE "V2_payments" ADD COLUMN "replica_date_fields" TEXT;

ALTER TABLE "V2_contract_requests" ADD COLUMN "replica_source_row" TEXT;

ALTER TABLE "V2_contract_requests" ADD COLUMN "replica_date_fields" TEXT;

ALTER TABLE "V2_payment_reports" ADD COLUMN "replica_source_row" TEXT;

ALTER TABLE "V2_payment_reports" ADD COLUMN "replica_date_fields" TEXT;

ALTER TABLE "V2_tenant_messages" ADD COLUMN "replica_source_row" TEXT;

ALTER TABLE "V2_tenant_messages" ADD COLUMN "replica_date_fields" TEXT;

ALTER TABLE "V2_contract_invites" ADD COLUMN "replica_source_row" TEXT;

ALTER TABLE "V2_contract_invites" ADD COLUMN "replica_date_fields" TEXT;

CREATE TABLE "V2_workspace_settings" (
  row_key TEXT PRIMARY KEY,
  row_hash TEXT NOT NULL,
  synced_at TEXT NOT NULL,
  "workspace_id" TEXT,
  "locale" TEXT,
  "timezone" TEXT,
  "currency" TEXT,
  "default_payment_day" TEXT,
  "default_electricity_fee_rate" TEXT,
  "summer_month_start" TEXT,
  "summer_month_end" TEXT,
  "summer_equipment_fee_rate" TEXT,
  "regular_equipment_fee_rate" TEXT,
  "default_management_fee" TEXT,
  "default_deposit_months" TEXT,
  "late_fee_type" TEXT,
  "late_fee_value" TEXT,
  "late_fee_grace_days" TEXT,
  "auto_overdue_reminder" TEXT,
  "overdue_reminder_hour" TEXT,
  "overdue_reminder_days_json" TEXT,
  "updated_at" TEXT,
  "replica_source_row" TEXT,
  "replica_date_fields" TEXT
);

CREATE TABLE "V2_property_owners" (
  row_key TEXT PRIMARY KEY,
  row_hash TEXT NOT NULL,
  synced_at TEXT NOT NULL,
  "property_owner_id" TEXT,
  "workspace_id" TEXT,
  "property_id" TEXT,
  "owner_user_id" TEXT,
  "owner_name" TEXT,
  "owner_phone" TEXT,
  "ownership_percentage" TEXT,
  "is_primary_owner" TEXT,
  "payment_recipient" TEXT,
  "updated_at" TEXT,
  "replica_source_row" TEXT,
  "replica_date_fields" TEXT
);

CREATE TABLE "V2_payment_accounts" (
  row_key TEXT PRIMARY KEY,
  row_hash TEXT NOT NULL,
  synced_at TEXT NOT NULL,
  "payment_account_id" TEXT,
  "workspace_id" TEXT,
  "account_name" TEXT,
  "bank_code" TEXT,
  "bank_name" TEXT,
  "bank_account_last5" TEXT,
  "is_default" TEXT,
  "account_status" TEXT,
  "updated_at" TEXT,
  "replica_source_row" TEXT,
  "replica_date_fields" TEXT
);

ALTER TABLE "V2_landlord_email_sessions" ADD COLUMN "replica_source_row" TEXT;

ALTER TABLE "V2_landlord_email_sessions" ADD COLUMN "replica_date_fields" TEXT;

CREATE TABLE "V2_landlord_tenant_list_view" (
  row_key TEXT PRIMARY KEY,
  row_hash TEXT NOT NULL,
  synced_at TEXT NOT NULL,
  "tenant_id" TEXT,
  "workspace_id" TEXT,
  "line_user_id" TEXT,
  "user_id" TEXT,
  "landlord_id" TEXT,
  "landlord_name" TEXT,
  "tenant_line_user_id" TEXT,
  "tenant_user_id" TEXT,
  "tenant_name" TEXT,
  "tenant_phone" TEXT,
  "tenant_email" TEXT,
  "tenant_binding_status" TEXT,
  "room_list" TEXT,
  "latest_bill_month" TEXT,
  "latest_due_date" TEXT,
  "latest_total_amount" TEXT,
  "latest_payment_status" TEXT,
  "unpaid_bill_count" TEXT,
  "unpaid_total_amount" TEXT,
  "tenant_account_status" TEXT,
  "updated_at" TEXT,
  "property_id" TEXT,
  "property_name" TEXT,
  "room_id" TEXT,
  "current_contract_id" TEXT,
  "contract_status" TEXT,
  "contract_start_date" TEXT,
  "contract_end_date" TEXT,
  "created_at" TEXT,
  "replica_source_row" TEXT,
  "replica_date_fields" TEXT
);
