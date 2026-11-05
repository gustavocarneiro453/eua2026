import { useMemo } from 'react'
import { useRaces } from '@/hooks/useElections'
import { BALLOT, type BallotSeat } from '@/lib/ballot'
import { classify, type Sit, type SitKind } from '@/lib/classify'
import { hasCountedVotes } from '@/lib/race'
import type { Office, Party, Race } from '@/services/types'

export interface Row { seat: BallotSeat; race?: Race; sit: Sit }

export interface OfficeStats {
  total: number
  /** wins declared by a named source (projected, official or certified), by party */
  declared: Record<Party, number>
  declaredTotal: number
  projected: number; official: number; certified: number
  /** votes are being counted and someone leads (not a win), by party */
  leading: Record<Party, number>
  leadingTotal: number
  tied: number
  /** contests with published votes that have no declared winner */
  counting: number
  awaiting: number
  unavailable: number
  /** the source reports 100% in — informational, still not a declaration */
  complete: number
  /** contests with no declared winner yet */
  pending: number
  /** contests with votes published by a count source */
  withVotes: number
}

const zero = (): Record<Party, number> => ({ DEM: 0, REP: 0, IND: 0, LIB: 0, GRN: 0, OTH: 0 })

export function statsOf(rows: Row[]): OfficeStats {
  const s: OfficeStats = { total: rows.length, declared: zero(), declaredTotal: 0, projected: 0, official: 0, certified: 0, leading: zero(), leadingTotal: 0, tied: 0, counting: 0, awaiting: 0, unavailable: 0, complete: 0, pending: 0, withVotes: 0 }
  for (const { sit, race } of rows) {
    if (hasCountedVotes(race)) s.withVotes++
    const k: SitKind = sit.kind
    if (k === 'projected' || k === 'official' || k === 'certified') { s[k]++; s.declaredTotal++; if (sit.party) s.declared[sit.party]++ }
    else if (k === 'lead') { s.leadingTotal++; s.counting++; if (sit.party) s.leading[sit.party]++ }
    else if (k === 'tied') { s.tied++; s.counting++ }
    else if (k === 'awaiting') s.awaiting++
    else if (k === 'unavailable') s.unavailable++
    if (sit.complete) s.complete++
  }
  s.pending = s.total - s.declaredTotal
  return s
}

/** All 506 contests of 2026 with their current situation, derived only from reference data + the sources' data. */
export function useBallot() {
  const { feed, map, coverage } = useRaces()
  return useMemo(() => {
    const ctx = { coverage, hasSnapshot: !!feed.snapshot, feedStatus: feed.status }
    const rows: Row[] = BALLOT.map((seat) => {
      const race = map.get(seat.key)
      return { seat, race, sit: classify(race, seat.state, ctx) }
    })
    const byKey = new Map(rows.map((r) => [r.seat.key, r]))
    const by = (o: Office) => rows.filter((r) => r.seat.office === o)
    const stats: Record<Office, OfficeStats> = { senate: statsOf(by('senate')), governor: statsOf(by('governor')), house: statsOf(by('house')) }
    return { rows, byKey, by, stats, feed, coverage }
  }, [feed, map, coverage])
}
