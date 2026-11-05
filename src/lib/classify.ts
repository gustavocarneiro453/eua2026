import type { Party, Race } from '@/services/types'
import { hasCountedVotes, leader, winner } from './race'

/**
 * What a contest looks like RIGHT NOW. Availability of data is never confused with a result:
 *  noRace      – no election for this office in this state in 2026
 *  awaiting    – the contest exists and a source covers it, but no votes were published yet
 *  unavailable – the contest exists but no integrated source can supply it (or the source cannot be reached)
 *  lead        – votes are being counted; `party` is who has more votes right now. NOT a win.
 *  tied        – the top two have exactly the same votes
 *  projected   – a named news organization projected a winner (not official)
 *  official    – the state published an official result (still subject to certification)
 *  certified   – the state certified the result, with a document
 */
export type SitKind = 'noRace' | 'awaiting' | 'unavailable' | 'lead' | 'tied' | 'projected' | 'official' | 'certified'
export type SitReason = 'notStarted' | 'loading' | 'sourcePending' | 'notIntegrated' | 'feedError' | null

export interface Sit {
  kind: SitKind
  party: Party | null
  reason: SitReason
  /** the source reports 100% of its reporting units in — still not a call and not certification */
  complete: boolean
}

export interface SitContext {
  /** states for which an integrated source publishes results */
  coverage: Set<string>
  hasSnapshot: boolean
  feedStatus: 'not_configured' | 'not_started' | 'loading' | 'ok' | 'error'
}

export const NO_RACE: Sit = { kind: 'noRace', party: null, reason: null, complete: false }

export function classify(race: Race | undefined, state: string, ctx: SitContext): Sit {
  if (ctx.feedStatus === 'not_started') return { kind: 'awaiting', party: null, reason: 'notStarted', complete: false }
  const complete = !!race && race.reportingPct === 100 && hasCountedVotes(race)
  if (race && ['projected', 'official', 'certified'].includes(race.status)) {
    const w = winner(race)
    if (w) return { kind: race.status as 'projected' | 'official' | 'certified', party: w.party, reason: null, complete }
  }
  if (race && hasCountedVotes(race)) {
    const l = leader(race)
    return l ? { kind: 'lead', party: l.party, reason: null, complete } : { kind: 'tied', party: null, reason: null, complete }
  }
  if (ctx.hasSnapshot && ctx.coverage.size && !ctx.coverage.has(state) && !race) return { kind: 'unavailable', party: null, reason: 'notIntegrated', complete: false }
  if (!ctx.hasSnapshot && ctx.feedStatus === 'error') return { kind: 'unavailable', party: null, reason: 'feedError', complete: false }
  if (!ctx.hasSnapshot) return { kind: 'awaiting', party: null, reason: 'loading', complete: false }
  return { kind: 'awaiting', party: null, reason: 'sourcePending', complete: false }
}
