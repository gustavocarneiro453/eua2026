import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock, Info, X } from 'lucide-react'
import { useI18n } from '@/i18n'
import { adsResource, type AdStatus, fetchAdStatus } from '@/services/ads'
import { cn } from '@/lib/utils'
import type { DictKey } from '@/i18n/dict'

const FINAL: AdStatus[] = ['live', 'outbid', 'failed', 'expired', 'refunded', 'needs_refund', 'refund_failed', 'removed']

/** After paying, the checkout sends the bidder back with ?leilao=retorno&ad=<id>: show what happened to the bid. */
export function AdReturnBanner() {
  const { t } = useI18n()
  const [sp, setSp] = useSearchParams()
  const adId = sp.get('leilao') === 'retorno' ? sp.get('ad') : null
  const paymentId = sp.get('payment_id') ?? sp.get('collection_id')
  const [st, setSt] = useState<{ status: AdStatus; slot: number } | null>(null)

  useEffect(() => {
    if (!adId) return
    let stop = false, tries = 0
    const tick = async () => {
      try {
        const r = await fetchAdStatus(adId, paymentId)
        if (stop) return
        setSt(r)
        if (r.status === 'live' || r.status === 'outbid') adsResource.refresh()
        if (FINAL.includes(r.status) || ++tries > 40) return // ~2 min of polling at most
      } catch { if (++tries > 40) return }
      setTimeout(tick, 3000)
    }
    tick()
    return () => { stop = true }
  }, [adId, paymentId])

  if (!adId || !st) return null
  const msg: [DictKey, 'ok' | 'wait' | 'info'] =
    st.status === 'pending_payment' ? ['ads.ret.pending', 'wait']
    : st.status === 'live' ? ['ads.ret.live', 'ok']
    : st.status === 'outbid' ? ['ads.ret.outbid', 'info']
    : st.status === 'refunded' ? ['ads.ret.refundDone', 'info']
    : st.status === 'needs_refund' ? ['ads.ret.refund', 'info']
    : st.status === 'refund_failed' ? ['ads.ret.refundFailed', 'info']
    : st.status === 'removed' ? ['ads.ret.removed', 'info'] : ['ads.ret.failed', 'info']
  const Icon = msg[1] === 'ok' ? CheckCircle2 : msg[1] === 'wait' ? Clock : Info
  const dismiss = () => { const n = new URLSearchParams(sp); ['leilao', 'ad', 'payment_id', 'collection_id', 'collection_status', 'status', 'external_reference', 'preference_id', 'payment_type', 'merchant_order_id', 'site_id', 'processing_mode', 'merchant_account_id'].forEach((k) => n.delete(k)); setSp(n, { replace: true }) }
  return (
    <div role="status" className={cn('border-b px-4 py-2.5 text-sm', msg[1] === 'ok' ? 'border-success/40 bg-success/10 text-green-200' : msg[1] === 'wait' ? 'border-warn/40 bg-warn/10 text-amber-200' : 'border-line bg-surface-2 text-ink')}>
      <div className="container-x flex items-center gap-2"><Icon className="h-4 w-4 shrink-0" /><span className="flex-1">{t(msg[0], { n: st.slot })}</span>
        <button onClick={dismiss} aria-label={t('ads.ret.dismiss')} className="rounded p-1 hover:bg-black/20"><X className="h-4 w-4" /></button></div>
    </div>
  )
}
