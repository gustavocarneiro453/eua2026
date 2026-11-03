import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { useI18n } from '@/i18n'
import { type AdSlotView, useAds } from '@/services/ads'
import { useBidDialog } from '@/components/BidDialog'
import { cn } from '@/lib/utils'

/** One ad slot: discreet card, clearly labeled as advertisement, with the current bid and how to beat it. */
export function AdCard({ slot, view, preview = false }: { slot: 1 | 2; view: AdSlotView; preview?: boolean }) {
  const { t, brl } = useI18n()
  const { open } = useBidDialog()
  const ad = view.ad
  const cta = (
    <button type="button" onClick={() => open(slot)} disabled={preview}
      className="shrink-0 rounded-md border border-line px-2.5 py-1 text-[11px] font-semibold text-ink transition-colors hover:border-accent hover:text-accent disabled:pointer-events-none">
      {ad ? t('ads.cta.outbid', { v: brl(view.minNextBidCents) }) : t('ads.cta.advertise')}
    </button>
  )
  if (!ad) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-line px-3 py-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{t('ads.label')}</p>
          <p className="truncate text-sm text-ink/90">{t('ads.empty')} <span className="text-muted">· {t('ads.emptyFrom', { v: brl(view.minNextBidCents) })}</span></p>
        </div>
        {cta}
      </div>
    )
  }
  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2', !preview && 'transition-colors hover:border-line/80')}>
      <a href={ad.url} target="_blank" rel="sponsored nofollow noopener noreferrer" className="group min-w-0 flex-1" aria-label={`${t('ads.label')}: ${ad.title}`} onClick={preview ? (e) => e.preventDefault() : undefined}>
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{t('ads.label')}<span className="normal-case tracking-normal font-normal">· {ad.advertiser}</span></p>
        <p className="truncate text-sm font-medium text-ink group-hover:text-accent">{ad.title}<ArrowUpRight className="ml-0.5 inline h-3 w-3 align-[-1px] text-muted" /></p>
        <p className="hidden truncate text-xs text-muted sm:block">{ad.body ? `${ad.body} · ` : ''}{ad.domain}</p>
      </a>
      {!preview && (
        <div className="flex shrink-0 flex-col items-end gap-1">
          {/* on phones the button already shows the price to beat: keep the strip short */}
          <span className="num hidden text-[10px] text-muted sm:block">{t('ads.currentBid', { v: brl(view.bidCents) })}</span>
          {cta}
        </div>
      )}
    </div>
  )
}

/** Strip at the very top of every page with exactly 2 auction slots. Hidden if the auction backend is not configured. */
export function AdSlots() {
  const { t } = useI18n()
  const ads = useAds()
  if (!ads.data) {
    if (ads.status !== 'loading') return null // not configured or unreachable: no empty box, no layout shift
    return <div className="border-b border-line bg-surface/40" aria-busy="true" aria-label={t('ads.loading')}><div className="container-x grid gap-2 py-2 sm:grid-cols-2"><div className="h-[58px] animate-pulse rounded-lg bg-surface-2/60" /><div className="hidden h-[58px] animate-pulse rounded-lg bg-surface-2/60 sm:block" /></div></div>
  }
  if (ads.data.disabled) return null
  return (
    <aside aria-label={t('ads.label')} className="border-b border-line bg-surface/40">
      <div className="container-x grid gap-2 py-2 sm:grid-cols-2">
        {ads.slots.map((s) => <AdCard key={s.slot} slot={s.slot} view={s} />)}
      </div>
      <div className="container-x -mt-1 pb-1.5 text-right"><Link to="/anuncie" className="text-[10px] text-muted hover:text-ink hover:underline">{t('ads.rulesLink')}</Link></div>
    </aside>
  )
}
