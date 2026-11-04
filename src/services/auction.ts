/**
 * Ad auction: exactly 2 slots. Rules (all amounts in integer cents of BRL):
 *  - minimum opening bid R$ 5,00; to take a slot that is occupied the new bid must be at least
 *    R$ 1,00 above the current one; the highest bid stays until someone beats it.
 *  - a bid is a payment: the ad goes live only after the payment is confirmed by the payment provider.
 *  - the slot is taken with an optimistic compare-and-swap on (bid, ad), so two simultaneous payments
 *    can never both win; the loser's payment is refunded.
 */
import { normalizeDomain, sameSite } from './logoMatch'

export const SLOTS = [1, 2] as const
export type SlotId = (typeof SLOTS)[number]
export const MIN_BID_CENTS = 500
export const INCREMENT_CENTS = 100
export const MAX_BID_CENTS = 1_000_000
const PENDING_TTL_MS = 2 * 3600_000
const MAX_PENDING_PER_HOUR = 300

// ---- minimal D1 typing (Cloudflare D1 and the dev SQLite shim both implement it)
export interface D1Result<T = unknown> { results?: T[]; meta?: { changes?: number } }
export interface D1Stmt {
  bind(...v: unknown[]): D1Stmt
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
  run(): Promise<D1Result>
}
export interface D1Like { prepare(sql: string): D1Stmt }

export const minNextBid = (currentCents: number) => Math.max(MIN_BID_CENTS, currentCents + INCREMENT_CENTS)

export type LogoSrc = 'logodev' | 'brandfetch' | 'site'
export const LOGO_SRCS: LogoSrc[] = ['logodev', 'brandfetch', 'site']
export interface AdLogo { domain: string; src: LogoSrc }
export interface AdInput { slot: SlotId; amountCents: number; advertiser: string; title: string; body: string; url: string; email: string | null; logo: AdLogo | null }
export type Validation = { ok: true; value: AdInput } | { ok: false; errors: Record<string, string> }

const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim() : '')

/** Server-side validation of everything the bidder sends. Links must be plain https URLs. */
export function validateAdInput(raw: any): Validation {
  const errors: Record<string, string> = {}
  const slot = Number(raw?.slot)
  if (!SLOTS.includes(slot as SlotId)) errors.slot = 'invalid_slot'
  const amountCents = Number(raw?.amountCents)
  if (!Number.isInteger(amountCents) || amountCents < MIN_BID_CENTS || amountCents > MAX_BID_CENTS) errors.amountCents = 'invalid_amount'
  const advertiser = clean(raw?.advertiser), title = clean(raw?.title), body = clean(raw?.body)
  if (advertiser.length < 2 || advertiser.length > 40) errors.advertiser = 'invalid_advertiser'
  if (title.length < 3 || title.length > 45) errors.title = 'invalid_title'
  if (body.length > 100) errors.body = 'invalid_body'
  let url = ''
  try {
    const u = new URL(clean(raw?.url))
    const host = u.hostname
    if (u.protocol !== 'https:' || u.username || u.password || !host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || u.href.length > 300) throw new Error('bad_url')
    url = u.href
  } catch { errors.url = 'invalid_url' }
  const emailRaw = clean(raw?.email)
  if (emailRaw && !(emailRaw.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw))) errors.email = 'invalid_email'
  if (raw?.acceptTerms !== true) errors.acceptTerms = 'terms_required'
  if (Object.keys(errors).length) return { ok: false, errors }
  // A logo is only kept when it belongs to the SAME site the ad links to: a famous brand's logo can never be attached
  // to an ad that leads somewhere else. Anything dubious is silently dropped (the ad then shows a monogram).
  let logo: AdLogo | null = null
  const ld = normalizeDomain(typeof raw?.logo?.domain === 'string' ? raw.logo.domain : '')
  if (ld && LOGO_SRCS.includes(raw?.logo?.src) && sameSite(new URL(url).hostname, ld)) logo = { domain: ld, src: raw.logo.src }
  return { ok: true, value: { slot: slot as SlotId, amountCents, advertiser, title, body, url, email: emailRaw || null, logo } }
}

// ---- public state
export interface PublicSlot { slot: SlotId; bidCents: number; minNextBidCents: number; ad: { advertiser: string; title: string; body: string; url: string; domain: string; logo: AdLogo | null } | null }

export async function getPublicState(db: D1Like): Promise<PublicSlot[]> {
  const { results } = await db.prepare(
    'SELECT s.slot AS slot, s.bid_cents AS bid, a.advertiser AS advertiser, a.title AS title, a.body AS body, a.url AS url, a.logo_domain AS logoDomain, a.logo_src AS logoSrc FROM slots s LEFT JOIN ads a ON a.id = s.ad_id ORDER BY s.slot',
  ).all<{ slot: number; bid: number; advertiser: string | null; title: string | null; body: string | null; url: string | null; logoDomain: string | null; logoSrc: string | null }>()
  return (results ?? []).map((r) => ({
    slot: r.slot as SlotId,
    bidCents: r.bid,
    minNextBidCents: minNextBid(r.bid),
    ad: r.url && r.title ? { advertiser: r.advertiser ?? '', title: r.title, body: r.body ?? '', url: r.url, domain: new URL(r.url).hostname.replace(/^www\./, ''),
      logo: r.logoDomain && LOGO_SRCS.includes(r.logoSrc as LogoSrc) ? { domain: r.logoDomain, src: r.logoSrc as LogoSrc } : null } : null,
  }))
}

// ---- creating a bid (pending until paid)
export type CreateResult = { ok: true; id: string } | { ok: false; error: 'bid_too_low' | 'too_many_pending'; minNextBidCents?: number }

