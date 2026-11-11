-- V3 stage 6: rich menus CMWebs published to a landlord's Official Account.
-- previous_default_menu_id is a default menu the landlord had set through the
-- Messaging API; menus made in the OA Manager cannot be read and come back on
-- their own once CMWebs removes its default.
CREATE TABLE line_rich_menus (
  workspace_id TEXT PRIMARY KEY,
  palette TEXT NOT NULL,
  template TEXT NOT NULL,
  tenant_menu_id TEXT NOT NULL,
  landlord_menu_id TEXT NOT NULL,
  previous_default_menu_id TEXT,
  default_enabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- People CMWebs linked a per-user menu to, so a new template can relink them.
CREATE TABLE line_rich_menu_users (
  workspace_id TEXT NOT NULL,
  line_user_id TEXT NOT NULL,
  menu TEXT NOT NULL CHECK (menu IN ('landlord','tenant')),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, line_user_id)
);
