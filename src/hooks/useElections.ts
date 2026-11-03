import { useMemo, useSyncExternalStore } from 'react'
import { getEvents, getState, subscribe } from '@/services/elections'
import type { Office, Race } from '@/services/types'

export function useFeed() {
  return useSyncExternalStore(subscribe, getState)
}
export function useUpdates() {
  return useSyncExternalStore(subscribe, getEvents)
}

/** Index of races by key `${office}:${state}[:${district}]` */
export function raceKey(office: Office, state: string, district?: number | null, special?: boolean) {
  return [office, state, district ?? '', special ? 's' : ''].join(':')
}

export function useRaces() {
  const feed = useFeed()
  return useMemo(() => {
    const map = new Map<string, Race>()
    for (const r of feed.snapshot?.races ?? []) map.set(raceKey(r.office, r.state, r.district, r.special), r)
    const coverage = new Set(feed.snapshot?.coverage ?? [])
    return { feed, map, coverage, list: feed.snapshot?.races ?? [] }
  }, [feed])
}
