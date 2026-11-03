import { useEffect, useSyncExternalStore } from 'react'
import type { Party } from './types'

/**
 * House seat panel from Open America: GET /elections/seat/<ST-NN>.json (ST-00 = at-large).
 * Verified 2026-11-03: CORS *, Cache-Control max-age=900 / s-maxage=3600, no key or quota.
 * Gives the sitting member and the seat's certified 2024 result (House Clerk election statistics).
 * `last_result` is null in the 9 states with new 2026 district lines (AL, CA, FL, LA, NC, OH, TN, TX, UT).
 * Fetched only for the districts being displayed, never in bulk.
 */
export interface SeatInfo {
  key: string
  member: string | null
  party: Party | null
  vacant: boolean
  reason: string | null
  last: { year: number; winner: string; party: string; share: number | null; margin: number | null; runnerUp: string | null; runnerUpParty: string | null; unopposed: boolean } | null
}

const PARTY: Record<string, Party> = { D: 'DEM', R: 'REP', I: 'IND' }
const cache = new Map<string, SeatInfo | { error: number }>()
const pending = new Set<string>()
const queue: string[] = []
const listeners = new Set<() => void>()
let version = 0, active = 0
const CONCURRENCY = 6, RETRY_MS = 2 * 60_000

function parse(key: string, j: any): SeatInfo {
  if (!j || typeof j.status !== 'string' || !['held', 'vacant'].includes(j.status)) throw new Error('invalid_seat')
  const lr = j.last_result
  return {
    key,
    member: typeof j.member === 'string' && j.member ? j.member : null,
    party: PARTY[j.party] ?? null,
    vacant: j.status === 'vacant',
    reason: typeof j.reason === 'string' && j.reason ? j.reason : null,
    last: lr && typeof lr === 'object' && typeof lr.winner === 'string' && Number.isFinite(lr.year)
      ? {
          year: lr.year, winner: lr.winner, party: String(lr.party ?? ''),
          share: Number.isFinite(lr.share) ? lr.share : null, margin: Number.isFinite(lr.margin) ? lr.margin : null,
          runnerUp: typeof lr.runner_up === 'string' && lr.runner_up ? lr.runner_up : null, runnerUpParty: typeof lr.runner_up_party === 'string' ? lr.runner_up_party : null,
          unopposed: lr.unopposed === true,
        }
      : null,
  }
}

function bump() { version++; listeners.forEach((l) => l()) }
function pump() {
  while (active < CONCURRENCY && queue.length) {
    const key = queue.shift()!
    active++
    fetch(`https://openamerica.io/elections/seat/${key}.json`, { credentials: 'omit' })
      .then(async (r) => { if (!r.ok) throw Object.assign(new Error('http'), { status: r.status }); cache.set(key, parse(key, await r.json())) })
      .catch((e) => cache.set(key, { error: Date.now() + (e.status === 404 ? 3600_000 : RETRY_MS) }))
      .finally(() => { active--; pending.delete(key); bump(); pump() })
  }
}

/** keys like "GA-01" (at-large: "AK-00"). Returns SeatInfo, {error} or undefined while loading. */
export function useSeats(keys: string[]) {
  const joined = keys.join(',')
  useEffect(() => {
    let added = false
    for (const k of joined ? joined.split(',') : []) {
      const c = cache.get(k)
      if (pending.has(k) || (c && !('error' in c)) || (c && 'error' in c && c.error > Date.now())) continue
      pending.add(k); queue.push(k); added = true
    }
    if (added) pump()
  }, [joined])
  useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, () => version)
  return (key: string): SeatInfo | 'error' | undefined => { const c = cache.get(key); return !c ? undefined : 'error' in c ? 'error' : c }
}
