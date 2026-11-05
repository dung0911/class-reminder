import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const shared = resolve('src/shared')

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': shared } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': shared } }
  },
  renderer: {
    root: resolve('src/renderer'),
    resolve: { alias: { '@shared': shared, '@': resolve('src/renderer/src') } },
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        // Hai trang: cửa sổ chính và popup nhắc giờ
        input: {
          index: resolve('src/renderer/index.html'),
          reminder: resolve('src/renderer/reminder.html')
        }
      }
    }
  }
})
