import type { ThemeMode } from '@shared/types'
import { useI18n } from '@/lib/i18n'

interface Props {
  theme: ThemeMode
  lang: string
  onToggleSidebar: () => void
  onTheme: (m: ThemeMode) => void
  onLang: (code: string) => void
}

const MODES: { id: ThemeMode; icon: string }[] = [
  { id: 'light', icon: '☀️' },
  { id: 'system', icon: '🖥️' },
  { id: 'dark', icon: '🌙' }
]

/**
 * Thanh trên cùng tự vẽ (thay cho thanh tiêu đề của Windows). Vùng trống kéo được để di chuyển cửa sổ.
 * Bên phải chừa chỗ cho 3 nút thu nhỏ / phóng to / đóng của hệ thống.
 */
export default function TitleBar({ theme, lang, onToggleSidebar, onTheme, onLang }: Props): React.JSX.Element {
  const { t, languages } = useI18n()
  return (
    <header className="drag flex h-11 shrink-0 items-center gap-2.5 border-b border-line bg-bar pl-3 pr-36">
      <button
        className="no-drag flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-ink"
        onClick={onToggleSidebar}
        title={t('header.toggleSidebar')}
      >
        ☰
      </button>
      <span className="btn-accent flex h-6 w-6 items-center justify-center rounded-md text-sm">🎓</span>
      <span className="text-sm font-bold tracking-tight">{t('app.name')}</span>
      <span className="flex-1" />

      <select
        value={lang}
        onChange={(e) => onLang(e.target.value)}
        title={t('header.language')}
        className="no-drag h-7 rounded-lg border border-line bg-field px-2 text-xs font-medium text-ink outline-none hover:border-accent"
      >
        {languages.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>

      <div className="seg no-drag !p-0.5" title={t('header.theme')}>
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => onTheme(m.id)}
            title={t(`theme.${m.id}`)}
            className={`flex h-6 w-7 items-center justify-center rounded-md text-xs transition ${
              theme === m.id ? 'bg-card shadow-sm' : 'opacity-60 hover:opacity-100'
            }`}
          >
            {m.icon}
          </button>
        ))}
      </div>
    </header>
  )
}
