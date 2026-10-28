// Meldung eines Inhaltsfehlers per E-Mail: die App füllt Empfänger, Betreff und Angaben zum
// Eintrag vor, gesendet wird aus dem Mailprogramm des Nutzers (keine Anmeldung, kein Server).

/** Beschreibung: mindestens so viele Zeichen, damit die Meldung verwertbar ist */
export const REPORT_MIN_LENGTH = 10
/** Höchstens so viele Zeichen; längere mailto-Adressen schneiden manche Mailprogramme ab */
export const REPORT_MAX_LENGTH = 800
/** Missbrauchsschutz: höchstens so viele Meldungen je Gerät … */
export const REPORT_LIMIT = 5
/** … innerhalb dieses Zeitraums */
export const REPORT_WINDOW_MS = 60 * 60 * 1000

export interface ContentReport {
  to: string
  id: string
  title: string
  /** Vollständige Adresse der Seite */
  url: string
  version: string
  edition: string
  /** z. B. „geprüft am 28.10.2026 (RR)“ oder „ungeprüft“ */
  state: string
  message: string
}

/** Beschreibung prüfen; liefert den Grund, warum sie (noch) nicht gesendet werden kann */
export function messageIssue(message: string): string | undefined {
  const length = message.trim().length
  if (length < REPORT_MIN_LENGTH) return `Bitte beschreibe den Fehler (mindestens ${REPORT_MIN_LENGTH} Zeichen).`
  if (length > REPORT_MAX_LENGTH) return `Bitte kürze die Beschreibung auf höchstens ${REPORT_MAX_LENGTH} Zeichen.`
  return undefined
}

/** mailto-Adresse mit Betreff (Titel und Kennung) und Angaben zum Eintrag unter der Beschreibung */
export function contentReportMailto(report: ContentReport): string {
  const subject = `Inhaltsfehler: ${report.title} (${report.id})`
  // Zeilenumbrüche als CRLF, wie RFC 6068 es für mailto vorsieht
  const body = [
    report.message.trim(),
    '',
    '---',
    `Eintrag: ${report.title}`,
    `Kennung: ${report.id}`,
    `Seite: ${report.url}`,
    `Stand: ${report.state}`,
    `App-Version: ${report.version} (${report.edition})`,
  ].join('\r\n')
  return `mailto:${report.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/** Zeitpunkte der Meldungen, die noch im Zeitraum liegen */
export function recentReports(timestamps: readonly number[], now: number): number[] {
  return timestamps.filter((time) => time <= now && now - time < REPORT_WINDOW_MS)
}

/** Wann wieder gemeldet werden darf; undefined, wenn sofort */
export function nextReportAllowedAt(timestamps: readonly number[], now: number): number | undefined {
  const recent = recentReports(timestamps, now).sort((a, b) => a - b)
  if (recent.length < REPORT_LIMIT) return undefined
  return recent[recent.length - REPORT_LIMIT]! + REPORT_WINDOW_MS
}

const STORAGE_KEY = 'shk-content-reports'

/** Gespeicherte Zeitpunkte; ohne oder mit kaputtem Speicher leer */
export function loadReportTimes(): number[] {
  try {
    const parsed: unknown = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is number => typeof item === 'number') : []
  } catch {
    return []
  }
}

/** Meldung vermerken (nur die Zeitpunkte im Zeitraum bleiben gespeichert) */
export function recordReport(now: number): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify([...recentReports(loadReportTimes(), now), now]))
  } catch {
    // ohne Speicher keine Begrenzung über das Neuladen hinaus
  }
}
