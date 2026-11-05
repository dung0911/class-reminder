import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/types'

/** Đăng ký nghe một sự kiện từ main, trả về hàm huỷ đăng ký */
function listen<T extends unknown[]>(channel: string, cb: (...args: T) => void): () => void {
  const handler = (_e: Electron.IpcRendererEvent, ...args: unknown[]): void => cb(...(args as T))
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: Api = {
  getData: () => ipcRenderer.invoke('data:get'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),
  join: (ev) => ipcRenderer.invoke('class:join', ev),
  getAutostart: () => ipcRenderer.invoke('autostart:get'),
  setAutostart: (on) => ipcRenderer.invoke('autostart:set', on),
  reminderInfo: () => ipcRenderer.invoke('reminder:info'),
  reminderAction: (action) => ipcRenderer.invoke('reminder:action', action),
  onToast: (cb) => listen<[string]>('toast', cb),
  onDataChanged: (cb) => listen('data:changed', cb),
  i18nLoad: (lang) => ipcRenderer.invoke('i18n:load', lang),
  openLocalesFolder: () => ipcRenderer.invoke('i18n:openFolder'),
  setWindowTheme: (theme) => ipcRenderer.invoke('window:theme', theme),
  encryptSecret: (plain) => ipcRenderer.invoke('secret:encrypt', plain),
  copySecret: (enc) => ipcRenderer.invoke('secret:copy', enc),
  revealSecret: (enc) => ipcRenderer.invoke('secret:reveal', enc),
  copyText: (text) => ipcRenderer.invoke('text:copy', text),
  openUrl: (url) => ipcRenderer.invoke('url:open', url),
  openSite: (siteId) => ipcRenderer.invoke('site:open', siteId),
  recipeRecord: (siteId) => ipcRenderer.invoke('recipe:record', siteId),
  recipeRun: (siteId) => ipcRenderer.invoke('recipe:run', siteId),
  syncDaymai: () => ipcRenderer.invoke('daymai:sync'),
  googleStatus: () => ipcRenderer.invoke('google:status'),
  googleSetConfig: (cfg) => ipcRenderer.invoke('google:config', cfg),
  googleConnect: () => ipcRenderer.invoke('google:connect'),
  googleDisconnect: () => ipcRenderer.invoke('google:disconnect'),
  googleSync: () => ipcRenderer.invoke('google:sync'),
  exportIcs: () => ipcRenderer.invoke('ics:export')
}

contextBridge.exposeInMainWorld('api', api)
