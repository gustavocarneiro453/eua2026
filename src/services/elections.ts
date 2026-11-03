import type { FeedState, Race, Snapshot, UpdateEvent } from './types'

/**
 * Election data service — single shared poller for the whole app.
 *
 * SOURCE STATUS: the Open America API (https://openamerica.io/elections/api/) has NOT been
 * verified yet (docs unreachable from the build environment). Until its endpoints, payload
 * fields and redistribution terms are confirmed, no provider-specific mapping exists here.
 * The app reads VITE_ELECTIONS_SNAPSHOT_URL, which must serve the normalized Snapshot shape
 * (src/services/types.ts). When Open America is verified, add `normalizeOpenAmerica(raw)` and
 * pass it as the adapter below — nothing else in the UI has to change.
 */

const SNAPSHOT_URL = (import.meta.env.VITE_ELECTIONS_SNAPSHOT_URL as string | undefined)?.trim() || ''
const POLL_MS = Math.max(30, Number(import.meta.env.VITE_POLL_SECONDS) || 60) * 1000
const MAX_BACKOFF_MS = 10 * 60 * 1000
const STALE_AFTER_MS = POLL_MS * 3
const STORAGE_KEY = 'eua2026:snapshot:v1'

type Adapter = (raw: unknown) => Snapshot
const adapter: Adapter = (raw) => {
  if (!isSnapshot(raw)) throw new Error('invalid_payload')
  return raw
}

// ---------- validation (no field is assumed; invalid payloads are rejected, never patched) ----------
const isNumOrNull = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v))
function isRace(r: any): r is Race {
  return r && typeof r.id === 'string' && ['senate', 'house', 'governor'].includes(r.office) &&
    typeof r.state === 'string' && ['no_data', 'counting', 'projected', 'official', 'certified'].includes(r.status) &&
    Array.isArray(r.candidates) && isNumOrNull(r.reportingPct) &&
    r.candidates.every((c: any) => c && typeof c.id === 'string' && typeof c.name === 'string' && isNumOrNull(c.votes) && isNumOrNull(c.pct)) &&
    // certification is only accepted with evidence; projection only with a named source
    (r.status !== 'certified' || typeof r.certificationSource === 'string') &&
    (r.status !== 'projected' || typeof r.projectionSource === 'string')
}
function isSnapshot(s: any): s is Snapshot {
  return s && s.source && typeof s.source.name === 'string' && Array.isArray(s.races) &&
    Array.isArray(s.coverage) && typeof s.isDemo === 'boolean' && s.races.every(isRace)
}

// ---------- store ----------
let state: FeedState = {
  status: SNAPSHOT_URL ? 'loading' : 'not_configured',
  snapshot: null, lastSuccessAt: null, lastAttemptAt: null, error: null, stale: false,
}
let events: UpdateEvent[] = []
const listeners = new Set<() => void>()
let etag: string | null = null
let lastModified: string | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let inflight: Promise<void> | null = null
let failures = 0
let nextDelay = POLL_MS

function set(patch: Partial<FeedState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

// Restore last valid snapshot so a reload during an outage still shows data (flagged stale).
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  if (SNAPSHOT_URL && saved && isSnapshot(saved.snapshot)) {
    state = { ...state, snapshot: saved.snapshot, lastSuccessAt: saved.at, stale: Date.now() - saved.at > STALE_AFTER_MS }
  }
} catch { /* storage unavailable */ }

function diff(prev: Snapshot | null, next: Snapshot) {
  if (!prev) return
  const old = new Map(prev.races.map((r) => [r.id, r]))
  const now = Date.now()
  for (const r of next.races) {
    const o = old.get(r.id)
    if (!o || o.status === r.status) continue
    const kind: UpdateEvent['kind'] | null =
      o.status === 'no_data' && r.status === 'counting' ? 'first_results'
      : r.status === 'projected' || r.status === 'official' || r.status === 'certified' ? r.status : null
    if (kind) events = [{ id: `${r.id}:${kind}:${now}`, at: now, raceId: r.id, kind }, ...events].slice(0, 50)
  }
}

function maxAgeMs(res: Response) {
  const m = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '')
  return m ? Number(m[1]) * 1000 : 0
}

async function fetchOnce(): Promise<void> {
  if (!SNAPSHOT_URL) return
  if (inflight) return inflight // dedupe concurrent requests
  inflight = (async () => {
    set({ lastAttemptAt: Date.now() })
    try {
      const headers: Record<string, string> = { Accept: 'application/json' }
      if (etag) headers['If-None-Match'] = etag
      if (lastModified) headers['If-Modified-Since'] = lastModified
      const res = await fetch(SNAPSHOT_URL, { headers, cache: 'no-cache' })
      const now = Date.now()
      // Respect server caching: never poll faster than max-age.
      nextDelay = Math.max(POLL_MS, maxAgeMs(res))
      if (res.status === 304) {
        failures = 0
        set({ status: 'ok', lastSuccessAt: now, error: null, stale: false })
        return
      }
      if (res.status === 429) {
        const ra = Number(res.headers.get('retry-after'))
        if (ra) nextDelay = Math.max(nextDelay, ra * 1000)
        throw new Error('http_429')
      }
      if (!res.ok) throw new Error(`http_${res.status}`)
      const snap = adapter(await res.json())
      etag = res.headers.get('etag')
      lastModified = res.headers.get('last-modified')
      diff(state.snapshot, snap)
      failures = 0
      set({ status: 'ok', snapshot: snap, lastSuccessAt: now, error: null, stale: false })
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: now, snapshot: snap })) } catch { /* quota */ }
    } catch (e) {
      failures++
      nextDelay = Math.min(MAX_BACKOFF_MS, Math.max(nextDelay, POLL_MS * 2 ** failures))
      set({
        status: 'error',
        error: e instanceof Error ? e.message : 'unknown',
        stale: state.lastSuccessAt ? Date.now() - state.lastSuccessAt > STALE_AFTER_MS : false,
      })
    } finally {
      inflight = null
    }
  })()
  return inflight
}

function schedule() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(async () => {
    if (document.visibilityState === 'visible') await fetchOnce()
    schedule()
  }, nextDelay)
}

let started = false
export function startFeed() {
  if (started || !SNAPSHOT_URL) return
  started = true
  fetchOnce().then(schedule)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (!state.lastAttemptAt || Date.now() - state.lastAttemptAt > POLL_MS)) {
      fetchOnce().then(schedule)
    }
  })
  // re-evaluate staleness even when no request completes
  setInterval(() => {
    const stale = !!state.lastSuccessAt && Date.now() - state.lastSuccessAt > STALE_AFTER_MS
    if (stale !== state.stale) set({ stale })
  }, 15_000)
}

export const refreshFeed = () => fetchOnce()
export const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export const getState = () => state
export const getEvents = () => events
export const feedConfig = { url: SNAPSHOT_URL, pollMs: POLL_MS, staleAfterMs: STALE_AFTER_MS }
