import { AlertTriangle, Database, RefreshCw, Activity } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { useFeed, useUpdates } from '@/hooks/useElections'
import { feedConfig, refreshFeed } from '@/services/elections'
import { useCountdown } from '@/services/countdown'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PartyDot, raceLabel } from '@/components/election'

function useNow(ms = 15000) {
  const [, setN] = useState(0)
  useEffect(() => { const i = setInterval(() => setN((n) => n + 1), ms); return () => clearInterval(i) }, [ms])
}

/** Top-of-page banner for demo / stale / error / not configured states. */
export function DataBanner() {
  const { t, date } = useI18n()
  const feed = useFeed()
  if (feed.snapshot?.isDemo) return <div className="bg-amber-400 px-4 py-2 text-center text-xs font-bold tracking-wide text-black">{feed.snapshot.replayYear ? t('data.replay', { y: feed.snapshot.replayYear }) : t('data.demo')}</div>
  if (feed.stale && feed.lastSuccessAt) return <Strip>{t('data.stale', { t: date(feed.lastSuccessAt) })}</Strip>
  if (feed.status === 'error') return <Strip>{t('data.error', { e: feed.error ?? '' })}</Strip>
  if (feed.status === 'ok' && feed.error) return <Strip>{t('data.partial', { e: feed.error })}</Strip>
  if (feed.snapshot?.sourceState === 'stale') return <Strip>{t('data.sourceStale', { t: date(feed.snapshot.generatedAt) })}</Strip>
  return null
}
function Strip({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center gap-2 bg-warn/15 px-4 py-2 text-center text-xs text-amber-200"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{children}</div>
}

export function DataPanel() {
  const { t, date, ago, hm } = useI18n()
  const feed = useFeed()
  const cd = useCountdown()
  useNow()
  const src = feed.snapshot?.source
  const offices = (['senate', 'governor', 'house'] as const).map((o) => [o, feed.offices[o]] as const)
  return (
    <Card>
      <CardHeader><h2 className="flex items-center gap-2 text-sm font-semibold"><Database className="h-4 w-4 text-muted" />{t('data.title')}</h2></CardHeader>
      <CardBody className="space-y-4 text-sm">
        {feed.status === 'not_started' && <p className="rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-muted">{t('data.notStarted', { t: date(cd.targetMs) })}</p>}
        {feed.status === 'not_configured' && <p className="rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-muted">{t('data.notConfigured')}</p>}
        <dl className="grid grid-cols-1 gap-3">
          <div><dt className="eyebrow">{t('data.source')}</dt>
            <dd className="mt-1">{src ? <a className="text-accent hover:underline" href={src.url} target="_blank" rel="noreferrer">{src.name}</a> : <span className="text-muted">Open America — {t('live.notConfigured').toLowerCase()}</span>}
              {src?.attribution && <span className="mt-1 block text-xs text-muted">“<a href="https://openamerica.io/" target="_blank" rel="noreferrer" className="hover:text-ink">{src.attribution}</a>”</span>}</dd></div>
          <div><dt className="eyebrow">{t('data.lastCheck')}</dt>
            <dd className="num mt-1">{feed.lastSuccessAt ? <>{date(feed.lastSuccessAt)} <span className="text-xs text-muted">({ago(feed.lastSuccessAt)})</span></> : <span className="text-muted">{t('data.never')}</span>}</dd></div>
          <div><dt className="eyebrow">{t('data.lastChange')}</dt>
            <dd className="num mt-1">{feed.lastChangeAt ? <>{date(feed.lastChangeAt)} <span className="text-xs text-muted">({ago(feed.lastChangeAt)})</span></> : <span className="text-muted">{t('data.noChange')}</span>}</dd></div>
          {feed.snapshot?.generatedAt && <div><dt className="eyebrow">{t('data.generated')}</dt><dd className="num mt-1">{date(feed.snapshot.generatedAt)}</dd></div>}
        </dl>
        {feed.snapshot && (
          <div>
            <p className="eyebrow mb-1">{t('data.perOffice')}</p>
            <ul className="space-y-1 text-xs">
              {offices.map(([o, h]) => (
                <li key={o} className="flex items-baseline justify-between gap-2">
                  <span className="text-ink/90">{t(`race.${o}`)}</span>
                  <span className={h.ok ? 'num text-muted' : 'text-amber-300'}>{h.ok ? t('data.officeOk', { n: h.races, t: h.asOf ? hm(h.asOf) : '—' }) : t('data.officeFail', { e: h.error ?? '?' })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {feed.status !== 'not_configured' && feed.status !== 'not_started' && (
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <span className="text-xs text-muted">{t('data.poll', { n: `${feedConfig.pollMs / 1000} s` })}</span>
            <Button variant="outline" size="sm" onClick={() => refreshFeed()}><RefreshCw className="h-3.5 w-3.5" />{t('data.refresh')}</Button>
          </div>
        )}
        {feed.snapshot?.sourceState === 'waiting' && <p className="rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-muted">{t('data.waiting')}</p>}
        {feed.snapshot && !feed.snapshot.callsSupported && <p className="text-xs leading-relaxed text-muted">{t('data.noCalls')}</p>}
        {feed.snapshot && <p className="text-xs leading-relaxed text-muted">{t('data.reportingUnit')}</p>}
        <p className="border-t border-line pt-3 text-xs text-muted">{t('data.institutional')}</p>
        <p className="text-xs text-muted">{t('data.coverageNote')} <Link to="/learn#dados" className="text-accent hover:underline">{t('data.seeSources')}</Link></p>
      </CardBody>
    </Card>
  )
}

/** The history of REAL changes: which contest, who, what changed, when the source updated and which source it was. */
export function UpdatesFeed() {
  const { t, time } = useI18n()
  const events = useUpdates()
  return (
    <Card>
      <CardHeader><h2 className="flex items-center gap-2 text-sm font-semibold"><Activity className="h-4 w-4 text-muted" />{t('updates.title')}</h2></CardHeader>
      <CardBody>
        {events.length === 0 ? <p className="text-xs leading-relaxed text-muted">{t('updates.empty')}</p> : (
          <ol className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {events.slice(0, 40).map((e) => (
              <li key={e.id} className="grid grid-cols-[auto_1fr] gap-3 text-sm">
                <span className="num pt-0.5 text-xs text-muted" title={t('updates.detectedAt', { t: time(e.at) })}>{time(e.asOf ? Date.parse(e.asOf) || e.at : e.at)}</span>
                <span className="min-w-0">
                  <Link className="font-medium hover:text-accent" to={`/states/${e.state}`}>{t(`race.${e.office}`)} · {raceLabel(e.office, e.state, e.district)}{e.special ? ` (${t('race.special')})` : ''}</Link>
                  <span className="block text-xs text-ink/90">
                    {e.party && <PartyDot party={e.party} className="mr-1.5" />}{t(`updates.${e.kind}`)}{e.candidate ? ` — ${e.candidate}` : ''}
                    {e.kind === 'leader_change' && e.from ? ` (${t('updates.from', { name: e.from })})` : ''}
                    {e.kind === 'first_results' && e.to ? ` · ${e.to}` : ''}
                    {(e.kind === 'votes' || e.kind === 'complete') && e.to ? ` · ${t('updates.reportingMove', { from: e.from ?? '—', to: e.to })}` : ''}
                  </span>
                  <span className="block text-[11px] text-muted">{t('updates.sourceAt', { src: e.source.split(' (')[0], t: time(e.at) })}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  )
}
