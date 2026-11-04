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
  logo_domain   TEXT,                       -- company logo shown with the ad; always the same site as `url`
  logo_src      TEXT CHECK (logo_src IS NULL OR logo_src IN ('logodev','brandfetch','site')),
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

-- ---- Company logo lookup (see src/services/logoSources.ts) -----------------------------------------------------
-- Upgrading a database created before logos existed:
--   ALTER TABLE ads ADD COLUMN logo_domain TEXT;
--   ALTER TABLE ads ADD COLUMN logo_src TEXT;
--
-- Cached name searches (Logo.dev results may be cached by its terms; Wikidata is CC0). Brandfetch is never stored.
CREATE TABLE IF NOT EXISTS logo_search_cache (
  key        TEXT PRIMARY KEY,              -- "<source>:<lang>:<normalized query>"
  results    TEXT NOT NULL,                 -- JSON array of {name, domain, source}
  fetched_at TEXT NOT NULL
);
-- Logos read from a company's own website (<= 150 KB, sniffed and sanitized). found = 0 caches "no logo here".
CREATE TABLE IF NOT EXISTS site_logos (
  domain       TEXT PRIMARY KEY,
  found        INTEGER NOT NULL,
  kind         TEXT,                        -- 'logo' | 'icon'
  content_type TEXT,
  data_b64     TEXT,
  source_url   TEXT,
  fetched_at   TEXT NOT NULL
);
-- Global hourly counters that cap how many upstream lookups / site fetches this site can trigger.
CREATE TABLE IF NOT EXISTS throttle (
  bucket TEXT NOT NULL,
  hour   TEXT NOT NULL,
  n      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, hour)
);
