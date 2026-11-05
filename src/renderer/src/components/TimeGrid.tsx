import { useEffect, useRef, useState } from 'react'
import type { ClassEvent } from '@shared/types'
import { dayCount } from '@shared/extras'
import { breakOn, endOn, occursOn, pad, sessionNumber, startOn, ymd } from '@shared/schedule'
import { TYPE_ICON, layoutLanes, sameDay } from '@/lib/constants'
import { useT } from '@/lib/i18n'

const START_H = 6
const END_H = 24
const HOUR_PX = 60

interface Props {
  events: ClassEvent[]
  /** 1 ngày (xem Ngày) hoặc 7 ngày (xem Tuần) */
  days: Date[]
  now: Date
  onSelect: (ev: ClassEvent, date: Date) => void
  /** Bấm vào ô trống: thêm lớp vào đúng ngày và giờ đó */
  onSlot: (date: Date, hour: number, x: number, y: number) => void
}

interface Item {
  ev: ClassEvent
  isBreak: boolean
  start: number // phút trong ngày
  end: number
}

const minutes = (d: Date): number => d.getHours() * 60 + d.getMinutes()

export default function TimeGrid({ events, days, now, onSelect, onSlot }: Props): React.JSX.Element {
  const t = useT()
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i)
  const yOf = (min: number): number => ((min - START_H * 60) / 60) * HOUR_PX
  const cols = `56px repeat(${days.length}, minmax(0, 1fr))`
  const [hover, setHover] = useState<{ col: number; hour: number } | null>(null)

  // Bề rộng một cột ngày: hẹp thì thẻ chỉ ghi giờ bắt đầu cho khỏi bị cắt chữ
  const colRef = useRef<HTMLDivElement>(null)
  const [colW, setColW] = useState(160)
  useEffect(() => {
    const el = colRef.current
    if (!el) return
    setColW(el.getBoundingClientRect().width) // đo ngay (cửa sổ đang ẩn thì ResizeObserver chưa kịp chạy)
    const ro = new ResizeObserver(() => setColW(el.getBoundingClientRect().width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [days.length])

  const itemsOf = (d: Date): Item[] =>
    events.flatMap((ev) => {
      const isBreak = !!breakOn(ev, d)
      if (!occursOn(ev, d) && !isBreak) return []
      return [{ ev, isBreak, start: minutes(startOn(ev, d)), end: minutes(startOn(ev, d)) + ev.duration }]
    })

  // Tự cuộn tới 1 giờ trước buổi sớm nhất đang hiển thị (không có buổi nào thì tới giờ hiện tại)
  const scroller = useRef<HTMLDivElement>(null)
  const firstKey = ymd(days[0])
  useEffect(() => {
    const starts = days.flatMap((d) => itemsOf(d).map((i) => i.start))
    const target = starts.length ? Math.min(...starts) / 60 : new Date().getHours()
    scroller.current?.scrollTo({ top: Math.max(0, yOf(Math.max(START_H, Math.floor(target) - 1) * 60)) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstKey, days.length, events.length])

  const todayIdx = days.findIndex((d) => sameDay(d, now))
  const nowMin = minutes(now)
  const nowInRange = todayIdx >= 0 && nowMin >= START_H * 60 && nowMin <= END_H * 60

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-card/40">
      {/* Hàng tên ngày */}
      <div className="grid border-b border-line bg-hover/50 pr-2.5" style={{ gridTemplateColumns: cols }}>
        <div />
        {days.map((d) => {
          const today = sameDay(d, now)
          const { count, breakDay } = dayCount(events, d)
          return (
            <div key={ymd(d)} className="flex flex-col items-center justify-center gap-0.5 py-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold uppercase tracking-wide ${today ? 'text-accent' : 'text-muted'}`}>
                  {t(`day.${d.getDay()}`)}
                </span>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    today ? 'btn-accent' : 'text-ink'
                  }`}
                >
                  {d.getDate()}
                </span>
              </div>
              <span className="text-[10px] font-medium text-muted">
                {count > 0 ? t('grid.count', { n: count }) : breakDay ? `🌴 ${t('grid.break')}` : '—'}
              </span>
            </div>
          )
        })}
      </div>

      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative grid" style={{ gridTemplateColumns: cols, height: hours.length * HOUR_PX }}>
          {/* Cột giờ */}
          <div>
            {hours.map((h) => (
              <div key={h} style={{ height: HOUR_PX }} className="pr-2 text-right text-[11px] font-medium text-muted">
                {/* nhãn giờ nằm sát vạch giờ hiện tại thì ẩn đi để khỏi bị nhãn giờ hiện tại đè lên */}
                <span className={`relative -top-2 ${nowInRange && Math.abs(yOf(h * 60) - yOf(nowMin)) < 12 ? 'invisible' : ''}`}>{pad(h)}:00</span>
              </div>
            ))}
          </div>

          {days.map((d, col) => {
            const weekend = d.getDay() === 0 || d.getDay() === 6
            const today = col === todayIdx
            // Phần đã qua: cả ngày nếu là ngày trước hôm nay, hoặc các giờ trước giờ hiện tại của hôm nay.
            // Ô đã qua không bấm được (không thêm lớp vào quá khứ); thẻ buổi học vẫn bấm được để điểm danh.
            const dayIsPast = ymd(d) < ymd(now)
            const slotPast = (hour: number): boolean => dayIsPast || (today && hour < now.getHours())
            const pastPx = dayIsPast ? hours.length * HOUR_PX : today ? Math.min(Math.max(yOf(nowMin), 0), hours.length * HOUR_PX) : 0
            const lanes = layoutLanes(itemsOf(d))
            return (
              <div
                key={ymd(d)}
                ref={col === 0 ? colRef : undefined}
                className={`relative border-l border-line ${dayIsPast ? '' : 'cursor-cell'} ${weekend ? 'hatch' : ''} ${today ? 'bg-accent-soft/40' : ''}`}
                style={{
                  backgroundImage: `linear-gradient(var(--c-line) 1px, transparent 1px)${weekend ? ', repeating-linear-gradient(135deg, transparent 0 6px, var(--c-hatch) 6px 7px)' : ''}`,
                  backgroundSize: `100% ${HOUR_PX}px${weekend ? ', auto' : ''}`
                }}
                onMouseMove={(e) => {
                  if ((e.target as HTMLElement).closest('[data-evt]')) return setHover(null)
                  const y = e.clientY - e.currentTarget.getBoundingClientRect().top
                  const hour = START_H + Math.floor(y / HOUR_PX)
                  if (slotPast(hour)) return setHover(null)
                  setHover((h) => (h && h.col === col && h.hour === hour ? h : { col, hour }))
                }}
                onMouseLeave={() => setHover(null)}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('[data-evt]')) return
                  const y = e.clientY - e.currentTarget.getBoundingClientRect().top
                  const hour = START_H + Math.floor(y / HOUR_PX)
                  if (slotPast(hour)) return
                  onSlot(d, hour, e.clientX, e.clientY)
                }}
              >
                {pastPx > 0 && (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0"
                    style={{ height: pastPx, background: 'color-mix(in srgb, var(--c-muted) 9%, transparent)' }}
                  />
                )}
                {hover?.col === col && (
                  <div
                    className="pointer-events-none absolute inset-x-1 flex items-center justify-center rounded-lg border border-dashed border-accent/40 bg-accent-soft/60 text-accent"
                    style={{ top: (hover.hour - START_H) * HOUR_PX + 2, height: HOUR_PX - 4 }}
                  >
                    <span className="text-xl font-light">+</span>
                  </div>
                )}

                {lanes.map(({ item, lane, lanes: n }) => {
                  const { ev, isBreak } = item
                  const top = Math.max(0, yOf(item.start))
                  const height = Math.max(44, (ev.duration / 60) * HOUR_PX - 3) // buổi ngắn vẫn đủ chỗ ghi giờ và tên
                  const place = {
                    top: top + 1,
                    height,
                    left: `calc(${(lane / n) * 100}% + 3px)`,
                    width: `calc(${100 / n}% - 6px)`,
                    ['--ec' as string]: ev.color
                  }
                  if (isBreak) {
                    return (
                      <button
                        key={`${ev.id}-brk`}
                        data-evt
                        onClick={() => onSelect(ev, d)}
                        className="evt evt-break absolute overflow-hidden px-2 py-1 text-left text-xs"
                        style={place}
                      >
                        <div className="truncate font-semibold">🌴 {t('grid.break')}</div>
                        <div className="truncate">{ev.title}</div>
                      </button>
                    )
                  }
                  const no = sessionNumber(ev, d)
                  const mark = ev.attendance?.[ymd(d)]
                  const live = now >= startOn(ev, d) && now < endOn(ev, d)
                  const end = item.end
                  return (
                    <button
                      key={ev.id}
                      data-evt
                      onClick={() => onSelect(ev, d)}
                      className={`evt absolute flex flex-col overflow-hidden text-left text-xs ${live ? 'evt-live' : ''} ${
                        ev.enabled ? '' : 'opacity-45'
                      }`}
                      style={place}
                    >
                      <div className="evt-head flex items-center gap-1 px-1.5 py-1 text-[11px] font-semibold">
                        <span className="truncate">
                          {ev.time}
                          {colW / n >= 104 && ` – ${pad(Math.floor(end / 60) % 24)}:${pad(end % 60)}`}
                        </span>
                        {live && <span className="ml-auto shrink-0 rounded-full bg-ok px-1.5 text-[10px] text-white">{t('status.live')}</span>}
                        {!live && mark === 'present' && <span className="ml-auto text-ok">✓</span>}
                        {!live && mark === 'absent' && <span className="ml-auto text-bad">✗</span>}
                      </div>
                      <div className="min-h-0 flex-1 px-1.5 py-1">
                        <div className="line-clamp-2 break-words font-bold leading-tight">{ev.title}</div>
                        {no && height > 70 && (
                          <div className="mt-0.5 opacity-80">
                            {t('grid.session', { no })}
                            {ev.totalSessions ? `/${ev.totalSessions}` : ''}
                          </div>
                        )}
                        {height > 96 && <div className="mt-1 opacity-70">{TYPE_ICON[ev.type]}</div>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}

          {/* Vạch giờ hiện tại: nhãn giờ ở cột trái, đường kẻ xuyên các cột */}
          {nowInRange && (
            <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: yOf(nowMin) }}>
              <div className="absolute left-1 -top-2.5 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                {pad(now.getHours())}:{pad(now.getMinutes())}
              </div>
              <div className="ml-[52px] h-[2px] bg-accent" />
              <div className="absolute -top-[3px] left-[49px] h-2 w-2 rounded-full bg-accent" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
