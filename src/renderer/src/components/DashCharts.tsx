import { useState } from 'react'
import type { AppData, ClassEvent } from '@shared/types'
import { heatmapWeeks, recentSessions, weeklyHours, type HeatStatus } from '@shared/extras'
import { pad, vnDate, ymd } from '@shared/schedule'
import { sameDay } from '@/lib/constants'
import { useT } from '@/lib/i18n'

const HEAT: Record<HeatStatus, string> = {
  present: 'bg-ok',
  absent: 'bg-bad',
  unmarked: 'bg-warn/80',
  upcoming: 'bg-accent/25',
  break: 'border border-dashed border-muted bg-transparent'
}

/** Bản đồ nhiệt đi học (kiểu bảng đóng góp của GitHub): mỗi cột một tuần, mỗi hàng một thứ */
export function Heatmap({ data, now }: { data: AppData; now: Date }): React.JSX.Element {
  const t = useT()
  const weeks = heatmapWeeks(data, now, 28)
  const rows = [1, 2, 3, 4, 5, 6, 0] // Thứ 2 → CN, đúng thứ tự trong cột
  const label = (r: number): string => ([1, 3, 5].includes(r) ? t(`day.${r}`) : '')

  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-block min-w-full">
        <div className="flex gap-[4px] pl-8 text-[10px] font-medium text-muted">
          {weeks.map((col, i) => {
            const m = col[0].date.getMonth()
            const show = i === 0 || weeks[i - 1][0].date.getMonth() !== m
            return (
              <div key={i} className="w-[14px] shrink-0 overflow-visible whitespace-nowrap">
                {show ? t('heat.month', { m: m + 1 }) : ''}
              </div>
            )
          })}
        </div>
        <div className="mt-1 flex gap-[4px]">
          <div className="flex w-7 shrink-0 flex-col gap-[4px] text-[10px] font-medium text-muted">
            {rows.map((r) => (
              <div key={r} className="flex h-[14px] items-center">
                {label(r)}
              </div>
            ))}
          </div>
          {weeks.map((col, i) => (
            <div key={i} className="flex flex-col gap-[4px]">
              {col.map((c) => (
                <div
                  key={ymd(c.date)}
                  title={c.status ? `${vnDate(ymd(c.date))} · ${t(c.status === 'break' ? 'status.break' : `status.${c.status}`)}${c.tip ? ` · ${c.tip}` : ''}` : vnDate(ymd(c.date))}
                  className={`h-[14px] w-[14px] rounded-[4px] ${c.status ? HEAT[c.status] : 'bg-hover'} ${
                    sameDay(c.date, now) ? 'ring-2 ring-accent ring-offset-1 ring-offset-transparent' : ''
                  }`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
          {(['present', 'absent', 'unmarked', 'upcoming', 'break'] as HeatStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded-[3px] ${HEAT[s]}`} />
              {t(s === 'break' ? 'status.break' : `status.${s}`)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Đồng hồ nửa vòng: tỉ lệ có mặt */
export function Gauge({ pct, sub }: { pct: number | null; sub: string }): React.JSX.Element {
  const r = 80
  const len = Math.PI * r
  const v = pct ?? 0
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 112" className="w-full max-w-[260px]">
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--c-hover)" strokeWidth="18" strokeLinecap="round" />
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="var(--c-accent)"
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray={len}
          strokeDashoffset={len * (1 - v / 100)}
        />
        <text x="100" y="92" textAnchor="middle" className="fill-current text-ink" style={{ fontSize: 34, fontWeight: 700 }}>
          {pct === null ? '—' : `${pct}%`}
        </text>
      </svg>
      <div className="-mt-1 text-xs text-muted">{sub}</div>
    </div>
  )
}

/** Biểu đồ cột giờ học theo tuần (kiểu "Profile Growth"): phần đậm là số giờ đã học (có mặt) */
export function HoursChart({ data, now }: { data: AppData; now: Date }): React.JSX.Element {
  const t = useT()
  const weeks = weeklyHours(data, now, 7, 4)
  const max = Math.max(1, ...weeks.map((w) => w.hours))
  const [hover, setHover] = useState<number | null>(null)
  const active = hover ?? weeks.findIndex((w) => w.current)
  const H = 130

  return (
    <div>
      <div className="flex items-end gap-2" style={{ height: H + 70 }}>
        {weeks.map((w, i) => {
          const h = Math.max(8, (w.hours / max) * H)
          const done = w.hours ? (w.attendedHours / w.hours) * 100 : 0
          const on = i === active
          return (
            <div
              key={ymd(w.monday)}
              className="relative flex flex-1 cursor-default flex-col items-center justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {on && (
                <div
                  className="absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg"
                  style={{ bottom: h + 30 }}
                >
                  {t('chart.tip', { h: w.hours, done: w.attendedHours })}
                </div>
              )}
              <div
                className={`relative w-full max-w-[34px] overflow-hidden rounded-full transition ${on ? 'ring-2 ring-accent/40' : ''}`}
                style={{ height: h, background: w.future ? 'color-mix(in srgb, var(--c-muted) 22%, transparent)' : 'var(--c-accent-soft)' }}
              >
                {!w.future && <div className="absolute inset-x-0 bottom-0 bg-accent" style={{ height: `${done}%` }} />}
              </div>
              <div className={`mt-2 text-[10px] font-medium ${w.current ? 'text-accent' : 'text-muted'}`}>
                {pad(w.monday.getDate())}/{pad(w.monday.getMonth() + 1)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const PILL: Record<string, string> = {
  present: 'bg-ok/15 text-ok',
  absent: 'bg-bad/15 text-bad',
  unmarked: 'bg-warn/15 text-warn',
  inprogress: 'bg-accent-soft text-accent'
}

/** Các buổi gần đây kèm nhãn trạng thái (kiểu bảng có "Pending / Done") */
export function RecentList({ data, now, onSelect }: { data: AppData; now: Date; onSelect: (ev: ClassEvent, d: Date) => void }): React.JSX.Element {
  const t = useT()
  const rows = recentSessions(data, now, 6)
  if (!rows.length) return <p className="text-sm text-muted">{t('recent.none')}</p>
  return (
    <div className="space-y-1.5">
      {rows.map(({ ev, session }) => (
        <button
          key={`${ev.id}-${session.key}`}
          onClick={() => onSelect(ev, session.date)}
          className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-hover"
        >
          <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: ev.color }} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{ev.title}</div>
            <div className="text-xs text-muted">
              {t('grid.session', { no: session.no })} · {t(`day.${session.date.getDay()}`)} {vnDate(session.key)}
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${PILL[session.status] ?? 'bg-hover text-muted'}`}>
            {t(`status.${session.status}`)}
          </span>
        </button>
      ))}
    </div>
  )
}
