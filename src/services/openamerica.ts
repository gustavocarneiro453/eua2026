import type { Candidate, Office, Party, Race, Snapshot, SourceRef } from './types'
import { SENATE_SEATS } from '../data/states'

/**
 * Open America election results API, contract version 1.
 * Docs: https://openamerica.io/elections/api/ (version 1, last changed 2026-09-27)
 *
 * Verified 2026-11-03:
 * - GET /elections/results.json?year=2026&office=House|Senate|Governor — no key, no quota
 * - Access-Control-Allow-Origin: * on 200 and 304; ETag + If-None-Match → 304
 * - Cache-Control: public, max-age=30, s-maxage=60 (shared edge cache upstream)
 * - Counts only, from official state election offices. The feed NEVER calls or projects races
 *   (`called`, `winner`, `w` always false/empty). `final` = all precincts in, NOT certification.
 * - Seats outside the 22 covered states are absent from the payload (never zero).
 * - Terms: free use with attribution and the `as_of` timestamp shown next to counts;
 *   repackaging the live feed as our own API requires a written agreement → no proxy here.
 */

export const OA_BASE = 'https://openamerica.io'
export const OA_DOCS = 'https://openamerica.io/elections/api/'
export const OA_ATTRIBUTION = 'official state election offices via Open America (openamerica.io)'
const SUPPORTED_API = 1

// Coverage list as published on the API page (generated there from the sync registry).
export const OA_COVERAGE = ['AR','AZ','CO','CT','FL','GA','IA','ID','IN','LA','MI','MN','NC','PA','RI','SC','TX','UT','VA','VT','WA','WV']

export const OA_OFFICES: { office: Office; param: string }[] = [
  { office: 'house', param: 'House' },
  { office: 'senate', param: 'Senate' },
  { office: 'governor', param: 'Governor' },
]

export const oaUrl = (year: number, param: string) => `${OA_BASE}/elections/results.json?year=${year}&office=${param}`

export interface OaCand { n: string; p: string; v: number; pct: number | null; inc?: boolean }
interface OaRace { leader?: string; pct_in: number | null; total?: number; as_of?: string | null; uncontested?: boolean; cands: OaCand[] }
export interface OaPayload {
  api: number; year: number; office: string
  live: boolean; stale: boolean; counting: boolean; final: boolean
  as_of: string | null; source: string
  races: Record<string, OaRace>
}

export const OA_SOURCE: SourceRef = { id: 'openamerica', name: 'Open America (escritórios eleitorais estaduais)', url: OA_DOCS, kind: 'state-official' }

// States whose ONLY Senate race in 2026 is a special election (FL, OH). The feed may key it "FL" or "FL-special";
// either way it is that special race, so the two must meet on the same key.
const ONLY_SPECIAL = new Set(SENATE_SEATS.filter((x) => x.special && SENATE_SEATS.filter((y) => y.state === x.state).length === 1).map((x) => x.state))

const PARTY: Record<string, Party> = { D: 'DEM', R: 'REP', I: 'IND', L: 'LIB', G: 'GRN' }

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isNumOrNull = (v: unknown) => v === null || isNum(v)

/** Rejects anything that does not match the documented contract; never patches values. */
export function validate(raw: any, office: string): OaPayload {
  if (!raw || typeof raw !== 'object') throw new Error('invalid_payload')
  if (raw.api !== SUPPORTED_API) throw new Error(`unsupported_api_${raw.api}`)
  if (String(raw.office).toLowerCase() !== office.toLowerCase()) throw new Error('office_mismatch')
  if (!raw.races || typeof raw.races !== 'object') throw new Error('invalid_races')
  for (const r of Object.values<any>(raw.races)) {
    if (!r || !Array.isArray(r.cands) || !isNumOrNull(r.pct_in)) throw new Error('invalid_race')
    for (const c of r.cands) if (!c || typeof c.n !== 'string' || !isNum(c.v) || !isNumOrNull(c.pct)) throw new Error('invalid_candidate')
  }
  return raw as OaPayload
}

function parseKey(office: Office, key: string): Pick<Race, 'state' | 'district' | 'special'> | null {
  if (office === 'house') {
    const m = /^([A-Z]{2})-(\d{2})$/.exec(key.toUpperCase())
    return m ? { state: m[1], district: Number(m[2]), special: false } : null
  }
  const m = /^([A-Z]{2})(-SPECIAL)?$/.exec(key.toUpperCase())
  if (!m) return null
  return { state: m[1], district: null, special: !!m[2] || (office === 'senate' && ONLY_SPECIAL.has(m[1])) }
}

/**
 * Verified 2026-11-05 in the live feed: Indiana's nine House races list candidates more than once, so the votes add up to
 * more than the published total. Two cases, handled without inventing anything:
 *  - EXACT repeats (same name, party, votes and %) are dropped;
 *  - the same candidate with DIFFERENT numbers (IN-09) is resolved only if exactly one combination of lines adds up to
 *    the state's own `total`; otherwise the first line of each is kept and the race is flagged `sourceConflict`.
 */
