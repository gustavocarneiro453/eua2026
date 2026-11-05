import type { FeedState, OfficeHealth, Race, Snapshot, UpdateEvent } from './types'

import { fallbackTargetMs } from '@/config/election'
import { OA_OFFICES, oaUrl, toSnapshot, validate, type OaPayload } from './openamerica'
import { diffSnapshots, mergeEvents } from './events'
import { applyDeclarations, parseDeclarations, type DeclarationItem } from './declarations'
import { mergeSnapshots } from './merge'

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
const IDLE_MS = 10 * 60_000 // only a reference value shown in the Data tab; the poller never slows down once the count started
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
const emptyHealth = (): OfficeHealth => ({ ok: false, error: null, lastOkAt: null, asOf: null, races: 0 })
let state: FeedState = {
  status: ENABLED ? 'loading' : 'not_configured',
  snapshot: null, lastSuccessAt: null, lastAttemptAt: null, error: null, stale: false,
  offices: { house: emptyHealth(), senate: emptyHealth(), governor: emptyHealth() }, lastChangeAt: null, checks: 0,
}
const EVENTS_KEY = `eua2026:events:oa${YEAR}:v1`
const isEvent = (e: any): e is UpdateEvent => e && typeof e.id === 'string' && typeof e.raceId === 'string' && typeof e.at === 'number' && typeof e.kind === 'string' && typeof e.state === 'string'
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

// Restore the last valid snapshot (and the history of real changes) so a reload keeps both; the snapshot is flagged stale.
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  if (ENABLED && saved && isSnapshot(saved.snapshot) && fallbackTargetMs() <= Date.now()) {
    state = { ...state, snapshot: saved.snapshot, lastSuccessAt: saved.at, stale: Date.now() - saved.at > STALE_AFTER_MS }
  }
  const ev = JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]')
  if (ENABLED && Array.isArray(ev) && fallbackTargetMs() <= Date.now()) events = ev.filter(isEvent).slice(0, 200)
} catch { /* storage unavailable */ }

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

// Declarations (projections / official calls / certifications) with their evidence; see ./declarations.ts
let declText = '', declItems: DeclarationItem[] = []
async function fetchDeclarations(): Promise<boolean> {
  try {
    const res = await fetch('/declarations.json', { cache: 'no-cache', credentials: 'omit', headers: { Accept: 'application/json' } })
    if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) { const had = declItems.length > 0; declItems = []; declText = ''; return had }
    const text = await res.text()
    if (text === declText) return false
    declText = text
    declItems = parseDeclarations(JSON.parse(text)).items
    return true
  } catch { return false } // unreachable or malformed: keep what was there, never invent
}

async function fetchOnce(): Promise<void> {
  if (!ENABLED) return
  if (inflight) return inflight // dedupe concurrent requests
  inflight = (async () => {
    set({ lastAttemptAt: Date.now() })
    // Each office is its own request: one failing must not discard the others.
    const [settled, declChanged] = await Promise.all([Promise.allSettled(URLS.map(fetchOffice)), fetchDeclarations()])
    const now = Date.now()
    const offices = { ...state.offices }
    let anyOk = false, anyChanged = declChanged, retryAfter = 0, minDelay = 0
    const errors: string[] = []
    settled.forEach((r, i) => {
      const u = URLS[i], body = bodies.get(u.url)
      if (r.status === 'fulfilled') {
        anyOk = true; anyChanged ||= r.value.changed; minDelay = Math.max(minDelay, r.value.minDelay)
        offices[u.office] = { ok: true, error: null, lastOkAt: now, asOf: body?.as_of ?? null, races: body ? Object.keys(body.races).length : 0 }
      } else {
        const msg = r.reason instanceof Error ? r.reason.message : 'unknown'
        retryAfter = Math.max(retryAfter, (r.reason as { retryAfter?: number })?.retryAfter ?? 0)
        errors.push(`${u.office}: ${msg}`)
        offices[u.office] = { ...offices[u.office], ok: false, error: msg }
      }
    })
    if (anyOk) {
      failures = 0
      const have = URLS.filter((u) => bodies.has(u.url))
      if (anyChanged || !state.snapshot || state.status !== 'ok') {
        const base = mergeSnapshots([toSnapshot(have.map((u) => bodies.get(u.url)!), YEAR === 2024 ? 2024 : null)], ['openamerica'])!
        const snap = applyDeclarations(base, declItems)
        const added = diffSnapshots(state.snapshot, snap, now, events)
        if (added.length) {
          events = mergeEvents(events, added)
          try { localStorage.setItem(EVENTS_KEY, JSON.stringify(events)) } catch { /* quota */ }
        }
        set({ status: 'ok', snapshot: snap, lastSuccessAt: now, lastChangeAt: now, error: errors.join(' · ') || null, stale: false, offices, checks: state.checks + 1 })
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: now, snapshot: snap })) } catch { /* quota */ }
      } else {
        set({ status: 'ok', lastSuccessAt: now, error: errors.join(' · ') || null, stale: false, offices, checks: state.checks + 1 })
      }
      // The provider asks for a poll about once a minute while counting. We keep that pace for the whole night:
      // states publish at very different hours (Alaska, Hawaii), so a slower "idle" pace would delay their first results.
      nextDelay = Math.max(POLL_MS, minDelay)
    } else {
      failures++
      nextDelay = Math.min(MAX_BACKOFF_MS, Math.max(retryAfter, POLL_MS * 2 ** failures))
      set({
        status: 'error', error: errors.join(' · ') || 'unknown', offices,
        stale: state.lastSuccessAt ? now - state.lastSuccessAt > STALE_AFTER_MS : false,
      })
    }
  })().finally(() => { inflight = null })
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
/** The count has not started: keep the results source untouched and drop any older copy. */
export function holdFeed() {
  if (started || !ENABLED) return
  set({ status: 'not_started', snapshot: null, lastSuccessAt: null, lastAttemptAt: null, error: null, stale: false, lastChangeAt: null })
}

/** Called when the countdown reaches zero (or if it already had): from now on the sources are polled. */
export function startFeed() {
  if (started || !ENABLED) return
  started = true
  set({ status: 'loading' })
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

export const refreshFeed = () => (started ? fetchOnce() : Promise.resolve())
export const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export const getState = () => state
export const getEvents = () => events
export const feedConfig = { year: YEAR, pollMs: POLL_MS, idleMs: IDLE_MS, staleAfterMs: STALE_AFTER_MS }
