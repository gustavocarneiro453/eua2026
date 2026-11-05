import type { Race, Snapshot } from './types'

/**
 * Combining sources. A race may come from more than one provider; the rule is explicit and tested:
 *  1. a stronger status wins (certified > official > projected > counting > no_data);
 *  2. between equal statuses, the provider listed first in `priority` wins (state offices before media);
 *  3. among the same provider, the more recently updated count wins, so an older copy never overwrites a newer one.
 * A source that has nothing for a race never blanks what another source has: the race is simply taken from the other.
 */
const RANK: Record<Race['status'], number> = { no_data: 0, counting: 1, projected: 2, official: 3, certified: 4 }
const t = (s: string | null) => (s ? Date.parse(s) || 0 : 0)

export function pickRace(a: Race, b: Race, priority: string[]): Race {
  if (RANK[a.status] !== RANK[b.status]) return RANK[a.status] > RANK[b.status] ? a : b
  const pa = priority.indexOf(a.source?.id ?? ''), pb = priority.indexOf(b.source?.id ?? '')
  const ra = pa < 0 ? 99 : pa, rb = pb < 0 ? 99 : pb
  if (ra !== rb) return ra < rb ? a : b
  return t(a.updatedAt) >= t(b.updatedAt) ? a : b
}

export function mergeRaces(lists: Race[][], priority: string[]): Race[] {
  const by = new Map<string, Race>()
  for (const list of lists) for (const r of list) {
    const cur = by.get(r.id)
    // a race with no votes from one source must not hide a race with votes from another
    by.set(r.id, !cur ? r : (r.candidates.some((c) => (c.votes ?? 0) > 0) !== cur.candidates.some((c) => (c.votes ?? 0) > 0))
      ? (r.candidates.some((c) => (c.votes ?? 0) > 0) ? r : cur) : pickRace(cur, r, priority))
  }
  return [...by.values()]
}

export function mergeSnapshots(parts: Snapshot[], priority: string[]): Snapshot | null {
  if (!parts.length) return null
  const first = parts[0]
  return {
    ...first,
    coverage: [...new Set(parts.flatMap((p) => p.coverage))].sort(),
    races: mergeRaces(parts.map((p) => p.races), priority),
    generatedAt: parts.map((p) => p.generatedAt).filter((x): x is string => !!x).sort().pop() ?? null,
  }
}
