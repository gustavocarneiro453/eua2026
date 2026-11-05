import { useI18n } from '@/i18n'
import { SENATE, SENATE_SEATS } from '@/data/states'
import { InfoTip } from '@/components/InfoTip'
import { PageHeader } from '@/components/PageHeader'
import { DataBanner } from '@/components/DataPanel'
import { RacesPage } from '@/components/RacesPage'

export default function Senate() {
  const { t } = useI18n()
  return (
    <>
      <DataBanner />
      <PageHeader eyebrow={<>{t('sum.seatsUp', { n: SENATE_SEATS.length })} · {t('sum.majority', { n: SENATE.majority })}</>} title={<>{t('senate.title')}<InfoTip term="senate" className="[&_svg]:h-5 [&_svg]:w-5" /></>} lede={t('senate.lede')} />
      <RacesPage office="senate" />
    </>
  )
}