export async function createPendingAd(db: D1Like, v: AdInput, now = Date.now()): Promise<CreateResult> {
  const iso = new Date(now).toISOString()
  await db.prepare("UPDATE ads SET status = 'expired', ended_at = ? WHERE status = 'pending_payment' AND created_at < ?").bind(iso, new Date(now - PENDING_TTL_MS).toISOString()).run()
  const recent = await db.prepare("SELECT COUNT(*) AS n FROM ads WHERE status = 'pending_payment' AND created_at > ?").bind(new Date(now - 3600_000).toISOString()).first<{ n: number }>()
  if ((recent?.n ?? 0) >= MAX_PENDING_PER_HOUR) return { ok: false, error: 'too_many_pending' }
  const slot = await db.prepare('SELECT bid_cents AS bid FROM slots WHERE slot = ?').bind(v.slot).first<{ bid: number }>()
  const min = minNextBid(slot?.bid ?? 0)
  if (v.amountCents < min) return { ok: false, error: 'bid_too_low', minNextBidCents: min }
  const id = crypto.randomUUID()
  await db.prepare("INSERT INTO ads (id, slot, bid_cents, advertiser, title, body, url, contact_email, logo_domain, logo_src, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?)")
    .bind(id, v.slot, v.amountCents, v.advertiser, v.title, v.body, v.url, v.email, v.logo?.domain ?? null, v.logo?.src ?? null, iso).run()
  return { ok: true, id }
}

export async function setPreference(db: D1Like, adId: string, preferenceId: string) {
  await db.prepare('UPDATE ads SET preference_id = ? WHERE id = ?').bind(preferenceId, adId).run()
}
export async function markFailed(db: D1Like, adId: string, now = Date.now()) {
  await db.prepare("UPDATE ads SET status = 'failed', ended_at = ? WHERE id = ? AND status = 'pending_payment'").bind(new Date(now).toISOString(), adId).run()
}

export interface AdRow { id: string; slot: number; bid_cents: number; status: string; payment_id: string | null; contact_email: string | null }
export const getAd = (db: D1Like, id: string) => db.prepare('SELECT id, slot, bid_cents, status, payment_id, contact_email FROM ads WHERE id = ?').bind(id).first<AdRow>()

// ---- settling a confirmed payment
export type SettleResult = 'live' | 'already' | 'refund_needed' | 'unknown_ad'

/**
 * Called only after the payment provider confirmed `paidCents` for this ad. Takes the slot if the bid is still
 * valid; otherwise reports `refund_needed` (e.g. someone paid a higher bid first). Safe to call many times.
 */
export async function settlePaid(db: D1Like, o: { adId: string; paymentId: string; paidCents: number; now?: number }): Promise<SettleResult> {
  const now = new Date(o.now ?? Date.now()).toISOString()
  const ad = await getAd(db, o.adId)
  if (!ad) return 'unknown_ad'
  if (ad.payment_id === o.paymentId && ['live', 'outbid', 'refunded', 'removed'].includes(ad.status)) return 'already'
  if (ad.payment_id && ad.payment_id !== o.paymentId) return 'refund_needed' // a second payment for the same ad: refund it, keep the first
  const markRefund = async () => {
    await db.prepare("UPDATE ads SET status = 'needs_refund', payment_id = ?, paid_at = ? WHERE id = ? AND status NOT IN ('live','outbid')").bind(o.paymentId, now, ad.id).run()
    return 'refund_needed' as const
  }
  if (o.paidCents !== ad.bid_cents) return markRefund()
  if (ad.status === 'needs_refund' || ad.status === 'refund_failed') return 'refund_needed'
  for (let attempt = 0; attempt < 5; attempt++) {
    const slot = await db.prepare('SELECT bid_cents AS bid, ad_id AS adId FROM slots WHERE slot = ?').bind(ad.slot).first<{ bid: number; adId: string | null }>()
    if (!slot) return 'unknown_ad'
    if (ad.bid_cents < minNextBid(slot.bid)) return markRefund()
    const swap = await db.prepare('UPDATE slots SET bid_cents = ?, ad_id = ?, updated_at = ? WHERE slot = ? AND bid_cents = ? AND COALESCE(ad_id, \'\') = ?')
      .bind(ad.bid_cents, ad.id, now, ad.slot, slot.bid, slot.adId ?? '').run()
    if (swap.meta?.changes === 1) {
      if (slot.adId) await db.prepare("UPDATE ads SET status = 'outbid', ended_at = ? WHERE id = ? AND status = 'live'").bind(now, slot.adId).run()
      await db.prepare("UPDATE ads SET status = 'live', payment_id = ?, paid_at = ?, live_at = ? WHERE id = ?").bind(o.paymentId, now, now, ad.id).run()
      return 'live'
    }
    // someone else changed the slot between our read and write: re-read and re-check
  }
  return markRefund()
}

export async function markRefunded(db: D1Like, adId: string, ok: boolean, now = Date.now()) {
  await db.prepare("UPDATE ads SET status = ?, ended_at = ? WHERE id = ? AND status IN ('needs_refund','refund_failed')").bind(ok ? 'refunded' : 'refund_failed', new Date(now).toISOString(), adId).run()
}

/** Takes an ad out of its slot (admin removal, chargeback). The slot reopens at the minimum bid. */
export async function revokeAd(db: D1Like, adId: string, status: 'removed' | 'refunded' = 'removed', now = Date.now()) {
  const iso = new Date(now).toISOString()
  await db.prepare("UPDATE slots SET bid_cents = 0, ad_id = NULL, updated_at = ? WHERE ad_id = ?").bind(iso, adId).run()
  await db.prepare("UPDATE ads SET status = ?, ended_at = ? WHERE id = ? AND status IN ('live','outbid')").bind(status, iso, adId).run()
}
