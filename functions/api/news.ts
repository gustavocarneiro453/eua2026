/**
 * Cloudflare Pages Function: GET /api/news?lang=pt|en
 *
 * Why this exists: GDELT limits clients to one request per 5 seconds, answers slowly (10–26 s) and
 * returns HTTP 429 under load, so visitors must not call it directly. This keeps a shared copy in
 * Cloudflare's edge cache (per data center): fresh for 10 min, served stale for up to 6 h if GDELT
 * fails. GDELT's terms allow redistribution with citation of the GDELT Project (the UI shows it).
 * No KV, no database. Only headline metadata is stored; article text is never copied.
 */
import { gdeltUrl, normalizeGdelt, type NewsLang, type NewsPayload } from '../../src/services/newsNormalize'

const FRESH_MS = 10 * 60_000
const STALE_MS = 6 * 3600_000
const UPSTREAM_TIMEOUT_MS = 28_000
const UA = 'eua2026-news/1.0 (headline aggregator for US midterm coverage)'

const inflight = new Map<NewsLang, Promise<NewsPayload>>()

async function fetchFromGdelt(lang: NewsLang): Promise<NewsPayload> {
  const res = await fetch(gdeltUrl(lang), { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) })
  const text = await res.text()
  if (res.status === 429 || /^\s*Please limit requests/i.test(text)) throw new Error('upstream_rate_limited')
  if (!res.ok) throw new Error(`upstream_http_${res.status}`)
  let json: unknown
  try { json = JSON.parse(text) } catch { throw new Error('upstream_not_json') }
  return { api: 1, lang, fetchedAt: new Date(Date.now()).toISOString(), source: 'GDELT', items: normalizeGdelt(json) }
}

// One upstream request at a time per language inside an isolate.
function refresh(lang: NewsLang) {
  let p = inflight.get(lang)
  if (!p) { p = fetchFromGdelt(lang).finally(() => inflight.delete(lang)); inflight.set(lang, p) }
  return p
}

function respond(payload: unknown, state: string, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    // Browsers may reuse for 2 min; never let the 6 h edge-storage TTL leak to clients.
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=120', 'X-News-Cache': state },
  })
}

export const onRequestGet = async (ctx: { request: Request; waitUntil(p: Promise<unknown>): void }) => {
  const url = new URL(ctx.request.url)
  const lang: NewsLang = url.searchParams.get('lang') === 'en' ? 'en' : 'pt'
  const cache = (caches as unknown as { default: Cache }).default
  const key = new Request(`${url.origin}/__news-cache/${lang}`)

  let stale: NewsPayload | null = null
  const hit = await cache.match(key)
  if (hit) {
    const p = (await hit.json()) as NewsPayload
    const age = Date.now() - Date.parse(p.fetchedAt)
    if (age < FRESH_MS) return respond(p, 'hit')
    if (age < STALE_MS) stale = p
  }

  try {
    const fresh = await refresh(lang)
    if (fresh.items.length === 0 && stale) return respond(stale, 'stale-empty-upstream')
    if (fresh.items.length > 0) {
      ctx.waitUntil(cache.put(key, new Response(JSON.stringify(fresh), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${STALE_MS / 1000}` } })))
    }
    return respond(fresh, 'miss')
  } catch (e) {
    if (stale) return respond(stale, 'stale-if-error')
    return respond({ error: e instanceof Error ? e.message : 'upstream_unavailable' }, 'error', 502)
  }
}
