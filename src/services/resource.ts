import { useEffect, useSyncExternalStore } from 'react'

/**
 * Generic polled client resource (same-origin cached endpoints): shared store per resource, one
 * in-flight request, polling only while a component uses it and the tab is visible, exponential
 * backoff, last valid copy kept in localStorage and flagged when old.
 */
export interface ResourceState<T> {
  status: 'loading' | 'ok' | 'error'
  data: T | null
  lastSuccessAt: number | null
  error: string | null
}

export function createResource<T extends { fetchedAt: string }>(o: { id: string; url: string; validate: (raw: unknown) => T; pollMs: number }) {
  const storageKey = `eua2026:res:${o.id}:v1`
  let state: ResourceState<T> = { status: 'loading', data: null, lastSuccessAt: null, error: null }
  try {
    const s = JSON.parse(localStorage.getItem(storageKey) || 'null')
    if (s) state = { status: 'loading', data: o.validate(s.data), lastSuccessAt: s.at, error: null }
  } catch { /* storage unavailable or invalid */ }

  const listeners = new Set<() => void>()
  let inflight: Promise<void> | null = null
  let fails = 0, users = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const set = (p: Partial<ResourceState<T>>) => { state = { ...state, ...p }; listeners.forEach((l) => l()) }

  function refresh(): Promise<void> {
    return (inflight ??= (async () => {
      try {
        const res = await fetch(o.url, { headers: { Accept: 'application/json' } })
        if (!res.ok) throw new Error(`http_${res.status}`)
        const data = o.validate(await res.json())
        const now = Date.now()
        fails = 0
        set({ status: 'ok', data, lastSuccessAt: now, error: null })
        try { localStorage.setItem(storageKey, JSON.stringify({ at: now, data })) } catch { /* quota */ }
      } catch (e) {
        fails++
        set({ status: 'error', error: e instanceof Error ? e.message : 'unknown' })
      } finally { inflight = null }
    })())
  }
  function schedule() {
    clearTimeout(timer)
    if (!users) return
    timer = setTimeout(async () => { if (document.visibilityState === 'visible') await refresh(); schedule() }, Math.min(30 * 60_000, o.pollMs * 2 ** Math.min(fails, 3)))
  }
  function start() {
    users++
    if (!state.lastSuccessAt || Date.now() - state.lastSuccessAt > o.pollMs / 2) refresh().then(schedule); else schedule()
    return () => { users--; if (!users) clearTimeout(timer) }
  }
  return {
    useResource(): ResourceState<T> {
      useEffect(start, [])
      return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, () => state)
    },
    refresh,
  }
}
