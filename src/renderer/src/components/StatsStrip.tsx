import type { AppData } from '@shared/types'
import { calendarStats } from '@shared/extras'
import { useT } from '@/lib/i18n'

interface Props {
  data: AppData
  now: Date
}

/** Dải 4 số liệu phía trên lịch (kiểu Appointment): chỉ hiện khi cửa sổ đủ cao để không chiếm chỗ của lịch */
export default function StatsStrip({ data, now }: Props): React.JSX.Element {
  const t = useT()
  const s = calendarStats(data, now)

  // Chênh lệch so với tuần trước, hiện bằng viên thuốc xanh/đỏ
  const delta = (cur: number, prev: number, unit = ''): { text: string; tone: string } | null => {
    if (cur === prev) return null
    const d = Math.round((cur - prev) * 10) / 10
    return { text: `${d > 0 ? '+' : ''}${d}${unit}`, tone: d > 0 ? 'bg-ok/15 text-ok' : 'bg-bad/15 text-bad' }
  }

  const cards: { label: string; value: string; unit?: string; pill?: { text: string; tone: string } | null; hint?: string }[] = [
    { label: t('stats.sessions'), value: String(s.sessions), pill: delta(s.sessions, s.sessionsPrev), hint: t('stats.vsLast') },
    { label: t('stats.hours'), value: String(s.hours), unit: t('stats.hoursUnit'), pill: delta(s.hours, s.hoursPrev), hint: t('stats.vsLast') },
    {
      label: t('stats.rate'),
      value: s.rate === null ? '—' : `${s.rate}`,
      unit: s.rate === null ? '' : '%',
      hint: s.past ? t('stats.rateSub', { present: s.present, past: s.past }) : undefined
    },
    {
      label: t('stats.tasks'),
      value: String(s.tasksOpen),
      pill: s.tasksOverdue ? { text: `${s.tasksOverdue} ${t('stats.overdue')}`, tone: 'bg-bad/15 text-bad' } : null
    }
  ]

  return (
    <div className="mb-3 hidden grid-cols-4 gap-3 [@media(min-height:860px)]:grid">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-line bg-card/50 px-4 py-3">
          <div className="text-xs font-medium text-muted">{c.label}</div>
          <div className="mt-1 flex items-end gap-2">
            <div className="text-2xl font-bold leading-none">
              {c.value}
              {c.unit && <span className="ml-0.5 text-sm font-semibold text-soft">{c.unit}</span>}
            </div>
            {c.pill && <span className={`mb-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${c.pill.tone}`}>{c.pill.text}</span>}
            {c.hint && <span className="mb-0.5 truncate text-[11px] text-muted">{c.hint}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
