/**
 * POST /api/ads/webhook — Mercado Pago payment notifications. The payload is never trusted: the payment is
 * re-fetched from Mercado Pago and matched to our ad (external_reference, amount, currency). A signature that
 * is present but wrong is rejected; answers 2xx within seconds so MP does not retry.
 */
import { reconcilePayment } from '../../../src/services/adsPayments'
import { type Ctx, getDb, json, paymentsMode } from '../../../src/services/adsHttp'
import { invalidateEdgeCache } from '../../../src/services/edgeCache'
import { verifyWebhookSignature } from '../../../src/services/mercadopago'

export const onRequestPost = async ({ request, env }: Ctx) => {
  const db = getDb(env)
  if (!db || paymentsMode(env) !== 'mercadopago') return json({ error: 'not_found' }, 404)
  const u = new URL(request.url)
  let body: any = null
  try { body = await request.json() } catch { /* IPN-style notifications have no body */ }
  const type = u.searchParams.get('type') ?? u.searchParams.get('topic') ?? body?.type ?? null
  const dataId = String(u.searchParams.get('data.id') ?? body?.data?.id ?? (u.searchParams.get('topic') === 'payment' ? u.searchParams.get('id') : '') ?? '')
  const sig = request.headers.get('x-signature')
  if (sig && env.MP_WEBHOOK_SECRET && !(await verifyWebhookSignature({ secret: env.MP_WEBHOOK_SECRET, xSignature: sig, xRequestId: request.headers.get('x-request-id'), dataId: dataId || null }))) {
    return json({ error: 'invalid_signature' }, 401)
  }
  if ((type && type !== 'payment') || !/^\d{1,20}$/.test(dataId)) return json({ ok: true, ignored: true })
  try {
    const r = await reconcilePayment(env, db, dataId)
    await invalidateEdgeCache(request, 'ads-state')
    return json({ ok: true, outcome: r.outcome })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'mp_http_404') return json({ ok: true, ignored: true }) // unknown payment (e.g. MP's own test ping)
    console.warn(`[ads] webhook failed: ${msg}`)
    return json({ error: 'processing_failed' }, 500) // MP retries
  }
}
