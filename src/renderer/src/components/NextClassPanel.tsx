import type { AppData, ClassEvent } from '@shared/types'
import { addBreakDay, endOn, formatRange, nextOccurrence, occursOn, pad, sessionNumber, startOn, vnDate, ymd } from '@shared/schedule'
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

  const live = !!next && next.at.getTime() <= now.getTime()
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
      events: d.events.map((e) => (e.id === next.e.id ? { ...e, breaks: addBreakDay(e.breaks, day) } : e))
    }))
  }

  return (
    <>
      <section className="card overflow-hidden">
        {!next ? (
          <div className="p-5">
            <h2 className="mb-2 text-base font-bold">⚡ {t('panel.nextClass')}</h2>
            <p className="text-sm text-muted">{t('panel.none')}</p>
          </div>
        ) : (
          <>
            {/* Dải màu của lớp */}
            <div className="h-1.5" style={{ background: next.e.color }} />
            <div className="p-5">
              <div className="mb-3 flex items-center">
                <h2 className="text-base font-bold">{live ? t('panel.current') : t('panel.nextClass')}</h2>
                <span
                  className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    live ? 'bg-ok text-white' : 'bg-accent-soft text-accent'
                  }`}
                >
                  {live ? t('status.live') : describe(next.at)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
                  style={{ background: `color-mix(in srgb, ${next.e.color} 22%, var(--c-card))` }}
                >
                  {TYPE_ICON[next.e.type]}
                </div>
                <div className="min-w-0">
                  <div className="line-clamp-2 text-lg font-bold leading-tight">{next.e.title}</div>
                  <div className="text-sm text-muted">{t(`type.${next.e.type}`)}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-soft">
                <span className="rounded-lg bg-hover px-2.5 py-1">🕒 {formatRange(next.e)}</span>
                {nextNo && (
                  <span className="rounded-lg bg-hover px-2.5 py-1">
                    📖 {t('grid.session', { no: nextNo })}
                    {next.e.totalSessions ? `/${next.e.totalSessions}` : ''}
                  </span>
                )}
              </div>

              <button
                onClick={() => void window.api.join(next.e)}
                className="btn-accent mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold hover:opacity-90"
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
                <div className="mt-3 flex flex-wrap gap-2">
                  {sites.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => void window.api.openSite(s.id)}
                      className="rounded-lg border border-line px-3 py-1 text-xs font-medium text-soft hover:bg-hover"
                    >
                      🌐 {s.name}
                    </button>
                  ))}
                </div>
              )}
              {next.e.note && <div className="mt-3 rounded-lg bg-hover p-2.5 text-xs text-muted">{next.e.note}</div>}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Toggle label={t('panel.camOff')} on={next.e.camOff} onClick={() => toggle(next.e.id, 'camOff')} />
                <Toggle label={t('panel.micOff')} on={next.e.micOff} onClick={() => toggle(next.e.id, 'micOff')} />
              </div>
            </div>
          </>
        )}
      </section>

      {lesson && (
        <section className="card p-5 text-sm">
          <h2 className="mb-1 text-base font-bold">{t('panel.lesson', { no: lesson.no })}</h2>
          {lesson.lesson && <div className="mb-2 font-medium text-accent">{lesson.lesson}</div>}
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

      <section className="card p-5">
        <h2 className="mb-3 text-base font-bold">{t('panel.today')}</h2>
        {today.length === 0 && <p className="text-sm text-muted">{t('panel.noClassToday')}</p>}
        <div className="space-y-2">
          {today.map((e) => {
            const done = now >= endOn(e, now)
            const going = now >= startOn(e, now) && !done
            return (
              <div
                key={e.id}
                className={`evt flex items-center gap-3 px-3 py-2 ${going ? 'evt-live' : ''} ${done ? 'opacity-60' : ''}`}
                style={{ ['--ec' as string]: e.color }}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{e.title}</div>
                  <div className="text-xs opacity-80">{formatRange(e)}</div>
                </div>
                {done ? (
                  <span className="text-ok">✓</span>
                ) : going ? (
                  <span className="rounded-full bg-ok px-2 py-0.5 text-[10px] font-bold text-white">{t('status.live')}</span>
                ) : (
                  <span>{TYPE_ICON[e.type]}</span>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button onClick={onClick} className="flex items-center justify-between rounded-lg bg-hover px-3 py-2 text-xs font-medium text-soft">
      {label}
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? 'bg-accent' : 'bg-muted/40'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  )
}
