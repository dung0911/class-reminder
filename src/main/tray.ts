import { app, Menu, nativeImage, Tray } from 'electron'
import { tr } from './i18n'
import { showMain } from './windows'

let tray: Tray | null = null

function buildMenu(): void {
  if (!tray) return
  tray.setToolTip(tr('app.name'))
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: tr('tray.open'), click: showMain },
      { label: tr('tray.quit'), click: () => app.quit() }
    ])
  )
}

export function createTray(): void {
  // Icon 16x16 màu xanh tạo từ bitmap BGRA (sau này thay bằng file .ico)
  const size = 16
  const buf = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    buf[i * 4] = 0xf1
    buf[i * 4 + 1] = 0x66
    buf[i * 4 + 2] = 0x63
    buf[i * 4 + 3] = 0xff
  }
  tray = new Tray(nativeImage.createFromBitmap(buf, { width: size, height: size }))
  tray.on('click', showMain)
  buildMenu()
}

/** Dựng lại menu khay khi đổi ngôn ngữ */
export function refreshTray(): void {
  buildMenu()
}
