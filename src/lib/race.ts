import type { Candidate, Party, Race, ResultStatus } from '@/services/types'

import { getState } from '@/services/elections'

export type DisplayStatus = ResultStatus | 'notCovered' | 'unavailable' | 'notStarted'

export function displayStatus(race: Race | undefined, coverage: Set<string>, hasSnapshot: boolean, state: string): DisplayStatus {
  if (getState().status === 'not_started') return 'notStarted' // the count has not begun: nothing was requested yet
  if (race) return race.status
  if (hasSnapshot && coverage.size && !coverage.has(state)) return 'notCovered'
  // Components re-render on feed changes, so reading the store here is safe.
  if (!hasSnapshot && getState().status === 'error') return 'unavailable'
  return 'no_data'
}

/** Highest vote-getter among candidates with known votes. Not a winner. */
export function leader(race: Race | undefined): Candidate | null {
  if (!race) return null
  const known = race.candidates.filter((c) => c.votes != null)
  if (!known.length) return null
  const sorted = [...known].sort((a, b) => (b.votes as number) - (a.votes as number))
  if (sorted.length > 1 && sorted[0].votes === sorted[1].votes) return null // tie: no leader
  return sorted[0]
}

/** Winner only when the source states one with a projected/official/certified status. */
export function winner(race: Race | undefined): Candidate | null {
  if (!race || !race.winnerId) return null
  if (!['projected', 'official', 'certified'].includes(race.status)) return null
  return race.candidates.find((c) => c.id === race.winnerId) ?? null
}

export const PARTY_COLOR: Record<Party, string> = {
  REP: 'var(--color-rep)', DEM: 'var(--color-dem)', IND: 'var(--color-ind)', LIB: '#EAB308', GRN: '#16A34A', OTH: '#64748B',
}

export function sortedCandidates(race: Race) {
  return [...race.candidates].sort((a, b) => (b.votes ?? -1) - (a.votes ?? -1))
}

export function winLabelKey(status: Race['status']) {
  return status === 'official' ? 'race.win.official' : status === 'certified' ? 'race.win.certified' : 'race.win.projected'
}

export interface RankedCandidate { c: Candidate; /** competition rank (1,1,3…); null when votes are unknown */ rank: number | null; tied: boolean }

/** Candidates by votes, descending. Unknown votes go last and are never ranked. Not a call of a winner. */
export function rankCandidates(race: Race | undefined): RankedCandidate[] {
  if (!race) return []
  const known = race.candidates.filter((c) => c.votes != null).sort((a, b) => (b.votes as number) - (a.votes as number) || a.name.localeCompare(b.name))
  const unknown = race.candidates.filter((c) => c.votes == null)
  const out: RankedCandidate[] = []
  known.forEach((c, i) => {
    const prev = out[i - 1]
    const same = i > 0 && prev.c.votes === c.votes
    const rank = same ? prev.rank : i + 1
    if (same) prev.tied = true
    out.push({ c, rank, tied: same })
  })
  return [...out, ...unknown.map((c) => ({ c, rank: null, tied: false }))]
}

export const hasCountedVotes = (race: Race | undefined) => !!race && race.candidates.some((c) => (c.votes ?? 0) > 0)
