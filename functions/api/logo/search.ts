/**
 * GET /api/logo/search?q=<company name or website>&lang=pt|en
 * Company name → candidate domains, best first, with a flag saying whether the best one is clear-cut.
 *   - Logo.dev Search (when LOGODEV_SECRET_KEY is set) and Wikidata, results cached in D1 (Logo.dev: 30 d, Wikidata: 7 d)
 *   - Brandfetch is searched live by the visitor's browser (its terms forbid server calls and caching)
 *   - a typed domain/URL needs no search at all
 * Total upstream lookups are capped per hour so the free plans cannot be drained.
 */
import { type Ctx, getDb, json } from '../../../src/services/adsHttp'
import { looksLikeDomain, normalizeDomain, normalizeName, rankCandidates, type RawCandidate } from '../../../src/services/logoMatch'
import { logodevSearch, type LogoEnv, wikidataSearch } from '../../../src/services/logoSources'
import { allow, getCachedSearch, putCachedSearch, TTL } from '../../../src/services/logoStore'

const HOURLY_UPSTREAM_LIMIT = 3000

export const onRequestGet = async ({ request, env }: Ctx & { env: Ctx['env'] & LogoEnv }) => {
  const db = getDb(env)
  if (!db) return json({ error: 'not_configured' }, 503)
  const u = new URL(request.url)
  const q = (u.searchParams.get('q') ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
  const lang: 'pt' | 'en' = u.searchParams.get('lang') === 'en' ? 'en' : 'pt'
  if (q.length < 2 || q.length > 80) return json({ error: 'invalid_query' }, 422)

  if (looksLikeDomain(q)) {
    const domain = normalizeDomain(q) as string
    return json({ api: 1, typedDomain: domain, candidates: [], confident: false, sources: {} })
  }

  const norm = normalizeName(q)
  const sources: Record<string, string> = { logodev: env.LOGODEV_SECRET_KEY ? 'ok' : 'off', wikidata: 'ok', brandfetch: env.BRANDFETCH_CLIENT_ID ? 'client' : 'off' }
  const raw: RawCandidate[] = []
  const lookups: { id: 'logodev' | 'wikidata'; key: string; ttl: number; run: () => Promise<RawCandidate[]> }[] = []
  if (env.LOGODEV_SECRET_KEY) lookups.push({ id: 'logodev', key: `logodev:${norm}`, ttl: TTL.logodev, run: () => logodevSearch(env, q) })
  lookups.push({ id: 'wikidata', key: `wikidata:${lang}:${norm}`, ttl: TTL.wikidata, run: () => wikidataSearch(q, lang) })

  await Promise.all(lookups.map(async (l) => {
    try {
      const cached = await getCachedSearch(db, l.key, l.ttl)
      if (cached) { raw.push(...cached); return }
      if (!(await allow(db, 'logo-search', HOURLY_UPSTREAM_LIMIT))) { sources[l.id] = 'busy'; return }
      const fresh = await l.run()
      await putCachedSearch(db, l.key, fresh) // an empty answer is cached too: "nothing found" is an answer
      raw.push(...fresh)
    } catch (e) {
      sources[l.id] = `error:${(e as Error).message.slice(0, 30)}`
      console.warn(`[logo] ${l.id} search failed: ${(e as Error).message}`)
    }
  }))

  const { candidates, confident } = rankCandidates(q, raw)
  return json({ api: 1, candidates, confident, sources }, 200, 'public, max-age=120')
}
