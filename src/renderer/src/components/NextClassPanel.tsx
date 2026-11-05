import type { AppData, ClassEvent } from '@shared/types'
import { addBreakDay, formatRange, nextOccurrence, occursOn, pad, sessionNumber, vnDate, ymd } from '@shared/schedule'
import { TYPE_ICON, sameDay } from '@/lib/constants'
import { useT } from '@/lib/i18n'

interface Props {
  data: AppData
  now: Date
  update: (fn: (d: AppData) => AppData) => void
}

export default function NextClassPanel({ data, now, update }: Props): React.JSX.Element {
  const t = useT()

  const upcoming = data.events
    .filter((e) => e.enabled)
    .map((e) => ({ e, at: nextOccurrence(e, now) }))
    .filter((x): x is { e: ClassEvent; at: Date } => x.at !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime())

  const next = upcoming[0]
  const today = data.events
    .filter((e) => e.enabled && occursOn(e, now))
    .sort((a, b) => a.time.localeCompare(b.time))

  const nextNo = next ? sessionNumber(next.e, next.at) : null
  const lesson = nextNo ? next?.e.syllabus?.find((s) => s.no === nextNo) : undefined
  const sites = next ? data.sites.filter((s) => next.e.siteIds?.includes(s.id)) : []

  const describe = (at: Date): string => {
    const diff = at.getTime() - now.getTime()
    if (diff <= 0) return t('panel.ongoing')
    const mins = Math.ceil(diff / 60_000)
    if (mins < 60) return t('panel.inMinutes', { min: mins })
    const hhmm = `${pad(at.getHours())}:${pad(at.getMinutes())}`
    return sameDay(at, now)
      ? t('panel.todayAt', { time: hhmm })
      : `${t(`day.${at.getDay()}`)} ${pad(at.getDate())}/${pad(at.getMonth() + 1)} ${hhmm}`
  }

  const toggle = (id: string, key: 'camOff' | 'micOff'): void =>
    update((d) => ({ ...d, events: d.events.map((e) => (e.id === id ? { ...e, [key]: !e[key] } : e)) }))

  const markBreak = (): void => {
    if (!next) return
    const day = ymd(next.at)
    if (!confirm(t('panel.confirmBreak', { no: nextNo ?? '', date: vnDate(day) }))) return
    update((d) => ({
      ...d,
      events: d.events.map((e) =>
        e.id === next.e.id ? { ...e, breaks: addBreakDay(e.breaks, day) } : e
      )
    }))
  }

  return (
    <div className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto">
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="mb-3 text-lg font-bold">⚡ {t('panel.nextClass')}</h2>
        {!next ? (
          <p className="text-sm text-muted">{t('panel.none')}</p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{ background: next.e.color }}>
                {TYPE_ICON[next.e.type]}
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold">{next.e.title}</div>
                <div className="text-sm text-muted">{t(`type.${next.e.type}`)}</div>
              </div>
            </div>
            <div className="mt-3 text-sm text-soft">🕒 {formatRange(next.e)}</div>
            {nextNo && (
              <div className="mt-1 text-sm text-soft">
                📖 {t('grid.session', { no: nextNo })}
                {next.e.totalSessions ? `/${next.e.totalSessions}` : ''}
              </div>
            )}
            <div className="mt-1 inline-block rounded-full bg-accent-soft px-3 py-0.5 text-xs text-accent">
              {describe(next.at)}
            </div>
            <button
              onClick={() => void window.api.join(next.e)}
              className="mt-4 w-full rounded-xl bg-accent py-3 font-semibold text-white hover:opacity-90"
            >
              ▶ {t('panel.join')}
            </button>
            <button
              onClick={markBreak}
              className="mt-2 w-full rounded-xl border border-line py-2 text-sm text-soft hover:bg-hover"
            >
              🌴 {t('panel.markBreak')}
            </button>
            {sites.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {sites.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => void window.api.openUrl(s.url)}
                    className="rounded-lg border border-line px-3 py-1 text-xs text-soft hover:bg-hover"
                  >
                    🌐 {s.name}
                  </button>
                ))}
              </div>
            )}
            {next.e.note && <div className="mt-3 rounded-lg bg-hover p-2 text-xs text-muted">{next.e.note}</div>}
            <Toggle label={t('panel.camOff')} on={next.e.camOff} onClick={() => toggle(next.e.id, 'camOff')} />
            <Toggle label={t('panel.micOff')} on={next.e.micOff} onClick={() => toggle(next.e.id, 'micOff')} />
          </>
        )}
      </section>

      {lesson && (
        <section className="rounded-2xl border border-line bg-panel p-5 text-sm">
          <h2 className="mb-1 text-lg font-bold">{t('panel.lesson', { no: lesson.no })}</h2>
          {lesson.lesson && <div className="mb-2 text-accent">{lesson.lesson}</div>}
          <ul className="list-disc space-y-1 pl-5 text-soft">
            {lesson.items.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
          {lesson.homework && (
            <div className="mt-3 rounded-lg bg-warn/10 p-3 text-warn">
              <b>{t('panel.homework')}:</b> {lesson.homework}
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="mb-3 text-lg font-bold">{t('panel.today')}</h2>
        {today.length === 0 && <p className="text-sm text-muted">{t('panel.noClassToday')}</p>}
        {today.map((e) => (
          <div key={e.id} className="mb-2 flex items-center gap-3">
            <span className="h-3 w-3 rounded-full" style={{ background: e.color }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{e.title}</div>
              <div className="text-xs text-muted">{formatRange(e)}</div>
            </div>
            <span>{TYPE_ICON[e.type]}</span>
          </div>
        ))}
      </section>
    </div>
  )
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button onClick={onClick} className="mt-3 flex w-full items-center justify-between text-sm text-soft">
      {label}
      <span className={`relative h-6 w-11 rounded-full transition ${on ? 'bg-accent' : 'bg-muted/50'}`}>
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`}
        />
      </span>
    </button>
  )
}
