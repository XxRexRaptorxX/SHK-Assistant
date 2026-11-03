// Ohne Importe, damit auch vite.config.ts und die Build-Werkzeuge diese Liste nutzen können.

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
