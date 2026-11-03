import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'

// Aderfarben-Tools ("kind": "wireColors"): System, Kabeltyp und Aderzahl wählen und sehen, welche Farbe
// üblicherweise wofür genutzt wird. Angeboten wird nur, was der Inhalt belegt: Eine Kombination ohne
// Zuordnung erscheint nicht in der Auswahl.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')

/** Name und Darstellung der Aderfarben; gestreift ist die Mischfarbe Grün-Gelb */
export const WIRE_COLORS = {
  gruenGelb: { name: 'Grün-Gelb', swatch: 'repeating-linear-gradient(45deg, #2e9e3f 0 6px, #f0c800 6px 12px)' },
  blau: { name: 'Blau', swatch: '#2271b3' },
  braun: { name: 'Braun', swatch: '#7a4a22' },
  schwarz: { name: 'Schwarz', swatch: '#0a0a0a' },
  grau: { name: 'Grau', swatch: '#8f999f' },
  rot: { name: 'Rot', swatch: '#c8281c' },
  weiss: { name: 'Weiß', swatch: '#ffffff' },
  gruen: { name: 'Grün', swatch: '#2e9e3f' },
  gelb: { name: 'Gelb', swatch: '#f0c800' },
  rosa: { name: 'Rosa', swatch: '#f4a6c0' },
  violett: { name: 'Violett', swatch: '#7d4fa3' },
} as const

export type WireColor = keyof typeof WIRE_COLORS

const wireSchema = z.strictObject({
  color: z.enum(Object.keys(WIRE_COLORS) as [WireColor, ...WireColor[]]),
  /** Wofür die Ader genutzt wird, z. B. „Neutralleiter (N)“ */
  use: z.string().trim().min(1),
  /** Zusatz, z. B. „Empfehlung des ZVEH, keine Normvorgabe“ */
  note: z.string().trim().default(''),
})

const assignmentSchema = z.strictObject({
  /** key des Systems */
  system: key,
  /** keys der Kabeltypen, für die diese Belegung gilt */
  cables: z.array(key).min(1),
  /** Aderzahl in der Leiste, z. B. „3“, „6+“, „Einzeln“ oder „2 Paare“ */
  cores: z.string().trim().min(1),
  /** Kleine zweite Zeile in der Leiste, trennt gleiche Aderzahlen, z. B. „mit N“ oder „vor 1965“ */
  coresNote: z.string().trim().default(''),
  /** Adern in der Reihenfolge der Anzeige */
  wires: z.array(wireSchema).min(1),
  /** Hinweis zu dieser Belegung */
  note: z.string().trim().default(''),
  /** Woher die Belegung stammt, kurz; die Links stehen in source des Eintrags */
  source: z.string().trim().min(1),
})

export const wireColorToolSchema = defineEntrySchema({
  kind: z.literal('wireColors'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  systems: z
    .array(
      z.strictObject({
        key,
        /** Name in der Leiste, z. B. „Starkstrom“ */
        label: z.string().trim().min(1),
        /** Kleine zweite Zeile in der Leiste, z. B. „Drehstrom 400 V“ */
        note: z.string().trim().default(''),
        /** Hinweis unter der Leiste, wenn dieses System gewählt ist */
        hint: z.string().trim().default(''),
        /** Warnung unter der Leiste, deutlich hervorgehoben, z. B. bei Altanlagen */
        warning: z.string().trim().default(''),
      }),
    )
    .min(2),
  cables: z
    .array(
      z.strictObject({
        key,
        /** Typbezeichnung, z. B. „NYM-J“ */
        name: z.string().trim().min(1),
        /** Weitere Suchbegriffe */
        aliases: z.array(z.string().trim().min(1)).default([]),
        /** Hinweis zum Kabeltyp, wenn er gewählt ist, z. B. wo er verlegt werden darf */
        note: z.string().trim().default(''),
      }),
    )
    .min(1),
  assignments: z.array(assignmentSchema).min(1),
})

export type WireColorTool = z.output<typeof wireColorToolSchema>
export type WireAssignment = WireColorTool['assignments'][number]

/** Kennung einer Aderzahl-Option; gleiche Aderzahlen unterscheiden sich über den Zusatz */
export const coresKey = (assignment: Pick<WireAssignment, 'cores' | 'coresNote'>) =>
  assignment.coresNote ? `${assignment.cores} ${assignment.coresNote}` : assignment.cores

/** Kabeltypen mit mindestens einer Belegung in diesem System, in der Reihenfolge des Inhalts */
export function cablesForSystem(tool: WireColorTool, system: string): WireColorTool['cables'] {
  const offered = new Set(tool.assignments.filter((entry) => entry.system === system).flatMap((entry) => entry.cables))
  return tool.cables.filter((cable) => offered.has(cable.key))
}

/** Belegungen für System und Kabeltyp, also die Aderzahlen zur Auswahl */
export function assignmentsFor(tool: WireColorTool, system: string, cable: string): WireAssignment[] {
  return tool.assignments.filter((entry) => entry.system === system && entry.cables.includes(cable))
}

export function checkWireColorTool(tool: WireColorTool): string[] {
  const issues: string[] = []
  const systemKeys = tool.systems.map((system) => system.key)
  const cableKeys = tool.cables.map((cable) => cable.key)
  if (new Set(systemKeys).size !== systemKeys.length) issues.push('systems: key doppelt vergeben')
  if (new Set(cableKeys).size !== cableKeys.length) issues.push('cables: key doppelt vergeben')
  const combinations = new Set<string>()
  tool.assignments.forEach((assignment, index) => {
    const where = `assignments[${index}] (${assignment.system}, ${coresKey(assignment)})`
    if (!systemKeys.includes(assignment.system)) issues.push(`${where}: unbekanntes System`)
    for (const cable of assignment.cables) {
      if (!cableKeys.includes(cable)) issues.push(`${where}: unbekannter Kabeltyp "${cable}"`)
      const combination = `${assignment.system}|${cable}|${coresKey(assignment)}`
      if (combinations.has(combination)) issues.push(`${where}: "${cable}" doppelt belegt`)
      combinations.add(combination)
    }
    // Eine genaue Aderzahl muss zur Zahl der Einträge passen; „6+“ und „Einzeln“ fassen mehrere Adern zusammen
    if (/^\d+$/.test(assignment.cores) && Number(assignment.cores) !== assignment.wires.length) {
      issues.push(`${where}: ${assignment.wires.length} Adern eingetragen`)
    }
  })
  for (const system of tool.systems) {
    if (!tool.assignments.some((assignment) => assignment.system === system.key)) {
      issues.push(`systems (${system.label}): keine Belegung`)
    }
  }
  for (const cable of tool.cables) {
    if (!tool.assignments.some((assignment) => assignment.cables.includes(cable.key))) {
      issues.push(`cables (${cable.name}): keine Belegung`)
    }
  }
  return issues
}

/** Suchbegriffe für die globale Suche */
export function wireColorKeywords(tool: WireColorTool): string[] {
  const uses = tool.assignments.flatMap((assignment) => assignment.wires.map((wire) => wire.use))
  return [
    ...tool.systems.flatMap((system) => [system.label, system.note]),
    ...tool.cables.flatMap((cable) => [cable.name, ...cable.aliases]),
    ...new Set(uses),
  ]
}
