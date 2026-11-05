import type { CSSProperties } from 'react'
import type { Party } from '@/services/types'
import { PARTY_COLOR } from './race'
import type { Sit, SitKind } from './classify'

/**
 * One visual language for all maps, tiles and bars. Eight situations, each distinguishable without color alone
 * (fill pattern / opacity / outline), so the three categories always read the same way:
 *
 *  noRace      flat dark navy
 *  awaiting    slate with a dotted texture
 *  unavailable dark with amber diagonal stripes
 *  lead        party color at 45% (a lead is not a win)
 *  tied        light grey with a dotted texture
 *  projected   party color with white diagonal hatching (a media projection, not official)
 *  official    solid party color
 *  certified   solid party color with a thick white outline
 */
export const SIT_ORDER: SitKind[] = ['noRace', 'awaiting', 'unavailable', 'lead', 'tied', 'projected', 'official', 'certified']
export const NO_RACE_FILL = '#141F31'
export const AWAIT_FILL = '#334155'
export const UNAVAILABLE_FILL = '#1B2638'
export const TIED_FILL = '#94A3B8'

export const patternId = (kind: 'dots' | 'amber' | 'tied' | 'proj', party?: Party) => (kind === 'proj' ? `pat-proj-${party ?? 'OTH'}` : `pat-${kind}`)

export interface Paint { fill: string; opacity: number; stroke?: string; strokeWidth?: number; css: CSSProperties }

const hatch = 'repeating-linear-gradient(45deg, rgba(255,255,255,.55) 0 2px, transparent 2px 5px)'
const amber = 'repeating-linear-gradient(45deg, rgba(245,158,11,.75) 0 2px, transparent 2px 5px)'
const dots = 'radial-gradient(rgba(255,255,255,.35) 1px, transparent 1.2px)'

export function paint(sit: Sit): Paint {
  const color = sit.party ? PARTY_COLOR[sit.party] : '#64748B'
  switch (sit.kind) {
    case 'noRace': return { fill: NO_RACE_FILL, opacity: 1, css: { background: NO_RACE_FILL } }
    case 'awaiting': return { fill: `url(#${patternId('dots')})`, opacity: 1, css: { backgroundColor: AWAIT_FILL, backgroundImage: dots, backgroundSize: '5px 5px' } }
    case 'unavailable': return { fill: `url(#${patternId('amber')})`, opacity: 1, css: { backgroundColor: UNAVAILABLE_FILL, backgroundImage: amber } }
    case 'tied': return { fill: `url(#${patternId('tied')})`, opacity: 1, css: { backgroundColor: TIED_FILL, backgroundImage: dots, backgroundSize: '5px 5px' } }
    case 'lead': return { fill: color, opacity: 0.45, css: { background: color, opacity: 0.45 } }
    case 'projected': return { fill: `url(#${patternId('proj', sit.party ?? 'OTH')})`, opacity: 1, css: { backgroundColor: color, backgroundImage: hatch } }
    case 'official': return { fill: color, opacity: 1, css: { background: color } }
    case 'certified': return { fill: color, opacity: 1, stroke: '#FFFFFF', strokeWidth: 2.4, css: { background: color, boxShadow: 'inset 0 0 0 2px #fff' } }
  }
}

/** Swatch for the legend: the same recipe used by the map, in neutral party color where the kind has none. */
export function swatch(kind: SitKind, party?: Party): CSSProperties {
  return paint({ kind, party: party ?? (kind === 'lead' || kind === 'projected' || kind === 'official' || kind === 'certified' ? 'DEM' : null), reason: null, complete: false }).css
}
