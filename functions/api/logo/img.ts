/**
 * GET /api/logo/img?d=<domain> — serves a logo that /api/logo/site stored for that domain.
 * Hardened: the stored bytes were sniffed and sanitized, and the response carries a sandboxing CSP + nosniff so even an
 * SVG opened directly in a tab cannot run anything on this origin. Cached 1 day in browsers, 7 days at the edge.
 */
import { type Ctx, getDb } from '../../../src/services/adsHttp'
import { normalizeDomain } from '../../../src/services/logoMatch'
import { getSiteLogo } from '../../../src/services/logoStore'

const HEADERS = {
  'Cache-Control': 'public, max-age=86400, s-maxage=604800',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  'Cross-Origin-Resource-Policy': 'same-origin',
}
const notFound = () => new Response(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } })

export const onRequestGet = async ({ request, env, waitUntil }: Ctx) => {
  const db = getDb(env)
  const raw = new URL(request.url).searchParams.get('d') ?? ''
  const domain = normalizeDomain(raw)
  if (!db || !domain || domain !== raw) return notFound()
  const cache = (caches as unknown as { default: Cache }).default
  const key = new Request(`${new URL(request.url).origin}/__logo-img/${domain}`)
  const hit = await cache.match(key)
  if (hit) return hit
  const row = await getSiteLogo(db, domain)
  if (!row?.found || !row.bytes || !row.contentType) return notFound()
  const res = new Response(row.bytes as BodyInit, { headers: { ...HEADERS, 'Content-Type': row.contentType } })
  waitUntil(cache.put(key, res.clone()))
  return res
}
