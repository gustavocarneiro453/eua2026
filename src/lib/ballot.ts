import { GOVERNOR_STATES, SENATE_SEATS, STATES } from '@/data/states'
import type { Office, Party } from '@/services/types'

/** Every contest on the 2026 ballot, from institutional reference data (never from results): 35 + 36 + 435 = 506. */
export interface BallotSeat {
  /** same key the results map uses: office:state:district:special */
  key: string
  office: Office
  state: string
  district: number | null
  special: boolean
  /** party holding the Senate seat before the election (senate.gov) */
  heldBy?: Party
}

export const seatKey = (office: Office, state: string, district?: number | null, special?: boolean) => [office, state, district ?? '', special ? 's' : ''].join(':')

export const BALLOT: BallotSeat[] = [
  ...SENATE_SEATS.map((s): BallotSeat => ({ key: seatKey('senate', s.state, null, s.special), office: 'senate', state: s.state, district: null, special: s.special, heldBy: s.heldBy })),
  ...GOVERNOR_STATES.map((st): BallotSeat => ({ key: seatKey('governor', st), office: 'governor', state: st, district: null, special: false })),
  ...STATES.flatMap((s) => (s.houseSeats === 1 ? [0] : Array.from({ length: s.houseSeats }, (_, i) => i + 1))
    .map((d): BallotSeat => ({ key: seatKey('house', s.code, d), office: 'house', state: s.code, district: d, special: false }))),
]

export const BALLOT_BY_OFFICE: Record<Office, BallotSeat[]> = {
  senate: BALLOT.filter((b) => b.office === 'senate'),
  governor: BALLOT.filter((b) => b.office === 'governor'),
  house: BALLOT.filter((b) => b.office === 'house'),
}

/** Map / page layers are the three offices. */
export type Layer = Office
