import { GOVERNOR_STATES, SENATE_SEATS, STATES, SENATE_NOT_UP } from '@/data/states'
import type { Party, Race } from '@/services/types'
import { winner } from './race'

export function tally(races: Race[], office: Race['office']) {
  const won: Partial<Record<Party, number>> = {}
  let withData = 0
  for (const r of races) {
    if (r.office !== office) continue
    if (r.status !== 'no_data') withData++
    const w = winner(r)
    if (w) won[w.party] = (won[w.party] ?? 0) + 1
  }
  const decided = Object.values(won).reduce((a, b) => a + (b ?? 0), 0)
  const up = office === 'senate' ? SENATE_SEATS.length : office === 'governor' ? GOVERNOR_STATES.length : STATES.reduce((a, s) => a + s.houseSeats, 0)
  return { won, decided, undecided: up - decided, withData, up }
}
export { SENATE_NOT_UP }

/** Days until election day (Eastern Time calendar). */
export function daysToElection(iso: string) {
  const et = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
  return Math.round((Date.parse(iso) - Date.parse(et)) / 86400000)
}