export function resolveLines(cands: OaCand[], total: number | undefined): { lines: OaCand[]; removed: number; conflict: boolean } {
  const seen = new Set<string>()
  const lines = cands.filter((c) => { const k = `${c.n}|${c.p}|${c.v}|${c.pct}`; if (seen.has(k)) return false; seen.add(k); return true })
  const groups = new Map<string, OaCand[]>()
  for (const c of lines) (groups.get(`${c.n}|${c.p}`) ?? groups.set(`${c.n}|${c.p}`, []).get(`${c.n}|${c.p}`)!).push(c)
  const dup = [...groups.values()].filter((g) => g.length > 1)
  if (!dup.length) return { lines, removed: cands.length - lines.length, conflict: false }
  let chosen: OaCand[] | null = null
  if (typeof total === 'number' && dup.length <= 10) {
    const single = [...groups.values()].filter((g) => g.length === 1).flat()
    const base = single.reduce((a, c) => a + c.v, 0)
    const hits: OaCand[][] = []
    const walk = (i: number, sum: number, pick: OaCand[]) => {
      if (i === dup.length) { if (sum === total) hits.push(pick); return }
      for (const c of dup[i]) walk(i + 1, sum + c.v, [...pick, c])
    }
    walk(0, base, [])
    if (hits.length === 1) chosen = [...single, ...hits[0]]
  }
  const keep = chosen ?? [...groups.values()].map((g) => g[0])
  const order = new Map(cands.map((c, i) => [`${c.n}|${c.p}|${c.v}|${c.pct}`, i]))
  keep.sort((a, b) => (order.get(`${a.n}|${a.p}|${a.v}|${a.pct}`) ?? 0) - (order.get(`${b.n}|${b.p}|${b.v}|${b.pct}`) ?? 0))
  return { lines: keep, removed: cands.length - keep.length, conflict: chosen === null }
}

function toRaces(office: Office, p: OaPayload): Race[] {
  const out: Race[] = []
  for (const [key, r] of Object.entries(p.races)) {
    const k = parseKey(office, key)
    if (!k) continue // unknown key format: skip rather than guess
    const { lines: unique, removed: duplicatesRemoved, conflict } = resolveLines(r.cands, r.total)
    const candidates: Candidate[] = unique.map((c) => ({
      id: `${c.n}|${c.p}`,
      name: c.n,
      party: PARTY[c.p] ?? 'OTH',
      partyOriginal: c.p,
      votes: c.v,
      pct: c.pct,
      // the feed's `inc: false` means "unknown", so only a true flag is kept
      ...(c.inc ? { incumbent: true } : {}),
    }))
    const hasVotes = unique.some((c) => c.v > 0)
    out.push({
      id: `${office}:${key}`,
      office, ...k,
      // The feed never calls races: a race is either without votes yet or being counted.
      status: hasVotes ? 'counting' : 'no_data',
      candidates,
      reportingPct: r.pct_in,
      winnerId: null,
      // The race's own update time as the state published it; the feed-level time only when the race has none
      updatedAt: r.as_of ?? p.as_of,
      source: OA_SOURCE,
      totalVotes: isNum(r.total) ? r.total : null,
      ...(r.uncontested === true ? { uncontested: true } : {}),
      ...(duplicatesRemoved > 0 ? { duplicatesRemoved } : {}),
      ...(conflict ? { sourceConflict: true } : {}),
    })
  }
  return out
}

export function toSnapshot(payloads: OaPayload[], replayYear: number | null): Snapshot {
  const asOf = payloads.map((p) => p.as_of).filter((x): x is string => !!x).sort().pop() ?? null
  const counting = payloads.some((p) => p.counting)
  const sourceState: Snapshot['sourceState'] = !counting ? 'waiting'
    : payloads.some((p) => p.live) ? 'live'
    : payloads.some((p) => p.stale) ? 'stale'
    : payloads.every((p) => p.final || !p.counting) ? 'final' : 'live'
  return {
    source: { name: 'Open America', url: OA_DOCS, attribution: OA_ATTRIBUTION },
    generatedAt: asOf,
    coverage: [...new Set([...OA_COVERAGE, ...payloads.flatMap((p) => Object.keys(p.races).map((k) => k.slice(0, 2).toUpperCase()))])].sort(),
    isDemo: replayYear != null,
    replayYear,
    callsSupported: false,
    sourceState,
    races: payloads.flatMap((p) => {
      const o = OA_OFFICES.find((x) => x.param.toLowerCase() === String(p.office).toLowerCase())
      return o ? toRaces(o.office, p) : []
    }),
  }
}
