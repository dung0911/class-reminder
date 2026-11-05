import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { writeFileSync } from 'fs'

type Page = 'index' | 'reminder'

const HEADER_H = 44
const OVERLAY = {
  dark: { color: '#0b0c1a', symbolColor: '#e5e7f5' },
  light: { color: '#e8eaf6', symbolColor: '#1c1e3a' }
}

const webPreferences = (): Electron.WebPreferences => ({
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
})

function loadPage(win: BrowserWindow, page: Page): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) void win.loadURL(`${devUrl}/${page}.html`)
  else void win.loadFile(join(__dirname, `../renderer/${page}.html`))
}

// ---------- Cửa sổ chính ----------
// Đóng cửa sổ = huỷ hẳn để nhả RAM; app vẫn chạy nền ở khay và mở lại khi cần.
let main: BrowserWindow | null = null

export function showMain(): void {
  if (main && !main.isDestroyed()) {
    if (main.isMinimized()) main.restore()
    main.show()
    main.focus()
    return
  }
  main = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    title: 'Lịch học',
    backgroundColor: '#0b0c1a',
    // Bỏ thanh tiêu đề của Windows: giao diện tự vẽ thanh trên cùng, chỉ giữ 3 nút thu nhỏ/phóng to/đóng
    titleBarStyle: 'hidden',
    titleBarOverlay: { ...OVERLAY.dark, height: HEADER_H },
    webPreferences: webPreferences()
  })
  main.once('ready-to-show', () => main?.show())
  main.on('closed', () => {
    main = null
  })
  loadPage(main, 'index')

  // Chỉ để kiểm thử: chụp cửa sổ chính ra file rồi thoát
  // (LICHHOC_SHOT_JS: đoạn JS chạy trước khi chụp để bấm sang trang khác; chỉ dùng khi chưa đóng gói)
  const shot = process.env['LICHHOC_SHOT_MAIN']
  if (shot) {
    const w = main
    setTimeout(async () => {
      const js = process.env['LICHHOC_SHOT_JS']
      if (js && !app.isPackaged) {
        const out = process.env['LICHHOC_SHOT_OUT'] // kết quả (hoặc lỗi) của đoạn JS, ghi ra file để đọc
        try {
          const result: unknown = await w.webContents.executeJavaScript(js)
          if (out) writeFileSync(out, JSON.stringify(result, null, 2), 'utf8')
        } catch (err) {
          if (out) writeFileSync(out, JSON.stringify({ error: String(err) }, null, 2), 'utf8')
        }
        await new Promise((r) => setTimeout(r, 1200))
      }
      writeFileSync(shot, (await w.webContents.capturePage()).toPNG())
      app.exit(0)
    }, 3000)
  }
}

/** Thu nhỏ cửa sổ chính (chế độ tập trung); không có cửa sổ thì thôi */
export function minimizeMain(): void {
  if (main && !main.isDestroyed()) main.minimize()
}

/** Cửa sổ chính đang mở và chưa bị thu nhỏ/ẩn */
export function mainIsVisible(): boolean {
  return !!main && !main.isDestroyed() && main.isVisible() && !main.isMinimized()
}

/** Đổi màu 3 nút cửa sổ cho khớp giao diện sáng/tối (khớp màu thanh trên cùng trong main.css) */
export function setWindowTheme(theme: 'dark' | 'light'): void {
  if (!main || main.isDestroyed()) return
  main.setTitleBarOverlay({ ...OVERLAY[theme], height: HEADER_H })
  main.setBackgroundColor(OVERLAY[theme].color)
}

export function sendToMain(channel: string, ...args: unknown[]): void {
  if (main && !main.isDestroyed()) main.webContents.send(channel, ...args)
}

// ---------- Popup nhắc giờ ----------
export function createReminderWindow(): BrowserWindow {
  const W = 360
  const H = 190
  const wa = screen.getPrimaryDisplay().workArea
  const win = new BrowserWindow({
    width: W,
    height: H,
    x: wa.x + wa.width - W - 16,
    y: wa.y + wa.height - H - 16,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: webPreferences()
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.once('ready-to-show', () => win.showInactive()) // không cướp focus khi bạn đang gõ
  loadPage(win, 'reminder')
  return win
}
