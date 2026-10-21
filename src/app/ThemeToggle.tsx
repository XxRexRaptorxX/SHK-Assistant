import { MoonIcon, SunIcon, SystemThemeIcon } from '../components/icons'
import { nextThemePreference, THEME_LABELS } from '../theme/theme'
import { useTheme } from '../theme/useTheme'

const ICONS = { system: SystemThemeIcon, light: SunIcon, dark: MoonIcon }

export function ThemeToggle({ className }: { className: string }) {
  const { preference, setPreference } = useTheme()
  const Icon = ICONS[preference]
  const next = nextThemePreference(preference)
  const label = `Darstellung: ${THEME_LABELS[preference]}. Wechseln zu ${THEME_LABELS[next]}`

  return (
    <button
      type="button"
      className={className}
      onClick={() => setPreference(next)}
      aria-label={label}
      title={label}
    >
      <Icon className="size-7" />
    </button>
  )
}
