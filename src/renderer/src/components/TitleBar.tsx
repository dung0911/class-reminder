import type { ThemeMode } from '@shared/types'
import { useI18n } from '@/lib/i18n'

interface Props {
  theme: ThemeMode
  lang: string
  onToggleSidebar: () => void
  onTheme: (m: ThemeMode) => void
  onLang: (code: string) => void
}

const NEXT: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' }
const ICON: Record<ThemeMode, string> = { system: '🖥️', light: '☀️', dark: '🌙' }

/**
 * Thanh trên cùng tự vẽ (thay cho thanh tiêu đề của Windows). Vùng trống kéo được để di chuyển cửa sổ.
 * Bên phải chừa chỗ cho 3 nút thu nhỏ / phóng to / đóng của hệ thống.
 */
export default function TitleBar({ theme, lang, onToggleSidebar, onTheme, onLang }: Props): React.JSX.Element {
  const { t, languages } = useI18n()
  const btn = 'no-drag flex h-8 items-center justify-center rounded-lg px-2 text-base hover:bg-hover'
  return (
    <header className="drag flex h-11 shrink-0 items-center gap-2 border-b border-line bg-bar pl-3 pr-36">
      <button className={btn} onClick={onToggleSidebar} title={t('header.toggleSidebar')}>
        ☰
      </button>
      <span className="text-lg">🎓</span>
      <span className="font-semibold">{t('app.name')}</span>
      <span className="flex-1" />
      <select
        value={lang}
        onChange={(e) => onLang(e.target.value)}
        title={t('header.language')}
        className="no-drag h-8 rounded-lg border border-line bg-field px-2 text-sm text-ink outline-none"
      >
        {languages.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>
      <button className={btn} onClick={() => onTheme(NEXT[theme])} title={`${t('header.theme')}: ${t(`theme.${theme}`)}`}>
        {ICON[theme]}
      </button>
    </header>
  )
}
