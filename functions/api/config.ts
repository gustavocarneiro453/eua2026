/**
 * GET /api/config — runtime settings that must change without a rebuild.
 *  - countdownTarget: ISO instant when the vote count is expected to start (env COUNTDOWN_TARGET; invalid values are ignored)
 *  - serverNow: the server clock, so visitors with a wrong clock still see the right countdown
 *  - logo: public identifiers for the browser-side logo services (Logo.dev publishable key, Brandfetch client ID)
 * Never cached: the point is a fresh clock reading.
 */
import { COUNTDOWN_DEFAULT_ISO, parseTargetIso } from '../../src/config/election'

interface Env { COUNTDOWN_TARGET?: string; LOGODEV_PUBLISHABLE_KEY?: string; BRANDFETCH_CLIENT_ID?: string }

// Public identifiers meant for browsers (never the secret key): Logo.dev publishable key (pk_…) and Brandfetch client ID.
const PK = /^pk_[A-Za-z0-9_-]{8,80}$/
const CLIENT_ID = /^[A-Za-z0-9_-]{8,80}$/

export const onRequestGet = ({ env }: { request: Request; env: Env }) => {
  const configured = parseTargetIso(env.COUNTDOWN_TARGET)
  const target = configured ?? (parseTargetIso(COUNTDOWN_DEFAULT_ISO) as number)
  return new Response(JSON.stringify({
    api: 1,
    serverNow: new Date(Date.now()).toISOString(),
    countdownTarget: new Date(target).toISOString(),
    countdownSource: configured != null ? 'configured' : 'default',
    logo: {
      logodevToken: env.LOGODEV_PUBLISHABLE_KEY && PK.test(env.LOGODEV_PUBLISHABLE_KEY) ? env.LOGODEV_PUBLISHABLE_KEY : null,
      brandfetchClientId: env.BRANDFETCH_CLIENT_ID && CLIENT_ID.test(env.BRANDFETCH_CLIENT_ID) ? env.BRANDFETCH_CLIENT_ID : null,
    },
  }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
}
