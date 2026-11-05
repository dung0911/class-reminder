// Các phép tính thuần dùng chung: mục lịch xuất ra ngoài (Google Calendar, .ics), báo cáo tuần,
// buổi vắng cần xem bù, đếm ngược kỳ thi. Không phụ thuộc Electron nên kiểm thử bằng node được.
import type { AppData, ClassEvent, Task } from './types'
import { breakOn, listSessions, occursOn, endOn, pad, sessionNumber, startOn, ymd, type SessionInfo } from './schedule'

// ---------- Mục lịch xuất ra ngoài ----------

export interface CalItem {
  /** Khoá ổn định để lần đồng bộ sau nhận ra đúng mục đó (không đổi khi sửa nội dung) */
  key: string
  title: string
  start: Date
  end: Date
  allDay?: boolean
  description: string
  location?: string
  /** Nhắc trước bao nhiêu phút (hiện thông báo trên điện thoại) */
  remind: number[]
}

/** Link vào lớp của một ngày: link riêng của buổi > link lớp > link của trang học đầu tiên */
export function linkFor(data: AppData, ev: ClassEvent, key: string): string {
  return ev.sessionLinks?.[key] || ev.url || data.sites.find((s) => ev.siteIds?.includes(s.id) && s.url)?.url || ''
}

/** Mọi buổi học, bài tập có hạn và ngày thi nằm trong [from, to] */
export function buildCalendarItems(data: AppData, from: Date, to: Date): CalItem[] {
  const items: CalItem[] = []
  const last = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59)

  for (const ev of data.events) {
    if (!ev.enabled) continue
    const c = new Date(from.getFullYear(), from.getMonth(), from.getDate())
    for (; c <= last; c.setDate(c.getDate() + 1)) {
      if (!occursOn(ev, c)) continue
      const key = ymd(c)
      const no = sessionNumber(ev, c)
      const lesson = no ? ev.syllabus?.find((s) => s.no === no) : undefined
      const link = linkFor(data, ev, key)
      const desc = [
        lesson?.lesson,
        ...(lesson?.items ?? []).map((i) => `• ${i}`),
        lesson?.homework ? `BTVN: ${lesson.homework}` : '',
        link ? `Vào lớp: ${link}` : '',
        ev.sessionNotes?.[key]?.note ?? '',
        ev.note ?? ''
      ].filter(Boolean)
      items.push({
        key: `class:${ev.id}:${key}`,
        title: `${ev.title}${no ? ` (${no}${ev.totalSessions ? `/${ev.totalSessions}` : ''})` : ''}`,
        start: startOn(ev, c),
        end: endOn(ev, c),
        description: desc.join('\n'),
        location: link || undefined,
        remind: [ev.remind, 0].filter((m, i, a) => a.indexOf(m) === i)
      })
    }
  }

  for (const t of data.tasks) {
    if (t.done || !t.due) continue
    const start = new Date(t.due)
    if (Number.isNaN(start.getTime()) || start < from || start > last) continue
    const cls = data.events.find((e) => e.id === t.eventId)
    items.push({
      key: `task:${t.id}`,
      title: `📝 ${t.title}`,
      start,
      end: new Date(start.getTime() + 15 * 60_000),
      description: [cls ? `Lớp: ${cls.title}` : '', t.url ? `Link: ${t.url}` : ''].filter(Boolean).join('\n'),
      location: t.url,
      remind: [1440, 120]
    })
  }

  const firstDay = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const exams: { key: string; title: string; date: string }[] = []
  if (data.settings.examDate) exams.push({ key: 'exam', title: data.settings.examTitle || 'Kỳ thi', date: data.settings.examDate })
  for (const ev of data.events) if (ev.examDate) exams.push({ key: `exam:${ev.id}`, title: `Thi ${ev.title}`, date: ev.examDate })
  for (const x of exams) {
    const [y, m, d] = x.date.split('-').map(Number)
    const day = new Date(y, m - 1, d)
    if (day < firstDay || day > last) continue
    items.push({
      key: x.key,
      title: `🎓 ${x.title}`,
      start: day,
      end: new Date(y, m - 1, d + 1),
      allDay: true,
      description: '',
      remind: [10080, 1440]
    })
  }
  return items
}

