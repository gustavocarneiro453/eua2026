/**
 * Cloudflare Pages Function: GET /api/news?lang=pt|en
 *
 * - en: GDELT headlines.
 * - pt: GDELT (Portuguese-language press) + Agência Brasil (EBC) RSS, fetched in parallel; either can fail
 *   without taking the other down. The response says which sources answered.
 * Why server-side: GDELT allows one request per 5 s, answers 429 without CORS headers and is slow.
 * A shared copy lives in the edge cache (src/services/edgeCache.ts): fresh 10 min, stale up to 6 h.
 * Terms: GDELT allows redistribution citing the GDELT Project; EBC authorizes reproduction crediting the
 * source. Only title, link, outlet and time are stored; article text is never copied.
 */
import { fetchUpstream, serveCached } from '../../src/services/edgeCache'
import { EBC_FEED, gdeltUrl, normalizeGdelt, SOURCE_NAME, type NewsItem, type NewsLang, type NewsPayload, type NewsSourceStatus } from '../../src/services/newsNormalize'
import { mergeNews, parseEbcRss } from '../../src/services/rssNormalize'

const UA = 'eua2026-news/1.0 (headline aggregator for US midterm coverage; credits sources on every item)'

async function fetchOnce(lang: NewsLang): Promise<NewsItem[]> {
  const res = await fetchUpstream(gdeltUrl(lang), { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(28_000) })
  const text = await res.text()
  if (res.status === 429 || /^\s*Please limit requests/i.test(text)) throw new Error('upstream_rate_limited')
  if (!res.ok) throw new Error(`upstream_http_${res.status}`)
  let json: unknown
  try { json = JSON.parse(text) } catch { throw new Error('upstream_not_json') }
  return normalizeGdelt(json)
}

// GDELT asks for at most one request every 5 s: on a 429, wait 6 s and try once more (only when GDELT is the only source).
const RETRY_AFTER_RATE_LIMIT_MS = 6_000
async function fetchGdelt(lang: NewsLang, retry: boolean): Promise<NewsItem[]> {
  try { return await fetchOnce(lang) } catch (e) {
    if (!retry || !(e instanceof Error) || e.message !== 'upstream_rate_limited') throw e
    await new Promise((r) => setTimeout(r, RETRY_AFTER_RATE_LIMIT_MS))
    return fetchOnce(lang)
  }
}

async function fetchEbc(): Promise<NewsItem[]> {
  const res = await fetchUpstream(EBC_FEED, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml' }, signal: AbortSignal.timeout(12_000) })
  if (!res.ok) throw new Error(`upstream_http_${res.status}`)
  return parseEbcRss(await res.text())
}

async function produce(lang: NewsLang): Promise<NewsPayload> {
  const jobs: { id: NewsSourceStatus['id']; run: Promise<NewsItem[]> }[] = [{ id: 'gdelt', run: fetchGdelt(lang, lang === 'en') }]
  if (lang === 'pt') jobs.push({ id: 'ebc', run: fetchEbc() })
  const settled = await Promise.allSettled(jobs.map((j) => j.run))
  const sources: NewsSourceStatus[] = settled.map((s, i) => ({ id: jobs[i].id, name: SOURCE_NAME[jobs[i].id], ok: s.status === 'fulfilled', count: s.status === 'fulfilled' ? s.value.length : 0 }))
  if (settled.every((s) => s.status === 'rejected')) {
    if (jobs.length === 1) throw (settled[0] as PromiseRejectedResult).reason // single source: keep the plain reason
    throw new Error(settled.map((s, i) => `${jobs[i].id}:${(s as PromiseRejectedResult).reason?.message ?? 'failed'}`).join(' | '))
  }
  const items = mergeNews(settled.map((s) => (s.status === 'fulfilled' ? s.value : [])))
  return { api: 1, lang, fetchedAt: new Date(Date.now()).toISOString(), source: 'GDELT', sources, items }
}

export const onRequestGet = (ctx: { request: Request; waitUntil(p: Promise<unknown>): void }) => {
  const lang: NewsLang = new URL(ctx.request.url).searchParams.get('lang') === 'en' ? 'en' : 'pt'
  return serveCached<NewsPayload>({
    request: ctx.request, waitUntil: ctx.waitUntil.bind(ctx), cacheKey: `news-${lang}`,
    freshMs: 10 * 60_000, staleMs: 6 * 3600_000, browserMaxAge: 120,
    produce: () => produce(lang), isEmpty: (p) => p.items.length === 0,
  })
}
