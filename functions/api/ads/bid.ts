/** POST /api/ads/bid — validates a bid, stores it as pending and returns the checkout URL to pay it. */
import { createPendingAd, markFailed, setPreference, validateAdInput } from '../../../src/services/auction'
import { type Ctx, getDb, json, paymentsMode, sameOrigin, siteOrigin } from '../../../src/services/adsHttp'
import { createCheckout } from '../../../src/services/mercadopago'

export const onRequestPost = async ({ request, env }: Ctx) => {
  const db = getDb(env)
  if (!db) return json({ error: 'ads_not_configured' }, 503)
  if (!sameOrigin(request)) return json({ error: 'forbidden_origin' }, 403)
  const mode = paymentsMode(env)
  if (mode === 'off') return json({ error: 'payments_not_configured' }, 503)
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) return json({ error: 'json_required' }, 415)
  const text = await request.text()
  if (text.length > 4096) return json({ error: 'payload_too_large' }, 413)
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return json({ error: 'invalid_json' }, 400) }
  const v = validateAdInput(raw)
  if (!v.ok) return json({ error: 'invalid_input', errors: v.errors }, 422)
  const c = await createPendingAd(db, v.value)
  if (!c.ok) return json({ error: c.error, minNextBidCents: c.minNextBidCents }, c.error === 'bid_too_low' ? 409 : 429)
  const origin = siteOrigin(env, request)
  try {
    if (mode === 'mock') return json({ adId: c.id, amountCents: v.value.amountCents, checkoutUrl: `${origin}/api/ads/mock?ad=${c.id}` })
    const r = await createCheckout(env, { adId: c.id, slot: v.value.slot, amountCents: v.value.amountCents, origin, email: v.value.email })
    await setPreference(db, c.id, r.preferenceId)
    return json({ adId: c.id, amountCents: v.value.amountCents, checkoutUrl: r.checkoutUrl })
  } catch (e) {
    await markFailed(db, c.id)
    return json({ error: 'checkout_failed', reason: (e as Error).message }, 502)
  }
}
