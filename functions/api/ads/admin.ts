/**
 * POST /api/ads/admin — moderation, protected by `Authorization: Bearer <ADMIN_TOKEN>`.
 *   {"action":"list"}                      → latest 100 ads with status
 *   {"action":"remove","slot":1|2}         → takes the ad out of the slot (slot reopens at R$ 5,00)
 *   {"action":"refund","adId":"<uuid>"}    → retries the refund of a needs_refund / refund_failed ad
 */
import { getAd, markRefunded, revokeAd } from '../../../src/services/auction'
import { refundAndMark } from '../../../src/services/adsPayments'
import { type Ctx, getDb, isAdId, json, paymentsMode, safeEqual } from '../../../src/services/adsHttp'
import { invalidateEdgeCache } from '../../../src/services/edgeCache'

export const onRequestPost = async ({ request, env }: Ctx) => {
  const db = getDb(env)
  if (!db || !env.ADMIN_TOKEN) return json({ error: 'not_found' }, 404)
  const auth = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!safeEqual(auth, env.ADMIN_TOKEN)) return json({ error: 'unauthorized' }, 401)
  let body: any
  try { body = await request.json() } catch { return json({ error: 'invalid_json' }, 400) }
  if (body?.action === 'list') {
    const { results } = await db.prepare('SELECT id, slot, bid_cents, status, advertiser, title, url, contact_email, logo_domain, logo_src, payment_id, created_at, live_at, ended_at FROM ads ORDER BY created_at DESC LIMIT 100').all()
    return json({ ads: results ?? [] })
  }
  if (body?.action === 'remove' && (body.slot === 1 || body.slot === 2)) {
    const row = await db.prepare('SELECT ad_id AS adId FROM slots WHERE slot = ?').bind(body.slot).first<{ adId: string | null }>()
    if (row?.adId) await revokeAd(db, row.adId, 'removed')
    await invalidateEdgeCache(request, 'ads-state')
    return json({ ok: true, removed: row?.adId ?? null })
  }
  if (body?.action === 'refund' && isAdId(body.adId)) {
    const ad = await getAd(db, body.adId)
    if (!ad?.payment_id || !['needs_refund', 'refund_failed'].includes(ad.status)) return json({ error: 'not_refundable' }, 409)
    if (paymentsMode(env) === 'mock') { await markRefunded(db, ad.id, true); return json({ ok: true, result: 'refunded' }) }
    return json({ ok: true, result: await refundAndMark(env, db, ad.id, ad.payment_id) })
  }
  return json({ error: 'unknown_action' }, 400)
}
