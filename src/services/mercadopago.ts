/**
 * Mercado Pago, Checkout Pro over REST (no SDK). Contract checked against the official SDK sources
 * (github.com/mercadopago/sdk-nodejs) and the webhook docs on 2026-11-03:
 *  - POST /checkout/preferences            → { id, init_point, sandbox_init_point }
 *  - GET  /v1/payments/{id}                → { status, transaction_amount, currency_id, external_reference, ... }
 *  - POST /v1/payments/{id}/refunds        → full refund when the body is empty
 *  - Webhook: POST with query `data.id` + `type=payment`; header x-signature "ts=...,v1=..." where
 *    v1 = HMAC-SHA256(secret, "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"), hex.
 *  Notifications are answered with 200/201 within 22 s, otherwise MP retries every 15 min.
 * The webhook payload is never trusted: the payment is always re-fetched with our access token.
 */
const API = 'https://api.mercadopago.com'

export interface MpEnv { MP_ACCESS_TOKEN?: string; MP_WEBHOOK_SECRET?: string }
export interface MpPayment { id: number | string; status: string; status_detail?: string; transaction_amount: number; currency_id: string; external_reference?: string | null }

export const mpConfigured = (env: MpEnv) => !!env.MP_ACCESS_TOKEN

async function mp<T>(env: MpEnv, path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json', ...(init.idempotencyKey ? { 'X-Idempotency-Key': init.idempotencyKey } : {}) },
      signal: AbortSignal.timeout(15_000),
    })
  } catch (e) {
    throw new Error(`mp_unreachable_${(e as Error).name === 'TimeoutError' ? 'timeout' : 'network'}`)
  }
  if (!res.ok) throw new Error(`mp_http_${res.status}`)
  return (await res.json()) as T
}

export async function createCheckout(env: MpEnv, o: { adId: string; slot: number; amountCents: number; origin: string; email: string | null }) {
  const body = {
    items: [{ id: `slot-${o.slot}`, title: `Anúncio EUA 2026 — espaço ${o.slot}`, quantity: 1, currency_id: 'BRL', unit_price: o.amountCents / 100 }],
    external_reference: o.adId,
    notification_url: `${o.origin}/api/ads/webhook`,
    back_urls: { success: `${o.origin}/?leilao=retorno&ad=${o.adId}`, pending: `${o.origin}/?leilao=retorno&ad=${o.adId}`, failure: `${o.origin}/?leilao=retorno&ad=${o.adId}` },
    auto_return: 'approved',
    // Boleto settles in days: useless for an auction. Pix and cards only.
    payment_methods: { excluded_payment_types: [{ id: 'ticket' }], installments: 1 },
    statement_descriptor: 'EUA2026',
    expires: true,
    expiration_date_to: new Date(Date.now() + 3600_000).toISOString(),
    ...(o.email ? { payer: { email: o.email } } : {}),
  }
  const r = await mp<{ id: string; init_point: string; sandbox_init_point?: string }>(env, '/checkout/preferences', { method: 'POST', body: JSON.stringify(body) })
  // Test credentials ("TEST-…") must use the sandbox checkout URL.
  const url = env.MP_ACCESS_TOKEN?.startsWith('TEST-') && r.sandbox_init_point ? r.sandbox_init_point : r.init_point
  return { preferenceId: r.id, checkoutUrl: url }
}

export const getPayment = (env: MpEnv, id: string) => mp<MpPayment>(env, `/v1/payments/${encodeURIComponent(id)}`)

export const refundPayment = (env: MpEnv, id: string) =>
  mp<{ id: number }>(env, `/v1/payments/${encodeURIComponent(id)}/refunds`, { method: 'POST', body: '{}', idempotencyKey: `eua2026-refund-${id}` })

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function expectedSignature(secret: string, dataId: string | null, requestId: string | null, ts: string) {
  const manifest = [dataId ? `id:${dataId}` : '', requestId ? `request-id:${requestId}` : '', `ts:${ts}`].filter(Boolean).join(';') + ';'
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest)))
}

/** Constant-time check of the x-signature header. */
export async function verifyWebhookSignature(o: { secret: string; xSignature: string | null; xRequestId: string | null; dataId: string | null }) {
  if (!o.xSignature) return false
  let ts = '', v1 = ''
  for (const part of o.xSignature.split(',')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim().toLowerCase(), v = part.slice(i + 1).trim()
    if (k === 'ts') ts = v
    else if (k === 'v1') v1 = v
  }
  if (!/^\d+$/.test(ts) || !v1) return false
  const want = await expectedSignature(o.secret, o.dataId, o.xRequestId, ts)
  if (want.length !== v1.length) return false
  let diff = 0
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ v1.charCodeAt(i)
  return diff === 0
}
