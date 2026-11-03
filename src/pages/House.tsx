import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { raceKey, useRaces } from '@/hooks/useElections'
import { HOUSE, STATES } from '@/data/states'
import { displayStatus, leader, sortedCandidates, winLabelKey, winner } from '@/lib/race'
import { PartyDot, raceLabel, ReportingBar, StatusBadge } from '@/components/election'
import { InfoTip } from '@/components/InfoTip'
import { PageHeader } from '@/components/PageHeader'
import { DataBanner } from '@/components/DataPanel'

export function districtsOf(seats: number) {
  return seats === 1 ? [0] : Array.from({ length: seats }, (_, i) => i + 1)
}

export function HouseTable({ states }: { states: typeof STATES }) {
  const { t, num, pct } = useI18n()
  const { map, coverage, feed } = useRaces()
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="text-left">
          <tr className="border-b border-line">
            {[t('col.district'), t('col.candidate'), t('col.votes'), t('col.reporting'), t('col.status')].map((h, i) => (
              <th key={h} className={`eyebrow px-4 py-3 font-semibold ${i === 2 ? 'text-right' : ''}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {states.map((s) => (
            <Fragment key={s.code}>
              <tr className="bg-surface-2/60"><td colSpan={5} className="px-4 py-2 text-xs font-semibold"><Link to={`/states/${s.code}`} className="hover:text-accent">{s.name}</Link> <span className="font-normal text-muted">· {s.houseSeats === 1 ? t('map.district1') : t('map.districts', { n: s.houseSeats })}</span></td></tr>
              {districtsOf(s.houseSeats).map((d) => {
                const r = map.get(raceKey('house', s.code, d))
                const top = r ? sortedCandidates(r).slice(0, 2) : []
                const w = winner(r), l = leader(r)
                return (
                  <tr key={d} className="border-t border-line/60 align-top">
                    <td className="num px-4 py-2.5 font-medium">{raceLabel('house', s.code, d)}</td>
                    <td className="px-4 py-2.5">{top.length ? top.map((c) => (
                      <div key={c.id} className="flex items-center gap-2"><PartyDot party={c.party} /><span className={w?.id === c.id ? 'font-semibold' : ''}>{c.name}</span>
                        {w?.id === c.id ? <span className="text-[10px] font-semibold uppercase text-green-400">✓ {t(winLabelKey(r!.status))}</span> : !w && l?.id === c.id && r?.status === 'counting' ? <span className="text-[10px] font-semibold uppercase text-amber-300">{t('race.leader')}</span> : null}
                      </div>)) : <span className="text-xs text-muted">{t('common.dash')}</span>}</td>
                    <td className="num px-4 py-2.5 text-right">{top.length ? top.map((c) => <div key={c.id}>{pct(c.pct)} <span className="text-xs text-muted">{num(c.votes)}</span></div>) : <span className="text-muted">—</span>}</td>
                    <td className="px-4 py-2.5">{r ? <ReportingBar pct={r.reportingPct} /> : <span className="text-muted">—</span>}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={displayStatus(r, coverage, !!feed.snapshot, s.code)} /></td>
                  </tr>
                )
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function House() {
  const { t } = useI18n()
  const [st, setSt] = useState('')
  const states = useMemo(() => (st ? STATES.filter((s) => s.code === st) : STATES), [st])
  return (
    <>
      <DataBanner />
      <PageHeader eyebrow={<>{t('sum.seatsUp', { n: HOUSE.total })} · {t('sum.majority', { n: HOUSE.majority })}</>} title={<>{t('house.title')}<InfoTip term="house" className="[&_svg]:h-5 [&_svg]:w-5" /></>}
        lede={<>{t('house.lede')} <InfoTip term="district" /></>}>
        <label className="mt-5 flex flex-col gap-1 text-xs text-muted sm:w-64">{t('house.filterState')}
          <select value={st} onChange={(e) => setSt(e.target.value)} className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink">
            <option value="">{t('house.all')}</option>
            {STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </label>
      </PageHeader>
      <div className="container-x mt-6"><HouseTable states={states} /></div>
    </>
  )
}
