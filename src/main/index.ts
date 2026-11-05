import { app, Menu } from 'electron'
import { join } from 'path'
import { startBackground } from './background'
import { registerIpc } from './ipc'
import { notifyClass, registerReminderIpc } from './notifier'
import { startScheduler } from './scheduler'
import { loadData } from './store'
import { createTray } from './tray'
import { showMain } from './windows'

// Cố định thư mục dữ liệu (không đổi theo productName) để luôn là %APPDATA%\lich-hoc
// (Chỉ khi chưa đóng gói) LICHHOC_USERDATA trỏ sang thư mục khác để kiểm thử mà không đụng dữ liệu thật
const testData = !app.isPackaged ? process.env['LICHHOC_USERDATA'] : undefined
app.setPath('userData', testData ?? join(app.getPath('appData'), 'lich-hoc'))
app.setAppUserModelId('com.lichhoc.app')

// Mở cùng Windows thì chỉ nằm khay, không bật cửa sổ chính
const startHidden = process.argv.includes('--hidden')

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', showMain)
  // Đóng hết cửa sổ vẫn giữ app chạy nền ở khay để còn nhắc giờ
  app.on('window-all-closed', () => {})

  void app.whenReady().then(() => {
    Menu.setApplicationMenu(null) // không dùng thanh menu mặc định
    registerIpc()
    registerReminderIpc()
    createTray()
    if (!startHidden) showMain()
    startScheduler(notifyClass)
    if (app.isPackaged || !process.env['LICHHOC_NO_BG']) startBackground() // LICHHOC_NO_BG: tắt việc chạy nền khi kiểm thử
    // Kiểm thử: bắn thử một lần nhắc giờ với lớp đầu tiên
    if (process.argv.includes('--test-reminder')) notifyClass(loadData().events[0], new Date())
  })
}
