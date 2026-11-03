/**
 * Expected start of the vote count, used by the countdown on the home page.
 *
 * Default: 2026-11-03T23:00:00Z = 6:00 p.m. Eastern Standard Time (UTC-5; daylight time ended on Nov 1),
 * the moment the first polls close in the 2026 general election: the Eastern-time parts of Indiana and Kentucky.
 * Sources: CBS News, "Here's when polls close for 2026 midterm elections across the U.S."
 * (https://www.cbsnews.com/news/when-polls-open-close-2026-midterm-elections/) and Quartz, "Poll closing times 2026".
 * States close at different times through 1 a.m. Eastern (Alaska); results appear as each state publishes them.
 *
 * It is configurable WITHOUT a rebuild: set COUNTDOWN_TARGET (ISO 8601 with offset, e.g. 2026-11-03T23:00:00Z) as a
 * variable in the Cloudflare Pages project; the server answers it at /api/config. VITE_COUNTDOWN_TARGET changes the
 * built-in fallback at build time.
 */
export const COUNTDOWN_SOURCE_URL = 'https://www.cbsnews.com/news/when-polls-open-close-2026-midterm-elections/'
export const COUNTDOWN_DEFAULT_ISO = '2026-11-03T23:00:00Z'

/** ISO 8601 with an explicit offset (Z or ±hh:mm) and a real date; anything else is rejected. */
export function parseTargetIso(s: unknown): number | null {
  if (typeof s !== 'string') return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(s.trim())) return null
  const t = Date.parse(s.trim())
  return Number.isNaN(t) ? null : t
}

/** Build-time fallback (VITE_COUNTDOWN_TARGET) or the documented default. */
export const fallbackTargetMs = (): number =>
  parseTargetIso((import.meta as { env?: Record<string, string> }).env?.VITE_COUNTDOWN_TARGET) ?? (parseTargetIso(COUNTDOWN_DEFAULT_ISO) as number)

/** 90061 s → "25:01:01" (hours are not capped, so 5 days out reads 120:00:00). */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}
