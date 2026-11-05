import { app, clipboard, ipcMain, shell } from 'electron'
import type { AppData, ClassEvent } from '@shared/types'
import { syncDaymai } from './daymai'
import { connectGoogle, disconnectGoogle, exportIcs, googleStatus, requestGoogleSync, setGoogleConfig, syncGoogle } from './gcal'
import { loadBundle, openLocalesFolder } from './i18n'
import { joinClass } from './launcher'
import { decrypt, encrypt } from './secrets'
import { loadData, mutateData, saveData } from './store'
import { refreshTray } from './tray'
import { openWeb, recordRecipe, runRecipe, createWebWindow, accountForSite } from './webwin'
import { sendToMain, setWindowTheme } from './windows'

// Mở cùng Windows và khởi động ẩn (--hidden). Bản chạy thử phải chỉ rõ đường dẫn electron + thư mục app.
function loginOpts(): { path?: string; args: string[] } {
  return app.isPackaged
    ? { args: ['--hidden'] }
    : { path: process.execPath, args: [app.getAppPath(), '--hidden'] }
}

let clipTimer: NodeJS.Timeout | null = null

const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e))

export function registerIpc(): void {
  ipcMain.handle('data:get', () => loadData())
  ipcMain.handle('data:save', (_e, data: AppData) => {
    const langChanged = loadData().settings.lang !== data.settings.lang
    saveData(data)
    if (langChanged) refreshTray()
    requestGoogleSync() // lịch đổi thì đẩy lên Google Calendar (nếu đã liên kết)
  })
  ipcMain.handle('class:join', (_e, ev: ClassEvent) => joinClass(ev))
  ipcMain.handle('autostart:get', () => app.getLoginItemSettings(loginOpts()).openAtLogin)
  ipcMain.handle('autostart:set', (_e, on: boolean) => {
    app.setLoginItemSettings({ openAtLogin: on, ...loginOpts() })
    return app.getLoginItemSettings(loginOpts()).openAtLogin
  })

  // Ngôn ngữ và giao diện
  ipcMain.handle('i18n:load', (_e, lang: string) => loadBundle(lang))
  ipcMain.handle('i18n:openFolder', () => openLocalesFolder())
  ipcMain.handle('window:theme', (_e, theme: 'dark' | 'light') => setWindowTheme(theme))

  // Mật khẩu: mã hoá bằng Windows (DPAPI qua safeStorage). Renderer không bao giờ giữ chữ rõ lâu dài.
  ipcMain.handle('secret:encrypt', (_e, plain: string) => encrypt(plain))
  ipcMain.handle('secret:reveal', (_e, enc: string) => decrypt(enc))
  ipcMain.handle('secret:copy', (_e, enc: string) => {
    const plain = decrypt(enc)
    if (plain === null) return false
    clipboard.writeText(plain)
    if (clipTimer) clearTimeout(clipTimer)
    // Tự xoá khỏi clipboard sau 30 giây (nếu bạn chưa chép thứ khác)
    clipTimer = setTimeout(() => {
      if (clipboard.readText() === plain) clipboard.clear()
    }, 30_000)
    return true
  })
  ipcMain.handle('text:copy', (_e, text: string) => clipboard.writeText(text))
  ipcMain.handle('url:open', (_e, url: string) => {
    if (/^https?:\/\//i.test(url)) return shell.openExternal(url) // chỉ cho mở http(s)
  })

  // Nền tảng học: cửa sổ riêng, công thức
  ipcMain.handle('site:open', (_e, siteId: string) => {
    const site = loadData().sites.find((s) => s.id === siteId)
    if (!site?.url) return
    if (loadData().settings.joinInApp) openWeb({ url: site.url })
    else void shell.openExternal(site.url)
  })
  ipcMain.handle('recipe:record', (_e, siteId: string) => {
    const site = loadData().sites.find((s) => s.id === siteId)
    if (!site?.url) return
    recordRecipe(site, (steps) => {
      if (!steps.length) return
      mutateData((d) => {
        const s = d.sites.find((x) => x.id === siteId)
        if (s) s.recipe = steps
      })
      sendToMain('data:changed')
      sendToMain('toast', `${site.name}: ${steps.length}`)
    })
  })
  ipcMain.handle('recipe:run', async (_e, siteId: string) => {
    const site = loadData().sites.find((s) => s.id === siteId)
    if (!site?.url || !site.recipe?.length) return
    const win = createWebWindow(site, true)
    await win.loadURL(site.url).catch(() => {})
    const r = await runRecipe(win, site.recipe, accountForSite(site.id))
    sendToMain('toast', r.ok ? `${site.name}: OK` : `${site.name}: ✗ ${r.failed?.selector ?? r.failed?.text ?? ''}`)
  })

  // Đồng bộ Daymai, Google Calendar, .ics
  ipcMain.handle('daymai:sync', () => syncDaymai())
  ipcMain.handle('google:status', () => googleStatus())
  ipcMain.handle('google:config', (_e, cfg: { clientId: string; clientSecret?: string; auto: boolean }) => setGoogleConfig(cfg))
  ipcMain.handle('google:connect', async () => {
    try {
      const st = await connectGoogle()
      void syncGoogle()
      return st
    } catch (e) {
      return { ...googleStatus(), lastError: errText(e) }
    }
  })
  ipcMain.handle('google:disconnect', () => disconnectGoogle())
  ipcMain.handle('google:sync', () => syncGoogle())
  ipcMain.handle('ics:export', () => exportIcs())
}
