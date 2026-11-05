import { useI18n } from '@/i18n'
import { GOVERNOR_STATES } from '@/data/states'
import { InfoTip } from '@/components/InfoTip'
import { PageHeader } from '@/components/PageHeader'
import { DataBanner } from '@/components/DataPanel'
import { RacesPage } from '@/components/RacesPage'

export default function Governors() {
  const { t } = useI18n()
  return (
    <>
      <DataBanner />
      <PageHeader eyebrow={t('sum.racesUp', { n: GOVERNOR_STATES.length })} title={<>{t('gov.title')}<InfoTip term="governor" className="[&_svg]:h-5 [&_svg]:w-5" /></>} lede={t('gov.lede')} />
      <RacesPage office="governor" />
    </>
  )
}
