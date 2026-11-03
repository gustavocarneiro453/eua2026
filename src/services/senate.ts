import { useMemo } from 'react'
import { createResource } from './resource'
import { type SenateMember, validateSenate } from './senateNormalize'

/** Current senators from /api/senate (official senate.gov XML, cached server-side). */
export const senateResource = createResource({ id: 'senate', url: '/api/senate', validate: validateSenate, pollMs: 6 * 3600_000 })

export function useSenate() {
  const st = senateResource.useResource()
  const members = st.data?.members
  const byState = useMemo(() => {
    const m = new Map<string, SenateMember[]>()
    for (const x of members ?? []) m.set(x.state, [...(m.get(x.state) ?? []), x])
    return m
  }, [members])
  /** Regular Class II seats are up in 2026; the OH/FL special elections are for the Class III seats. */
  return { ...st, incumbent: (state: string, special: boolean): SenateMember | null => byState.get(state)?.find((x) => x.senateClass === (special ? 3 : 2)) ?? null }
}
