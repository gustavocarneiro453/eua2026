/**
 * Cloudflare Pages Function: GET /api/news?lang=pt|en
 *
 * Why this exists: GDELT limits clients to one request per 5 seconds, answers slowly (10–26 s) and
 * returns HTTP 429 under load, so visitors must not call it directly. A shared copy lives in the
 * edge cache (see src/services/edgeCache.ts): fresh 10 min, served stale up to 6 h if GDELT fails.
 * GDELT's terms allow redistribution with citation of the GDELT Project (the UI shows it).
 * Only headline metadata is stored; article text is never copied.
 */
import { serveCached } from '../../src/services/edgeCache'
import { gdeltUrl, normalizeGdelt, type NewsLang, type NewsPayload } from '../../src/services/newsNormalize'

const UA = 'eua2026-news/1.0 (headline aggregator for US midterm coverage)'

async function fetchFromGdelt(lang: NewsLang): Promise<NewsPayload> {
  const res = await fetch(gdeltUrl(lang), { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(28_000) })
  const text = await res.text()
  if (res.status === 429 || /^\s*Please limit requests/i.test(text)) throw new Error('upstream_rate_limited')
  if (!res.ok) throw new Error(`upstream_http_${res.status}`)
  let json: unknown
  try { json = JSON.parse(text) } catch { throw new Error('upstream_not_json') }
  return { api: 1, lang, fetchedAt: new Date(Date.now()).toISOString(), source: 'GDELT', items: normalizeGdelt(json) }
}

export const onRequestGet = (ctx: { request: Request; waitUntil(p: Promise<unknown>): void }) => {
  const lang: NewsLang = new URL(ctx.request.url).searchParams.get('lang') === 'en' ? 'en' : 'pt'
  return serveCached<NewsPayload>({
    request: ctx.request, waitUntil: ctx.waitUntil.bind(ctx), cacheKey: `news-${lang}`,
    freshMs: 10 * 60_000, staleMs: 6 * 3600_000, browserMaxAge: 120,
    produce: () => fetchFromGdelt(lang), isEmpty: (p) => p.items.length === 0,
  })
}
