/**
 * News headlines — shared by the Cloudflare Pages Function (functions/api/news.ts) and the client.
 * Source: GDELT Project DOC 2.0 API (https://api.gdeltproject.org/api/v2/doc/doc), mode=ArtList.
 *
 * Verified 2026-11-03:
 * - Free, no key. Access-Control-Allow-Origin: *, Cache-Control: public, max-age=900.
 * - Rate limit: "one request every 5 seconds"; "high-traffic users" are told to use other datasets;
 *   responses took 10–26 s and many requests got HTTP 429 (plain-text body, not JSON).
 * - Terms (gdeltproject.org/about.html): unrestricted use incl. commercial; redistribution allowed,
 *   but any use or redistribution must cite the GDELT Project and link https://www.gdeltproject.org/.
 * - Only headline metadata is returned (title, url, domain, seendate, language, sourcecountry).
 *   `seendate` is when GDELT indexed the article, not necessarily when it was published.
 */

export type NewsLang = 'pt' | 'en'

export type NewsSourceId = 'gdelt' | 'ebc'

export interface NewsItem {
  id: string
  title: string
  url: string
  domain: string
  /** ISO 8601 UTC: GDELT = when it indexed the article; EBC = publication time */
  seenAt: string
  country: string | null
  /** Which source supplied the item (missing in older cached copies = gdelt) */
  source?: NewsSourceId
}

export interface NewsSourceStatus { id: NewsSourceId; name: string; ok: boolean; count: number }

export interface NewsPayload {
  api: 1
  lang: NewsLang
  /** When our server obtained this list from GDELT */
  fetchedAt: string
  source: 'GDELT'
  /** Per-source outcome of this refresh (Portuguese feed combines GDELT and Agência Brasil) */
  sources?: NewsSourceStatus[]
  items: NewsItem[]
}

export const GDELT_ENDPOINT = 'https://api.gdeltproject.org/api/v2/doc/doc'
export const GDELT_SITE = 'https://www.gdeltproject.org/'
export const EBC_SITE = 'https://agenciabrasil.ebc.com.br/'
export const EBC_FEED = 'https://agenciabrasil.ebc.com.br/rss/internacional/feed.xml'
export const EBC_TERMS = 'https://www.ebc.com.br/termos-de-uso-e-condicoes-gerais-do-portal-da-ebc'
export const SOURCE_NAME: Record<NewsSourceId, string> = { gdelt: 'GDELT Project', ebc: 'Agência Brasil (EBC)' }
export const SOURCE_URL: Record<NewsSourceId, string> = { gdelt: GDELT_SITE, ebc: EBC_SITE }

export const GDELT_QUERY: Record<NewsLang, string> = {
  pt: '("eleições nos EUA" OR "eleições americanas" OR "eleições de meio de mandato" OR "eleições legislativas dos EUA" OR midterms) sourcelang:portuguese',
  en: '("midterm elections" OR "2026 midterms") sourcelang:english',
}

export function gdeltUrl(lang: NewsLang, timespan = '2d') {
  const q = new URLSearchParams({ query: GDELT_QUERY[lang], mode: 'ArtList', format: 'json', maxrecords: '75', sort: 'datedesc', timespan })
  return `${GDELT_ENDPOINT}?${q}`
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' }

/** GDELT tokenizes titles ("Trump ' s", "midterms : x"); undo the extra spacing. */
export function cleanTitle(s: string) {
  return s
    .replace(/&(amp|quot|#39|apos|lt|gt|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?%)\]”’»])/g, '$1')
    .replace(/([(\[“‘«])\s+/g, '$1')
    .replace(/(\w)\s+'\s*(s|t|re|ve|ll|d)\b/gi, "$1'$2")
    .trim()
}

export function parseSeenDate(s: unknown): string | null {
  const m = typeof s === 'string' ? /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s) : null
  if (!m) return null
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`
  return Number.isNaN(Date.parse(iso)) ? null : iso
}

export const dedupKey = (title: string) => title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().slice(0, 70)

/** Raw GDELT ArtList JSON → clean, deduplicated items (newest first). Never invents fields. */
export function normalizeGdelt(raw: unknown, limit = 36): NewsItem[] {
  const arts = (raw as { articles?: unknown })?.articles
  if (!Array.isArray(arts)) return [] // GDELT answers {} when nothing matches
  const seen = new Set<string>()
  const out: NewsItem[] = []
  for (const a of arts as Record<string, unknown>[]) {
    if (!a || typeof a.url !== 'string' || typeof a.title !== 'string') continue
    let u: URL
    try { u = new URL(a.url) } catch { continue }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') continue
    const seenAt = parseSeenDate(a.seendate)
    const title = cleanTitle(a.title)
    if (!seenAt || title.length < 15) continue
    const key = dedupKey(title)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id: u.href, title, url: u.href,
      domain: typeof a.domain === 'string' && a.domain ? a.domain.replace(/^www\./, '') : u.hostname.replace(/^www\./, ''),
      seenAt,
      country: typeof a.sourcecountry === 'string' && a.sourcecountry ? a.sourcecountry : null,
      source: 'gdelt',
    })
  }
  out.sort((x, y) => Date.parse(y.seenAt) - Date.parse(x.seenAt))
  return out.slice(0, limit)
}

/** Strict check used by the client on /api/news responses. */
export function validateNews(raw: any, lang: NewsLang): NewsPayload {
  if (!raw || raw.api !== 1 || raw.lang !== lang || raw.source !== 'GDELT' || !Array.isArray(raw.items) || Number.isNaN(Date.parse(raw.fetchedAt))) throw new Error('invalid_news_payload')
  for (const i of raw.items) {
    if (!i || typeof i.title !== 'string' || typeof i.url !== 'string' || !/^https?:\/\//.test(i.url) || Number.isNaN(Date.parse(i.seenAt))) throw new Error('invalid_news_item')
  }
  if (raw.sources !== undefined && !(Array.isArray(raw.sources) && raw.sources.every((s: any) => s && (s.id === 'gdelt' || s.id === 'ebc') && typeof s.ok === 'boolean'))) throw new Error('invalid_news_sources')
  return raw as NewsPayload
}
