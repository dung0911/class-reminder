import { shell } from 'electron'
import type { ClassEvent } from '@shared/types'
import { endOn, occursOn, startOn, ymd } from '@shared/schedule'
import { startFocus } from './focus'
import { tr } from './i18n'
import { loadData, mutateData } from './store'
import { openWeb } from './webwin'
import { sendToMain, showMain } from './windows'
import { openZoom, toZoomDeepLink } from './zoom'

export { toZoomDeepLink }

/** Link để vào lớp: link của buổi hôm nay > link chung của lớp > link của trang học đầu tiên */
function resolveUrl(ev: ClassEvent): string {
  const today = ev.sessionLinks?.[ymd(new Date())]
  if (today) return today
  if (ev.url) return ev.url
  const data = loadData()
  const site = data.sites.find((s) => ev.siteIds?.includes(s.id) && s.url)
  return site?.url ?? ''
}

/**
 * Bấm "Vào học" trong khoảng từ 30 phút trước giờ tới hết buổi => ghi nhận có mặt buổi hôm nay.
 * (Vắng thì bạn tự đánh dấu; cứ vào học là có mặt.)
 */
function markPresentIfInSession(ev: ClassEvent): void {
  const now = new Date()
  if (!occursOn(ev, now)) return
  const from = new Date(startOn(ev, now).getTime() - 30 * 60_000)
  if (now < from || now >= endOn(ev, now)) return
  const key = ymd(now)
  mutateData((d) => {
    const e = d.events.find((x) => x.id === ev.id)
    if (e) e.attendance = { ...(e.attendance ?? {}), [key]: 'present' }
  })
  sendToMain('data:changed')
}

/**
 * Điểm vào duy nhất để "vào học":
 *  - link Zoom: mở thẳng app Zoom
 *  - trang web (Daymai...): cửa sổ riêng của app, tự đăng nhập, bắt link Zoom khi trang chuyển hướng
 *  - Google Meet: mặc định mở trình duyệt của bạn (đã đăng nhập sẵn); bật "Meet trong app" để tự tắt mic/cam
 * Luôn có đường lùi: cài đặt "Vào học trong app" tắt thì mở bằng trình duyệt mặc định.
 */
export async function joinClass(ev: ClassEvent): Promise<void> {
  const url = resolveUrl(ev)
  if (!url) {
    showMain()
    sendToMain('toast', tr('toast.noLink', { title: ev.title }))
    return
  }
  markPresentIfInSession(ev)
  startFocus(ev)

  const s = loadData().settings
  if (toZoomDeepLink(url)) return openZoom(url)
  if (!/^https?:\/\//i.test(url)) return void (await shell.openExternal(url))

  const meet = ev.type === 'meet'
  if (s.joinInApp && (!meet || s.meetInApp)) {
    openWeb({
      url,
      handoffZoom: true,
      muteMeet: meet && (ev.camOff || ev.micOff) ? { cam: ev.camOff, mic: ev.micOff } : undefined
    })
    return
  }
  await shell.openExternal(url)
}
