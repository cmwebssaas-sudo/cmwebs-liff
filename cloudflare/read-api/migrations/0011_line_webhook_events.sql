-- V3 stage 5: LINE webhooks arrive at /line/webhook/<webhook_key> per channel.
-- bot_user_id is the Official Account's user ID, recorded when the channel is
-- verified; webhook bodies must name it as their destination once it is set.
ALTER TABLE line_channels ADD COLUMN bot_user_id TEXT;

-- One row per webhookEventId. Only 'forwarded' counts as a duplicate, so a
-- redelivery of an event that failed to reach Apps Script is forwarded again.
-- Rows hold no message content and are purged after seven days.
CREATE TABLE line_webhook_events (
  webhook_event_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','forwarded','failed')),
  received_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX line_webhook_events_received ON line_webhook_events(received_at);
