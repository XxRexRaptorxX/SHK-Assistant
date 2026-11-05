// Ohne Importe, damit auch vite.config.ts und die Build-Werkzeuge diese Liste nutzen können.

/** Name der App, wie er überall angezeigt wird */
export const APP_NAME = 'SHK-Assistant'

/**
 * Andere Schreibweisen, unter denen die App gefunden werden soll.
 * Landen als alternateName in den strukturierten Daten (Schema.org).
 */
export const APP_ALTERNATE_NAMES = ['SHK Assistent', 'SHK Assistant', 'SHK-Assistent'] as const

/** Titel der Startseite (index.html, Browser-Tab, Vorschau beim Teilen) */
export const HOME_TITLE = `${APP_NAME} – Digitaler SHK Assistent für Heizungsbauer`

/** Hauptüberschrift der Startseite, aufgeteilt in Name und Zusatz */
export const HOME_HEADING = { name: APP_NAME, tagline: 'Dein digitaler SHK Assistent' } as const

/** Beschreibung der Startseite (meta description, Vorschau, strukturierte Daten, Text ohne JavaScript) */
export const SITE_DESCRIPTION =
  'SHK-Assistant ist dein digitaler SHK Assistent für das Sanitär-, Heizungs- und Klimatechnik-Handwerk. Nutze Formeln, Rechner, Umrechner, Checklisten und ein umfangreiches SHK-Lexikon – auch offline.'

/**
 * Bereiche mit statischen Seiten für Suchmaschinen (tools/seo-pages.ts).
 * dir entspricht der Route in der App (src/app/modules.ts). Die Fachmann-Codes fehlen bewusst:
 * sie liegen hinter der PIN-Abfrage und gehören nicht in den Suchindex.
 */
export const SEO_SECTIONS = [
  { collection: 'lexicon', dir: 'lexikon', title: 'Lexikon', heading: 'SHK-Lexikon: Bauteile und Begriffe' },
  { collection: 'checklists', dir: 'checklisten', title: 'Checklisten', heading: 'Checklisten für Wartung und Prüfungen' },
  { collection: 'converter', dir: 'umrechner', title: 'Umrechner', heading: 'Umrechner für Einheiten und Größen' },
  { collection: 'formulas', dir: 'formeln', title: 'Formeln', heading: 'Formelsammlung für Heizungsbauer' },
  { collection: 'tools', dir: 'tools', title: 'Tools', heading: 'Tools für die Praxis' },
] as const

export type SeoSection = (typeof SEO_SECTIONS)[number]

/** Dateien auf oberster Ebene, die nur für Suchmaschinen da sind */
export const SEO_ROOT_FILES = ['robots.txt', 'sitemap.xml'] as const

/** Gehört die Datei im Build zu den Suchmaschinen-Seiten? Diese Dateien bleiben außerhalb des Offline-Caches. */
export function isSeoFile(file: string): boolean {
  return (
    (SEO_ROOT_FILES as readonly string[]).includes(file) ||
    SEO_SECTIONS.some((section) => file.startsWith(`${section.dir}/`))
  )
}

/** Prüft die Adresse aus VITE_SITE_URL und liefert sie mit genau einem "/" am Ende. */
export function parseSiteUrl(value: string | undefined): string {
  if (!value || !/^https?:\/\/[^/\s]+/.test(value)) {
    throw new Error(`Ungültige Adresse: VITE_SITE_URL="${value ?? ''}". Erwartet z. B. https://example.org/app/`)
  }
  return `${value.replace(/\/+$/, '')}/`
}
