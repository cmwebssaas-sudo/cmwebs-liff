-- Public z3House gallery photo URLs parsed from room websites, shared by all
-- Worker isolates. Fresh for 6 hours (1 minute after a failed fetch).
CREATE TABLE room_gallery_cache (
  url TEXT PRIMARY KEY,
  status INTEGER NOT NULL,
  photos TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
