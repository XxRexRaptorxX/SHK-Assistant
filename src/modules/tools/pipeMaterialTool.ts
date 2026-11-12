import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'
import { relatedToolsSchema } from './factorTool.ts'

// Rohrwerkstoff-Tools ("kind": "pipeMaterials"): Man wählt ein Anlagensystem (z. B. Trinkwasser), falls vorhanden
// ein Untersystem (z. B. Warmwasser) und die Verlegung (z. B. Unterputz) und bekommt die Rohrwerkstoffe mit
// Bewertung, Bedingung und Quelle. Zu jedem Werkstoff stehen Vor- und Nachteile, jeweils mit eigener Quelle.
// „Vorgeschrieben“ steht nur, wo eine Quelle den Werkstoff konkret verlangt.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')

/** Kennzeichen einer Auswahl, zu der noch kein belegter Werkstoff vorliegt */
export const CONTENT_MISSING = 'TODO: Inhalt fehlt'

/** Eine Aussage mit kurzer Quellenangabe; die Links stehen in source des Eintrags */
const statementSchema = z.strictObject({
  text: z.string().trim().min(1),
  source: z.string().trim().min(1),
})

const materialSchema = z.strictObject({
  key,
  /** pipe: Rohrwerkstoff; fitting: Werkstoff für Fittings und Verbinder, eigene Liste unter den Rohren */
  kind: z.enum(['pipe', 'fitting']).default('pipe'),
  /**
   * Nur Rohre: rigid (starr, z. B. Metallrohr als Stange) oder flexible (biegsam, z. B. Verbundrohr von der Rolle).
   * Wo die Verlegung zählt, werden Unterputz nur flexible und Aufputz nur starre Rohre empfohlen (Vorgabe des Inhabers).
   */
  form: z.enum(['rigid', 'flexible']).optional(),
  /** Name, z. B. „Edelstahl 1.4401/1.4521“ */
  name: z.string().trim().min(1),
  /** Weitere Suchbegriffe, z. B. „V4A“ */
  aliases: z.array(z.string().trim().min(1)).default([]),
  /** Kurze eigene Beschreibung */
  description: z.string().trim().min(1),
  pros: z.array(statementSchema).default([]),
  cons: z.array(statementSchema).default([]),
  /** Beispielprodukte aus den Quellen, z. B. „Viega Sanpress Inox“ */
  products: z.array(statementSchema).default([]),
  /** Veralteter Werkstoff (Marke „Veraltet“), mit Begründung und Quelle */
  outdated: statementSchema.optional(),
})

/** Empfohlene Werkstoffe je Ergebnis (System bzw. Untersystem und Verlegung) */
export const RECOMMENDED_RANGE = { min: 1, max: 3 } as const

const LEVELS = ['required', 'recommended', 'suitable', 'limited', 'avoid'] as const

const recommendationSchema = z.strictObject({
  /** key des Werkstoffs */
  material: key,
  /**
   * required: von der Quelle verlangt; recommended: von der Quelle am besten bewertet; suitable: geeignet;
   * limited: nur eingeschränkt oder unter Bedingungen geeignet; avoid: laut Quelle nicht geeignet oder nicht zulässig
   */
  level: z.enum(LEVELS),
  /** Gilt nur für diese Verlegearten (keys aus installations); leer = für alle */
  installations: z.array(key).default([]),
  /** Bedingung oder Begründung */
  note: z.string().trim().default(''),
  source: z.string().trim().min(1),
})

/** Auswahl mit Werkstoffen: Untersystem oder ein System ohne Untersysteme */
const selectionShape = {
  key,
  /** Name in der Auswahl, z. B. „Warmwasser und Zirkulation“ */
  label: z.string().trim().min(1),
  aliases: z.array(z.string().trim().min(1)).default([]),
  /** Hinweis zur Auswahl; ohne Werkstoffe beginnt er mit „TODO: Inhalt fehlt“ */
  note: z.string().trim().default(''),
  /** Vorgaben und Einsatzgrenzen, die für alle Werkstoffe gelten */
  requirements: z.array(statementSchema).default([]),
  /** Empfohlene oder vorgeschriebene Dämmung, Isolierung, Schutzrohre und Korrosionsschutz */
  protection: z.array(statementSchema).default([]),
  recommendations: z.array(recommendationSchema).default([]),
}

const subsystemSchema = z.strictObject(selectionShape)

