import type { D1Like } from './auction'
import { b64, fromB64, type SiteLogo } from './logoSources'
import type { RawCandidate } from './logoMatch'

/** D1-backed caches for the logo lookups (all TTLs in ms). */
export const TTL = { logodev: 30 * 86400_000, wikidata: 7 * 86400_000, siteFound: 30 * 86400_000, siteMissing: 24 * 3600_000 }

const hourKey = (now: number) => new Date(now).toISOString().slice(0, 13)

export async function getCachedSearch(db: D1Like, key: string, ttl: number, now = Date.now()): Promise<RawCandidate[] | null> {
  const row = await db.prepare('SELECT results, fetched_at AS at FROM logo_search_cache WHERE key = ?').bind(key).first<{ results: string; at: string }>()
  if (!row || now - Date.parse(row.at) > ttl) return null
  try { const v = JSON.parse(row.results); return Array.isArray(v) ? v : null } catch { return null }
}
export async function putCachedSearch(db: D1Like, key: string, results: RawCandidate[], now = Date.now()) {
  await db.prepare('INSERT OR REPLACE INTO logo_search_cache (key, results, fetched_at) VALUES (?, ?, ?)').bind(key, JSON.stringify(results), new Date(now).toISOString()).run()
}

export interface StoredSiteLogo { found: boolean; kind: 'logo' | 'icon' | null; contentType: string | null; bytes: Uint8Array | null; sourceUrl: string | null; fetchedAt: number }

export async function getSiteLogo(db: D1Like, domain: string, withBytes = true): Promise<StoredSiteLogo | null> {
  const row = await db.prepare(`SELECT found, kind, content_type AS ct, ${withBytes ? 'data_b64' : 'NULL'} AS data, source_url AS src, fetched_at AS at FROM site_logos WHERE domain = ?`).bind(domain).first<{ found: number; kind: string | null; ct: string | null; data: string | null; src: string | null; at: string }>()
  if (!row) return null
  return { found: row.found === 1, kind: (row.kind as 'logo' | 'icon' | null), contentType: row.ct, bytes: row.data ? fromB64(row.data) : null, sourceUrl: row.src, fetchedAt: Date.parse(row.at) }
}
/** True while the stored answer (logo found, or "no logo here") is still fresh. */
export const siteLogoFresh = (r: StoredSiteLogo, now = Date.now()) => now - r.fetchedAt < (r.found ? TTL.siteFound : TTL.siteMissing)

export async function putSiteLogo(db: D1Like, domain: string, r: SiteLogo, now = Date.now()) {
  await db.prepare('INSERT OR REPLACE INTO site_logos (domain, found, kind, content_type, data_b64, source_url, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(domain, r.found ? 1 : 0, r.kind ?? null, r.contentType ?? null, r.bytes ? b64(r.bytes) : null, r.sourceUrl ?? null, new Date(now).toISOString()).run()
}

/** Counts one use of `bucket` in the current hour; returns false once `limit` is exceeded. */
export async function allow(db: D1Like, bucket: string, limit: number, now = Date.now()): Promise<boolean> {
  const row = await db.prepare('INSERT INTO throttle (bucket, hour, n) VALUES (?, ?, 1) ON CONFLICT(bucket, hour) DO UPDATE SET n = n + 1 RETURNING n').bind(bucket, hourKey(now)).first<{ n: number }>()
  if (Math.random() < 0.02) await db.prepare('DELETE FROM throttle WHERE hour < ?').bind(hourKey(now - 48 * 3600_000)).run()
  return (row?.n ?? 1) <= limit
}
