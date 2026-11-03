import { useI18n } from '@/i18n'
import { useAds } from '@/services/ads'
import { useBidDialog } from '@/components/BidDialog'
import { AdCard } from '@/components/AdSlots'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import type { DictKey } from '@/i18n/dict'

function Block({ title, keys, vars }: { title: string; keys: DictKey[]; vars?: Record<string, string | number> }) {
  const { t } = useI18n()
  return (
    <Card>
      <CardHeader><h2 className="font-serif text-xl font-semibold">{title}</h2></CardHeader>
      <CardBody><ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink/90">{keys.map((k) => <li key={k}>{t(k, vars)}</li>)}</ul></CardBody>
    </Card>
  )
}

export default function Advertise() {
  const { t, brl } = useI18n()
  const ads = useAds()
  const { open } = useBidDialog()
  const { minBidCents: min, incrementCents: inc } = ads.rules
  const vars = { min: brl(min), inc: brl(inc), a: brl(min), b: brl(min + inc), c: brl(min + 2 * inc) }
  return (
    <>
      <PageHeader eyebrow={t('ads.label')} title={t('adv.title')} lede={t('adv.lede')} />
      <div className="container-x mt-6 max-w-4xl space-y-4">
        {ads.data?.disabled && <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">{t('adv.off')}</p>}
        {!ads.data?.disabled && <Card>
          <CardHeader><h2 className="font-serif text-xl font-semibold">{t('adv.now')}</h2></CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            {ads.slots.length ? ads.slots.map((s) => (
              <div key={s.slot} className="space-y-2">
                <AdCard slot={s.slot} view={s} />
                <Button size="sm" variant="outline" onClick={() => open(s.slot)}>{t('adv.bid')} · {t('ads.dialog.title', { n: s.slot })}</Button>
              </div>
            )) : <p className="text-sm text-muted">{t('ads.loading')}</p>}
          </CardBody>
        </Card>}
        <Block title={t('adv.how')} keys={['adv.how1', 'adv.how2', 'adv.how3', 'adv.how4', 'adv.how5']} vars={vars} />
        <Block title={t('adv.money')} keys={['adv.money1', 'adv.money2', 'adv.money3']} />
        <Block title={t('adv.content')} keys={['adv.content1', 'adv.content2', 'adv.content3', 'adv.content4']} />
        <Block title={t('adv.data')} keys={['adv.data1']} />
      </div>
    </>
  )
}
