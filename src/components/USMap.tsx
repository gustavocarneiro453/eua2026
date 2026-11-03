import { memo, useMemo, useRef, useState } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { useNavigate } from 'react-router-dom'
import topo from 'us-atlas/states-10m.json'
import { STATE_BY_FIPS, STATE_BY_CODE } from '@/data/states'
import { useI18n } from '@/i18n'
import { useRaces } from '@/hooks/useElections'
import { type Layer, type StateLayerInfo, summarize } from '@/lib/summary'
import { PARTY_COLOR } from '@/lib/race'
import { StatusBadge } from '@/components/election'
import { cn } from '@/lib/utils'
import type { DictKey } from '@/i18n/dict'

const NO_RACE = '#141F31'
const NO_DATA = 'var(--color-na)'

function fillFor(info: StateLayerInfo): { fill: string; opacity: number; pattern?: boolean } {
  if (!info.hasRace) return { fill: NO_RACE, opacity: 1 }
  if (info.districts != null) {
    const share = info.districtsWithData! / info.districts
    return share > 0 ? { fill: 'var(--color-accent)', opacity: 0.25 + 0.6 * share } : { fill: NO_DATA, opacity: 1 }
  }
  if (info.winParty) return { fill: PARTY_COLOR[info.winParty], opacity: 1 }
  if (info.leadParty) return { fill: PARTY_COLOR[info.leadParty], opacity: 0.4 }
  return { fill: NO_DATA, opacity: 1 }
}

const LAYERS: [Layer, DictKey][] = [['senate', 'nav.senate'], ['governor', 'nav.governors'], ['house', 'nav.house']]

export const USMap = memo(function USMap({ initialLayer = 'senate', showLayers = true, selected, onSelect }: {
  initialLayer?: Layer; showLayers?: boolean; selected?: string; onSelect?: (code: string) => void
}) {
  const { t, num } = useI18n()
  const navigate = useNavigate()
  const { map, coverage, feed } = useRaces()
  const [layer, setLayer] = useState<Layer>(initialLayer)
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const pointer = useRef<string>('mouse')
  const previewed = useRef<string | null>(null)
  const info = useMemo(() => summarize(layer, map, coverage, !!feed.snapshot), [layer, map, coverage, feed.snapshot])
  const select = (code: string) => (onSelect ? onSelect(code) : navigate(`/states/${code}`))
  const move = (code: string, e: React.MouseEvent) => {
    const r = box.current!.getBoundingClientRect()
    setHover({ code, x: e.clientX - r.left, y: e.clientY - r.top })
  }
  const h = hover ? info[hover.code] : null
  const hs = hover ? STATE_BY_CODE[hover.code] : null

  return (
    <div>
      {showLayers && (
        <div className="mb-3 flex flex-wrap items-center gap-2" role="tablist" aria-label={t('map.layer')}>
          {LAYERS.map(([l, k]) => (
            <button key={l} role="tab" aria-selected={layer === l} onClick={() => setLayer(l)}
              className={cn('rounded-full px-3 py-1 text-xs font-semibold transition-colors', layer === l ? 'bg-ink text-bg' : 'bg-surface-2 text-muted hover:text-ink')}>{t(k)}</button>
          ))}
        </div>
      )}
      <div ref={box} className="relative" onMouseLeave={() => { if (pointer.current !== 'touch') setHover(null) }}>
        <ComposableMap projection="geoAlbersUsa" width={975} height={610} projectionConfig={{ scale: 1280 }} className="h-auto w-full" aria-label={t('map.title')}>
          <Geographies geography={topo}>
            {({ geographies }) => geographies.map((geo) => {
              const s = STATE_BY_FIPS[geo.id as string]
              if (!s) return null // territories / DC not part of the 50 states
              const f = fillFor(info[s.code])
              const isSel = selected === s.code
              return (
                <Geography key={geo.rsmKey} geography={geo} tabIndex={0} role="button" aria-label={s.name}
                  onMouseMove={(e) => move(s.code, e)} onFocus={() => setHover({ code: s.code, x: 40, y: 40 })} onBlur={() => setHover(null)}
                  onPointerDown={(e) => { pointer.current = e.pointerType }}
                  onClick={(e) => {
                    // Touch: first tap shows the preview, second tap on the same state opens it.
                    if (pointer.current === 'touch' && previewed.current !== s.code) { previewed.current = s.code; move(s.code, e); return }
                    select(s.code)
                  }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(s.code) } }}
                  style={{
                    default: { fill: f.fill, fillOpacity: f.opacity, stroke: isSel ? '#F5F7FA' : '#101827', strokeWidth: isSel ? 2 : 0.8, outline: 'none', transition: 'fill-opacity .2s' },
                    hover: { fill: f.fill, fillOpacity: Math.min(1, f.opacity + 0.2), stroke: '#F5F7FA', strokeWidth: 1.5, outline: 'none', cursor: 'pointer' },
                    pressed: { fill: f.fill, stroke: '#F5F7FA', strokeWidth: 2, outline: 'none' },
                  }} />
              )
            })}
          </Geographies>
        </ComposableMap>
        {hover && h && hs && (
          <div className="pointer-events-none absolute z-10 w-60 rounded-lg border border-line bg-[#0B1220]/95 p-3 text-xs shadow-2xl"
            style={{ left: Math.min(hover.x + 14, (box.current?.clientWidth ?? 600) - 250), top: hover.y + 14 }}>
            <p className="font-serif text-base font-semibold text-ink">{hs.name}</p>
            <p className="mb-2 text-muted">{hs.houseSeats === 1 ? t('map.district1') : t('map.districts', { n: hs.houseSeats })}</p>
            {!h.hasRace ? <p className="text-muted">{t(layer === 'senate' ? 'states.noSenate' : 'states.noGov')}</p>
              : h.districts != null ? <p className="num text-muted">{t('sum.withData')}: <span className="text-ink">{feed.snapshot ? `${num(h.districtsWithData!)} / ${num(h.districts)}` : '—'}</span></p>
              : <StatusBadge status={h.status} />}
            {coverage.size > 0 && <p className="mt-2 text-muted">{t('map.coverage')}: {coverage.has(hs.code) ? t('map.covered') : t('map.notCovered')}</p>}
            <p className="mt-2 text-accent">{t('map.open')} →</p>
          </div>
        )}
      </div>
      <Legend layer={layer} />
    </div>
  )
})

function Legend({ layer }: { layer: Layer }) {
  const { t } = useI18n()
  const sw = (bg: string, op: number, label: string) => (
    <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm ring-1 ring-line" style={{ background: bg, opacity: op }} />{label}</span>
  )
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted">
        {layer !== 'house' && sw(NO_RACE, 1, t('map.legend.noRace'))}
        {sw(NO_DATA, 1, t('map.legend.noData'))}
        {layer === 'house' ? sw('var(--color-accent)', 0.7, t('sum.withData')) : <>
          {sw('var(--color-rep)', 0.4, t('map.legend.leadR'))}{sw('var(--color-dem)', 0.4, t('map.legend.leadD'))}
          {sw('var(--color-rep)', 1, t('map.legend.R'))}{sw('var(--color-dem)', 1, t('map.legend.D'))}
        </>}
      </div>
      <p className="text-[11px] text-muted">{t('map.colorNote')}</p>
    </div>
  )
}
