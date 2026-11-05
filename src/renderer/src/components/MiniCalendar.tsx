import { useEffect, useState } from 'react'
import type { ClassEvent } from '@shared/types'
import { occursOn, ymd } from '@shared/schedule'
import { DAY_ORDER, monthCells, sameDay, weekDays } from '@/lib/constants'
import { useT } from '@/lib/i18n'

interface Props {
  events: ClassEvent[]
  /** Ngày đang xem */
  anchor: Date
  now: Date
  view: 'day' | 'week' | 'month'
  onPick: (d: Date) => void
}

/** Lịch tháng nhỏ: chấm màu dưới ngày có học, tô cả tuần (hoặc ngày) đang xem, bấm để nhảy tới ngày đó */
export default function MiniCalendar({ events, anchor, now, view, onPick }: Props): React.JSX.Element {
  const t = useT()
  const [shown, setShown] = useState(() => new Date(anchor.getFullYear(), anchor.getMonth(), 1))
  // Đổi ngày xem sang tháng khác (ví dụ bấm › ở lịch lớn) thì lịch nhỏ đi theo
  useEffect(() => {
    setShown((s) => (s.getFullYear() === anchor.getFullYear() && s.getMonth() === anchor.getMonth() ? s : new Date(anchor.getFullYear(), anchor.getMonth(), 1)))
  }, [anchor])

  const cells = monthCells(shown)
  const week = new Set(weekDays(anchor).map(ymd))
  const colors = (d: Date): string[] => events.filter((e) => e.enabled && occursOn(e, d)).map((e) => e.color).slice(0, 3)
  const step = (n: number): void => setShown(new Date(shown.getFullYear(), shown.getMonth() + n, 1))

  return (
    <section className="card p-4">
      <div className="mb-2 flex items-center">
        <div className="text-sm font-bold">
          {t('month.name', { m: shown.getMonth() + 1, y: shown.getFullYear() })}
        </div>
        <div className="ml-auto flex gap-1">
          <button onClick={() => step(-1)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-hover">‹</button>
          <button onClick={() => step(1)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-hover">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase text-muted">
        {DAY_ORDER.map((d) => (
          <div key={d} className="py-1">{t(`day.${d}`)}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d) => {
          const inMonth = d.getMonth() === shown.getMonth()
          const today = sameDay(d, now)
          const inView = view === 'day' ? sameDay(d, anchor) : view === 'week' ? week.has(ymd(d)) : false
          const dots = colors(d)
          return (
            <button
              key={ymd(d)}
              onClick={() => onPick(d)}
              className={`relative flex h-9 flex-col items-center justify-center text-xs font-medium transition ${
                inView ? 'bg-accent-soft' : 'hover:bg-hover'
              } ${view === 'week' && d.getDay() === 1 && inView ? 'rounded-l-lg' : ''} ${
                view === 'week' && d.getDay() === 0 && inView ? 'rounded-r-lg' : ''
              } ${view === 'day' ? 'rounded-lg' : ''} ${inMonth ? 'text-ink' : 'text-muted/50'}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                  today ? 'btn-accent font-bold' : ''
                }`}
              >
                {d.getDate()}
              </span>
              <span className="absolute bottom-0.5 flex gap-0.5">
                {dots.map((c, i) => (
                  <span key={i} className="h-1 w-1 rounded-full" style={{ background: c }} />
                ))}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
