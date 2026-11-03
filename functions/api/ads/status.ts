/**
 * GET /api/ads/status?id=<adId>[&payment_id=<n>] — the bidder's private status link (the id is a random UUID).
 * When the browser returns from checkout with a payment_id, the payment is verified with Mercado Pago and
 * applied right away, so the ad does not depend on the webhook arriving first.
 */
import { getAd } from '../../../src/services/auction'
import { reconcilePayment } from '../../../src/services/adsPayments'
import { type Ctx, getDb, isAdId, json, paymentsMode } from '../../../src/services/adsHttp'
import { invalidateEdgeCache } from '../../../src/services/edgeCache'

export const onRequestGet = async ({ request, env }: Ctx) => {
  const db = getDb(env)
  if (!db) return json({ error: 'ads_not_configured' }, 503)
  const u = new URL(request.url)
  const id = u.searchParams.get('id')
  if (!isAdId(id)) return json({ error: 'invalid_id' }, 400)
  let ad = await getAd(db, id)
  if (!ad) return json({ error: 'not_found' }, 404)
  const paymentId = u.searchParams.get('payment_id')
  if (ad.status === 'pending_payment' && paymentId && /^\d{1,20}$/.test(paymentId) && paymentsMode(env) === 'mercadopago') {
    try {
      const r = await reconcilePayment(env, db, paymentId)
      if (r.adId === id) { await invalidateEdgeCache(request, 'ads-state'); ad = (await getAd(db, id)) ?? ad }
    } catch (e) { console.warn(`[ads] return reconcile failed: ${(e as Error).message}`) }
  }
  return json({ status: ad.status, slot: ad.slot, bidCents: ad.bid_cents })
}
