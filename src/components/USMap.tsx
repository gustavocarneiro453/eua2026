import { memo, useMemo, useRef, useState } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { useNavigate } from 'react-router-dom'
import topo from 'us-atlas/states-10m.json'
import { STATE_BY_FIPS, STATE_BY_CODE } from '@/data/states'
import { useI18n } from '@/i18n'
import { type Row, useBallot } from '@/hooks/useBallot'
import type { Layer } from '@/lib/ballot'
import { PARTY_COLOR } from '@/lib/race'
import { AWAIT_FILL, NO_RACE_FILL, paint, patternId, UNAVAILABLE_FILL } from '@/lib/sitStyle'
import type { Sit } from '@/lib/classify'
import { StatusBadge } from '@/components/election'
import { MapLegend } from '@/components/MapLegend'
import { DistrictGrid } from '@/components/DistrictGrid'
import { StatePanel } from '@/components/RacePanel'
import { cn } from '@/lib/utils'
import type { DictKey } from '@/i18n/dict'
import type { Party } from '@/services/types'

const LAYERS: [Layer, DictKey][] = [['senate', 'nav.senate'], ['governor', 'nav.governors'], ['house', 'nav.house']]
const PARTIES: Party[] = ['REP', 'DEM', 'IND', 'LIB', 'GRN', 'OTH']

/** Texture definitions shared by every state path (SVG patterns cannot be referenced from CSS). */
function MapDefs() {
  return (
    <defs>
      <pattern id={patternId('dots')} width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill={AWAIT_FILL} /><circle cx="2.5" cy="2.5" r="0.9" fill="rgba(255,255,255,.4)" /></pattern>
      <pattern id={patternId('tied')} width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#94A3B8" /><circle cx="2.5" cy="2.5" r="0.9" fill="rgba(0,0,0,.35)" /></pattern>
      <pattern id={patternId('amber')} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill={UNAVAILABLE_FILL} /><rect width="2" height="6" fill="rgba(245,158,11,.75)" /></pattern>
      {PARTIES.map((p) => (
        <pattern key={p} id={patternId('proj', p)} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill={PARTY_COLOR[p]} /><rect width="2" height="6" fill="rgba(255,255,255,.6)" /></pattern>
      ))}
    </defs>
  )
}

interface Deleg { counts: Record<string, number>; total: number; segments: { color: string; opacity: number; n: number }[] }

/** A state's House delegation as a strip: declared D | leading D | not yet known | leading R | declared R. */
function delegation(rows: Row[]): Deleg {
  const counts: Record<string, number> = { decD: 0, leadD: 0, decR: 0, leadR: 0, other: 0, tied: 0, awaiting: 0, unavailable: 0, noRace: 0 }
  for (const { sit } of rows) {
    const declared = sit.kind === 'projected' || sit.kind === 'official' || sit.kind === 'certified'
    if (declared) counts[sit.party === 'DEM' ? 'decD' : sit.party === 'REP' ? 'decR' : 'other']++
    else if (sit.kind === 'lead') counts[sit.party === 'DEM' ? 'leadD' : sit.party === 'REP' ? 'leadR' : 'other']++
    else counts[sit.kind]++
  }
  const seg = (color: string, opacity: number, n: number) => ({ color, opacity, n })
  return {
    counts, total: rows.length,
    segments: [
      seg(PARTY_COLOR.DEM, 1, counts.decD), seg(PARTY_COLOR.DEM, 0.45, counts.leadD),
      seg(AWAIT_FILL, 1, counts.awaiting), seg(UNAVAILABLE_FILL, 1, counts.unavailable), seg('#94A3B8', 1, counts.tied), seg(PARTY_COLOR.IND, 0.6, counts.other),
      seg(PARTY_COLOR.REP, 0.45, counts.leadR), seg(PARTY_COLOR.REP, 1, counts.decR),
    ].filter((s) => s.n > 0),
  }
}

function singleSit(rows: Row[]): Sit {
  return rows[0]?.sit ?? { kind: 'noRace', party: null, reason: null, complete: false }
}

