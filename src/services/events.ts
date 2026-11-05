import type { EventKind, Party, Race, Snapshot, UpdateEvent } from './types'
import { leader } from '@/lib/race'

/**
 * History of REAL changes. Two consecutive snapshots are compared race by race; an event exists only if a field
 * actually changed. Re-reading identical data produces nothing, and nothing is ever invented to fill the list.
 */
const COALESCE_VOTES_MS = 10 * 60_000
const fmtPct = (n: number | null) => (n == null ? null : `${n.toFixed(1)}%`)
const sumVotes = (r: Race) => r.candidates.reduce((a, c) => a + (c.votes ?? 0), 0)
const counted = (r: Race) => r.candidates.some((c) => (c.votes ?? 0) > 0)

export const eventKey = (r: Pick<Race, 'office' | 'state' | 'district' | 'special'>) => `${r.office}:${r.state}:${r.district ?? ''}:${r.special ? 's' : ''}`

function make(r: Race, kind: EventKind, now: number, extra: Partial<UpdateEvent>): UpdateEvent {
  return {
    id: `${r.id}:${kind}:${now}`, at: now, asOf: r.updatedAt, raceId: r.id, office: r.office, state: r.state, district: r.district ?? null,
    special: !!r.special, kind, candidate: null, party: null, from: null, to: null, reportingPct: r.reportingPct,
    source: r.declaration?.by ?? r.source?.name ?? '—', ...extra,
  }
}

/**
 * @param recent already recorded events, used only to avoid flooding the list with a "votes" event every minute
 */
export function diffSnapshots(prev: Snapshot | null, next: Snapshot, now: number, recent: UpdateEvent[] = []): UpdateEvent[] {
  if (!prev) return []
  const old = new Map(prev.races.map((r) => [r.id, r]))
  const out: UpdateEvent[] = []
  for (const r of next.races) {
    const o = old.get(r.id)
    const nl = leader(r), ol = o ? leader(o) : null
    const had = !!o && counted(o), has = counted(r)
    const lead = (c: { name: string; party: Party } | null) => (c ? { candidate: c.name, party: c.party } : {})

    // status declared by a named source (projection / official call / certification)
    if (r.status !== o?.status && (r.status === 'projected' || r.status === 'official' || r.status === 'certified')) {
      const w = r.candidates.find((c) => c.id === r.winnerId) ?? null
      out.push(make(r, r.status, now, { ...lead(w), from: o?.status ?? null, to: r.status }))
      continue
    }
    if (!has) continue
    if (!had) { out.push(make(r, 'first_results', now, { ...lead(nl), to: nl ? fmtPct(nl.pct) : null })); continue }
    if (nl && ol && nl.id !== ol.id) { out.push(make(r, 'leader_change', now, { ...lead(nl), from: ol.name, to: nl.name })); continue }
    if (!nl && ol) { out.push(make(r, 'tied', now, { from: ol.name, to: null })); continue }
    if (nl && !ol) { out.push(make(r, 'leader_change', now, { ...lead(nl), from: null, to: nl.name })); continue }
    if (r.reportingPct === 100 && o!.reportingPct !== 100) { out.push(make(r, 'complete', now, { ...lead(nl), from: fmtPct(o!.reportingPct), to: '100%' })); continue }
    const changed = sumVotes(r) !== sumVotes(o!) || r.reportingPct !== o!.reportingPct
    if (changed) {
      const k = eventKey(r)
      const flooded = recent.some((e) => e.kind === 'votes' && eventKey(e) === k && now - e.at < COALESCE_VOTES_MS)
      const dup = out.some((e) => e.kind === 'votes' && e.raceId === r.id)
      if (!flooded && !dup) out.push(make(r, 'votes', now, { ...lead(nl), from: fmtPct(o!.reportingPct), to: fmtPct(r.reportingPct) }))
    }
  }
  return out
}

export function mergeEvents(existing: UpdateEvent[], added: UpdateEvent[], cap = 200): UpdateEvent[] {
  return [...added, ...existing].slice(0, cap)
}
