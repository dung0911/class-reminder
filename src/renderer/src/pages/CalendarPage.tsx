import { useState } from 'react'
import type { AppData, ClassEvent } from '@shared/types'
import { pad } from '@shared/schedule'
import { useNow } from '@/lib/useData'
import { addDays, weekDays } from '@/lib/constants'
import { useT } from '@/lib/i18n'
import TimeGrid from '@/components/TimeGrid'
import MonthGrid from '@/components/MonthGrid'
import MiniCalendar from '@/components/MiniCalendar'
import StatsStrip from '@/components/StatsStrip'
import NextClassPanel from '@/components/NextClassPanel'

type View = 'day' | 'week' | 'month'
const VIEWS: View[] = ['day', 'week', 'month']

interface Props {
  data: AppData
  update: (fn: (d: AppData) => AppData) => void
  /** 'all' hoặc id một lớp (chọn ở thanh bên hoặc ở các nút lọc) */
  filter: string
  onFilter: (id: string) => void
  onSelect: (ev: ClassEvent, date: Date) => void
  onAdd: () => void
  onSlot: (date: Date, hour: number, x: number, y: number) => void
}

function greetingKey(h: number): string {
  if (h < 11) return 'greet.morning'
  if (h < 14) return 'greet.noon'
  if (h < 18) return 'greet.afternoon'
  return 'greet.evening'
}

const dm = (d: Date): string => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`

export default function CalendarPage({ data, update, filter, onFilter, onSelect, onAdd, onSlot }: Props): React.JSX.Element {
  const t = useT()
  const now = useNow()
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(() => new Date())

  const events = data.events.filter((e) => filter === 'all' || e.id === filter)
  const days = view === 'day' ? [anchor] : weekDays(anchor)

  const move = (dir: -1 | 1): void =>
    setAnchor((a) =>
      view === 'month' ? new Date(a.getFullYear(), a.getMonth() + dir, 1) : addDays(a, dir * (view === 'day' ? 1 : 7))
    )

  const title =
    view === 'month'
      ? t('month.name', { m: anchor.getMonth() + 1, y: anchor.getFullYear() })
      : view === 'day'
        ? `${t(`day.${anchor.getDay()}`)}, ${dm(anchor)}/${anchor.getFullYear()}`
        : t('month.name', { m: days[0].getMonth() + 1, y: days[0].getFullYear() })
  const range =
    view === 'week' ? `${dm(days[0])} – ${dm(days[6])}/${days[6].getFullYear()}` : view === 'day' ? '' : ''

  const nav = 'flex h-9 w-9 items-center justify-center rounded-lg border border-line text-soft hover:bg-hover'

  return (
    <div className="flex h-full flex-col">
      <header className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t(greetingKey(now.getHours()))} 👋</h1>
          {/* cửa sổ thấp thì bỏ dòng phụ để lịch có thêm chỗ */}
          <p className="text-muted [@media(max-height:859px)]:hidden">{t('greet.sub')}</p>
        </div>
        <button onClick={onAdd} className="btn-accent rounded-xl px-4 py-2.5 text-sm font-semibold hover:opacity-90">
          + {t('calendar.addClass')}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 gap-4">
        <section className="card flex min-w-0 flex-1 flex-col p-4">
          <StatsStrip data={data} now={now} />
          {/* Lọc theo lớp (giống Tất cả / Cá nhân / Công việc) */}
          <div className="mb-3 flex items-center gap-3">
            {/* Một hàng cuộn ngang: nhiều lớp cũng không làm hàng này cao lên và chiếm chỗ của lịch */}
            <div className="flex min-w-0 flex-1 items-center gap-1.5 no-scrollbar overflow-x-auto *:shrink-0 *:whitespace-nowrap">
              <Chip active={filter === 'all'} onClick={() => onFilter('all')}>
                {t('filter.all')}
              </Chip>
              {data.events.map((e) => (
                <Chip key={e.id} active={filter === e.id} onClick={() => onFilter(e.id)}>
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: e.color }} />
                  {e.title}
                </Chip>
              ))}
            </div>
            <div className="seg shrink-0">
              {VIEWS.map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                    view === v ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'
                  }`}
                >
                  {t(`view.${v}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button onClick={() => move(-1)} className={nav}>‹</button>
            <button onClick={() => move(1)} className={nav}>›</button>
            <h2 className="ml-1 text-xl font-bold">{title}</h2>
            {range && <span className="rounded-lg bg-hover px-2.5 py-1 text-xs font-semibold text-soft">{range}</span>}
            <button
              onClick={() => setAnchor(new Date())}
              className="ml-auto rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-soft hover:bg-hover"
            >
              {t('common.today')}
            </button>
          </div>

          {view === 'month' ? (
            <MonthGrid
              events={events}
              anchor={anchor}
              now={now}
              onSelect={onSelect}
              onDay={(d) => {
                setAnchor(d)
                setView('day')
              }}
            />
          ) : (
            <TimeGrid events={events} days={days} now={now} onSelect={onSelect} onSlot={onSlot} />
          )}
        </section>

        {/* *:shrink-0 để các thẻ không bị co ép (cột này cuộn được thay vì nén thẻ) */}
        <div className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto pr-0.5 *:shrink-0 min-[1280px]:w-80">
          <MiniCalendar events={data.events} anchor={anchor} now={now} view={view} onPick={setAnchor} />
          <NextClassPanel data={data} now={now} update={update} />
        </div>
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition ${
        active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-hover hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
