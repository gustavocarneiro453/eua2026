/**
 * Shared edge-cache helper for Cloudflare Pages Functions (Cache API, no KV/DB).
 * Fresh copy served as-is; after `freshMs` a refresh is attempted (one in flight per key);
 * if the upstream fails, a copy younger than `staleMs` is served instead (stale-if-error).
 */
export interface Stamped { fetchedAt: string }

const inflight = new Map<string, Promise<unknown>>()

export function jsonResponse(body: unknown, state: string, browserMaxAge: number, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    // Never leak the long edge-storage TTL to browsers.
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${browserMaxAge}`, 'X-Edge-Cache': state },
  })
}

export async function serveCached<T extends Stamped>(o: {
  request: Request
  waitUntil: (p: Promise<unknown>) => void
  cacheKey: string
  freshMs: number
  staleMs: number
  browserMaxAge: number
  produce: () => Promise<T>
  isEmpty?: (v: T) => boolean
}): Promise<Response> {
  const cache = (caches as unknown as { default: Cache }).default
  const key = new Request(`${new URL(o.request.url).origin}/__edge-cache/${o.cacheKey}`)
  let stale: T | null = null
  const hit = await cache.match(key)
  if (hit) {
    const v = (await hit.json()) as T
    const age = Date.now() - Date.parse(v.fetchedAt)
    if (age < o.freshMs) return jsonResponse(v, 'hit', o.browserMaxAge)
    if (age < o.staleMs) stale = v
  }
  try {
    let p = inflight.get(o.cacheKey) as Promise<T> | undefined
    if (!p) { p = o.produce().finally(() => inflight.delete(o.cacheKey)); inflight.set(o.cacheKey, p) }
    const fresh = await p
    const empty = o.isEmpty?.(fresh) ?? false
    if (empty && stale) return jsonResponse(stale, 'stale-empty-upstream', o.browserMaxAge)
    if (!empty) {
      o.waitUntil(cache.put(key, new Response(JSON.stringify(fresh), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${o.staleMs / 1000}` } })))
    }
    return jsonResponse(fresh, 'miss', o.browserMaxAge)
  } catch (e) {
    if (stale) return jsonResponse(stale, 'stale-if-error', o.browserMaxAge)
    return jsonResponse({ error: e instanceof Error ? e.message : 'upstream_unavailable' }, 'error', 30, 502)
  }
}
