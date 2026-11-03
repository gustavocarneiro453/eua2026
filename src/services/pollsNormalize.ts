import { STATE_BY_CODE, STATE_BY_NAME } from '../data/states'

/**
 * Election polls — VoteHub Polling API (https://api.votehub.com/polls).
 * Verified 2026-11-03: free, no key, no CORS header (so it is read server-side, see functions/api/polls.ts),
 * ignores `limit`; filters `poll_type` and `subject` work (e.g. subject=2026%20Georgia). A full type list is
 * 100 KB–3 MB. Fields: id, poll_type, pollster, start_date, end_date, created_at, sample_size, population,
 * answers[{choice,pct}], seat_name, subject, sponsors[], internal, partisan, url.
 * Licence: reported as CC BY 4.0 by third-party documentation; the official page could not be opened from
 * the build environment, so attribution (VoteHub + link to each poll's original source) is always shown.
 * Polls are NOT results and NOT projections; answers carry candidate names without party.
 */
export type PollKind = 'senate' | 'governor' | 'house' | 'generic'

export interface Poll {
  id: string
  kind: PollKind
  state: string | null
  district: number | null
  pollster: string
  startDate: string | null
  endDate: string
  sampleSize: number | null
  population: string | null
  answers: { choice: string; pct: number }[]
  internal: boolean
  partisan: 'DEM' | 'REP' | null
  sponsors: string[]
  url: string | null
}

export interface PollsPayload { api: 1; fetchedAt: string; source: 'VoteHub'; polls: Poll[] }

export const VOTEHUB_API = 'https://api.votehub.com/polls'
export const VOTEHUB_SITE = 'https://votehub.com/'
export const POLL_TYPES: { type: string; kind: PollKind; query: string }[] = [
  { type: 'us-senator', kind: 'senate', query: 'poll_type=us-senator' },
  { type: 'governor', kind: 'governor', query: 'poll_type=governor' },
  { type: 'us-representative', kind: 'house', query: 'poll_type=us-representative' },
  { type: 'generic-ballot', kind: 'generic', query: 'poll_type=generic-ballot&subject=2026' },
]

const MAX_AGE_DAYS = 150
const MAX_PER_RACE = 6
const MAX_GENERIC = 12
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))

/** Raw VoteHub list for one poll_type → validated 2026 general-election polls. Never invents fields. */
export function normalizePolls(kind: PollKind, raw: unknown, now = Date.now()): Poll[] {
  if (!Array.isArray(raw)) throw new Error('polls_not_array')
  const cutoff = now - MAX_AGE_DAYS * 86400_000
  const out: Poll[] = []
  for (const r of raw as Record<string, any>[]) {
    if (!r || typeof r.id !== 'string' || !isDate(r.end_date) || typeof r.pollster !== 'string') continue
    if (Date.parse(r.end_date) < cutoff) continue
    let state: string | null = null, district: number | null = null
    if (kind === 'house') {
      const m = /^([A-Z]{2})-(\d{2})$/.exec(String(r.seat_name ?? ''))
      if (!m || !STATE_BY_CODE[m[1]] || r.subject !== `2026 ${m[0]}`) continue
      state = m[1]; district = STATE_BY_CODE[m[1]].houseSeats === 1 ? 0 : Number(m[2])
    } else if (kind === 'generic') {
      if (r.subject !== '2026') continue
    } else {
      // Only "2026 <State>": primaries ("2026 Texas Republican") and anything else are excluded.
      const st = typeof r.subject === 'string' && r.subject.startsWith('2026 ') ? STATE_BY_NAME[r.subject.slice(5)] : undefined
      if (!st) continue
      state = st.code
    }
    const answers = Array.isArray(r.answers)
      ? r.answers.filter((a: any) => a && typeof a.choice === 'string' && typeof a.pct === 'number' && a.pct >= 0 && a.pct <= 100).map((a: any) => ({ choice: a.choice, pct: a.pct }))
      : []
    if (answers.length < 2) continue
    answers.sort((a: { pct: number }, b: { pct: number }) => b.pct - a.pct)
    out.push({
      id: r.id, kind, state, district, pollster: r.pollster,
      startDate: isDate(r.start_date) ? r.start_date : null, endDate: r.end_date,
      sampleSize: Number.isFinite(r.sample_size) ? r.sample_size : null,
      population: typeof r.population === 'string' ? r.population : null,
      answers, internal: r.internal === true,
      partisan: r.partisan === 'DEM' || r.partisan === 'REP' ? r.partisan : null,
      sponsors: Array.isArray(r.sponsors) ? r.sponsors.filter((s: unknown) => typeof s === 'string') : [],
      url: typeof r.url === 'string' && /^https?:\/\//.test(r.url) ? r.url : null,
    })
  }
  out.sort((a, b) => b.endDate.localeCompare(a.endDate))
  const count = new Map<string, number>()
  return out.filter((p) => {
    const k = `${p.kind}:${p.state}:${p.district}`
    const n = (count.get(k) ?? 0) + 1
    count.set(k, n)
    return n <= (kind === 'generic' ? MAX_GENERIC : MAX_PER_RACE)
  })
}

export function validatePolls(raw: any): PollsPayload {
  if (!raw || raw.api !== 1 || raw.source !== 'VoteHub' || !Array.isArray(raw.polls) || Number.isNaN(Date.parse(raw.fetchedAt))) throw new Error('invalid_polls_payload')
  for (const p of raw.polls) {
    if (!p || !['senate', 'governor', 'house', 'generic'].includes(p.kind) || !Array.isArray(p.answers) || typeof p.pollster !== 'string' || !isDate(p.endDate)) throw new Error('invalid_poll')
  }
  return raw as PollsPayload
}
