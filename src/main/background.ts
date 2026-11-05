// Việc chạy nền ngoài nhắc giờ học: lấy buổi/bài tập mới từ Daymai, nhắc bài tập sắp hạn,
// nhắc xem bù buổi vắng, báo cáo tuần, đẩy lịch lên Google Calendar.
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { pendingMakeups, weekReport } from '@shared/extras'
import { pad, vnDate, ymd } from '@shared/schedule'
import { syncDaymai } from './daymai'
import { requestGoogleSync } from './gcal'
import { tr } from './i18n'
import { notifyInfo } from './notifier'
import { loadData, mutateData } from './store'

interface State {
  weekly?: string
  makeup?: string
  loginWarn?: string
}
const stateFile = (): string => join(app.getPath('userData'), 'state.json')
const readState = (): State => {
  try {
    return JSON.parse(readFileSync(stateFile(), 'utf8')) as State
  } catch {
    return {}
  }
}
const setState = (p: State): void => writeFileSync(stateFile(), JSON.stringify({ ...readState(), ...p }), 'utf8')

async function autoSyncDaymai(): Promise<void> {
  const r = await syncDaymai()
  const today = ymd(new Date())
  // Cần đăng nhập thì nhắc tối đa một lần mỗi ngày
  if (!r.ok && r.message === tr('sync.needLogin') && readState().loginWarn !== today) {
    if (notifyInfo(tr('sync.title'), r.message)) setState({ loginWarn: today })
  }
}

function tick(): void {
  const now = new Date()
  const data = loadData()
  const today = ymd(now)

  // 1. Bài tập sắp hạn: nhắc trước 1 ngày và trước 2 giờ
  for (const t of data.tasks) {
    if (t.done || !t.due) continue
    const left = new Date(t.due).getTime() - now.getTime()
    if (Number.isNaN(left) || left < 0) continue
    const has = t.reminded ?? []
    const mark = left <= 2 * 3_600_000 ? '2h' : left <= 24 * 3_600_000 ? '1d' : null
    if (!mark || has.includes(mark)) continue
    const due = new Date(t.due)
    const when = `${pad(due.getHours())}:${pad(due.getMinutes())} ${vnDate(ymd(due))}`
    if (notifyInfo(tr(mark === '2h' ? 'task.remind2h' : 'task.remind1d'), `${t.title}\n${tr('task.due', { when })}`)) {
      mutateData((d) => {
        const x = d.tasks.find((y) => y.id === t.id)
        if (x) x.reminded = [...new Set([...(x.reminded ?? []), mark, ...(mark === '2h' ? ['1d'] : [])])]
      })
    }
  }

  // 2. Buổi vắng chưa xem bù: nhắc mỗi ngày một lần, từ 9 giờ sáng
  if (now.getHours() >= 9 && readState().makeup !== today) {
    const list = pendingMakeups(data, now)
    if (list.length) {
      const first = list[0]
      const body = tr('makeup.body', { n: list.length, first: `${first.ev.title} · ${vnDate(first.session.key)}` })
      if (notifyInfo(tr('makeup.title'), body)) setState({ makeup: today })
    }
  }

  // 3. Báo cáo tuần: Chủ nhật từ 20 giờ
  if (now.getDay() === 0 && now.getHours() >= 20) {
    const r = weekReport(data, now)
    const week = ymd(r.from)
    if (readState().weekly !== week) {
      const body = tr('weekly.body', {
        present: r.present,
        absent: r.absent,
        unmarked: r.unmarked,
        tasks: r.tasksDue.length + r.tasksOverdue.length
      })
      if (notifyInfo(tr('weekly.title'), body)) setState({ weekly: week })
    }
  }
}

export function startBackground(): void {
  setInterval(tick, 60_000)
  setTimeout(tick, 10_000)
  // Lấy buổi/bài tập mới từ Daymai: sau khi mở máy 20 giây rồi 3 tiếng một lần
  setTimeout(() => void autoSyncDaymai(), 20_000)
  setInterval(() => void autoSyncDaymai(), 3 * 3_600_000)
  // Đẩy lịch lên Google Calendar: lúc mở máy rồi 6 tiếng một lần (còn lại đẩy ngay khi dữ liệu đổi)
  setTimeout(requestGoogleSync, 30_000)
  setInterval(requestGoogleSync, 6 * 3_600_000)
}