// ---------- File .ics (Google Calendar, Apple, Outlook đều nhập được) ----------

const utc = (d: Date): string =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
const dateOnly = (d: Date): string => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
const esc = (s: string): string => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Gập dòng dài theo chuẩn RFC 5545 (tối đa ~75 ký tự mỗi dòng, dòng tiếp bắt đầu bằng một dấu cách) */
function fold(line: string): string {
  const parts: string[] = []
  for (let i = 0; i < line.length; ) {
    let end = Math.min(i + 60, line.length)
    // không cắt giữa một cặp ký tự (emoji)
    if (end < line.length && /[\uDC00-\uDFFF]/.test(line[end])) end--
    parts.push(line.slice(i, end))
    i = end
  }
  return parts.join('\r\n ')
}

export function buildIcs(items: CalItem[], calName: string, now: Date = new Date()): string {
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lich hoc//VI//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(calName)}`]
  for (const it of items) {
    out.push('BEGIN:VEVENT')
    out.push(`UID:${it.key.replace(/[^a-z0-9]/gi, '-')}@lichhoc.local`)
    out.push(`DTSTAMP:${utc(now)}`)
    if (it.allDay) {
      out.push(`DTSTART;VALUE=DATE:${dateOnly(it.start)}`, `DTEND;VALUE=DATE:${dateOnly(it.end)}`)
    } else {
      out.push(`DTSTART:${utc(it.start)}`, `DTEND:${utc(it.end)}`)
    }
    out.push(`SUMMARY:${esc(it.title)}`)
    if (it.description) out.push(`DESCRIPTION:${esc(it.description)}`)
    if (it.location) out.push(`LOCATION:${esc(it.location)}`)
    for (const m of it.remind) {
      out.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(it.title)}`, `TRIGGER:-PT${m}M`, 'END:VALARM')
    }
    out.push('END:VEVENT')
  }
  out.push('END:VCALENDAR')
  return out.map(fold).join('\r\n') + '\r\n'
}

// ---------- Kỳ thi ----------

/** Còn bao nhiêu ngày tới `key` ("YYYY-MM-DD"); 0 = hôm nay, âm = đã qua */
export function daysUntil(key: string, now: Date = new Date()): number {
  const [y, m, d] = key.split('-').map(Number)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86_400_000)
}

export interface ExamInfo {
  /** Tên môn/kỳ thi; rỗng nếu là kỳ thi chung chưa đặt tên */
  title: string
  date: string
  days: number
  /** Có nếu là kỳ thi của một môn */
  eventId?: string
}

/** Mọi kỳ thi chưa tới (kỳ thi chung + thi từng môn), sớm nhất trước */
export function upcomingExams(data: AppData, now: Date = new Date()): ExamInfo[] {
  const list: ExamInfo[] = []
  if (data.settings.examDate) list.push({ title: data.settings.examTitle ?? '', date: data.settings.examDate, days: 0 })
  for (const ev of data.events) if (ev.examDate) list.push({ title: ev.title, date: ev.examDate, days: 0, eventId: ev.id })
  return list
    .map((x) => ({ ...x, days: daysUntil(x.date, now) }))
    .filter((x) => x.days >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ---------- Buổi vắng cần xem bù ----------

export interface Makeup {
  ev: ClassEvent
  session: SessionInfo
  /** Link xem lại: bản ghi hình bạn dán > link buổi học trên web */
  link: string
}

export function pendingMakeups(data: AppData, now: Date = new Date()): Makeup[] {
  const out: Makeup[] = []
  for (const ev of data.events) {
    for (const s of listSessions(ev, now)) {
      if (s.status !== 'absent' || ev.sessionNotes?.[s.key]?.watched) continue
      out.push({ ev, session: s, link: ev.sessionNotes?.[s.key]?.recordingUrl || linkFor(data, ev, s.key) })
    }
  }
  return out
}

// ---------- Báo cáo tuần ----------

export interface WeekReport {
  from: Date
  to: Date
  present: number
  absent: number
  unmarked: number
  upcoming: number
  breaks: number
  /** Bài tập chưa xong có hạn trong tuần */
  tasksDue: Task[]
  /** Bài tập chưa xong đã quá hạn */
  tasksOverdue: Task[]
}

/** Tuần Thứ 2 → Chủ nhật chứa `now` */
export function weekReport(data: AppData, now: Date = new Date()): WeekReport {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6, 23, 59, 59)
  const r: WeekReport = { from, to, present: 0, absent: 0, unmarked: 0, upcoming: 0, breaks: 0, tasksDue: [], tasksOverdue: [] }
  for (const ev of data.events) {
    for (let i = 0; i < 7; i++) {
      const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)
      if (breakOn(ev, d)) {
        r.breaks++
        continue
      }
      if (!occursOn(ev, d)) continue
      const mark = ev.attendance?.[ymd(d)]
      if (mark === 'present') r.present++
      else if (mark === 'absent') r.absent++
      else if (now >= endOn(ev, d)) r.unmarked++
      else r.upcoming++
    }
  }
  for (const t of data.tasks) {
    if (t.done || !t.due) continue
    const due = new Date(t.due)
    if (due < now) r.tasksOverdue.push(t)
    else if (due <= to) r.tasksDue.push(t)
  }
  return r
}

// ---------- Thống kê hiển thị (dải số liệu, bản đồ nhiệt, biểu đồ giờ học, bảng buổi gần đây) ----------

const dayStart = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addD = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const mondayOf = (d: Date): Date => addD(d, -((d.getDay() + 6) % 7))

/** Số buổi và số phút học của một tuần bắt đầu từ `monday` (không tính buổi nghỉ) */
function weekLoad(data: AppData, monday: Date): { sessions: number; minutes: number; attendedMinutes: number } {
  let sessions = 0
  let minutes = 0
  let attendedMinutes = 0
  for (const ev of data.events) {
    if (!ev.enabled) continue
    for (let i = 0; i < 7; i++) {
      const d = addD(monday, i)
      if (!occursOn(ev, d)) continue
      sessions++
      minutes += ev.duration
      if (ev.attendance?.[ymd(d)] === 'present') attendedMinutes += ev.duration
    }
  }
  return { sessions, minutes, attendedMinutes }
}

export interface CalendarStats {
  sessions: number
  sessionsPrev: number
  hours: number
  hoursPrev: number
  /** Tỉ lệ có mặt trên các buổi đã qua, 0..100; null nếu chưa có buổi nào */
  rate: number | null
  present: number
  past: number
  tasksOpen: number
  tasksOverdue: number
}

/** Số liệu cho dải thống kê phía trên lịch */
export function calendarStats(data: AppData, now: Date = new Date()): CalendarStats {
  const mon = mondayOf(now)
  const cur = weekLoad(data, mon)
  const prev = weekLoad(data, addD(mon, -7))
  let present = 0
  let past = 0
  for (const ev of data.events) {
    for (const s of listSessions(ev, now)) {
      if (s.status === 'present' || s.status === 'absent' || s.status === 'unmarked') past++
      if (s.status === 'present') present++
    }
  }
  const open = data.tasks.filter((t) => !t.done)
  return {
    sessions: cur.sessions,
    sessionsPrev: prev.sessions,
    hours: Math.round((cur.minutes / 60) * 10) / 10,
    hoursPrev: Math.round((prev.minutes / 60) * 10) / 10,
    rate: past ? Math.round((present / past) * 100) : null,
    present,
    past,
    tasksOpen: open.length,
    tasksOverdue: open.filter((t) => t.due && new Date(t.due) < now).length
  }
}

/** Số buổi học trong một ngày (không tính nghỉ) trên các lớp đang bật; breakDay = có lớp nghỉ ngày đó */
export function dayCount(events: ClassEvent[], d: Date): { count: number; breakDay: boolean } {
  let count = 0
  let breakDay = false
  for (const ev of events) {
    if (occursOn(ev, d)) count++
    else if (breakOn(ev, d)) breakDay = true
  }
  return { count, breakDay }
}

export type HeatStatus = 'present' | 'absent' | 'unmarked' | 'upcoming' | 'break'

export interface HeatCell {
  date: Date
  status: HeatStatus | null
  /** Mô tả ngắn để hiện khi rê chuột */
  tip: string
}

/** Lưới bản đồ nhiệt: `weeks` cột (mỗi cột Thứ 2 → CN), bắt đầu từ tuần sớm nhất có lớp (tối đa ~5 tháng trước) */
export function heatmapWeeks(data: AppData, now: Date = new Date(), weeks = 30): HeatCell[][] {
  const starts = data.events.map((e) => e.startDate).filter((s): s is string => !!s).sort()
  const earliest = starts.length ? new Date(`${starts[0]}T00:00:00`) : addD(now, -7 * 8)
  const floor = addD(mondayOf(now), -7 * 20)
  const first = mondayOf(earliest < floor ? floor : earliest)
  const today = dayStart(now)
  const out: HeatCell[][] = []
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = []
    for (let i = 0; i < 7; i++) {
      const d = addD(first, w * 7 + i)
      const bits: { status: HeatStatus; title: string }[] = []
      for (const ev of data.events) {
        if (breakOn(ev, d)) {
          bits.push({ status: 'break', title: ev.title })
          continue
        }
        if (!occursOn(ev, d)) continue
        const mark = ev.attendance?.[ymd(d)]
        const status: HeatStatus = mark ?? (endOn(ev, d) <= now ? 'unmarked' : 'upcoming')
        bits.push({ status, title: ev.title })
      }
      // Ưu tiên hiển thị: vắng > chưa ghi nhận > có mặt > sắp tới > nghỉ
      const order: HeatStatus[] = ['absent', 'unmarked', 'present', 'upcoming', 'break']
      const status = bits.length ? order.find((s) => bits.some((b) => b.status === s)) ?? null : null
      col.push({ date: d, status: d < today && !bits.length ? null : status, tip: bits.map((b) => b.title).join(', ') })
    }
    out.push(col)
  }
  return out
}

export interface WeekHours {
  monday: Date
  hours: number
  attendedHours: number
  current: boolean
  future: boolean
}

/** Giờ học từng tuần: `past` tuần trước, tuần này, `future` tuần sau */
export function weeklyHours(data: AppData, now: Date = new Date(), past = 7, future = 4): WeekHours[] {
  const mon = mondayOf(now)
  const out: WeekHours[] = []
  for (let k = -past; k <= future; k++) {
    const m = addD(mon, k * 7)
    const l = weekLoad(data, m)
    out.push({ monday: m, hours: Math.round((l.minutes / 60) * 10) / 10, attendedHours: Math.round((l.attendedMinutes / 60) * 10) / 10, current: k === 0, future: k > 0 })
  }
  return out
}

export interface RecentRow {
  ev: ClassEvent
  session: SessionInfo
}

/** Các buổi đã qua hoặc đang diễn ra, mới nhất trước */
export function recentSessions(data: AppData, now: Date = new Date(), limit = 6): RecentRow[] {
  const rows: RecentRow[] = []
  for (const ev of data.events) {
    for (const s of listSessions(ev, now)) {
      if (s.status !== 'upcoming') rows.push({ ev, session: s })
    }
  }
  return rows.sort((a, b) => b.session.date.getTime() - a.session.date.getTime() || b.ev.time.localeCompare(a.ev.time)).slice(0, limit)
}
