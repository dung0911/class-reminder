import type { AppData, ClassEvent } from '@shared/types'
import { formatRange, vnDate } from '@shared/schedule'
import { DAY_ORDER, TYPE_ICON } from '@/lib/constants'
import { useT } from '@/lib/i18n'

interface Props {
  data: AppData
  onEdit: (ev: ClassEvent) => void
  onAdd: () => void
}

export default function CoursesPage({ data, onEdit, onAdd }: Props): React.JSX.Element {
  const t = useT()
  const siteNames = (e: ClassEvent): string =>
    data.sites
      .filter((s) => e.siteIds?.includes(s.id))
      .map((s) => s.name)
      .join(', ')

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('courses.title')}</h1>
        <button onClick={onAdd} className="rounded-xl bg-accent px-4 py-2 font-semibold text-white hover:opacity-90">
          + {t('calendar.addClass')}
        </button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto">
        {data.events.length === 0 && <p className="text-muted">{t('courses.empty')}</p>}
        {data.events.map((e) => (
          <button
            key={e.id}
            onClick={() => onEdit(e)}
            className={`flex w-full items-center gap-4 rounded-2xl border border-line bg-panel p-4 text-left hover:bg-hover ${
              e.enabled ? '' : 'opacity-50'
            }`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{ background: e.color }}>
              {TYPE_ICON[e.type]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-semibold">{e.title}</div>
              <div className="text-sm text-muted">
                {t(`type.${e.type}`)}
                {siteNames(e) && ` · ${siteNames(e)}`} · {formatRange(e)}
              </div>
              <div className="mt-1 text-sm text-soft">
                {DAY_ORDER.filter((d) => e.days.includes(d)).map((d) => t(`day.${d}`)).join(', ')}
                {e.startDate && (
                  <span className="ml-3 text-muted">
                    {t('courses.since', { date: vnDate(e.startDate) })}
                    {e.totalSessions ? ` · ${t('courses.sessions', { n: e.totalSessions })}` : ''}
                  </span>
                )}
                {!e.url && !e.siteIds?.length && <span className="ml-3 text-bad">⚠ {t('courses.noLink')}</span>}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
