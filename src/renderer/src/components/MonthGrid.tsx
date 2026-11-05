import type { ClassEvent } from '@shared/types'
import { breakOn, occursOn, ymd } from '@shared/schedule'
import { DAY_ORDER, monthCells, sameDay } from '@/lib/constants'
import { useT } from '@/lib/i18n'

interface Props {
  events: ClassEvent[]
  /** Ngày bất kỳ trong tháng đang xem */
  anchor: Date
  now: Date
  onSelect: (ev: ClassEvent, date: Date) => void
  /** Bấm vào ngày: chuyển sang xem Ngày */
  onDay: (date: Date) => void
}

const MAX = 3

/** Xem Tháng: lưới 6 tuần, mỗi ngày hiện tối đa 3 buổi, dư thì ghi "+n" */
export default function MonthGrid({ events, anchor, now, onSelect, onDay }: Props): React.JSX.Element {
  const t = useT()
  const cells = monthCells(anchor)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-card/40">
      <div className="grid grid-cols-7 border-b border-line bg-hover/50">
        {DAY_ORDER.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted">
            {t(`day.${d}`)}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {cells.map((d) => {
          const inMonth = d.getMonth() === anchor.getMonth()
          const today = sameDay(d, now)
          const weekend = d.getDay() === 0 || d.getDay() === 6
          const items = events
            .flatMap((ev) => {
              const brk = !!breakOn(ev, d)
              return occursOn(ev, d) || brk ? [{ ev, brk }] : []
            })
            .sort((a, b) => a.ev.time.localeCompare(b.ev.time))
          return (
            <div
              key={ymd(d)}
              onClick={() => onDay(d)}
              className={`min-h-0 cursor-pointer overflow-hidden border-b border-l border-line p-1.5 hover:bg-hover ${
                weekend ? 'hatch' : ''
              } ${inMonth ? '' : 'opacity-40'} ${today ? 'bg-accent-soft/50' : ''}`}
            >
              <div className="mb-1 flex">
                <span
                  className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold ${
                    today ? 'btn-accent' : 'text-soft'
                  }`}
                >
                  {d.getDate()}
                </span>
              </div>
              <div className="space-y-1">
                {items.slice(0, MAX).map(({ ev, brk }) => (
                  <button
                    key={ev.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelect(ev, d)
                    }}
                    className={`evt flex w-full items-center gap-1 truncate px-1.5 py-0.5 text-left text-[11px] font-semibold ${
                      brk ? 'evt-break' : ''
                    }`}
                    style={{ ['--ec' as string]: ev.color }}
                  >
                    <span className="shrink-0 opacity-80">{brk ? '🌴' : ev.time}</span>
                    <span className="truncate">{ev.title}</span>
                  </button>
                ))}
                {items.length > MAX && <div className="px-1 text-[11px] font-semibold text-muted">+{items.length - MAX}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
