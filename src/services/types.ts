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
  updatedAt: string | null
}

export interface Snapshot {
  source: { name: string; url: string; attribution?: string; license?: string }
  /** When the source generated the data (if provided) */
  generatedAt: string | null
  /** States with data coverage, per the source */
  coverage: string[]
  isDemo: boolean
  races: Race[]
}

export type FeedStatus = 'not_configured' | 'loading' | 'ok' | 'error'

export interface FeedState {
  status: FeedStatus
  snapshot: Snapshot | null
  /** Last time we successfully received (or revalidated) data */
  lastSuccessAt: number | null
  lastAttemptAt: number | null
  error: string | null
  stale: boolean
}

export interface UpdateEvent {
  id: string
  at: number
  raceId: string
  kind: 'first_results' | 'projected' | 'official' | 'certified'
}
