/**
 * POST /api/logo/site  {"url": "https://example.com"}
 * Looks for the company's logo on its OWN website (JSON-LD logo, apple-touch-icon, icons), validates the image
 * (real type from its bytes, ≤150 KB, unsafe SVG rejected) and stores it, so it is served from /api/logo/img.
 * Fetching is SSRF-guarded (https + public host at every redirect hop). Sites that block robots (403) are respected:
 * the answer is simply "not found". Results are cached 30 days (found) / 24 h (not found).
 */
import { type Ctx, getDb, json, sameOrigin } from '../../../src/services/adsHttp'
import { normalizeDomain } from '../../../src/services/logoMatch'
import { findSiteLogo } from '../../../src/services/logoSources'
import { allow, getSiteLogo, putSiteLogo, siteLogoFresh } from '../../../src/services/logoStore'

const HOURLY_SITE_FETCH_LIMIT = 400
const inflight = new Map<string, ReturnType<typeof findSiteLogo>>()

export const onRequestPost = async ({ request, env }: Ctx) => {
  const db = getDb(env)
  if (!db) return json({ error: 'not_configured' }, 503)
  if (!sameOrigin(request)) return json({ error: 'forbidden_origin' }, 403)
  let body: { url?: unknown }
  try { const t = await request.text(); if (t.length > 1000) return json({ error: 'payload_too_large' }, 413); body = JSON.parse(t) } catch { return json({ error: 'invalid_json' }, 400) }
  const domain = typeof body?.url === 'string' ? normalizeDomain(body.url) : null
  if (!domain) return json({ error: 'invalid_url' }, 422)

  const answer = (found: boolean, kind: string | null) => json({ api: 1, domain, found, kind, imageUrl: found ? `/api/logo/img?d=${encodeURIComponent(domain)}` : null })
  const cached = await getSiteLogo(db, domain, false)
  if (cached && siteLogoFresh(cached)) return answer(cached.found, cached.kind)
  if (!(await allow(db, 'site-fetch', HOURLY_SITE_FETCH_LIMIT))) return json({ error: 'busy' }, 429)

  let p = inflight.get(domain)
  if (!p) { p = findSiteLogo(domain).finally(() => inflight.delete(domain)); inflight.set(domain, p) }
  const r = await p.catch(() => ({ found: false } as const))
  await putSiteLogo(db, domain, r)
  return answer(r.found, r.found ? r.kind ?? null : null)
}
