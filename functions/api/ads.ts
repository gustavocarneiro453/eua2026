/** GET /api/ads — public auction state (2 slots), cached 5 s at the edge (not in browsers). */
import { getPublicState, INCREMENT_CENTS, MAX_BID_CENTS, MIN_BID_CENTS } from '../../src/services/auction'
import { type Ctx, getDb, json, paymentsMode } from '../../src/services/adsHttp'
import { serveCached, type Stamped } from '../../src/services/edgeCache'

export const onRequestGet = ({ request, env, waitUntil }: Ctx) => {
  const db = getDb(env)
  // Auction not set up (no database, or no payment provider): answer 200 'disabled' so the site simply shows no ads (no console errors).
  if (!db || paymentsMode(env) === 'off') return json({ api: 1, fetchedAt: new Date(Date.now()).toISOString(), disabled: true }, 200, 'public, max-age=60')
  return serveCached<Stamped & Record<string, unknown>>({
    request, waitUntil: waitUntil.bind(null), cacheKey: 'ads-state', freshMs: 5_000, staleMs: 120_000, browserMaxAge: 0, // browsers always revalidate: a bidder returning from checkout must see the new state at once
    produce: async () => ({
      api: 1, fetchedAt: new Date(Date.now()).toISOString(), slots: await getPublicState(db),
      rules: { minBidCents: MIN_BID_CENTS, incrementCents: INCREMENT_CENTS, maxBidCents: MAX_BID_CENTS }, payments: paymentsMode(env),
    }),
  })
}
