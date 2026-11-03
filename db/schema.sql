-- Ad auction schema (Cloudflare D1 = SQLite). Run once, e.g. in the Cloudflare dashboard:
--   Workers & Pages → D1 → your database → Console → paste this file → Execute
-- or:  npx wrangler d1 execute <DB_NAME> --remote --file=db/schema.sql
-- Then bind the database to the Pages project with the variable name DB
-- (Pages project → Settings → Bindings → Add → D1 database).

CREATE TABLE IF NOT EXISTS slots (
  slot       INTEGER PRIMARY KEY CHECK (slot IN (1, 2)),
  bid_cents  INTEGER NOT NULL DEFAULT 0,   -- current winning bid; 0 = empty
  ad_id      TEXT,                          -- ad currently shown in this slot
  updated_at TEXT NOT NULL DEFAULT ''
);
INSERT OR IGNORE INTO slots (slot) VALUES (1), (2);

CREATE TABLE IF NOT EXISTS ads (
  id            TEXT PRIMARY KEY,           -- random UUID; also the bidder's private status token
  slot          INTEGER NOT NULL CHECK (slot IN (1, 2)),
  bid_cents     INTEGER NOT NULL CHECK (bid_cents >= 500),
  advertiser    TEXT NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL DEFAULT '',
  url           TEXT NOT NULL,
  contact_email TEXT,                       -- optional, only to contact the advertiser about their ad
  status        TEXT NOT NULL CHECK (status IN
                  ('pending_payment','live','outbid','expired','failed','needs_refund','refunded','refund_failed','removed')),
  payment_id    TEXT,
  preference_id TEXT,
  created_at    TEXT NOT NULL,
  paid_at       TEXT,
  live_at       TEXT,
  ended_at      TEXT
);
CREATE INDEX IF NOT EXISTS ads_status_created ON ads (status, created_at);
-- A payment can settle at most one ad (makes webhook retries idempotent).
CREATE UNIQUE INDEX IF NOT EXISTS ads_payment_unique ON ads (payment_id) WHERE payment_id IS NOT NULL;
