import type { ReactNode } from 'react'
import { primaryButton, secondaryButton } from '../components/buttons'
import { showAllHidden, useHiddenIds } from '../hidden/hiddenStore'
import { CompanyLogo } from '../components/CompanyLogo'
import { MoonIcon, SunIcon, SystemThemeIcon } from '../components/icons'
import { content } from '../content'
import { isInternalEdition } from '../config/edition'
import { usePageTitle } from '../lib/usePageTitle'
import { THEME_LABELS, THEME_PREFERENCES, type ThemePreference } from '../theme/theme'
import { useTheme } from '../theme/useTheme'
import { detectPlatform, promptInstall, useInstallState, type Platform } from './install'
import { updateSettings, useSettings } from './settings'
import { pageTitle } from '../components/headings'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 border-t-2 border-line pt-4 first-of-type:border-t-0 first-of-type:pt-0">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

/** Großer Schalter (an/aus), mit Handschuhen bedienbar */
export function Switch({ label, description, checked, onChange }: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-edge bg-surface p-4 text-left"
    >
      <span>
        <span className="block font-semibold">{label}</span>
        {description && <span className="mt-1 block text-base text-muted">{description}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-9 w-16 shrink-0 items-center rounded-full border-2 transition-colors ${
          checked ? 'border-accent bg-accent' : 'border-line bg-page'
        }`}
      >
        <span
          className={`inline-block size-6 rounded-full transition-transform ${
            checked ? 'translate-x-8 bg-accent-ink' : 'translate-x-1 bg-line'
          }`}
        />
      </span>
    </button>
  )
}

/** Anzahl ausgeblendeter Formeln/Umrechner und Knopf, um alle wieder einzublenden */
function HiddenEntries() {
  const count = useHiddenIds().size
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-edge bg-surface p-4">
      <span>
        <span className="block font-semibold">Ausgeblendete Einträge</span>
        <span className="mt-1 block text-base text-muted">
          {count === 0
            ? 'Keine. Formeln und Umrechner lassen sich über das Auge auf ihrer Seite ausblenden.'
            : `${count} ${count === 1 ? 'Eintrag ist' : 'Einträge sind'} in den Listen ausgeblendet.`}
        </span>
      </span>
      <button type="button" className={secondaryButton} disabled={count === 0} onClick={showAllHidden}>
        Alle einblenden
      </button>
    </div>
  )
}

const THEME_ICONS = { system: SystemThemeIcon, light: SunIcon, dark: MoonIcon }

function ThemeChoice({ value, onChange }: { value: ThemePreference; onChange: (value: ThemePreference) => void }) {
  return (
    <div role="radiogroup" aria-label="Darstellung" className="grid grid-cols-3 gap-2">
      {THEME_PREFERENCES.map((option) => {
        const Icon = THEME_ICONS[option]
        const selected = option === value
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 font-semibold ${
              selected ? 'border-accent bg-accent text-accent-ink' : 'border-edge bg-surface'
            }`}
          >
            <Icon className="size-7" />
            {THEME_LABELS[option]}
          </button>
        )
      })}
    </div>
  )
}

const INSTALL_GUIDES: Record<Platform, { title: string; steps: string[] }> = {
  ios: {
    title: 'iPhone und iPad (Safari)',
    steps: [
      'Die App in Safari öffnen.',
      'Unten (iPad: oben) auf das Teilen-Symbol tippen (Quadrat mit Pfeil nach oben).',
      '„Zum Home-Bildschirm“ wählen und mit „Hinzufügen“ bestätigen.',
    ],
  },
  android: {
    title: 'Android (Chrome, Samsung Internet, Firefox)',
    steps: [
      'Das Browser-Menü öffnen (⋮ oben rechts bzw. ≡ unten).',
      '„App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen.',
      'Mit „Installieren“ bzw. „Hinzufügen“ bestätigen.',
    ],
  },
  desktop: {
    title: 'Computer (Chrome, Edge)',
    steps: [
      'Rechts in der Adressleiste auf das Installieren-Symbol klicken.',
      'Alternativ im Menü (⋮ bzw. …) „App installieren“ wählen.',
    ],
  },
}

