-- V3 stage 6: evidence from the landlord setup wizard. A channel becomes
-- active only after its webhook test and provider check have passed.
-- previous_webhook_endpoint keeps the URL that CMWebs replaced, for rollback.
ALTER TABLE line_channels ADD COLUMN previous_webhook_endpoint TEXT;
ALTER TABLE line_channels ADD COLUMN webhook_verified_at TEXT;
ALTER TABLE line_channels ADD COLUMN provider_checked_at TEXT;
