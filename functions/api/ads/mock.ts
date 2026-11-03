/**
 * LOCAL/DEMO checkout, only active when PAYMENTS_MODE=mock is set explicitly (never in production):
 * GET shows a fake payment page, POST "pays" the ad as if the provider had confirmed it.
 */
import { getAd, markRefunded, settlePaid } from '../../../src/services/auction'
import { type Ctx, getDb, isAdId, json, paymentsMode, sameOrigin } from '../../../src/services/adsHttp'
import { invalidateEdgeCache } from '../../../src/services/edgeCache'

const page = (body: string) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Checkout de teste</title>
<body style="font:16px system-ui;background:#101827;color:#f5f7fa;display:grid;place-items:center;min-height:100vh;margin:0"><main style="max-width:420px;padding:24px;background:#182438;border-radius:12px">${body}</main>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })

export const onRequestGet = async ({ request, env }: Ctx) => {
  const db = getDb(env)
  if (!db || paymentsMode(env) !== 'mock') return json({ error: 'not_found' }, 404)
  const id = new URL(request.url).searchParams.get('ad')
  const ad = isAdId(id) ? await getAd(db, id) : null
  if (!ad) return json({ error: 'not_found' }, 404)
  return page(`<p style="background:#f59e0b;color:#000;padding:6px 10px;border-radius:6px;font-weight:700;font-size:13px">AMBIENTE DE TESTE — nenhum pagamento real</p>
<h1 style="font-size:20px">Pagar R$ ${(ad.bid_cents / 100).toFixed(2).replace('.', ',')}</h1><p>Espaço ${ad.slot}. Simula a confirmação do Mercado Pago.</p>
<form method="post" action="/api/ads/mock"><input type="hidden" name="ad" value="${ad.id}"><button style="padding:10px 16px;border:0;border-radius:8px;background:#22c55e;font-weight:700;cursor:pointer">Simular pagamento aprovado</button></form>
<p><a style="color:#8995a7" href="/?leilao=retorno&ad=${ad.id}">Cancelar e voltar</a></p>`)
}

export const onRequestPost = async ({ request, env }: Ctx) => {
  const db = getDb(env)
  if (!db || paymentsMode(env) !== 'mock') return json({ error: 'not_found' }, 404)
  if (!sameOrigin(request)) return json({ error: 'forbidden_origin' }, 403)
  const id = String((await request.formData()).get('ad') ?? '')
  const ad = isAdId(id) ? await getAd(db, id) : null
  if (!ad) return json({ error: 'not_found' }, 404)
  const r = await settlePaid(db, { adId: ad.id, paymentId: `mock-${ad.id}`, paidCents: ad.bid_cents })
  if (r === 'refund_needed') await markRefunded(db, ad.id, true) // simulated automatic refund
  await invalidateEdgeCache(request, 'ads-state')
  return new Response(null, { status: 303, headers: { Location: `/?leilao=retorno&ad=${ad.id}` } })
}