const systemSchema = z.strictObject({
  ...selectionShape,
  /** Untersysteme; Vorgaben und Werkstoffe des Systems gelten dann für jedes Untersystem mit */
  subsystems: z.array(subsystemSchema).default([]),
})

export const pipeMaterialToolSchema = defineEntrySchema({
  kind: z.literal('pipeMaterials'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  tags: topicTagsSchema,
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  related: relatedToolsSchema,
  /** Verlegearten, z. B. Aufputz und Unterputz; die erste ist vorausgewählt */
  installations: z
    .array(z.strictObject({ key, label: z.string().trim().min(1), note: z.string().trim().default('') }))
    .min(2),
  materials: z.array(materialSchema).min(1),
  systems: z.array(systemSchema).min(1),
})

export type PipeMaterialTool = z.output<typeof pipeMaterialToolSchema>
export type PipeMaterial = PipeMaterialTool['materials'][number]
export type PipeSystem = PipeMaterialTool['systems'][number]
export type PipeSubsystem = PipeSystem['subsystems'][number]
export type PipeRecommendation = PipeSystem['recommendations'][number]
export type PipeLevel = PipeRecommendation['level']
export type PipeStatement = PipeMaterial['pros'][number]

/** Was zur Stellung von System, Untersystem und Verlegung angezeigt wird */
export interface PipeSelectionResult {
  /** Hinweise von System und Untersystem, leere weggelassen */
  notes: string[]
  /** Eine der Auswahlen hat noch keinen Inhalt */
  missing: boolean
  requirements: PipeStatement[]
  protection: PipeStatement[]
  /** Werkstoffe (Rohre und Fittings) für diese Verlegung, Vorgeschriebenes zuerst, Ungeeignetes zuletzt */
  recommendations: PipeRecommendation[]
}

const appliesTo = (recommendation: PipeRecommendation, installation: string) =>
  recommendation.installations.length === 0 || recommendation.installations.includes(installation)

/** Werkstoffe für System (+ Untersystem) und Verlegung; innerhalb einer Stufe wie im Inhalt, System vor Untersystem */
export function pipeSelection(
  system: PipeSystem,
  subsystem: PipeSubsystem | undefined,
  installation: string,
): PipeSelectionResult {
  const parts = subsystem ? [system, subsystem] : [system]
  const all = parts.flatMap((part) => part.recommendations).filter((entry) => appliesTo(entry, installation))
  return {
    notes: parts.map((part) => part.note).filter(Boolean),
    missing: parts.some((part) => part.note.startsWith(CONTENT_MISSING)),
    requirements: parts.flatMap((part) => part.requirements),
    protection: parts.flatMap((part) => part.protection),
    recommendations: LEVELS.flatMap((level) => all.filter((entry) => entry.level === level)),
  }
}

/** Hängt die Bewertung bei dieser Auswahl von der Verlegung ab? Nur dann wird die Verlegung abgefragt */
export function installationRelevant(system: PipeSystem, subsystem: PipeSubsystem | undefined): boolean {
  const parts = subsystem ? [system, subsystem] : [system]
  return parts.some((part) => part.recommendations.some((entry) => entry.installations.length > 0))
}

function duplicates(values: string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
}

export function checkPipeMaterialTool(tool: PipeMaterialTool): string[] {
  const issues: string[] = []
  const installationKeys = tool.installations.map((installation) => installation.key)
  const materialKeys = tool.materials.map((material) => material.key)
  for (const value of duplicates(installationKeys)) issues.push(`installations: key "${value}" doppelt vergeben`)
  for (const value of duplicates(materialKeys)) issues.push(`materials: key "${value}" doppelt vergeben`)
  for (const value of duplicates(tool.systems.map((system) => system.key))) issues.push(`systems: key "${value}" doppelt vergeben`)

  const used = new Set<string>()
  const materialByKey = new Map(tool.materials.map((material) => [material.key, material]))
  const isPipe = (entry: PipeRecommendation) => materialByKey.get(entry.material)?.kind !== 'fitting'
  for (const material of tool.materials) {
    if (material.kind === 'pipe' && !material.form) issues.push(`materials (${material.name}): form fehlt (rigid oder flexible)`)
    if (material.kind === 'fitting' && material.form) issues.push(`materials (${material.name}): form nur bei Rohren`)
  }
  /** Wo die Verlegung zählt: Unterputz nur flexible, Aufputz nur starre Rohre empfehlen */
  const formFor: Record<string, 'rigid' | 'flexible'> = { aufputz: 'rigid', unterputz: 'flexible' }
  const checkRecommendations = (where: string, recommendations: PipeRecommendation[], byInstallation: boolean) => {
    for (const recommendation of recommendations) {
      used.add(recommendation.material)
      if (!materialKeys.includes(recommendation.material)) issues.push(`${where}: unbekannter Werkstoff "${recommendation.material}"`)
      for (const installation of recommendation.installations) {
        if (!installationKeys.includes(installation)) issues.push(`${where}: unbekannte Verlegeart "${installation}"`)
      }
      // Bedingung oder Grund muss dabeistehen, sonst liest sich Pflicht, Empfehlung, Einschränkung oder Verbot wie eine allgemeine Regel
      if (recommendation.level !== 'suitable' && !recommendation.note) {
        issues.push(`${where}: "${recommendation.material}" (${recommendation.level}) braucht note`)
      }
    }
    for (const installation of installationKeys) {
      const applying = recommendations.filter((entry) => appliesTo(entry, installation))
      // Derselbe Werkstoff darf je Verlegeart nur einmal bewertet sein
      for (const value of duplicates(applying.map((entry) => entry.material))) {
        issues.push(`${where}: Werkstoff "${value}" bei "${installation}" doppelt`)
      }
      // Jedes Ergebnis mit Rohren nennt 1–3 empfohlene Rohre; Fittings zählen nicht mit
      const pipes = applying.filter(isPipe)
      const recommendedPipes = pipes.filter((entry) => entry.level === 'recommended')
      const recommended = recommendedPipes.length
      if (pipes.length > 0 && (recommended < RECOMMENDED_RANGE.min || recommended > RECOMMENDED_RANGE.max)) {
        issues.push(
          `${where}: bei "${installation}" ${recommended} Empfehlungen, erlaubt ${RECOMMENDED_RANGE.min}–${RECOMMENDED_RANGE.max}`,
        )
      }
      const wanted = formFor[installation]
      if (byInstallation && wanted) {
        for (const entry of recommendedPipes) {
          const form = materialByKey.get(entry.material)?.form
          if (form && form !== wanted) {
            issues.push(`${where}: bei "${installation}" wird "${entry.material}" (${form}) empfohlen, erlaubt nur ${wanted}`)
          }
        }
      }
    }
  }
  const checkMissing = (where: string, note: string, hasContent: boolean) => {
    const missing = note.startsWith(CONTENT_MISSING)
    if (!hasContent && !missing) issues.push(`${where}: keine Werkstoffe und kein „${CONTENT_MISSING}“`)
    if (missing && tool.status === 'verified') issues.push(`${where}: „${CONTENT_MISSING}“ ist bei verified nicht erlaubt`)
  }

  for (const system of tool.systems) {
    const where = `systems (${system.label})`
    for (const value of duplicates(system.subsystems.map((subsystem) => subsystem.key))) {
      issues.push(`${where}: Untersystem-key "${value}" doppelt vergeben`)
    }
    if (system.subsystems.length === 0) {
      checkMissing(where, system.note, system.recommendations.length > 0)
      checkRecommendations(where, system.recommendations, installationRelevant(system, undefined))
    } else {
      if (system.note.startsWith(CONTENT_MISSING)) issues.push(`${where}: „${CONTENT_MISSING}“ gehört ans Untersystem`)
      for (const subsystem of system.subsystems) {
        const subWhere = `${where} > ${subsystem.label}`
        checkMissing(subWhere, subsystem.note, system.recommendations.length + subsystem.recommendations.length > 0)
        checkRecommendations(
          subWhere,
          [...system.recommendations, ...subsystem.recommendations],
          installationRelevant(system, subsystem),
        )
      }
    }
  }
  for (const material of tool.materials) {
    if (!used.has(material.key)) issues.push(`materials (${material.name}): nirgends verwendet`)
  }
  return issues
}

/** Suchbegriffe für die globale Suche */
export function pipeMaterialKeywords(tool: PipeMaterialTool): string[] {
  return [
    ...tool.installations.map((installation) => installation.label),
    ...tool.materials.flatMap((material) => [
      material.name,
      ...material.aliases,
      ...material.products.map((product) => product.text),
    ]),
    ...tool.systems.flatMap((system) => [
      system.label,
      ...system.aliases,
      ...system.subsystems.flatMap((subsystem) => [subsystem.label, ...subsystem.aliases]),
    ]),
  ]
}
