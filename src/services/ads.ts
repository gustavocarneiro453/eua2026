import { useMemo } from 'react'
import { createResource } from './resource'

/** Client side of the ad auction (server: functions/api/ads*). All amounts are integer cents of BRL. */
export interface AdView { advertiser: string; title: string; body: string; url: string; domain: string; logo: { domain: string; src: 'logodev' | 'brandfetch' | 'site' } | null }
export interface AdSlotView { slot: 1 | 2; bidCents: number; minNextBidCents: number; ad: AdView | null }
export interface AdsState {
  api: 1; fetchedAt: string; slots: AdSlotView[]
  rules: { minBidCents: number; incrementCents: number; maxBidCents: number }
  payments: 'mock' | 'mercadopago' | 'off'
  /** true when the auction is not configured on the server: show no ads and no bid buttons */
  disabled?: boolean
}

function validateAds(raw: any): AdsState {
  if (raw?.api === 1 && raw.disabled === true && !Number.isNaN(Date.parse(raw.fetchedAt))) {
    return { api: 1, fetchedAt: raw.fetchedAt, slots: [], rules: { minBidCents: 500, incrementCents: 100, maxBidCents: 1_000_000 }, payments: 'off', disabled: true }
  }
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
  if (!raw || raw.api !== 1 || !Array.isArray(raw.slots) || raw.slots.length !== 2 || Number.isNaN(Date.parse(raw.fetchedAt)) || !raw.rules || !num(raw.rules.minBidCents) || !num(raw.rules.incrementCents)) throw new Error('invalid_ads_payload')
  for (const s of raw.slots) {
    if (![1, 2].includes(s?.slot) || !num(s.bidCents) || !num(s.minNextBidCents)) throw new Error('invalid_slot')
    // Defense in depth: an ad link must be https, whatever the server says.
    if (s.ad && !(typeof s.ad.title === 'string' && typeof s.ad.url === 'string' && /^https:\/\//.test(s.ad.url))) throw new Error('invalid_ad')
    if (s.ad?.logo && !(typeof s.ad.logo.domain === 'string' && /^[a-z0-9.-]{3,253}$/.test(s.ad.logo.domain) && ['logodev', 'brandfetch', 'site'].includes(s.ad.logo.src))) s.ad.logo = null // a malformed logo never breaks the ad
  }
  return raw as AdsState
}

export const adsResource = createResource({ id: 'ads', url: '/api/ads', validate: validateAds, pollMs: 30_000 })

export function useAds() {
  const st = adsResource.useResource()
  const slots = useMemo(() => st.data?.slots ?? [], [st.data])
  return { ...st, slots, rules: st.data?.rules ?? { minBidCents: 500, incrementCents: 100, maxBidCents: 1_000_000 }, enabled: !!st.data && !st.data.disabled }
}

export interface BidInput { slot: 1 | 2; amountCents: number; advertiser: string; title: string; body: string; url: string; email: string; acceptTerms: boolean; logo: { domain: string; src: 'logodev' | 'brandfetch' | 'site' } | null }

export class BidError extends Error {
  constructor(public code: string, public fields?: Record<string, string>, public minNextBidCents?: number) { super(code) }
}

export async function submitBid(input: BidInput): Promise<{ adId: string; checkoutUrl: string }> {
  let res: Response
  try { res = await fetch('/api/ads/bid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }) } catch { throw new BidError('network') }
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new BidError(j.error ?? 'generic', j.errors, j.minNextBidCents)
  try {
    const u = new URL(j.checkoutUrl)
    if (u.protocol !== 'https:' && u.origin !== location.origin) throw new Error('bad')
  } catch { throw new BidError('checkout_failed') }
  return j
}

export type AdStatus = 'pending_payment' | 'live' | 'outbid' | 'expired' | 'failed' | 'needs_refund' | 'refunded' | 'refund_failed' | 'removed'
export async function fetchAdStatus(id: string, paymentId?: string | null): Promise<{ status: AdStatus; slot: number; bidCents: number }> {
  const q = new URLSearchParams({ id }); if (paymentId) q.set('payment_id', paymentId)
  const res = await fetch(`/api/ads/status?${q}`)
  if (!res.ok) throw new Error(`http_${res.status}`)
  return res.json()
}

/** "7,00" / "7.5" / "7" → cents, or null when it is not a plain amount. */
export function parseAmountCents(text: string): number | null {
  const t = text.trim().replace(/^R\$\s*/i, '')
  if (!/^\d{1,5}([.,]\d{1,2})?$/.test(t)) return null
  return Math.round(Number(t.replace(',', '.')) * 100)
}
