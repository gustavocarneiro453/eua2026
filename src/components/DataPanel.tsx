import { AlertTriangle, Database, RefreshCw, Activity } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { useFeed, useUpdates, useRaces } from '@/hooks/useElections'
import { feedConfig, refreshFeed } from '@/services/elections'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { raceLabel } from '@/components/election'

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
  if (feed.snapshot?.sourceState === 'stale') return <Strip>{t('data.sourceStale', { t: date(feed.snapshot.generatedAt) })}</Strip>
  return null
}
function Strip({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center gap-2 bg-warn/15 px-4 py-2 text-center text-xs text-amber-200"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{children}</div>
}

export function DataPanel() {
  const { t, date, ago } = useI18n()
  const feed = useFeed()
  useNow()
  const src = feed.snapshot?.source
  return (
    <Card>
      <CardHeader><h2 className="flex items-center gap-2 text-sm font-semibold"><Database className="h-4 w-4 text-muted" />{t('data.title')}</h2></CardHeader>
      <CardBody className="space-y-4 text-sm">
        {feed.status === 'not_configured' && <p className="rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-muted">{t('data.notConfigured')}</p>}
        <dl className="grid grid-cols-1 gap-3">
          <div><dt className="eyebrow">{t('data.source')}</dt>
            <dd className="mt-1">{src ? <a className="text-accent hover:underline" href={src.url} target="_blank" rel="noreferrer">{src.name}</a> : <span className="text-muted">Open America — {t('live.notConfigured').toLowerCase()}</span>}
              {src?.attribution && <span className="mt-1 block text-xs text-muted">“<a href="https://openamerica.io/" target="_blank" rel="noreferrer" className="hover:text-ink">{src.attribution}</a>”</span>}</dd></div>
          <div><dt className="eyebrow">{t('data.lastSuccess')}</dt>
            <dd className="num mt-1">{feed.lastSuccessAt ? <>{date(feed.lastSuccessAt)} <span className="text-xs text-muted">({ago(feed.lastSuccessAt)})</span></> : <span className="text-muted">{t('data.never')}</span>}</dd></div>
          {feed.snapshot?.generatedAt && <div><dt className="eyebrow">{t('data.generated')}</dt><dd className="num mt-1">{date(feed.snapshot.generatedAt)}</dd></div>}
        </dl>
        {feed.status !== 'not_configured' && (
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <span className="text-xs text-muted">{t('data.poll', { n: feed.snapshot?.sourceState === 'waiting' || feed.snapshot?.sourceState === 'final' ? '10 min' : `${feedConfig.pollMs / 1000} s` })}</span>
            <Button variant="outline" size="sm" onClick={() => refreshFeed()}><RefreshCw className="h-3.5 w-3.5" />{t('data.refresh')}</Button>
          </div>
        )}
        {feed.snapshot?.sourceState === 'waiting' && <p className="rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-muted">{t('data.waiting')}</p>}
        {feed.snapshot && !feed.snapshot.callsSupported && <p className="text-xs leading-relaxed text-muted">{t('data.noCalls')}</p>}
        {feed.snapshot && <p className="text-xs leading-relaxed text-muted">{t('data.reportingUnit')}</p>}
        <p className="border-t border-line pt-3 text-xs text-muted">{t('data.institutional')}</p>
        <p className="text-xs text-muted">{t('data.coverageNote')}</p>
      </CardBody>
    </Card>
  )
}

export function UpdatesFeed() {
  const { t, time } = useI18n()
  const events = useUpdates()
  const { list } = useRaces()
  const byId = new Map(list.map((r) => [r.id, r]))
  return (
    <Card>
      <CardHeader><h2 className="flex items-center gap-2 text-sm font-semibold"><Activity className="h-4 w-4 text-muted" />{t('updates.title')}</h2></CardHeader>
      <CardBody>
        {events.length === 0 ? <p className="text-xs leading-relaxed text-muted">{t('updates.empty')}</p> : (
          <ol className="space-y-3">
            {events.slice(0, 12).map((e) => {
              const r = byId.get(e.raceId)
              return (
                <li key={e.id} className="grid grid-cols-[auto_1fr] gap-3 text-sm">
                  <span className="num pt-0.5 text-xs text-muted">{time(e.at)}</span>
                  <span><span className="font-medium">{r ? <Link className="hover:text-accent" to={`/states/${r.state}`}>{t(`race.${r.office}`)} · {raceLabel(r.office, r.state, r.district)}</Link> : e.raceId}</span>
                    <span className="block text-xs text-muted">{t(`updates.${e.kind}`)}</span></span>
                </li>
              )
            })}
          </ol>
        )}
      </CardBody>
    </Card>
  )
}
