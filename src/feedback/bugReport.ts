import { REPOSITORY_URL } from '../config/links'

interface BugReportContext {
  /** Seite der App, auf der der Fehler auftrat, z. B. "/formeln/kreisflaeche" */
  page?: string
  version: string
  edition: string
}

/**
 * Neues GitHub-Issue mit vorausgefüllter Vorlage. Enthält nur Seite, Version und Ausgabe,
 * keine Daten des Nutzers. Zum Absenden braucht man ein GitHub-Konto.
 */
export function bugReportUrl({ page, version, edition }: BugReportContext): string {
  const body = [
    ...(page ? [`**Seite:** ${page}`] : []),
    `**Version:** ${version} (${edition})`,
    '',
    '**Was ist passiert?**',
    '',
    '',
    '**Was hätte passieren sollen?**',
    '',
  ].join('\n')
  const params = new URLSearchParams({ title: 'Fehler: ', body })
  return `${REPOSITORY_URL}/issues/new?${params.toString()}`
}

/** Für die aktuelle App-Version und Ausgabe */
export function currentBugReportUrl(page?: string): string {
  return bugReportUrl({
    page,
    version: __APP_VERSION__,
    edition: import.meta.env.VITE_EDITION === 'internal' ? 'intern' : 'öffentlich',
  })
}
