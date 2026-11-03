import { Bar, BarChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import { useI18n } from '@/i18n'

export interface Segment { key: string; label: string; value: number; color: string; opacity?: number }

/** Horizontal stacked seat bar with a majority marker. */
export function SeatBalance({ segments, total, majority }: { segments: Segment[]; total: number; majority: number }) {
  const { num } = useI18n()
  const row = Object.fromEntries(segments.map((s) => [s.key, s.value]))
  return (
    <div>
      <div className="h-10">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={[row]} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap={0}>
            <XAxis type="number" hide domain={[0, total]} />
            <YAxis type="category" hide />
            <Tooltip cursor={false} wrapperStyle={{ outline: 'none' }} content={({ payload }) => payload?.length ? (
              <div className="rounded-lg border border-line bg-[#0B1220] p-2 text-xs">
                {segments.map((s) => <p key={s.key} className="num flex justify-between gap-4"><span className="text-muted">{s.label}</span><span>{num(s.value)}</span></p>)}
              </div>) : null} />
            {segments.map((s) => <Bar key={s.key} dataKey={s.key} stackId="a" fill={s.color} fillOpacity={s.opacity ?? 1} isAnimationActive={false} stroke="#101827" strokeWidth={1} />)}
            <ReferenceLine x={majority} stroke="#F5F7FA" strokeWidth={2} strokeDasharray="3 2" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        {segments.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color, opacity: s.opacity ?? 1 }} />{s.label} <span className="num font-semibold text-ink">{num(s.value)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
