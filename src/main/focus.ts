import type { ClassEvent } from '@shared/types'
import { endOn, startOn } from '@shared/schedule'
import { loadData } from './store'
import { minimizeMain } from './windows'

// Chế độ tập trung: sau khi bấm "Vào học" trong giờ học, app thu nhỏ và tạm im mọi nhắc khác tới hết buổi.
// (Không đụng tới "Không làm phiền" của Windows: đó là cài đặt hệ thống, bạn tự bật nếu muốn.)
let until = 0
let focusId: string | null = null
const joinedListeners = new Set<(ev: ClassEvent) => void>()

/** Đăng ký nghe việc vào học (ví dụ đóng popup nhắc giờ của chính lớp đó) */
export function onJoined(cb: (ev: ClassEvent) => void): void {
  joinedListeners.add(cb)
}

export function startFocus(ev: ClassEvent): void {
  for (const cb of joinedListeners) cb(ev)
  if (!loadData().settings.focusOnJoin) return
  const now = new Date()
  const from = startOn(ev, now).getTime() - 30 * 60_000
  const end = endOn(ev, now).getTime()
  if (now.getTime() < from || now.getTime() >= end) return // vào xem lại ngoài giờ thì không bật
  until = end
  focusId = ev.id
  minimizeMain()
}

/** Đang trong buổi học khác (`exceptId` là lớp được phép nhắc) nên nên im lặng */
export function isFocused(exceptId?: string): boolean {
  return Date.now() < until && focusId !== exceptId
}
