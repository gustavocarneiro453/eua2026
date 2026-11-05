/**
 * GET /api/config — runtime settings that must change without a rebuild.
 *  - countdownTarget: ISO instant when the vote count is expected to start (env COUNTDOWN_TARGET; invalid values are ignored)
 *  - serverNow: the server clock, so visitors with a wrong clock still see the right countdown
 * Never cached: the point is a fresh clock reading.
 */
import { COUNTDOWN_DEFAULT_ISO, parseTargetIso } from '../../src/config/election'

interface Env { COUNTDOWN_TARGET?: string }

export const onRequestGet = ({ env }: { request: Request; env: Env }) => {
  const configured = parseTargetIso(env.COUNTDOWN_TARGET)
  const target = configured ?? (parseTargetIso(COUNTDOWN_DEFAULT_ISO) as number)
  return new Response(JSON.stringify({
    api: 1,
    serverNow: new Date(Date.now()).toISOString(),
    countdownTarget: new Date(target).toISOString(),
    countdownSource: configured != null ? 'configured' : 'default',
  }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
}
