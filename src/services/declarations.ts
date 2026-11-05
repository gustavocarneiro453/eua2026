import type { Declaration, Party, Race, Snapshot } from './types'
import { GOVERNOR_STATES, SENATE_SEATS, STATE_BY_CODE } from '../data/states'

/**
 * Projections, official calls and certifications — the information the count feed itself never gives.
 *
 * They come ONLY from /declarations.json, a file kept by the site's maintainers. Each entry must name the organization
 * that published it, link to the evidence and carry the publication time; entries without all three are discarded.
 * Nothing in this file is ever derived from vote counts, and the repository ships it empty.
 *
 * {
 *   "version": 1,
 *   "items": [
 *     { "race": "senate:GA", "status": "projected", "winner": "Jon Ossoff", "party": "DEM",
 *       "by": "CBS News", "url": "https://…", "at": "2026-11-04T03:12:00Z" }
 *   ]
 * }
 * "race" is `office:STATE` for Senate/Governor (`senate:FL:s` for a special), `house:STATE-NN` for a House seat (00 = at-large).
 */
export interface DeclarationItem extends Declaration { race: string; winner: string; party: Party }

const PARTIES = new Set(['DEM', 'REP', 'IND', 'LIB', 'GRN', 'OTH'])
const isHttps = (u: unknown): u is string => { try { return typeof u === 'string' && new URL(u).protocol === 'https:' } catch { return false } }

export function parseDeclarations(raw: unknown): { items: DeclarationItem[]; rejected: number } {
  const list = raw && typeof raw === 'object' && (raw as { version?: unknown }).version === 1 && Array.isArray((raw as { items?: unknown }).items) ? (raw as { items: unknown[] }).items : null
  if (!list) return { items: [], rejected: 0 }
  const items: DeclarationItem[] = []
  let rejected = 0
  for (const x of list as Record<string, unknown>[]) {
    const ok = x && typeof x.race === 'string' && seatOf(x.race) !== null
      && (x.status === 'projected' || x.status === 'official' || x.status === 'certified')
      && typeof x.winner === 'string' && x.winner.trim() !== '' && typeof x.party === 'string' && PARTIES.has(x.party)
      && typeof x.by === 'string' && x.by.trim() !== '' && isHttps(x.url)
      && typeof x.at === 'string' && !Number.isNaN(Date.parse(x.at)) && Date.parse(x.at) <= Date.now() + 5 * 60_000
    if (ok) items.push({ race: x.race as string, status: x.status as Declaration['status'], winner: (x.winner as string).trim(), party: x.party as Party, by: (x.by as string).trim(), url: x.url as string, at: x.at as string })
    else rejected++
  }
  return { items, rejected }
}

/** Reference-data descriptor for a declaration key, or null when it names a race that is not on the 2026 ballot. */
function seatOf(key: string): { id: string; office: Race['office']; state: string; district: number | null; special: boolean } | null {
  let m = /^(senate|governor):([A-Z]{2})(:s)?$/.exec(key)
  if (m) {
    const office = m[1] as 'senate' | 'governor', special = !!m[3]
    if (!STATE_BY_CODE[m[2]]) return null
    if (office === 'senate' && !SENATE_SEATS.some((s) => s.state === m![2] && s.special === special)) return null
    if (office === 'governor' && (special || !GOVERNOR_STATES.includes(m[2]))) return null
    return { id: key, office, state: m[2], district: null, special }
  }
  m = /^house:([A-Z]{2})-(\d{2})$/.exec(key)
  if (!m || !STATE_BY_CODE[m[1]]) return null
  const n = STATE_BY_CODE[m[1]].houseSeats, d = Number(m[2])
  return (n === 1 ? d === 0 : d >= 1 && d <= n) ? { id: key, office: 'house', state: m[1], district: d, special: false } : null
}

/**
 * Attaches declarations to the snapshot. A declaration is applied only if its winner is one of the candidates the count
 * source lists, or — when the race is not in any count source — it creates the race with that single named candidate and
 * unknown (null) votes. A conflicting candidate name is ignored rather than guessed.
 */
export function applyDeclarations(snap: Snapshot, items: DeclarationItem[]): Snapshot {
  if (!items.length) return snap
  const races = new Map(snap.races.map((r) => [r.id, r]))
  for (const d of items) {
    const seat = seatOf(d.race)
    if (!seat) continue
    const existing = snap.races.find((r) => r.office === seat.office && r.state === seat.state && (r.district ?? null) === seat.district && !!r.special === seat.special)
    const base = existing ?? ({ id: d.race, office: seat.office, state: seat.state, district: seat.district, special: seat.special, status: 'no_data', candidates: [], reportingPct: null, updatedAt: null } as Race)
    let cand = base.candidates.find((c) => c.name.trim().toLowerCase() === d.winner.toLowerCase())
    if (!cand && base.candidates.length) continue // the count source lists candidates and none matches: do not guess
    const candidates = cand ? base.candidates : [{ id: `${d.winner}|${d.party}`, name: d.winner, party: d.party, votes: null, pct: null }]
    cand = cand ?? candidates[0]
    const rank = { no_data: 0, counting: 1, projected: 2, official: 3, certified: 4 }
    if (rank[base.status] > rank[d.status]) continue
    const declared: Race = {
      ...base, candidates, status: d.status, winnerId: cand.id,
      projectionSource: d.status === 'projected' ? d.by : base.projectionSource ?? null,
      certificationSource: d.status === 'certified' ? d.url : base.certificationSource ?? null,
      declaration: { status: d.status, by: d.by, url: d.url, at: d.at },
    }
    races.set(existing ? existing.id : d.race, declared)
  }
  return { ...snap, races: [...races.values()], callsSupported: true }
}