export const USMap = memo(function USMap({ initialLayer = 'senate', showLayers = true, selected, mode = 'panel' }: {
  initialLayer?: Layer; showLayers?: boolean; selected?: string; mode?: 'panel' | 'navigate'
}) {
  const { t, num, pct } = useI18n()
  const navigate = useNavigate()
  const { by, coverage } = useBallot()
  const [layer, setLayer] = useState<Layer>(initialLayer)
  const [houseView, setHouseView] = useState<'districts' | 'states'>('districts')
  const [pick, setPick] = useState<{ code: string; district: number | null } | null>(null)
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)

  const rows = useMemo(() => by(layer), [by, layer])
  const perState = useMemo(() => {
    const m = new Map<string, Row[]>()
    for (const r of rows) (m.get(r.seat.state) ?? m.set(r.seat.state, []).get(r.seat.state)!).push(r)
    return m
  }, [rows])
  const deleg = useMemo(() => (layer === 'house' ? new Map([...perState].map(([k, v]) => [k, delegation(v)])) : null), [layer, perState])

  const move = (code: string, e: React.MouseEvent) => {
    const r = box.current!.getBoundingClientRect()
    setHover({ code, x: e.clientX - r.left, y: e.clientY - r.top })
  }
  const choose = (code: string) => { if (mode === 'navigate') navigate(`/states/${code}`); else setPick({ code, district: null }) }
  const hs = hover ? STATE_BY_CODE[hover.code] : null
  const hrows = hover ? perState.get(hover.code) ?? [] : []
  const hrow = hrows[0]

  return (
    <div>
      {showLayers && (
        <div className="mb-3 flex flex-wrap items-center gap-2" role="tablist" aria-label={t('map.layer')}>
          {LAYERS.map(([l, k]) => (
            <button key={l} role="tab" aria-selected={layer === l} onClick={() => { setLayer(l); setPick(null) }}
              className={cn('rounded-full px-3 py-1 text-xs font-semibold transition-colors', layer === l ? 'bg-ink text-bg' : 'bg-surface-2 text-muted hover:text-ink')}>{t(k)}</button>
          ))}
          {layer === 'house' && (
            <span className="ml-auto inline-flex rounded-full bg-surface-2 p-0.5 text-xs font-semibold" role="group" aria-label={t('map.houseView')}>
              {(['districts', 'states'] as const).map((v) => (
                <button key={v} onClick={() => setHouseView(v)} aria-pressed={houseView === v}
                  className={cn('rounded-full px-3 py-1', houseView === v ? 'bg-ink text-bg' : 'text-muted hover:text-ink')}>{t(v === 'districts' ? 'map.viewDistricts' : 'map.viewStates')}</button>
              ))}
            </span>
          )}
        </div>
      )}

      {layer === 'house' && houseView === 'districts' ? (
        <div className="rounded-lg border border-line bg-bg/40 p-3">
          <DistrictGrid rows={rows} selected={pick?.district != null ? rows.find((r) => r.seat.state === pick.code && r.seat.district === pick.district)?.seat.key : null}
            onSelect={(r) => setPick({ code: r.seat.state, district: r.seat.district })} />
        </div>
      ) : (
        <div ref={box} className="relative" onMouseLeave={() => setHover(null)}>
          <ComposableMap projection="geoAlbersUsa" width={975} height={610} projectionConfig={{ scale: 1280 }} className="h-auto w-full" aria-label={t('map.title')}>
            <MapDefs />
            {deleg && [...deleg].map(([code, d]) => {
              if (d.segments.length < 2) return null
              let acc = 0
              return (
                <defs key={code}>
                  <linearGradient id={`deleg-${code}`} x1="0" x2="1" y1="0" y2="0">
                    {d.segments.flatMap((s, i) => {
                      const a = acc / d.total; acc += s.n; const b = acc / d.total
                      return [<stop key={`${i}a`} offset={a} stopColor={s.color} stopOpacity={s.opacity} />, <stop key={`${i}b`} offset={b} stopColor={s.color} stopOpacity={s.opacity} />]
                    })}
                  </linearGradient>
                </defs>
              )
            })}
            <Geographies geography={topo}>
              {({ geographies }) => geographies.map((geo) => {
                const s = STATE_BY_FIPS[geo.id as string]
                if (!s) return null // territories / DC are not part of the 50 states
                const srows = perState.get(s.code) ?? []
                let fill = NO_RACE_FILL, fo = 1, stroke: string | undefined, sw: number | undefined
                if (layer === 'house' && deleg) {
                  const d = deleg.get(s.code)!
                  if (d.segments.length >= 2) fill = `url(#deleg-${s.code})`
                  else { const p = paint(singleSit(srows)); fill = p.fill; fo = p.opacity }
                  if (srows.length && srows.every((r) => r.sit.kind === 'certified')) { stroke = '#fff'; sw = 2.4 }
                } else if (srows.length) {
                  const p = paint(singleSit(srows)); fill = p.fill; fo = p.opacity; stroke = p.stroke; sw = p.strokeWidth
                } else { const p = paint({ kind: 'noRace', party: null, reason: null, complete: false }); fill = p.fill }
                const isSel = selected === s.code || pick?.code === s.code
                return (
                  <Geography key={geo.rsmKey} geography={geo} tabIndex={0} role="button" aria-label={s.name}
                    onMouseMove={(e) => move(s.code, e)} onFocus={() => setHover({ code: s.code, x: 40, y: 40 })} onBlur={() => setHover(null)}
                    onClick={() => choose(s.code)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(s.code) } }}
                    style={{
                      default: { fill, fillOpacity: fo, stroke: isSel ? '#F5F7FA' : stroke ?? '#101827', strokeWidth: isSel ? 2 : sw ?? 0.8, outline: 'none' },
                      hover: { fill, fillOpacity: Math.min(1, fo + 0.2), stroke: '#F5F7FA', strokeWidth: 1.5, outline: 'none', cursor: 'pointer' },
                      pressed: { fill, stroke: '#F5F7FA', strokeWidth: 2, outline: 'none' },
                    }} />
                )
              })}
            </Geographies>
          </ComposableMap>
          {hover && hs && (
            <div className="pointer-events-none absolute z-10 w-60 rounded-lg border border-line bg-[#0B1220]/95 p-3 text-xs shadow-2xl"
              style={{ left: Math.max(0, Math.min(hover.x + 14, (box.current?.clientWidth ?? 600) - 250)), top: hover.y + 14 }}>
              <p className="font-serif text-base font-semibold text-ink">{hs.name}</p>
              {layer === 'house' && deleg ? (
                <div className="num mt-1 space-y-0.5 text-muted">
                  <p>{hs.houseSeats === 1 ? t('map.district1') : t('map.districts', { n: hs.houseSeats })}</p>
                  {[['del.declared', deleg.get(hs.code)!.counts.decD + deleg.get(hs.code)!.counts.decR], ['del.leadDEM', deleg.get(hs.code)!.counts.leadD], ['del.leadREP', deleg.get(hs.code)!.counts.leadR], ['del.awaiting', deleg.get(hs.code)!.counts.awaiting], ['del.unavailable', deleg.get(hs.code)!.counts.unavailable]]
                    .filter(([, n]) => (n as number) > 0).map(([k, n]) => <p key={k as string}>{t(k as DictKey)}: <span className="text-ink">{num(n as number)}</span></p>)}
                </div>
              ) : hrow ? (
                <div className="mt-1.5 space-y-1.5">
                  <StatusBadge sit={hrow.sit} />
                  {hrow.race && hrow.sit.kind !== 'awaiting' && hrow.sit.kind !== 'unavailable' && (
                    <p className="num text-muted">{[...hrow.race.candidates].sort((a, b) => (b.votes ?? -1) - (a.votes ?? -1)).slice(0, 2).map((c) => `${c.name.split(' ').slice(-1)[0]} ${pct(c.pct)}`).join(' · ')}</p>
                  )}
                  {hrow.race?.reportingPct != null && <p className="num text-muted">{t('race.reporting', { p: pct(hrow.race.reportingPct) })}</p>}
                </div>
              ) : <p className="mt-1 text-muted">{t(layer === 'senate' ? 'states.noSenate' : 'states.noGov')}</p>}
              {layer !== 'house' && coverage.size > 0 && hrow && <p className="mt-2 text-muted">{t('map.coverage')}: {coverage.has(hs.code) ? t('map.covered') : t('map.notCovered')}</p>}
              <p className="mt-2 text-accent">{mode === 'panel' ? t('map.details') : t('map.open')} →</p>
            </div>
          )}
        </div>
      )}
      <MapLegend house={layer === 'house'} />
      {mode === 'panel' && pick && (
        <div className="mt-4">
          <StatePanel code={pick.code} layer={layer} district={pick.district} onDistrict={(d) => setPick({ code: pick.code, district: d })} onClose={() => setPick(null)} />
        </div>
      )}
    </div>
  )
})
