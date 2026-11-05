import { useEffect, useRef } from 'react'
import type { ClassEvent } from '@shared/types'
import { breakOn, occursOn, pad, sessionNumber, ymd } from '@shared/schedule'
import { DAY_ORDER, TYPE_ICON, sameDay, weekStart } from '@/lib/constants'
import { useT } from '@/lib/i18n'

const START_H = 6
const END_H = 24
const HOUR_PX = 56

interface Props {
  events: ClassEvent[]
  weekOffset: number
  now: Date
  /** Bấm vào một buổi (kể cả buổi đang nghỉ) */
  onSelect: (ev: ClassEvent, date: Date) => void
}

export default function WeekGrid({ events, weekOffset, now, onSelect }: Props): React.JSX.Element {
  const t = useT()
  const ws = weekStart(weekOffset)
  const days = DAY_ORDER.map((dow, i) => {
    const d = new Date(ws)
    d.setDate(d.getDate() + i)
    return { dow, d }
  })
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i)
  const yOf = (h: number, m: number): number => (((h - START_H) * 60 + m) / 60) * HOUR_PX

  // Tự cuộn tới 1 giờ trước lớp sớm nhất của tuần đang xem (không có lớp thì tới giờ hiện tại)
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const starts = days.flatMap(({ d }) =>
      events.filter((e) => occursOn(e, d) || breakOn(e, d)).map((e) => Number(e.time.split(':')[0]))
    )
    const target = starts.length ? Math.min(...starts) : new Date().getHours()
    scroller.current?.scrollTo({ top: Math.max(0, yOf(Math.max(START_H, target - 1), 0)) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, events.length])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-line pr-2.5">
        <div />
        {days.map(({ dow, d }) => {
          const today = sameDay(d, now)
          return (
            <div key={dow} className={`py-2 text-center text-xs ${today ? 'text-accent' : 'text-muted'}`}>
              {t(`day.${dow}`)}
              <div
                className={`mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-base ${
                  today ? 'bg-accent text-white' : 'text-ink'
                }`}
              >
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-[56px_repeat(7,1fr)]" style={{ height: hours.length * HOUR_PX }}>
          <div>
            {hours.map((h) => (
              <div key={h} style={{ height: HOUR_PX }} className="pr-2 text-right text-[11px] text-muted">
                <span className="relative -top-2">{pad(h)}:00</span>
              </div>
            ))}
          </div>
          {days.map(({ dow, d }) => (
            <div
              key={dow}
              className={`relative border-l border-line ${sameDay(d, now) ? 'bg-accent-soft/40' : ''}`}
              style={{
                backgroundImage: 'linear-gradient(var(--c-line) 1px, transparent 1px)',
                backgroundSize: `100% ${HOUR_PX}px`
              }}
            >
              {events.map((e) => {
                const isBreak = breakOn(e, d)
                if (!occursOn(e, d) && !isBreak) return null
                const [h, m] = e.time.split(':').map(Number)
                const top = Math.max(0, yOf(h, m))
                const height = Math.max(26, (e.duration / 60) * HOUR_PX - 2)
                if (isBreak) {
                  // Bản trước tự lưu chữ "Nghỉ" làm lý do; coi như không có lý do để khỏi lặp chữ
                  const reason = isBreak.note && isBreak.note !== 'Nghỉ' ? isBreak.note : undefined
                  return (
                    <button
                      key={`${e.id}-break`}
                      onClick={() => onSelect(e, d)}
                      title={reason}
                      className="absolute inset-x-1 overflow-hidden rounded-lg border border-dashed border-muted px-2 py-1 text-left text-xs text-muted hover:bg-hover"
                      style={{ top, height }}
                    >
                      <div className="truncate font-semibold">🌴 {t('grid.break')}</div>
                      <div className="truncate">{e.title}</div>
                      {reason && <div className="truncate opacity-80">{reason}</div>}
                    </button>
                  )
                }
                const no = sessionNumber(e, d)
                const endMin = h * 60 + m + e.duration
                const mark = e.attendance?.[ymd(d)]
                return (
                  <button
                    key={e.id}
                    onClick={() => onSelect(e, d)}
                    className={`absolute inset-x-1 overflow-hidden rounded-lg border-l-4 border-black/30 px-2 py-1 text-left text-xs text-white shadow ${
                      e.enabled ? '' : 'opacity-40'
                    }`}
                    style={{ top, height, background: e.color }}
                  >
                    <div className="line-clamp-2 break-words font-semibold leading-tight">
                      {TYPE_ICON[e.type]} {e.title}
                    </div>
                    <div className="opacity-90">
                      {e.time} – {pad(Math.floor(endMin / 60) % 24)}:{pad(endMin % 60)}
                    </div>
                    {no && (
                      <div className="opacity-90">
                        {t('grid.session', { no })}
                        {e.totalSessions ? `/${e.totalSessions}` : ''}
                        {mark === 'present' && ' ✓'}
                        {mark === 'absent' && ' ✗'}
                      </div>
                    )}
                  </button>
                )
              })}
              {sameDay(d, now) && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-bad"
                  style={{ top: yOf(now.getHours(), now.getMinutes()) }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
