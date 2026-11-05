import { useState } from 'react'
import type { AppData, ClassEvent } from '@shared/types'
import { pad } from '@shared/schedule'
import { useNow } from '@/lib/useData'
import { weekStart } from '@/lib/constants'
import { useT } from '@/lib/i18n'
import WeekGrid from '@/components/WeekGrid'
import NextClassPanel from '@/components/NextClassPanel'

interface Props {
  data: AppData
  update: (fn: (d: AppData) => AppData) => void
  onSelect: (ev: ClassEvent, date: Date) => void
  onAdd: () => void
}

function greetingKey(h: number): string {
  if (h < 11) return 'greet.morning'
  if (h < 14) return 'greet.noon'
  if (h < 18) return 'greet.afternoon'
  return 'greet.evening'
}

export default function CalendarPage({ data, update, onSelect, onAdd }: Props): React.JSX.Element {
  const t = useT()
  const [offset, setOffset] = useState(0)
  const now = useNow()
  const ws = weekStart(offset)
  const we = new Date(ws)
  we.setDate(we.getDate() + 6)
  const range = `${pad(ws.getDate())}/${pad(ws.getMonth() + 1)} – ${pad(we.getDate())}/${pad(we.getMonth() + 1)}/${we.getFullYear()}`

  return (
    <div className="flex h-full flex-col">
      <header className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t(greetingKey(now.getHours()))} 👋</h1>
          <p className="text-muted">{t('greet.sub')}</p>
        </div>
        <button onClick={onAdd} className="rounded-xl bg-accent px-4 py-2 font-semibold text-white hover:opacity-90">
          + {t('calendar.addClass')}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 gap-4">
        <section className="flex min-w-0 flex-1 flex-col rounded-2xl border border-line bg-panel p-4">
          <div className="mb-3 flex items-center gap-2">
            <button onClick={() => setOffset(offset - 1)} className="rounded-lg px-3 py-1 hover:bg-hover">‹</button>
            <button onClick={() => setOffset(offset + 1)} className="rounded-lg px-3 py-1 hover:bg-hover">›</button>
            <span className="ml-1 text-lg font-semibold">{range}</span>
            <button
              onClick={() => setOffset(0)}
              className="ml-auto rounded-full border border-line px-4 py-1 text-sm hover:bg-hover"
            >
              {t('common.today')}
            </button>
          </div>
          <WeekGrid events={data.events} weekOffset={offset} now={now} onSelect={onSelect} />
        </section>
        <NextClassPanel data={data} now={now} update={update} />
      </div>
    </div>
  )
}
