import { Fragment, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { raceKey } from '@/hooks/useElections'
import { useBallot } from '@/hooks/useBallot'
import { HOUSE, STATES, type StateInfo } from '@/data/states'
import { hasCountedVotes, rankCandidates } from '@/lib/race'
import { useSeats } from '@/services/seats'
import { PartyDot, raceLabel, ReportingBar, StatusBadge, StateOfficeLink } from '@/components/election'
import { PollsBlock } from '@/components/PollsBlock'
import { SeatLines } from '@/components/SeatLines'
import { InfoTip } from '@/components/InfoTip'
import { PageHeader } from '@/components/PageHeader'
import { DataBanner } from '@/components/DataPanel'
import { Pagination } from '@/components/ui/pagination'
import { OfficeSummary } from '@/components/OfficeSummary'
import { MethodNote } from '@/components/MethodNote'
import { MapLegend } from '@/components/MapLegend'
import { DistrictGrid } from '@/components/DistrictGrid'
import { RacePanel } from '@/components/RacePanel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Race } from '@/services/types'

export const PAGE_SIZE = 25

export interface HouseRow { state: StateInfo; district: number; seat: string }
const seatKey = (code: string, d: number) => `${code}-${String(d).padStart(2, '0')}`
export function houseRows(states: StateInfo[]): HouseRow[] {
  return states.flatMap((s) => (s.houseSeats === 1 ? [0] : Array.from({ length: s.houseSeats }, (_, i) => i + 1)).map((d) => ({ state: s, district: d, seat: seatKey(s.code, d) })))
}

function Candidates({ race }: { race: Race }) {
  const { t, pct, num } = useI18n()
  const [all, setAll] = useState(false)
  const ranked = rankCandidates(race)
  const shown = all ? ranked : ranked.slice(0, 2)
  return (
    <>
      <td className="px-4 py-2.5">
        {shown.map((r) => (
          <div key={r.c.id} className="flex items-center gap-2">
            <span className="num w-7 shrink-0 text-xs text-muted">{r.rank != null ? t('rank.n', { n: r.rank }) : '—'}</span>
            <PartyDot party={r.c.party} /><span className={r.rank === 1 ? 'font-semibold' : ''}>{r.c.name}</span>
            {r.tied && <span className="text-[10px] uppercase text-amber-300">{t('rank.tied')}</span>}
          </div>
        ))}
        {ranked.length > 2 && <button onClick={() => setAll((v) => !v)} className="mt-1 text-xs font-medium text-accent hover:underline">{all ? t('house.less') : t('house.more', { n: ranked.length })}</button>}
      </td>
      <td className="num px-4 py-2.5 text-right">{shown.map((r) => <div key={r.c.id}>{pct(r.c.pct)} <span className="text-xs text-muted">{num(r.c.votes)}</span></div>)}</td>
    </>
  )
}

/** One page of districts. Rows without votes show the incumbent and the certified 2024 result instead of "no data". */
export function HouseTable({ rows }: { rows: HouseRow[] }) {
  const { t } = useI18n()
  const { byKey } = useBallot()
  const seatOf = useSeats(rows.map((r) => r.seat))
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="text-left">
          <tr className="border-b border-line">
            {[t('col.district'), t('col.candidate'), t('col.votes'), t('col.reporting'), t('col.status')].map((h, i) => (
              <th key={h} className={cn('eyebrow px-4 py-3 font-semibold', i === 2 && 'text-right')}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const b = byKey.get(raceKey('house', row.state.code, row.district))!
            const r = b.race, sit = b.sit
            const counted = hasCountedVotes(r)
            return (
              <Fragment key={row.seat}>
                {(i === 0 || rows[i - 1].state.code !== row.state.code) && (
                  <tr className="bg-surface-2/60"><td colSpan={5} className="px-4 py-2 text-xs font-semibold"><Link to={`/states/${row.state.code}`} className="hover:text-accent">{row.state.name}</Link> <span className="font-normal text-muted">· {row.state.houseSeats === 1 ? t('map.district1') : t('map.districts', { n: row.state.houseSeats })}</span>{sit.reason === 'notIntegrated' && <span className="ml-2 font-normal text-muted">· {t('race.officialResults')} <StateOfficeLink state={row.state.code} /></span>}</td></tr>
                )}
                <tr className="border-t border-line/60 align-top">
                  <td className="num px-4 py-2.5 font-medium">{raceLabel('house', row.state.code, row.district)}</td>
                  {r && counted ? <Candidates race={r} /> : (
                    <>
                      <td className="px-4 py-2.5">
                        <SeatLines seat={seatOf(row.seat)} state={row.state.code} />
                        <PollsBlock kind="house" state={row.state.code} district={row.district} limit={1} hideEmpty footer={false} />
                      </td>
                      <td className="num px-4 py-2.5 text-right text-muted">—</td>
                    </>
                  )}
                  <td className="px-4 py-2.5">{r && counted ? <ReportingBar pct={r.reportingPct} /> : <span className="text-muted">—</span>}</td>
                  <td className="px-4 py-2.5"><StatusBadge sit={sit} />{r && counted && <p className="num mt-1 text-[10px] text-muted">{r.source?.name.split(' (')[0]}</p>}</td>
                </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Local (state-page) pagination for states with many districts. */
export function PagedHouseTable({ rows }: { rows: HouseRow[] }) {
  const [page, setPage] = useState(1)
  const top = useRef<HTMLDivElement>(null)
  const go = (p: number) => { setPage(p); top.current?.scrollIntoView({ block: 'nearest' }) }
  return (
    <div ref={top} className="scroll-mt-20 space-y-3">
      <HouseTable rows={rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)} />
      <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={go} />
    </div>
  )
}

/** National House picture: totals, the 435 districts (each with its own result) and the district detail. */
function HouseOverview() {
  const { t } = useI18n()
  const { by } = useBallot()
  const rows = by('house')
  const [sel, setSel] = useState<string | null>(null)
  const row = sel ? rows.find((r) => r.seat.key === sel) : null
  return (
    <div className="container-x mt-6 space-y-4">
      <section className="rounded-xl border border-line bg-surface p-4" aria-label={t('sum.national')}><OfficeSummary office="house" /></section>
      <MethodNote office="house" />
      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-serif text-xl font-semibold">{t('house.gridTitle')}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">{t('house.gridHint')}</p>
        <div className="mt-4"><DistrictGrid rows={rows} selected={sel} onSelect={(r) => setSel(r.seat.key === sel ? null : r.seat.key)} size={22} /></div>
        <MapLegend house />
        {row && <div className="mt-4"><RacePanel row={row} onClose={() => setSel(null)} /></div>}
      </section>
    </div>
  )
}

export default function House() {
  const { t } = useI18n()
  const { byKey } = useBallot()
  const [sp, setSp] = useSearchParams()
  const uf = STATES.some((s) => s.code === sp.get('uf')) ? sp.get('uf')! : ''
  const status = sp.get('status') === 'counting' || sp.get('status') === 'await' ? sp.get('status')! : ''
  const rawPage = Math.max(1, Math.floor(Number(sp.get('p')) || 1))
  const top = useRef<HTMLDivElement>(null)

  const rows = useMemo(() => {
    const base = houseRows(uf ? STATES.filter((s) => s.code === uf) : STATES)
    if (!status) return base
    return base.filter((r) => hasCountedVotes(byKey.get(raceKey('house', r.state.code, r.district))?.race) === (status === 'counting'))
  }, [uf, status, byKey])
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const page = Math.min(rawPage, pageCount)

  const update = (patch: Record<string, string>, resetPage = true) => {
    const n = new URLSearchParams(sp)
    for (const [k, v] of Object.entries(patch)) v ? n.set(k, v) : n.delete(k)
    if (resetPage) n.delete('p')
    setSp(n)
  }
  const goPage = (p: number) => { update({ p: p > 1 ? String(p) : '' }, false); top.current?.scrollIntoView({ block: 'start' }) }
  const select = 'h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink'
  return (
    <>
      <DataBanner />
      <PageHeader eyebrow={<>{t('sum.seatsUp', { n: HOUSE.total })} · {t('sum.majority', { n: HOUSE.majority })}</>} title={<>{t('house.title')}<InfoTip term="house" className="[&_svg]:h-5 [&_svg]:w-5" /></>}
        lede={<>{t('house.lede')} <InfoTip term="district" /></>}>
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted sm:w-56">{t('house.filterState')}
            <select value={uf} onChange={(e) => update({ uf: e.target.value })} className={select}>
              <option value="">{t('house.all')}</option>
              {STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted sm:w-56">{t('house.status')}
            <select value={status} onChange={(e) => update({ status: e.target.value })} className={select}>
              <option value="">{t('house.status.all')}</option>
              <option value="counting">{t('house.status.counting')}</option>
              <option value="await">{t('house.status.await')}</option>
            </select>
          </label>
          {(uf || status) && <Button variant="ghost" size="sm" onClick={() => setSp(new URLSearchParams())}>{t('house.reset')}</Button>}
        </div>
      </PageHeader>
      <HouseOverview />
      <div ref={top} className="container-x mt-6 scroll-mt-20 space-y-4">
        {rows.length === 0 ? <p className="text-sm text-muted">{t('common.none')}</p> : (
          <>
            <HouseTable rows={rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)} />
            <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={goPage} />
          </>
        )}
      </div>
    </>
  )
}
