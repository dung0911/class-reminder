// Đồng bộ từ Daymai.vn: link từng buổi học, giờ học bị đổi/huỷ, bài tập và bài thi.
// Chạy trong một cửa sổ ẩn dùng chung phiên đăng nhập với cửa sổ "Vào học" (partition của nền tảng).
// Không có phiên đăng nhập và không có mật khẩu đã lưu thì báo cần đăng nhập, không tự làm gì thêm.
import type { BrowserWindow } from 'electron'
import type { ClassEvent, Site, SyncResult, Task } from '@shared/types'
import { breakOn, occursOn } from '@shared/schedule'
import { tr } from './i18n'
import { notifyInfo } from './notifier'
import { loadData, mutateData } from './store'
import { accountForSite, createWebWindow, tryAutoLogin } from './webwin'
import { sendToMain } from './windows'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const ORIGIN = 'https://daymai.vn'
const hostOf = (u: string): string => {
  try {
    return new URL(u).hostname
  } catch {
    return ''
  }
}

interface SessionRow {
  date: string
  start: string
  end: string
  sid: string
}
interface TaskRow {
  remoteId: string
  title: string
  due?: string
  url?: string
  done: boolean
}

/** Mã khoá học trong link của lớp, ví dụ https://daymai.vn/student/course/33967468/session -> 33967468 */
const courseIdOf = (ev: ClassEvent): string | null => ev.url.match(/\/student\/course\/(\d+)/)?.[1] ?? null

// Đọc danh sách buổi: mỗi dòng bảng có ngày dd/mm/yyyy, giờ "20:20 → 23:00" và link .../session/<mã buổi>
const SCRAPE_SESSIONS = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const read = () => [...document.querySelectorAll('tr')].map((tr) => {
    const href = [...tr.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).find((h) => /\\/session\\/\\d+$/.test(h || ''));
    const t = tr.innerText || '';
    const d = t.match(/(\\d{2})\\/(\\d{2})\\/(\\d{4})/);
    const m = t.match(/(\\d{1,2}):(\\d{2})\\s*→\\s*(\\d{1,2}):(\\d{2})/);
    if (!href || !d) return null;
    const p = (n) => String(n).padStart(2, '0');
    return { date: d[3] + '-' + d[2] + '-' + d[1], start: m ? p(m[1]) + ':' + m[2] : '', end: m ? p(m[3]) + ':' + m[4] : '', sid: href.match(/(\\d+)$/)[1] };
  }).filter(Boolean);
  for (let i = 0; i < 30; i++) { const r = read(); if (r.length) return r; await sleep(400); }
  return [];
})()`

// Đọc bài tập/bài thi: chưa có mẫu thật để đối chiếu (khoá mới chưa giao bài), nên đọc theo cách chung:
// mỗi dòng bảng có link và ngày giờ hạn nộp. Dòng nào không có ngày thì bỏ qua.
const SCRAPE_TASKS = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const p = (n) => String(n).padStart(2, '0');
  const read = () => [...document.querySelectorAll('main tr')].map((tr) => {
    const a = [...tr.querySelectorAll('a[href]')].find((x) => x.getAttribute('href') && !x.getAttribute('href').startsWith('#'));
    const t = (tr.innerText || '').trim();
    let due = null;
    let m = t.match(/(\\d{1,2}):(\\d{2})\\D{0,4}(\\d{2})\\/(\\d{2})\\/(\\d{4})/);
    if (m) due = m[5] + '-' + m[4] + '-' + m[3] + 'T' + p(m[1]) + ':' + m[2];
    else if ((m = t.match(/(\\d{2})\\/(\\d{2})\\/(\\d{4})\\D{0,4}(\\d{1,2}):(\\d{2})/))) due = m[3] + '-' + m[2] + '-' + m[1] + 'T' + p(m[4]) + ':' + m[5];
    else if ((m = t.match(/(\\d{2})\\/(\\d{2})\\/(\\d{4})/))) due = m[3] + '-' + m[2] + '-' + m[1] + 'T23:59';
    if (!due) return null;
    const cells = [...tr.querySelectorAll('td')].map((c) => (c.innerText || '').trim()).filter(Boolean);
    const title = (a && (a.innerText || '').trim()) || cells.find((c) => c.length > 3 && !/^\\d+$/.test(c)) || '';
    if (!title) return null;
    return { remoteId: (a && a.getAttribute('href')) || title, title: title.slice(0, 160), due, url: a ? a.href : undefined, done: /đã nộp|hoàn thành|đã làm|đã thi/i.test(t) };
  }).filter(Boolean);
  for (let i = 0; i < 20; i++) {
    const r = read();
    if (r.length) return r;
    if (/không có|chưa có|chưa hoàn thành/i.test(document.body.innerText) && i > 5) return [];
    await sleep(400);
  }
  return [];
})()`

const onLoginPage = (win: BrowserWindow): Promise<boolean> =>
  win.webContents.executeJavaScript(`/\\/login/.test(location.pathname)`) as Promise<boolean>

async function load(win: BrowserWindow, url: string): Promise<void> {
  try {
    await win.loadURL(url)
  } catch {
    /* chuyển hướng làm huỷ lần tải đầu: vẫn đọc trang đang hiện */
  }
  await sleep(1200)
}

