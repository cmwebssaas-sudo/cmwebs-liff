-- Generated additive projection extension; existing migrations are immutable.
ALTER TABLE "V2_users" ADD COLUMN "email_verified_at" TEXT;

ALTER TABLE "V2_users" ADD COLUMN "email_login_enabled" TEXT;
