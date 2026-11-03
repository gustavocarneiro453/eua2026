import { GOVERNOR_STATES, SENATE_SEATS, STATES } from '@/data/states'
import { raceKey } from '@/hooks/useElections'
import type { Party, Race } from '@/services/types'
import { type DisplayStatus, displayStatus, leader, winner } from './race'

export type Layer = 'senate' | 'governor' | 'house'

export interface StateLayerInfo {
  hasRace: boolean
  status: DisplayStatus
  leadParty: Party | null
  winParty: Party | null
  /** House only */
  districtsWithData?: number
  districts?: number
}

export function summarize(layer: Layer, map: Map<string, Race>, coverage: Set<string>, hasSnapshot: boolean) {
  const out: Record<string, StateLayerInfo> = {}
  for (const s of STATES) {
    if (layer === 'house') {
      const n = s.houseSeats
      let withData = 0
      for (let d = n === 1 ? 0 : 1; d <= (n === 1 ? 0 : n); d++) {
        const r = map.get(raceKey('house', s.code, d))
        if (r && r.status !== 'no_data') withData++
      }
      out[s.code] = { hasRace: true, status: displayStatus(undefined, coverage, hasSnapshot, s.code), leadParty: null, winParty: null, districtsWithData: withData, districts: n }
      continue
    }
    const seats = layer === 'senate' ? SENATE_SEATS.filter((x) => x.state === s.code) : GOVERNOR_STATES.includes(s.code) ? [{ special: false }] : []
    if (!seats.length) { out[s.code] = { hasRace: false, status: 'no_data', leadParty: null, winParty: null }; continue }
    const race = map.get(raceKey(layer, s.code, null, seats[0].special))
    const w = winner(race)
    const l = race?.status === 'counting' ? leader(race) : null
    out[s.code] = { hasRace: true, status: displayStatus(race, coverage, hasSnapshot, s.code), leadParty: l?.party ?? null, winParty: w?.party ?? null }
  }
  return out
}
