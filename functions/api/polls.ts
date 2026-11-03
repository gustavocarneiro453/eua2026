/**
 * Cloudflare Pages Function: GET /api/polls
 * VoteHub sends no CORS header and returns whole poll lists (up to 3 MB), so it is read here and
 * trimmed to 2026 general-election polls of the last 150 days (≤6 per race). Edge cache: fresh 30 min,
 * stale up to 24 h if VoteHub fails. Polls are labeled as polls everywhere in the UI, never as results.
 */
import { serveCached } from '../../src/services/edgeCache'
import { normalizePolls, POLL_TYPES, VOTEHUB_API, type Poll, type PollsPayload } from '../../src/services/pollsNormalize'

const UA = 'eua2026-polls/1.0 (election coverage; attribution to VoteHub shown)'

async function produce(): Promise<PollsPayload> {
  const lists = await Promise.all(POLL_TYPES.map(async (t) => {
    const res = await fetch(`${VOTEHUB_API}?${t.query}`, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(25_000) })
    if (!res.ok) throw new Error(`upstream_http_${res.status}`)
    let json: unknown
    try { json = await res.json() } catch { throw new Error('upstream_not_json') }
    return normalizePolls(t.kind, json, Date.now())
  }))
  const polls: Poll[] = lists.flat()
  return { api: 1, fetchedAt: new Date(Date.now()).toISOString(), source: 'VoteHub', polls }
}

export const onRequestGet = (ctx: { request: Request; waitUntil(p: Promise<unknown>): void }) =>
  serveCached<PollsPayload>({
    request: ctx.request, waitUntil: ctx.waitUntil.bind(ctx), cacheKey: 'polls',
    freshMs: 30 * 60_000, staleMs: 24 * 3600_000, browserMaxAge: 300,
    produce, isEmpty: (p) => p.polls.length === 0,
  })
