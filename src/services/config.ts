/** One shared, memoized read of /api/config (countdown target, server clock, public logo identifiers). */
export interface PublicConfig {
  serverNow?: string
  countdownTarget?: string
  countdownSource?: string
}
export interface ConfigReading { json: PublicConfig; sentAt: number; receivedAt: number }

let pending: Promise<ConfigReading | null> | null = null
let last: ConfigReading | null = null

/** Resolves to the parsed config with the local send/receive times (to correct the visitor's clock), or null if unreachable. */
export function readConfig(): Promise<ConfigReading | null> {
  return (pending ??= (async () => {
    try {
      const sentAt = Date.now()
      const res = await fetch('/api/config', { cache: 'no-store', signal: AbortSignal.timeout(4000) })
      if (!res.ok) throw new Error(`http_${res.status}`)
      const json = (await res.json()) as PublicConfig
      if (!json || typeof json !== 'object') throw new Error('invalid_config')
      last = { json, sentAt, receivedAt: Date.now() }
      return last
    } catch { return null }
  })())
}
export const peekConfig = () => last

/** Test helper. */
export function __resetConfig() { pending = null; last = null }
