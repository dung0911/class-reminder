import type { AppData, Attendance, ClassEvent } from '@shared/types'
import { classStats, listSessions, pad, vnDate, ymd, withAttendance, type SessionInfo, type SessionStatus } from '@shared/schedule'
import { pendingMakeups, upcomingExams, weekReport } from '@shared/extras'
import { useNow } from '@/lib/useData'
import { Gauge, Heatmap, HoursChart, RecentList } from '@/components/DashCharts'
import { useT } from '@/lib/i18n'

interface Props {
  data: AppData
  update: (fn: (d: AppData) => AppData) => void
  onSelect: (ev: ClassEvent, date: Date) => void
}

const CELL: Record<SessionStatus, string> = {
  present: 'bg-ok text-white',
  absent: 'bg-bad text-white',
  unmarked: 'bg-warn/80 text-white',
  inprogress: 'bg-accent text-white',
  upcoming: 'bg-hover text-muted'
}

export default function DashboardPage({ data, update, onSelect }: Props): React.JSX.Element {
  const t = useT()
  const now = useNow()
  const tracked = data.events.filter((e) => e.startDate)
  const all = tracked.map((e) => classStats(e, now))
  const sum = (k: 'present' | 'absent' | 'unmarked' | 'breaks' | 'past'): number => all.reduce((n, s) => n + s[k], 0)
  const past = sum('past')
  const rate = past ? Math.round((sum('present') / past) * 100) : null

  const week = weekReport(data, now)
  const makeups = pendingMakeups(data, now)
  const exams = upcomingExams(data, now)
  const hasAnyExam = !!data.settings.examDate || data.events.some((e) => e.examDate)
  const sessionsLeft = all.reduce((n, s) => n + (s.total !== null ? s.upcoming + s.inprogress : 0), 0)
  const short = (d: Date): string => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`

  const markWatched = (evId: string, key: string): void =>
    update((d) => ({
      ...d,
      events: d.events.map((e) =>
        e.id === evId ? { ...e, sessionNotes: { ...(e.sessionNotes ?? {}), [key]: { ...(e.sessionNotes?.[key] ?? {}), watched: true } } } : e
      )
    }))

  const mark = (ev: ClassEvent, key: string, s: Attendance | undefined): void =>
    update((d) => ({ ...d, events: d.events.map((e) => (e.id === ev.id ? withAttendance(e, key, s) : e)) }))

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col">
      <header className="mb-4">
        <h1 className="text-3xl font-bold">{t('dash.title')}</h1>
        <p className="text-muted">{t('dash.subtitle')}</p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Card label={t('dash.rate')} value={rate === null ? '—' : `${rate}%`} tone="text-accent" ring={rate} />
          <Card label={t('status.present')} value={sum('present')} tone="text-ok" icon="✅" />
          <Card label={t('status.absent')} value={sum('absent')} tone="text-bad" icon="❌" />
          <Card label={t('status.unmarked')} value={sum('unmarked')} tone="text-warn" icon="❔" />
          <Card label={t('dash.breaks')} value={sum('breaks')} tone="text-muted" icon="🌴" />
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <section className="card p-5 lg:col-span-2">
            <h2 className="mb-3 text-lg font-bold">🔥 {t('dash.heatmap')}</h2>
            <Heatmap data={data} now={now} />
          </section>
          <section className="card flex flex-col p-5">
            <h2 className="mb-3 text-lg font-bold">🎯 {t('dash.rate')}</h2>
            <div className="flex flex-1 flex-col justify-center">
              <Gauge pct={rate} sub={past ? t('stats.rateSub', { present: sum('present'), past }) : t('recent.none')} />
            </div>
          </section>
        </div>

        <div className="grid gap-3 lg:grid-cols-5">
          <section className="card p-5 lg:col-span-3">
            <h2 className="mb-1 text-lg font-bold">📈 {t('dash.hoursChart')}</h2>
            <p className="mb-3 text-xs text-muted">{t('dash.hoursHint')}</p>
            <HoursChart data={data} now={now} />
          </section>
          <section className="card p-5 lg:col-span-2">
            <h2 className="mb-3 text-lg font-bold">🕘 {t('dash.recent')}</h2>
            <RecentList data={data} now={now} onSelect={onSelect} />
          </section>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {/* Báo cáo tuần */}
          <section className="card p-5">
            <div className="mb-2 flex items-baseline gap-2">
              <h2 className="text-lg font-bold">📅 {t('week.title')}</h2>
              <span className="text-xs text-muted">
                {short(week.from)} – {short(new Date(week.to))}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-soft">
              <span>✓ {t('status.present')}: <b className="text-ok">{week.present}</b></span>
              <span>✗ {t('status.absent')}: <b className="text-bad">{week.absent}</b></span>
              <span>? {t('status.unmarked')}: <b className="text-warn">{week.unmarked}</b></span>
              <span>⏳ {t('status.upcoming')}: <b>{week.upcoming}</b></span>
              <span>🌴 {t('dash.breaks')}: <b>{week.breaks}</b></span>
            </div>
            <div className="mt-2 text-sm text-soft">
              📝 {t('week.tasks')}: <b>{week.tasksDue.length}</b>
              {week.tasksOverdue.length > 0 && (
                <span className="ml-2 text-bad">
                  · {t('week.overdue')}: <b>{week.tasksOverdue.length}</b>
                </span>
              )}
            </div>
          </section>

          {/* Đếm ngược kỳ thi */}
          <section className="card p-5">
            <h2 className="mb-2 text-lg font-bold">🎓 {t('exam.cardTitle')}</h2>
            {exams.length === 0 ? (
              <p className="text-sm text-muted">{hasAnyExam ? t('exam.passed') : t('exam.none')}</p>
            ) : (
              <div className="space-y-2">
                {exams.map((x, i) => (
                  <div key={`${x.eventId ?? 'all'}-${x.date}`} className="flex items-baseline gap-3">
                    <b className={`${i === 0 ? 'text-4xl text-accent' : 'text-2xl text-soft'}`}>{x.days}</b>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {x.title || t('exam.default')} <span className="text-xs text-muted">· {t('exam.daysLeft')}</span>
                      </div>
                      <div className="text-xs text-muted">{vnDate(x.date)}</div>
                    </div>
                  </div>
                ))}
                {sessionsLeft > 0 && <div className="text-sm text-soft">{t('exam.sessionsLeft', { n: sessionsLeft })}</div>}
              </div>
            )}
          </section>
        </div>

        {/* Buổi vắng cần xem bù */}
        {makeups.length > 0 && (
          <section className="card p-5">
            <h2 className="mb-2 text-lg font-bold text-warn">🎬 {t('makeup.title')} ({makeups.length})</h2>
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {makeups.map((m) => (
                <div key={`${m.ev.id}-${m.session.key}`} className="flex items-center gap-3 rounded-xl bg-hover px-3 py-2">
                  <button onClick={() => onSelect(m.ev, m.session.date)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-medium">
                      {m.ev.title} · {t('grid.session', { no: m.session.no })} · {t(`day.${m.session.date.getDay()}`)} {vnDate(ymd(m.session.date))}
                    </div>
                    {m.ev.sessionNotes?.[m.session.key]?.recordingUrl && <div className="text-xs text-muted">🎬 {t('makeup.hasRecording')}</div>}
                  </button>
                  {m.link && (
                    <button onClick={() => void window.api.openUrl(m.link)} className="rounded-lg border border-line px-3 py-1 text-sm text-soft hover:bg-field">
                      ↗ {t('makeup.watch')}
                    </button>
                  )}
                  <button onClick={() => markWatched(m.ev.id, m.session.key)} className="rounded-lg bg-ok/15 px-3 py-1 text-sm font-semibold text-ok hover:bg-ok/25">
                    ✓ {t('makeup.done')}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.events.map((ev) => {
          if (!ev.startDate) {
            return (
              <section key={ev.id} className="card p-5">
                <div className="font-semibold">{ev.title}</div>
                <p className="text-sm text-muted">{t('dash.noStart')}</p>
              </section>
            )
          }
          const st = classStats(ev, now)
          const sessions = listSessions(ev, now)
          const absent = sessions.filter((s) => s.status === 'absent')
          const unmarked = sessions.filter((s) => s.status === 'unmarked')
          const denom = Math.max(sessions.length, 1)
          const seg = (n: number): string => `${(n / denom) * 100}%`
          return (
            <section key={ev.id} className="card p-5">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ background: ev.color }} />
                <h2 className="text-lg font-bold">{ev.title}</h2>
                <span className="text-sm text-muted">
                  {t('dash.progress', { done: st.past, total: st.total ?? sessions.length })}
                </span>
                <span className="ml-auto text-2xl font-bold text-accent">{st.rate === null ? '—' : `${st.rate}%`}</span>
              </div>

              <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-hover">
                <div className="bg-ok" style={{ width: seg(st.present) }} />
                <div className="bg-bad" style={{ width: seg(st.absent) }} />
                <div className="bg-warn/80" style={{ width: seg(st.unmarked) }} />
                <div className="bg-accent" style={{ width: seg(st.inprogress) }} />
              </div>
              <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-soft">
                <span>✓ {t('status.present')}: <b className="text-ok">{st.present}</b></span>
                <span>✗ {t('status.absent')}: <b className="text-bad">{st.absent}</b></span>
                <span>? {t('status.unmarked')}: <b className="text-warn">{st.unmarked}</b></span>
                <span>🌴 {t('dash.breaks')}: <b>{st.breaks}</b></span>
                {st.total !== null && <span>⏳ {t('status.upcoming')}: <b>{st.upcoming}</b></span>}
              </div>

              <div className="mb-1 text-xs text-muted">{t('dash.grid')}</div>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {sessions.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => onSelect(ev, s.date)}
                    title={`${t('grid.session', { no: s.no })} · ${vnDate(s.key)} · ${t(`status.${s.status}`)}`}
                    className={`h-7 w-7 rounded-md text-[11px] font-semibold ${CELL[s.status]}`}
                  >
                    {s.no}
                  </button>
                ))}
              </div>

              {unmarked.length > 0 && (
                <Group title={`${t('dash.needMark')} (${unmarked.length})`} tone="text-warn">
                  {unmarked.map((s) => (
                    <Row key={s.key} ev={ev} s={s} t={t} onSelect={onSelect}>
                      <button onClick={() => mark(ev, s.key, 'present')} className="rounded-lg bg-ok/15 px-3 py-1 text-sm font-semibold text-ok hover:bg-ok/25">
                        ✓ {t('status.present')}
                      </button>
                      <button onClick={() => mark(ev, s.key, 'absent')} className="rounded-lg bg-bad/15 px-3 py-1 text-sm font-semibold text-bad hover:bg-bad/25">
                        ✗ {t('status.absent')}
                      </button>
                    </Row>
                  ))}
                </Group>
              )}

              <Group title={`${t('dash.absentList')} (${absent.length})`} tone="text-bad">
                {absent.length === 0 && <p className="text-sm text-muted">{t('dash.noAbsent')}</p>}
                {absent.map((s) => (
                  <Row key={s.key} ev={ev} s={s} t={t} onSelect={onSelect}>
                    <button onClick={() => mark(ev, s.key, undefined)} className="rounded-lg border border-line px-3 py-1 text-sm text-soft hover:bg-hover">
                      {t('dash.clear')}
                    </button>
                  </Row>
                ))}
              </Group>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function Card({ label, value, tone, icon, ring }: { label: string; value: string | number; tone: string; icon?: string; ring?: number | null }): React.JSX.Element {
  return (
    <div className="card flex items-center gap-3 p-4">
      {ring !== undefined ? (
        <Ring pct={ring} />
      ) : (
        icon && <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-hover text-lg">{icon}</div>
      )}
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-muted">{label}</div>
        <div className={`text-2xl font-bold leading-tight ${tone}`}>{value}</div>
      </div>
    </div>
  )
}

/** Vòng tròn phần trăm (tỉ lệ có mặt) */
function Ring({ pct }: { pct: number | null }): React.JSX.Element {
  const r = 18
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 shrink-0 -rotate-90">
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--c-hover)" strokeWidth="5" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="var(--c-accent)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - (pct ?? 0) / 100)}
      />
    </svg>
  )
}

function Group({ title, tone, children }: { title: string; tone: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="mt-3">
      <div className={`mb-2 text-sm font-semibold ${tone}`}>{title}</div>
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">{children}</div>
    </div>
  )
}

function Row({
  ev,
  s,
  t,
  onSelect,
  children
}: {
  ev: ClassEvent
  s: SessionInfo
  t: (k: string, v?: Record<string, string | number>) => string
  onSelect: (ev: ClassEvent, date: Date) => void
  children: React.ReactNode
}): React.JSX.Element {
  const lesson = ev.syllabus?.find((x) => x.no === s.no)
  return (
    <div className="flex items-center gap-3 rounded-xl bg-hover px-3 py-2">
      <button onClick={() => onSelect(ev, s.date)} className="min-w-0 flex-1 text-left">
        <div className="text-sm font-medium">
          {t('grid.session', { no: s.no })} · {t(`day.${s.date.getDay()}`)} {vnDate(s.key)}
        </div>
        {lesson?.lesson && <div className="truncate text-xs text-muted">{lesson.lesson}</div>}
      </button>
      {children}
    </div>
  )
}
