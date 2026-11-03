import type { FeedState, Race, Snapshot, UpdateEvent } from './types'

import { OA_OFFICES, oaUrl, toSnapshot, validate, type OaPayload } from './openamerica'

/**
 * Election data service — one shared poller for the whole app.
 * Source: Open America (see ./openamerica.ts for the verified contract and terms).
 * Browsers fetch the feed directly: the provider allows CORS, has no quota and serves it
 * from a shared edge cache; re-serving it from our own endpoint would need a written agreement.
 */

const ENABLED = import.meta.env.VITE_DATA_SOURCE !== 'off'
// 2024 is Open America's real replay of certified results, for development only (labeled in the UI).
const YEAR = Number(import.meta.env.VITE_OA_YEAR) === 2024 ? 2024 : 2026
const URLS = OA_OFFICES.map((o) => ({ ...o, url: oaUrl(YEAR, o.param) }))
const POLL_MS = 60_000 // provider's schedule while races exist and are not final
const IDLE_MS = 10 * 60_000 // provider's schedule before any race exists, or once final
const MAX_BACKOFF_MS = 10 * 60_000
const STALE_AFTER_MS = POLL_MS * 3
const STORAGE_KEY = `eua2026:snapshot:oa${YEAR}:v2`

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
  return s && s.source && typeof s.source.name === 'string' && Array.isArray(s.races) && typeof s.sourceState === 'string' &&
    Array.isArray(s.coverage) && typeof s.isDemo === 'boolean' && s.races.every(isRace)
}

// ---------- store ----------
let state: FeedState = {
  status: ENABLED ? 'loading' : 'not_configured',
  snapshot: null, lastSuccessAt: null, lastAttemptAt: null, error: null, stale: false,
}
let events: UpdateEvent[] = []
const listeners = new Set<() => void>()
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
  if (ENABLED && saved && isSnapshot(saved.snapshot)) {
    state = { ...state, snapshot: saved.snapshot, lastSuccessAt: saved.at, stale: Date.now() - saved.at > STALE_AFTER_MS }
  }
} catch { /* storage unavailable */ }

function diff(prev: Snapshot | null, next: Snapshot) {
  if (!prev) return
  const old = new Map(prev.races.map((r) => [r.id, r]))
  const now = Date.now()
  for (const r of next.races) {
    const prevStatus = old.get(r.id)?.status ?? 'no_data'
    if (prevStatus === r.status) continue
    const kind: UpdateEvent['kind'] | null =
      prevStatus === 'no_data' && r.status === 'counting' ? 'first_results'
      : r.status === 'projected' || r.status === 'official' || r.status === 'certified' ? r.status : null
    if (kind) events = [{ id: `${r.id}:${kind}:${now}`, at: now, raceId: r.id, kind }, ...events].slice(0, 50)
  }
}

function maxAgeMs(res: Response) {
  const m = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '')
  return m ? Number(m[1]) * 1000 : 0
}

// The provider does not expose ETag to cross-origin scripts (no Access-Control-Expose-Headers),
// so revalidation is left to the browser's HTTP cache: `cache: 'no-cache'` makes it send
// If-None-Match itself and turn a 304 into the cached body. Unchanged bodies are then skipped here.
const texts = new Map<string, string>()
const bodies = new Map<string, OaPayload>()

async function fetchOffice(u: (typeof URLS)[number]): Promise<{ changed: boolean; minDelay: number }> {
  // credentials are omitted on purpose: the provider sends no CORS header to credentialed requests
  const res = await fetch(u.url, { headers: { Accept: 'application/json' }, credentials: 'omit', cache: 'no-cache' })
  const minDelay = maxAgeMs(res)
  if (res.status === 429 || res.status >= 500) {
    const ra = Number(res.headers.get('retry-after'))
    throw Object.assign(new Error(`http_${res.status}`), { retryAfter: ra ? ra * 1000 : 0 })
  }
  if (!res.ok) throw new Error(`http_${res.status}`)
  const text = await res.text()
  if (text === texts.get(u.url) && bodies.has(u.url)) return { changed: false, minDelay }
  bodies.set(u.url, validate(JSON.parse(text), u.param))
  texts.set(u.url, text)
  return { changed: true, minDelay }
}

async function fetchOnce(): Promise<void> {
  if (!ENABLED) return
  if (inflight) return inflight // dedupe concurrent requests
  inflight = (async () => {
    set({ lastAttemptAt: Date.now() })
    try {
      const results = await Promise.all(URLS.map(fetchOffice))
      const now = Date.now()
      failures = 0
      if (results.some((r) => r.changed) || !state.snapshot || state.status !== 'ok') {
        const snap = toSnapshot(URLS.map((u) => bodies.get(u.url)!), YEAR === 2024 ? 2024 : null)
        diff(state.status === 'ok' ? state.snapshot : null, snap)
        set({ status: 'ok', snapshot: snap, lastSuccessAt: now, error: null, stale: false })
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: now, snapshot: snap })) } catch { /* quota */ }
      } else {
        set({ status: 'ok', lastSuccessAt: now, error: null, stale: false })
      }
      const ss = state.snapshot?.sourceState
      nextDelay = Math.max(ss === 'waiting' || ss === 'final' ? IDLE_MS : POLL_MS, ...results.map((r) => r.minDelay))
    } catch (e) {
      failures++
      const ra = (e as { retryAfter?: number }).retryAfter ?? 0
      nextDelay = Math.min(MAX_BACKOFF_MS, Math.max(ra, POLL_MS * 2 ** failures))
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
  if (started || !ENABLED) return
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
export const feedConfig = { year: YEAR, pollMs: POLL_MS, idleMs: IDLE_MS, staleAfterMs: STALE_AFTER_MS }
