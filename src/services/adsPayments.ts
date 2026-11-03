import { type D1Like, getAd, markFailed, markRefunded, revokeAd, settlePaid } from './auction'
import { getPayment, type MpEnv, refundPayment } from './mercadopago'

export type Outcome = 'live' | 'already' | 'refunded' | 'refund_failed' | 'waiting' | 'failed' | 'revoked' | 'unknown_ad' | 'ignored'

/** Refunds the payment in full and records the result (a failure is kept visible for manual follow-up). */
export async function refundAndMark(env: MpEnv, db: D1Like, adId: string, paymentId: string): Promise<'refunded' | 'refund_failed'> {
  try { await refundPayment(env, paymentId); await markRefunded(db, adId, true); return 'refunded' } catch (e) {
    console.warn(`[ads] refund failed for payment ${paymentId}: ${(e as Error).message}`)
    await markRefunded(db, adId, false)
    return 'refund_failed'
  }
}

/**
 * Looks the payment up at Mercado Pago (never trusting the caller) and applies it to the ad it belongs to.
 * Idempotent: webhook retries and the browser's return-from-checkout call both end up here.
 */
export async function reconcilePayment(env: MpEnv, db: D1Like, paymentId: string): Promise<{ adId: string | null; outcome: Outcome; slot?: number }> {
  const p = await getPayment(env, paymentId)
  const adId = p.external_reference ?? null
  const ad = adId ? await getAd(db, adId) : null
  if (!ad) return { adId, outcome: 'unknown_ad' }
  const slot = ad.slot
  switch (p.status) {
    case 'approved': {
      const paidCents = Math.round(Number(p.transaction_amount) * 100)
      if (p.currency_id !== 'BRL') { await settlePaid(db, { adId: ad.id, paymentId, paidCents: -1 }); return { adId, slot, outcome: await refundAndMark(env, db, ad.id, paymentId) } }
      const r = await settlePaid(db, { adId: ad.id, paymentId, paidCents })
      if (r === 'refund_needed') return { adId, slot, outcome: await refundAndMark(env, db, ad.id, paymentId) }
      return { adId, slot, outcome: r === 'live' || r === 'already' ? r : 'unknown_ad' }
    }
    case 'pending': case 'in_process': case 'authorized': case 'in_mediation':
      return { adId, slot, outcome: 'waiting' }
    case 'rejected': case 'cancelled':
      await markFailed(db, ad.id); return { adId, slot, outcome: 'failed' }
    case 'refunded': case 'charged_back':
      // Money went back to the buyer: the ad must not keep the slot.
      await revokeAd(db, ad.id, 'refunded'); return { adId, slot, outcome: 'revoked' }
    default:
      return { adId, slot, outcome: 'ignored' }
  }
}