/** Vào trang cần đăng nhập: tự đăng nhập nếu có mật khẩu đã lưu. false = chưa vào được (cần bạn đăng nhập). */
async function ensureLoggedIn(win: BrowserWindow, site: Site, url: string): Promise<boolean> {
  await load(win, url)
  if (!(await onLoginPage(win))) return true
  if (!(await tryAutoLogin(win, accountForSite(site.id)))) return false
  for (let i = 0; i < 25; i++) {
    await sleep(400)
    if (!(await onLoginPage(win).catch(() => true))) {
      await load(win, url) // sau đăng nhập có thể rơi về trang chủ
      return !(await onLoginPage(win))
    }
  }
  return false
}

export async function syncDaymai(): Promise<SyncResult> {
  const data = loadData()
  const site = data.sites.find((s) => /(^|\.)daymai\.vn$/.test(hostOf(s.url)))
  if (!site) return { ok: false, message: tr('sync.noSite') }
  const events = data.events.filter((e) => courseIdOf(e) && e.siteIds?.includes(site.id))
  if (!events.length) return { ok: false, message: tr('sync.noCourse') }

  const win = createWebWindow(site, false)
  const found: { ev: ClassEvent; rows: SessionRow[]; tasks: TaskRow[] }[] = []
  try {
    const first = `${ORIGIN}/student/course/${courseIdOf(events[0])}/session`
    if (!(await ensureLoggedIn(win, site, first))) {
      return { ok: false, message: tr('sync.needLogin') }
    }
    for (const ev of events) {
      const id = courseIdOf(ev) as string
      await load(win, `${ORIGIN}/student/course/${id}/session`)
      const rows = (await win.webContents.executeJavaScript(SCRAPE_SESSIONS)) as SessionRow[]
      const tasks: TaskRow[] = []
      for (const page of ['exercise', 'exam']) {
        await load(win, `${ORIGIN}/student/course/${id}/${page}`)
        tasks.push(...((await win.webContents.executeJavaScript(SCRAPE_TASKS)) as TaskRow[]))
      }
      found.push({ ev, rows, tasks })
    }
  } catch (err) {
    return { ok: false, message: tr('sync.error', { err: String(err) }) }
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }

  // ----- Áp kết quả vào dữ liệu -----
  const today = new Date()
  const changes: string[] = []
  let sessions = 0
  let newTasks = 0
  mutateData((d) => {
    for (const { ev: old, rows, tasks } of found) {
      const ev = d.events.find((e) => e.id === old.id)
      if (!ev) continue
      const links = { ...(ev.sessionLinks ?? {}) }
      const times = { ...(ev.sessionTimes ?? {}) }
      const seen = new Set<string>()
      for (const r of rows) {
        seen.add(r.date)
        const link = `${ORIGIN}/student/session/${r.sid}`
        if (links[r.date] !== link) sessions++
        links[r.date] = link
        const day = new Date(`${r.date}T00:00:00`)
        const before = times[r.date]
        if (r.start) times[r.date] = r.start
        if (day < new Date(today.getFullYear(), today.getMonth(), today.getDate())) continue
        const vn = r.date.split('-').reverse().join('/')
        if (occursOn(ev, day)) {
          // So với lần đồng bộ trước (không so với giờ bạn đặt trong app, vì bạn có thể cố ý đặt khác Daymai)
          if (before && r.start && r.start !== before) changes.push(tr('sync.timeChanged', { title: ev.title, date: vn, from: before, to: r.start }))
        } else if (!breakOn(ev, day)) {
          changes.push(tr('sync.extra', { title: ev.title, date: vn, time: r.start }))
        }
      }
      // Buổi từng có link, còn ở tương lai mà Daymai không còn liệt kê nữa => có thể bị huỷ
      for (const date of Object.keys(links)) {
        if (!seen.has(date) && new Date(`${date}T23:59:00`) > today && rows.length) {
          changes.push(tr('sync.cancelled', { title: ev.title, date: date.split('-').reverse().join('/') }))
          delete links[date]
        }
      }
      ev.sessionLinks = links
      ev.sessionTimes = times

      for (const r of tasks) {
        const have = d.tasks.find((t) => t.source === 'daymai' && t.remoteId === r.remoteId)
        if (have) {
          have.title = r.title
          have.due = r.due
          have.url = r.url
          if (r.done) have.done = true
        } else {
          const t: Task = {
            id: `dm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
            title: r.title,
            due: r.due,
            eventId: ev.id,
            url: r.url,
            done: r.done,
            source: 'daymai',
            remoteId: r.remoteId
          }
          d.tasks.push(t)
          if (!r.done) newTasks++
        }
      }
    }
  })
  sendToMain('data:changed')

  if (changes.length) notifyInfo(tr('sync.changedTitle'), changes.slice(0, 3).join('\n'))
  else if (newTasks) notifyInfo(tr('sync.title'), tr('sync.newTasks', { n: newTasks }))
  const message = [tr('sync.done', { sessions, tasks: newTasks }), ...changes].join('\n')
  return { ok: true, message }
}
