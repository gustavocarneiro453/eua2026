import { useEffect, useState, useSyncExternalStore } from 'react'
import { fallbackTargetMs, parseTargetIso } from '@/config/election'
import { readConfig } from './config'

/**
 * Countdown to the expected start of the vote count.
 * - The target comes from /api/config (configurable on the server); until it answers (or if it fails) the
 *   built-in documented default is used.
 * - Time is the SERVER's: the offset between the server clock and the visitor's clock is applied, so a wrong
 *   computer clock cannot start the count early or late.
 * - When the target is reached the countdown ends by itself and the `onStarted` listeners run (this is what
 *   starts the results polling).
 */
export type Phase = 'before' | 'started'
export interface CountdownState {
  /** false until /api/config answered (or failed): the phase is not decided before that */
  ready: boolean
  phase: Phase; targetMs: number; skewMs: number; source: 'default' | 'configured'; fromServer: boolean
}

let state: CountdownState = { ready: false, phase: 'before', targetMs: fallbackTargetMs(), skewMs: 0, source: 'default', fromServer: false }
const listeners = new Set<() => void>()
const startedListeners = new Set<() => void>()
const beforeListeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined
let initialized = false

export const serverNow = () => Date.now() + state.skewMs
const compute = (s: CountdownState): Phase => (s.ready && Date.now() + s.skewMs >= s.targetMs ? 'started' : 'before')

function set(patch: Partial<CountdownState>) {
  const prev = state
  const next = { ...state, ...patch }
  state = { ...next, phase: compute(next) }
  listeners.forEach((l) => l())
  schedule()
  if (state.phase === 'started' && prev.phase !== 'started') startedListeners.forEach((l) => l())
  if (state.ready && !prev.ready && state.phase === 'before') beforeListeners.forEach((l) => l())
}

/** Wakes up exactly when the countdown reaches zero (setTimeout is capped near 24.8 days, so re-check in chunks). */
function schedule() {
  clearTimeout(timer)
  if (!state.ready || state.phase !== 'before') return
  const remaining = state.targetMs - serverNow()
  timer = setTimeout(() => set({}), Math.max(0, Math.min(remaining + 20, 2 ** 31 - 1)))
}

/** Runs `cb` once the count has started (immediately if it already has). Returns an unsubscribe function. */
export function onStarted(cb: () => void) {
  startedListeners.add(cb)
  if (state.phase === 'started') cb()
  return () => { startedListeners.delete(cb) }
}

/** Runs `cb` once it is known that the count has NOT started yet (the feed must stay idle). */
export function onBefore(cb: () => void) {
  beforeListeners.add(cb)
  if (state.ready && state.phase === 'before') cb()
  return () => { beforeListeners.delete(cb) }
}

export async function initCountdown() {
  if (initialized) return
  initialized = true
  try {
    const r = await readConfig()
    const j = r?.json
    const server = Date.parse(j?.serverNow ?? ''), target = parseTargetIso(j?.countdownTarget)
    if (!r || Number.isNaN(server) || target == null) throw new Error('invalid_config')
    // Offset between server and visitor clocks, taking half the round trip as network delay.
    set({ ready: true, targetMs: target, skewMs: server - (r.sentAt + (r.receivedAt - r.sentAt) / 2), source: j?.countdownSource === 'configured' ? 'configured' : 'default', fromServer: true })
  } catch {
    set({ ready: true }) // keep the documented default and the visitor's own clock
  }
}

export function useCountdown() {
  useEffect(() => { initCountdown() }, [])
  const s = useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, () => state)
  // Re-render every 250 ms while counting down so the seconds never skip.
  const [, tick] = useTick(s.phase === 'before')
  void tick
  return { ...s, remainingMs: Math.max(0, s.targetMs - (Date.now() + s.skewMs)) }
}

function useTick(active: boolean) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setN((x) => x + 1), 250)
    return () => clearInterval(id)
  }, [active])
  return [n, setN] as const
}

/** Test helper: reset the module between tests. */
export function __resetCountdown(targetMs?: number) {
  clearTimeout(timer); initialized = false
  state = { ready: false, phase: 'before', targetMs: targetMs ?? fallbackTargetMs(), skewMs: 0, source: 'default', fromServer: false }
}
