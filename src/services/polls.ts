import { useMemo } from 'react'
import { createResource } from './resource'
import { type Poll, type PollKind, validatePolls } from './pollsNormalize'

/** Polls come from /api/polls (VoteHub, read server-side and cached). Polls are never results. */
export const pollsResource = createResource({ id: 'polls', url: '/api/polls', validate: validatePolls, pollMs: 10 * 60_000 })

export function usePolls() {
  const st = pollsResource.useResource()
  const index = useMemo(() => {
    const m = new Map<string, Poll[]>()
    for (const p of st.data?.polls ?? []) {
      const k = `${p.kind}:${p.state ?? ''}:${p.district ?? ''}`
      m.set(k, [...(m.get(k) ?? []), p])
    }
    return m
  }, [st.data])
  return { ...st, forRace: (kind: PollKind, state: string | null = null, district: number | null = null) => index.get(`${kind}:${state ?? ''}:${district ?? ''}`) ?? [] }
}
