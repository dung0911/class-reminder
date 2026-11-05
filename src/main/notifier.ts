import { app, BrowserWindow, ipcMain, Notification } from 'electron'
import { writeFileSync } from 'fs'
import type { ClassEvent } from '@shared/types'
import { pad } from '@shared/schedule'
import { currentLang, tr } from './i18n'
import { isFocused, onJoined } from './focus'
import { joinClass } from './launcher'
import { createReminderWindow, showMain } from './windows'

interface PopupState {
  win: BrowserWindow
  ev: ClassEvent
  hhmm: string
}
const popups = new Map<number, PopupState>() // webContents.id -> trạng thái

/** Nhắc giờ bằng 2 lớp: thông báo Windows + popup góc màn hình (phòng khi Focus Assist nuốt thông báo) */
export function notifyClass(ev: ClassEvent, start: Date): void {
  if (isFocused(ev.id)) return // đang trong buổi học khác (chế độ tập trung)
  const hhmm = `${pad(start.getHours())}:${pad(start.getMinutes())}`
  const n = new Notification({
    title: `📚 ${ev.title} — ${hhmm}`,
    body: tr('notify.body'),
    urgency: 'critical'
  })
  n.on('click', () => void joinClass(ev))
  n.show()
  showPopup(ev, hhmm)
}

function showPopup(ev: ClassEvent, hhmm: string): void {
  const win = createReminderWindow()
  const id = win.webContents.id
  popups.set(id, { win, ev, hhmm })
  win.on('closed', () => popups.delete(id))
  // tự đóng khi lớp đã kết thúc
  setTimeout(() => !win.isDestroyed() && win.close(), ev.duration * 60_000)

  const shot = process.env['LICHHOC_SHOT']
  if (shot) {
    setTimeout(async () => {
      writeFileSync(shot, (await win.webContents.capturePage()).toPNG())
      app.exit(0)
    }, 2000)
  }
}

/** Thông báo ngắn không gắn với lớp (bài tập, báo cáo tuần, xem bù); bấm vào thì mở app. Im lặng khi đang tập trung. */
export function notifyInfo(title: string, body: string): boolean {
  if (isFocused()) return false
  const n = new Notification({ title, body })
  n.on('click', showMain)
  n.show()
  return true
}

export function registerReminderIpc(): void {
  // Vào học rồi thì đóng popup nhắc giờ còn treo của lớp đó
  onJoined((ev) => {
    for (const p of popups.values()) if (p.ev.id === ev.id && !p.win.isDestroyed()) p.win.close()
  })
  ipcMain.handle('reminder:info', (e) => {
    const p = popups.get(e.sender.id)
    return p ? { lang: currentLang(), title: p.ev.title, time: p.hhmm, hasUrl: !!p.ev.url } : null
  })
  ipcMain.handle('reminder:action', (e, action: 'join' | 'snooze' | 'dismiss') => {
    const p = popups.get(e.sender.id)
    if (!p) return
    if (action === 'join') void joinClass(p.ev)
    if (action === 'snooze') setTimeout(() => showPopup(p.ev, p.hhmm), 2 * 60_000)
    p.win.close()
  })
}
