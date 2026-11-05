import type { AppData, ClassEvent } from '@shared/types'
import { classStats, formatRange, vnDate } from '@shared/schedule'
import { DAY_ORDER, TYPE_ICON } from '@/lib/constants'
import { useNow } from '@/lib/useData'
import { useT } from '@/lib/i18n'

interface Props {
  data: AppData
  onEdit: (ev: ClassEvent) => void
  onAdd: () => void
}

export default function CoursesPage({ data, onEdit, onAdd }: Props): React.JSX.Element {
  const t = useT()
  const now = useNow(60_000)
  const siteNames = (e: ClassEvent): string =>
    data.sites
      .filter((s) => e.siteIds?.includes(s.id))
      .map((s) => s.name)
      .join(', ')

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t('courses.title')}</h1>
        <button onClick={onAdd} className="btn-accent rounded-xl px-4 py-2.5 text-sm font-semibold hover:opacity-90">
          + {t('calendar.addClass')}
        </button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {data.events.length === 0 && <p className="text-muted">{t('courses.empty')}</p>}
        {data.events.map((e) => {
          const st = e.startDate ? classStats(e, now) : null
          const total = st ? st.total ?? st.past : 0
          const pct = st && total ? Math.min(100, Math.round((st.past / total) * 100)) : 0
          return (
            <button
              key={e.id}
              onClick={() => onEdit(e)}
              className={`card flex w-full items-stretch gap-4 overflow-hidden p-0 text-left transition hover:-translate-y-0.5 ${
                e.enabled ? '' : 'opacity-50'
              }`}
            >
              <div className="w-1.5 shrink-0" style={{ background: e.color }} />
              <div className="flex min-w-0 flex-1 items-center gap-4 py-4 pr-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
                  style={{ background: `color-mix(in srgb, ${e.color} 20%, var(--c-card))` }}
                >
                  {TYPE_ICON[e.type]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-bold">{e.title}</div>
                  <div className="text-sm text-muted">
                    {t(`type.${e.type}`)}
                    {siteNames(e) && ` · ${siteNames(e)}`} · {formatRange(e)}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    {DAY_ORDER.filter((d) => e.days.includes(d)).map((d) => (
                      <span key={d} className="rounded-md bg-hover px-2 py-0.5 font-semibold text-soft">
                        {t(`day.${d}`)}
                      </span>
                    ))}
                    {e.startDate && (
                      <span className="text-muted">
                        {t('courses.since', { date: vnDate(e.startDate) })}
                        {e.totalSessions ? ` · ${t('courses.sessions', { n: e.totalSessions })}` : ''}
                      </span>
                    )}
                    {!e.url && !e.siteIds?.length && <span className="text-bad">⚠ {t('courses.noLink')}</span>}
                  </div>
                  {st && total > 0 && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hover">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `color-mix(in srgb, ${e.color} 60%, var(--c-ink))` }} />
                      </div>
                      <span className="text-xs font-medium text-muted">{t('dash.progress', { done: st.past, total })}</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
