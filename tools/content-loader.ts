import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { Edition } from '../src/config/editions.ts'
import type { BaseEntry, CollectionDefinition } from '../src/content/schema/base.ts'

z.config(z.locales.de())

export class ContentValidationError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super(
      `Inhaltsvalidierung fehlgeschlagen (${issues.length} Fehler):\n` +
        issues.map((issue) => `  - ${issue}`).join('\n'),
    )
    this.name = 'ContentValidationError'
    this.issues = issues
  }
}

export interface LoadContentOptions {
  contentDir: string
  edition: Edition
  collections: Record<string, CollectionDefinition>
}

export interface LoadedContent {
  /** Pro Sammlung die Einträge, die in der Edition enthalten sind (nach id sortiert) */
  data: Record<string, BaseEntry[]>
  /** Alle Einträge unabhängig von der Edition, z. B. für den Public-Bundle-Test */
  allEntries: BaseEntry[]
}

export function isIncludedInEdition(entry: BaseEntry, edition: Edition): boolean {
  return edition === 'internal' || entry.visibility === 'public'
}

/** JSON-Dateien eines Ordners; Begleitdateien (attachmentExtension) sind erlaubt, wenn ihr .json existiert. */
function listJsonFiles(dir: string, issues: string[], contentDir: string, attachmentExtension?: string): string[] {
  const files: string[] = []
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    if (dirent.name.startsWith('.')) continue
    const fullPath = path.join(dir, dirent.name)
    if (dirent.isDirectory()) {
      files.push(...listJsonFiles(fullPath, issues, contentDir, attachmentExtension))
    } else if (dirent.name.endsWith('.json')) {
      files.push(fullPath)
    } else if (attachmentExtension && dirent.name.endsWith(attachmentExtension)) {
      const json = fullPath.slice(0, -attachmentExtension.length) + '.json'
      if (!existsSync(json)) issues.push(`${relative(contentDir, fullPath)}: zugehörige .json-Datei fehlt`)
    } else {
      const allowed = attachmentExtension ? `.json- und ${attachmentExtension}-Dateien` : '.json-Dateien'
      issues.push(`${relative(contentDir, fullPath)}: nur ${allowed} erlaubt`)
    }
  }
  return files.sort()
}

/** Liest die Begleitdatei (z. B. .svg) in das konfigurierte Feld; fehlt sie, meldet das Schema das Feld. */
function withAttachment(raw: unknown, file: string, attachment: { extension: string; field: string } | undefined) {
  if (!attachment || typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw
  const attached = file.slice(0, -'.json'.length) + attachment.extension
  if (!existsSync(attached)) return raw
  return { ...raw, [attachment.field]: readFileSync(attached, 'utf8') }
}

function relative(contentDir: string, file: string): string {
  return path.relative(contentDir, file).split(path.sep).join('/')
}

function formatPath(issuePath: PropertyKey[]): string {
  return issuePath.length > 0 ? `${issuePath.map(String).join('.')}: ` : ''
}

/**
 * Liest alle Inhalte aus contentDir, validiert sie und filtert nach Edition.
 * Wirft ContentValidationError mit allen gefundenen Fehlern auf einmal.
 */
export function loadContent({ contentDir, edition, collections }: LoadContentOptions): LoadedContent {
  const issues: string[] = []
  const data: Record<string, BaseEntry[]> = {}
  const allEntries: BaseEntry[] = []
  const idToFile = new Map<string, string>()
  const references: { file: string; from: string; to: string }[] = []

  const knownDirs = new Set(Object.values(collections).map((c) => c.dir))
  if (existsSync(contentDir)) {
    for (const dirent of readdirSync(contentDir, { withFileTypes: true })) {
      if (dirent.isDirectory() && !dirent.name.startsWith('.') && !knownDirs.has(dirent.name)) {
        issues.push(`${dirent.name}/: unbekannter Inhaltsordner (nicht in src/content/collections.ts registriert)`)
      }
    }
  }

  for (const [name, collection] of Object.entries(collections)) {
    const dir = path.join(contentDir, collection.dir)
    const files = existsSync(dir) ? listJsonFiles(dir, issues, contentDir, collection.attachment?.extension) : []
    const entries: BaseEntry[] = []

    for (const file of files) {
      const rel = relative(contentDir, file)

      let raw: unknown
      try {
        raw = JSON.parse(readFileSync(file, 'utf8'))
      } catch (error) {
        issues.push(`${rel}: ungültiges JSON (${(error as Error).message})`)
        continue
      }

      const result = collection.schema.safeParse(withAttachment(raw, file, collection.attachment))
      if (!result.success) {
        for (const issue of result.error.issues) {
          issues.push(`${rel}: ${formatPath(issue.path)}${issue.message}`)
        }
        continue
      }

      const entry = result.data
      if (!entry.id.startsWith(`${collection.idPrefix}.`)) {
        issues.push(`${rel}: id "${entry.id}" muss mit "${collection.idPrefix}." beginnen`)
      }
      const existing = idToFile.get(entry.id)
      if (existing) {
        issues.push(`${rel}: id "${entry.id}" ist bereits in ${existing} vergeben`)
      } else {
        idToFile.set(entry.id, rel)
      }
      for (const message of collection.check?.(entry) ?? []) {
        issues.push(`${rel}: ${message}`)
      }
      for (const to of collection.references?.(entry) ?? []) {
        references.push({ file: rel, from: entry.id, to })
      }
      entries.push(entry)
    }

    // Reihenfolge im Register zählt: z. B. Einheiten vor Formeln
    issues.push(...(collection.prepare?.(entries) ?? []))
    entries.sort((a, b) => a.id.localeCompare(b.id))
    allEntries.push(...entries)
    data[name] = entries.filter((entry) => isIncludedInEdition(entry, edition))
  }

  // Erst nach dem Laden aller Sammlungen prüfbar
  for (const { file, from, to } of references) {
    if (to === from) issues.push(`${file}: "${from}" verweist auf sich selbst`)
    else if (!idToFile.has(to)) issues.push(`${file}: Verweis auf unbekannte id "${to}"`)
  }

  if (issues.length > 0) throw new ContentValidationError(issues)
  return { data, allEntries }
}
