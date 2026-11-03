import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { useI18n } from '@/i18n'
import { adsResource, BidError, parseAmountCents, submitBid, useAds } from '@/services/ads'
import { Button } from '@/components/ui/button'
import { AdCard } from '@/components/AdSlots'
import { cn } from '@/lib/utils'
import type { DictKey } from '@/i18n/dict'

type Slot = 1 | 2
const Ctx = createContext<{ open: (slot: Slot) => void }>({ open: () => {} })
export const useBidDialog = () => useContext(Ctx)

const input = 'h-10 w-full rounded-md border border-line bg-bg px-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none'

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-medium text-muted">
      <span className="flex items-baseline justify-between gap-2"><span>{label}</span>{hint && <span className="font-normal">{hint}</span>}</span>
      <span className="mt-1 block text-sm font-normal text-ink">{children}</span>
      {error && <span className="mt-1 block text-xs font-normal text-red-300" role="alert">{error}</span>}
    </label>
  )
}

export function BidDialogProvider({ children }: { children: ReactNode }) {
  const { t, brl } = useI18n()
  const ads = useAds()
  const ref = useRef<HTMLDialogElement>(null)
  const [slot, setSlot] = useState<Slot>(1)
  const [busy, setBusy] = useState(false)
  const [topError, setTopError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [f, setF] = useState({ advertiser: '', title: '', body: '', url: 'https://', email: '', amount: '', acceptTerms: false })

  const view = ads.slots.find((s) => s.slot === slot)
  const min = view?.minNextBidCents ?? ads.rules.minBidCents
  const open = useCallback((s: Slot) => {
    setSlot(s); setErrors({}); setTopError(''); setBusy(false)
    const mn = ads.slots.find((x) => x.slot === s)?.minNextBidCents ?? ads.rules.minBidCents
    setF((p) => ({ ...p, amount: (mn / 100).toFixed(2).replace('.', ',') })) // start at the minimum valid bid
    ref.current?.showModal()
  }, [ads.slots, ads.rules.minBidCents])
  // If the minimum rises while the dialog is open (someone else bid) and the field was cleared, refill it
  useEffect(() => { if (ref.current?.open) setF((p) => (p.amount === '' ? { ...p, amount: (min / 100).toFixed(2).replace('.', ',') } : p)) }, [min, slot, ads.data])
  const close = () => ref.current?.close()
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }))

  const cents = parseAmountCents(f.amount)
  const preview = useMemo(() => ({ advertiser: f.advertiser.trim() || '…', title: f.title.trim() || '…', body: f.body.trim(), url: f.url, domain: (() => { try { return new URL(f.url).hostname.replace(/^www\./, '') } catch { return '' } })() }), [f.advertiser, f.title, f.body, f.url])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (f.advertiser.trim().length < 2) errs.advertiser = t('ads.err.advertiser')
    if (f.title.trim().length < 3) errs.title = t('ads.err.title')
    if (f.body.trim().length > 100) errs.body = t('ads.err.body')
    try { const u = new URL(f.url.trim()); if (u.protocol !== 'https:' || !u.hostname.includes('.')) throw new Error() } catch { errs.url = t('ads.err.url') }
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) errs.email = t('ads.err.email')
    if (cents == null || cents < min) errs.amount = t('ads.err.amount', { min: brl(min) })
    if (!f.acceptTerms) errs.acceptTerms = t('ads.err.terms')
    setErrors(errs); setTopError('')
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const r = await submitBid({ slot, amountCents: cents!, advertiser: f.advertiser, title: f.title, body: f.body, url: f.url.trim(), email: f.email, acceptTerms: true })
      window.location.assign(r.checkoutUrl)
    } catch (err) {
      setBusy(false)
      if (err instanceof BidError) {
        if (err.code === 'bid_too_low') { adsResource.refresh(); setF((p) => ({ ...p, amount: '' })) }
        const key = `ads.err.${err.code}` as DictKey
        setTopError(err.code === 'bid_too_low' ? t(key, { min: brl(err.minNextBidCents ?? min) }) : err.code === 'invalid_input' ? t('ads.err.generic') : (t(key) === key ? t('ads.err.generic') : t(key)))
        if (err.code === 'invalid_input' && err.fields) setErrors(Object.fromEntries(Object.entries(err.fields).map(([k]) => [k, t(`ads.err.${k}` as DictKey, { min: brl(min) })])))
      } else setTopError(t('ads.err.generic'))
    }
  }

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      <dialog ref={ref} onClick={(e) => { if (e.target === ref.current) close() }} aria-labelledby="bid-title"
        className="m-auto w-[min(92vw,34rem)] max-h-[92vh] overflow-y-auto rounded-xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/60">
        <form onSubmit={submit} noValidate className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="bid-title" className="font-serif text-2xl font-semibold">{t('ads.dialog.title', { n: slot })}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {t('ads.dialog.lede', { rule: view && view.bidCents > 0 ? t('ads.dialog.ruleTaken', { cur: brl(view.bidCents), min: brl(min), inc: brl(ads.rules.incrementCents) }) : t('ads.dialog.ruleEmpty', { min: brl(min) }) })}
              </p>
            </div>
            <button type="button" onClick={close} aria-label={t('ads.cancel')} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink"><X className="h-5 w-5" /></button>
          </div>

          <Field label={t('ads.f.amount')} error={errors.amount} hint={t('ads.f.amountHint', { min: brl(min) })}>
            <input className={cn(input, 'num font-semibold')} inputMode="decimal" autoComplete="off" value={f.amount} onChange={set('amount')} aria-invalid={!!errors.amount} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('ads.f.advertiser')} error={errors.advertiser} hint={`${f.advertiser.length}/40`}><input className={input} maxLength={40} value={f.advertiser} onChange={set('advertiser')} /></Field>
            <Field label={t('ads.f.title')} error={errors.title} hint={`${f.title.length}/45`}><input className={input} maxLength={45} value={f.title} onChange={set('title')} /></Field>
          </div>
          <Field label={t('ads.f.body')} error={errors.body} hint={`${f.body.length}/100`}><input className={input} maxLength={100} value={f.body} onChange={set('body')} /></Field>
          <Field label={t('ads.f.url')} error={errors.url}><input className={input} type="url" inputMode="url" value={f.url} onChange={set('url')} /></Field>
          <Field label={t('ads.f.email')} error={errors.email}><input className={input} type="email" autoComplete="email" maxLength={120} value={f.email} onChange={set('email')} /></Field>

          <div>
            <p className="eyebrow mb-1.5">{t('ads.preview')}</p>
            <AdCard slot={slot} view={{ slot, bidCents: cents ?? min, minNextBidCents: min, ad: preview }} preview />
          </div>

          <div>
            <label className="flex items-start gap-2 text-xs leading-relaxed text-ink/90">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]" checked={f.acceptTerms} onChange={(e) => setF((p) => ({ ...p, acceptTerms: e.target.checked }))} />
              <span>{t('ads.f.terms')} <Link to="/anuncie" target="_blank" className="text-accent hover:underline">{t('ads.f.rules')}</Link></span>
            </label>
            {errors.acceptTerms && <p className="mt-1 text-xs text-red-300" role="alert">{errors.acceptTerms}</p>}
          </div>
          {topError && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200" role="alert">{topError}</p>}
          <p className="text-[11px] leading-relaxed text-muted">{ads.data?.payments === 'mock' ? <span className="font-semibold text-amber-300">{t('ads.payNoteMock')}</span> : t('ads.payNote')}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>{t('ads.cancel')}</Button>
            <Button type="submit" disabled={busy}>{busy ? t('ads.paying') : `${t('ads.pay')} · ${cents != null ? brl(cents) : '—'}`}</Button>
          </div>
        </form>
      </dialog>
    </Ctx.Provider>
  )
}
