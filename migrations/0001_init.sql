-- HuntFlow cloud backend schema (Cloudflare D1).
--
-- Every table is keyed by the Firebase uid (`sub` claim of the ID
-- token), so one user can never read or write another user's rows.

-- One row per synced record. `payload` is the record as JSON text.
-- A tombstone keeps `deleted_at` and a stub payload so deletions
-- propagate. `server_seq` is the per-user change counter at the time
-- the row last changed; devices pull "everything after my cursor".
CREATE TABLE IF NOT EXISTS sync_items (
  uid TEXT NOT NULL,
  collection TEXT NOT NULL,
  local_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  server_seq INTEGER NOT NULL,
  PRIMARY KEY (uid, collection, local_id)
);
CREATE INDEX IF NOT EXISTS sync_items_by_seq ON sync_items (uid, server_seq);

-- Monotonic per-user change counter. Never reset (not even by a cloud
-- wipe) so device cursors stay valid.
CREATE TABLE IF NOT EXISTS sync_state (
  uid TEXT PRIMARY KEY,
  seq INTEGER NOT NULL
);

-- Evidence files stored in R2 at `object_key`.
CREATE TABLE IF NOT EXISTS asset_files (
  uid TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  file_name TEXT,
  relative_path TEXT,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploaded_at INTEGER NOT NULL,
  PRIMARY KEY (uid, asset_id)
);

-- HuntFlow Pro entitlement, written only by the verified Dodo webhook.
-- `updated_at` is the webhook event time (ms) for last-writer-wins.
CREATE TABLE IF NOT EXISTS entitlements (
  uid TEXT PRIMARY KEY,
  is_pro INTEGER NOT NULL,
  dodo_customer_id TEXT NOT NULL DEFAULT '',
  dodo_subscription_id TEXT,
  current_period_end INTEGER,
  updated_at INTEGER NOT NULL
);

-- Standard Webhooks `webhook-id` values already applied (dedupe).
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  webhook_id TEXT PRIMARY KEY,
  delivered_at INTEGER NOT NULL
);

-- Fixed-window rate limits (contact form). `key` holds a hash, never a raw IP.
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
