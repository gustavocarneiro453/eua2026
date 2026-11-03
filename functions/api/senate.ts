/**
 * Cloudflare Pages Function: GET /api/senate — current senators from the official senate.gov XML
 * (no CORS header there). Changes rarely: fresh 12 h, stale up to 7 days if senate.gov fails.
 */
import { fetchUpstream, jsonResponse, serveCached } from '../../src/services/edgeCache'
import { SENATE_FALLBACK } from '../../src/data/senateSnapshot'
import { parseSenateXml, SENATE_XML, type SenatePayload } from '../../src/services/senateNormalize'

async function produce(): Promise<SenatePayload> {
  const res = await fetchUpstream(SENATE_XML, { headers: { 'User-Agent': 'eua2026-senate/1.0', Accept: 'text/xml' }, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`upstream_http_${res.status}`)
  return { api: 1, fetchedAt: new Date(Date.now()).toISOString(), source: 'senate.gov', members: parseSenateXml(await res.text()) }
}

export const onRequestGet = async (ctx: { request: Request; waitUntil(p: Promise<unknown>): void }) => {
  const res = await serveCached<SenatePayload>({
    request: ctx.request, waitUntil: ctx.waitUntil.bind(ctx), cacheKey: 'senate',
    freshMs: 12 * 3600_000, staleMs: 7 * 86400_000, browserMaxAge: 3600, produce,
  })
  // senate.gov unreachable and no recent server copy: serve the embedded official list, clearly flagged.
  return res.status === 502 ? jsonResponse(SENATE_FALLBACK, 'fallback', 300) : res
}