function Guide({ platform }: { platform: Platform }) {
  const guide = INSTALL_GUIDES[platform]
  return (
    <ol className="mt-2 list-decimal space-y-1 pl-6">
      {guide.steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  )
}

function InstallSection() {
  const { installed, canPrompt } = useInstallState()
  const platform = typeof navigator === 'undefined' ? 'desktop' : detectPlatform(navigator.userAgent, navigator.maxTouchPoints)
  const others = (Object.keys(INSTALL_GUIDES) as Platform[]).filter((p) => p !== platform)

  if (installed) {
    return <p className="font-semibold">✓ Die App ist auf diesem Gerät installiert und funktioniert auch ohne Internet.</p>
  }
  return (
    <>
      <p className="text-base text-muted">
        Installiert startet die App wie eine normale App vom Startbildschirm, ohne Browserleiste, und
        funktioniert auch ohne Internet.
      </p>
      {canPrompt && (
        <button type="button" className={`${primaryButton} mt-3 w-full`} onClick={() => void promptInstall()}>
          App installieren
        </button>
      )}
      <h3 className="mt-4 font-semibold">{INSTALL_GUIDES[platform].title}</h3>
      <Guide platform={platform} />
      <details className="mt-4">
        <summary className="min-h-12 cursor-pointer py-3 font-semibold">Anleitung für andere Geräte</summary>
        {others.map((p) => (
          <div key={p} className="mt-2">
            <h3 className="font-semibold">{INSTALL_GUIDES[p].title}</h3>
            <Guide platform={p} />
          </div>
        ))}
      </details>
    </>
  )
}

function AboutSection() {
  const counts: [string, number][] = [
    ['Formeln', content.formulas.length],
    ['Umrechner', content.converter.length],
    ['Checklisten', content.checklists.length],
    ['Lexikon-Einträge', content.lexicon.length],
  ]
  return (
    <>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-base">
        <dt className="font-semibold">Version</dt>
        <dd>{__APP_VERSION__}</dd>
        <dt className="font-semibold">Ausgabe</dt>
        <dd>{isInternalEdition ? 'Intern' : 'Öffentlich'}</dd>
        {counts.map(([label, count]) => (
          <div key={label} className="contents">
            <dt className="font-semibold">{label}</dt>
            <dd>{count}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4">
        <CompanyLogo />
      </div>
    </>
  )
}

export function SettingsPage() {
  usePageTitle('Einstellungen')
  const settings = useSettings()
  const { preference, setPreference } = useTheme()

  return (
    <>
      <h1 className={pageTitle}>Einstellungen</h1>
      <div className="mt-4">
        <Section title="Grundeinstellungen">
          <Switch
            label="Unübliche Einheiten ausblenden"
            description="Zeigt im Umrechner nur die gebräuchlichen Einheiten, z. B. ohne ft, psi oder µV. Standard: aus."
            checked={settings.hideRareUnits}
            onChange={(hideRareUnits) => updateSettings({ hideRareUnits })}
          />
          <div className="mt-3">
            <Switch
              label="Einheiten ausgeschrieben anzeigen"
              description="Zeigt im Umrechner hinter jeder Einheit grau den vollen Namen, z. B. „hl Hektoliter“. Standard: an."
              checked={settings.showUnitNames}
              onChange={(showUnitNames) => updateSettings({ showUnitNames })}
            />
          </div>
          <HiddenEntries />
        </Section>
        <Section title="Design">
          <ThemeChoice value={preference} onChange={setPreference} />
          <p className="mt-2 text-base text-muted">Standard: Dunkel. „System“ folgt der Einstellung des Handys (hell/dunkel).</p>
        </Section>
        <Section title="App auf den Startbildschirm">
          <InstallSection />
        </Section>
        <Section title="Über die App">
          <AboutSection />
        </Section>
      </div>
    </>
  )
}
