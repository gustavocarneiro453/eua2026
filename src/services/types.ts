// Normalized election data model used by the UI.
// Source adapters (src/services/elections.ts) must map provider payloads into this shape.
// Never fill missing values with 0: use null.

export type Office = 'senate' | 'house' | 'governor'
export type Party = 'DEM' | 'REP' | 'IND' | 'LIB' | 'GRN' | 'OTH'

/**
 * no_data   – the source has no results for this race yet
 * counting  – votes are being reported; any leader is NOT a winner
 * projected – a named source projected a winner (not official)
 * official  – official canvass results published by the state
 * certified – results certified by the state; requires evidence (certificationSource)
 */
export type ResultStatus = 'no_data' | 'counting' | 'projected' | 'official' | 'certified'

export interface Candidate {
  id: string
  name: string
  party: Party
  /** Party label exactly as delivered by the source */
  partyOriginal?: string
  votes: number | null
  pct: number | null
  incumbent?: boolean
}

/** Where a piece of information came from. `kind` tells how much weight it carries. */
export interface SourceRef {
  id: string
  name: string
  url: string
  /** state-official = counts published by state election offices; news = media projection; certification = state certification document */
  kind: 'state-official' | 'news' | 'certification'
}

/** A projection / official call / certification attached to a race, with its evidence. Never inferred from counts. */
export interface Declaration {
  status: 'projected' | 'official' | 'certified'
  by: string
  url: string
  /** ISO instant the source published it */
  at: string
}

export interface Race {
  id: string
  office: Office
  state: string // USPS code
  district?: number | null // House only; 0 = at-large
  special?: boolean
  status: ResultStatus
  candidates: Candidate[]
  /** Share of expected vote reported, 0–100, or null if unknown */
  reportingPct: number | null
  winnerId?: string | null
  /** Who made the projection (required when status = projected) */
  projectionSource?: string | null
  /** Evidence URL (required when status = certified) */
  certificationSource?: string | null
  /** When THIS race's count was updated by its source (ISO), not when we fetched it */
  updatedAt: string | null
  /** Who supplied the vote counts */
  source?: SourceRef
  /** Total votes counted, as published (null when the source gives none) */
  totalVotes?: number | null
  /** The state reports the contest had a single candidate */
  uncontested?: boolean
  /** The source listed the same candidate line more than once (identical name, party, votes and %); the repeats were dropped */
  duplicatesRemoved?: number
  /** The source repeated a candidate with different numbers and they could not be reconciled with its own total */
  sourceConflict?: boolean
  declaration?: Declaration
}

export interface Snapshot {
  source: { name: string; url: string; attribution?: string; license?: string }
  /** When the source generated the data (if provided) */
  generatedAt: string | null
  /** States with data coverage, per the source */
  coverage: string[]
  isDemo: boolean
  /** Replayed past election (e.g. 2024), clearly labeled in the UI */
  replayYear?: number | null
  /** Whether the source can ever declare winners. Open America never does. */
  callsSupported: boolean
  /** Source-side freshness: waiting = no votes yet; final = all precincts in (not certification) */
  sourceState: 'waiting' | 'live' | 'stale' | 'final'
  races: Race[]
}

/** not_started: the count has not begun yet, so no results source is queried */
export type FeedStatus = 'not_configured' | 'not_started' | 'loading' | 'ok' | 'error'

/** Health of one results request (one office), so a failure in one never hides the others */
export interface OfficeHealth {
  ok: boolean
  error: string | null
  lastOkAt: number | null
  /** newest `as_of` the source reported for this office */
  asOf: string | null
  races: number
}

export interface FeedState {
  status: FeedStatus
  snapshot: Snapshot | null
  offices: Record<Office, OfficeHealth>
  /** last time any data actually changed (not just a successful check) */
  lastChangeAt: number | null
  /** number of checks that succeeded since this page loaded */
  checks: number
  /** Last time we successfully received (or revalidated) data */
  lastSuccessAt: number | null
  lastAttemptAt: number | null
  error: string | null
  stale: boolean
}

export type EventKind = 'first_results' | 'leader_change' | 'tied' | 'votes' | 'complete' | 'projected' | 'official' | 'certified'

/** One REAL change between two consecutive snapshots of a race. Nothing is recorded when the data did not change. */
export interface UpdateEvent {
  id: string
  /** when we detected it (ms) */
  at: number
  /** when the source says the count was updated (ISO), if it says */
  asOf: string | null
  raceId: string
  office: Office
  state: string
  district: number | null
  special: boolean
  kind: EventKind
  candidate: string | null
  party: Party | null
  /** previous / new value, already formatted as data (names, percentages, vote totals) */
  from: string | null
  to: string | null
  reportingPct: number | null
  source: string
}
