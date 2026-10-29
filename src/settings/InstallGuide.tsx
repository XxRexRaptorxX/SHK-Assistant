import { detectPlatform, type Platform } from './install'

/** Schritte zum Installieren je Gerät (Einstellungen und Installations-Hinweis) */
export const INSTALL_GUIDES: Record<Platform, { title: string; steps: string[] }> = {
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

export function InstallGuide({ platform }: { platform: Platform }) {
  const guide = INSTALL_GUIDES[platform]
  return (
    <ol className="mt-2 list-decimal space-y-1 pl-6">
      {guide.steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  )
}

/** Gerät des Nutzers; ohne Browser (Tests) „desktop“ */
export function currentPlatform(): Platform {
  return typeof navigator === 'undefined' ? 'desktop' : detectPlatform(navigator.userAgent, navigator.maxTouchPoints)
}
