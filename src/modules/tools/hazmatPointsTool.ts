import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'

// Gefahrgut-Tools ("kind": "hazmatPoints"): 1000-Punkte-Regel nach ADR 1.1.3.6. Man wählt ein oder mehrere
// Gefahrgüter, gibt Anzahl und Menge je Gebinde ein und bekommt die Punkte (Menge × Faktor der
// Beförderungskategorie), die Summe und die Vorschriften, die für diese Ladung gelten.
// Kategorien, Faktoren, Stoffe und Vorschriften stehen im Inhalt, nicht im Code.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')

/** Einheit der Menge: kg (Nettomasse), l (Liter bzw. Fassungsraum) oder Stk. (zählt nur, z. B. Leergut) */
export const HAZMAT_UNITS = ['kg', 'l', 'Stk.'] as const
export type HazmatUnit = (typeof HAZMAT_UNITS)[number]

const categorySchema = z.strictObject({
  /** Beförderungskategorie 0 bis 4 (ADR Tabelle A, Spalte 15) */
  category: z.number().int().min(0).max(4),
  /** Multiplikationsfaktor für die Punkte; null = Kategorie 0, keine Freistellung möglich */
  factor: z.number().min(0).nullable(),
  /** Höchstzulässige Gesamtmenge je Beförderungseinheit zur Anzeige, z. B. „333“ oder „unbegrenzt“ */
  maxQuantity: z.string().trim().min(1),
})

const groupSchema = z.strictObject({
  key,
  /** Überschrift in der Auswahl, z. B. „Gase in Flaschen“ */
  label: z.string().trim().min(1),
})

const substanceSchema = z.strictObject({
  key,
  /** Name in der Auswahl, wie auf der Baustelle gesagt, z. B. „Propan / Flüssiggas“ */
  name: z.string().trim().min(1),
  /** Weitere Suchbegriffe */
  aliases: z.array(z.string().trim().min(1)).default([]),
  /** key der Gruppe */
  group: key,
  /** UN-Nummer, vierstellig; fehlt z. B. bei Leergut */
  un: z
    .string()
    .regex(/^\d{4}$/, 'un: vierstellige Nummer erwartet')
    .optional(),
  /** Benennung laut ADR, z. B. „Acetylen, gelöst“ */
  officialName: z.string().trim().min(1),
  /** Klasse und Einstufung, wie in der Quelle, z. B. „Klasse 3, Verpackungsgruppe III“ */
  classInfo: z.string().trim().min(1),
  transportCategory: z.number().int().min(0).max(4),
  unit: z.enum(HAZMAT_UNITS),
  /** Wie die Menge gezählt wird, z. B. „Fassungsraum der Flasche in Litern“ */
  quantityBasis: z.string().trim().min(1),
  /** Übliche Gebindegrößen zum Antippen (in unit) */
  sizes: z.array(z.number().positive()).default([]),
  /** Hinweis unter dem Stoff, z. B. woher die Zuordnung stammt */
  note: z.string().trim().default(''),
  /** keys der Vorschriften mit when "selected", die bei diesem Stoff gelten */
  rules: z.array(key).default([]),
  /** Kurz, woher UN-Nummer und Kategorie stammen */
  source: z.string().trim().min(1),
})

/** Wann eine Vorschrift angezeigt wird */
export const HAZMAT_RULE_WHEN = ['always', 'withinLimit', 'overLimit', 'selected'] as const

const ruleSchema = z.strictObject({
  key,
  title: z.string().trim().min(1),
  /** Eigene Kurzfassung, kein Normtext */
  text: z.string().trim().min(1),
  /**
   * always: bei jeder Ladung; withinLimit: nur bis zur Grenze (Freistellung); overLimit: nur darüber oder bei
   * Kategorie 0; selected: nur wenn ein gewählter Stoff die Vorschrift in rules nennt
   */
  when: z.enum(HAZMAT_RULE_WHEN),
  source: z.string().trim().min(1),
})

const exampleSchema = z.strictObject({
  label: z.string().trim().min(1),
  items: z
    .array(
      z.strictObject({
        substance: key,
        /** Gesamtmenge in der Einheit des Stoffs */
        quantity: z.number().positive(),
      }),
    )
    .min(1),
  /** Punktsumme laut Quelle */
  expected: z.number().min(0),
  source: z.string().trim().min(1),
})

export const hazmatPointsToolSchema = defineEntrySchema({
  kind: z.literal('hazmatPoints'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  tags: topicTagsSchema,
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  /** Ausgabe des Regelwerks, z. B. „ADR 2025“ */
  edition: z.string().trim().min(1),
  /** Grenze der Punktsumme, bis zu der die Freistellung gilt */
  limit: z.number().positive(),
  categories: z.array(categorySchema).length(5),
  groups: z.array(groupSchema).min(1),
  substances: z.array(substanceSchema).min(1),
  rules: z.array(ruleSchema).min(1),
  /** Hinweis zur Handwerkerregelung, aufklappbar unter den Vorschriften */
  craftsmanRule: z.strictObject({
    title: z.string().trim().min(1),
    text: z.string().trim().min(1),
    source: z.string().trim().min(1),
  }),
  /** Einschränkungen des Tools, stehen am Seitenende */
  closingNote: z.string().trim().min(1),
  /** Rechenbeispiele aus den Quellen; der Build prüft, dass das Tool dieselbe Summe ergibt */
  examples: z.array(exampleSchema).min(1),
})

export type HazmatPointsTool = z.output<typeof hazmatPointsToolSchema>
export type HazmatSubstance = HazmatPointsTool['substances'][number]
export type HazmatRule = HazmatPointsTool['rules'][number]
export type HazmatCategory = HazmatPointsTool['categories'][number]

/** Eine Position der Ladung: Gesamtmenge eines Stoffs in seiner Einheit */
export interface LoadItem {
  substance: string
  quantity: number
}

export interface LoadPosition {
  substance: HazmatSubstance
  quantity: number
  factor: number | null
  /** null bei Kategorie 0 */
  points: number | null
}

export interface CategoryTotal {
  category: HazmatCategory
  /** Mengen je Einheit, z. B. { kg: 20, l: 100 } */
  quantities: Partial<Record<HazmatUnit, number>>
  points: number
}

export interface LoadSummary {
  positions: LoadPosition[]
  /** Kategorien mit Ladung, aufsteigend */
  categories: CategoryTotal[]
  total: number
  /** Ein Stoff der Kategorie 0 ist dabei: keine Freistellung, egal wie viele Punkte */
  hasCategoryZero: boolean
  /** Freistellung nach 1.1.3.6: keine Kategorie 0 und Summe höchstens limit */
  exempt: boolean
}

// Rundungsfehler beim Malnehmen (z. B. 0,1 × 3) sollen die Grenze nicht verschieben
const EPSILON = 1e-9

export function categoryOf(tool: HazmatPointsTool, category: number): HazmatCategory {
  const found = tool.categories.find((candidate) => candidate.category === category)
  if (!found) throw new Error(`Beförderungskategorie ${category} fehlt im Inhalt`)
  return found
}

export function findSubstance(tool: HazmatPointsTool, substanceKey: string): HazmatSubstance | undefined {
  return tool.substances.find((substance) => substance.key === substanceKey)
}

/** Punkte der Ladung: je Position Menge × Faktor, dazu Summen je Kategorie (für das Beförderungspapier) */
export function summarizeLoad(tool: HazmatPointsTool, items: readonly LoadItem[]): LoadSummary {
  const positions: LoadPosition[] = items.flatMap((item) => {
    const substance = findSubstance(tool, item.substance)
    if (!substance || !(item.quantity > 0)) return []
    const { factor } = categoryOf(tool, substance.transportCategory)
    return [{ substance, quantity: item.quantity, factor, points: factor === null ? null : item.quantity * factor }]
  })
  const categories = tool.categories
    .filter((category) => positions.some((position) => position.substance.transportCategory === category.category))
    .sort((a, b) => a.category - b.category)
    .map((category) => {
      const inCategory = positions.filter((position) => position.substance.transportCategory === category.category)
      const quantities: Partial<Record<HazmatUnit, number>> = {}
      for (const position of inCategory) {
        quantities[position.substance.unit] = (quantities[position.substance.unit] ?? 0) + position.quantity
      }
      return { category, quantities, points: inCategory.reduce((sum, position) => sum + (position.points ?? 0), 0) }
    })
  const total = positions.reduce((sum, position) => sum + (position.points ?? 0), 0)
  const hasCategoryZero = positions.some((position) => position.points === null)
  return { positions, categories, total, hasCategoryZero, exempt: !hasCategoryZero && total <= tool.limit + EPSILON }
}

/** Vorschriften für die Ladung: erst die je nach Grenze, dann die allgemeinen, dann die der gewählten Stoffe */
export function rulesForLoad(tool: HazmatPointsTool, substanceKeys: readonly string[], exempt: boolean): HazmatRule[] {
  const selected = new Set(
    substanceKeys.flatMap((substanceKey) => findSubstance(tool, substanceKey)?.rules ?? []),
  )
  const byWhen = (when: HazmatRule['when']) => tool.rules.filter((rule) => rule.when === when)
  return [
    ...byWhen(exempt ? 'withinLimit' : 'overLimit'),
    ...byWhen('always'),
    ...byWhen('selected').filter((rule) => selected.has(rule.key)),
  ]
}

function duplicates(values: string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
}

export function checkHazmatPointsTool(tool: HazmatPointsTool): string[] {
  const issues: string[] = []
  const categoryNumbers = tool.categories.map((category) => category.category)
  for (const number of [0, 1, 2, 3, 4]) {
    if (!categoryNumbers.includes(number)) issues.push(`categories: Kategorie ${number} fehlt`)
  }
  for (const category of tool.categories) {
    if ((category.factor === null) !== (category.category === 0)) {
      issues.push(`categories (${category.category}): factor null gehört genau zu Kategorie 0`)
    }
  }
  const groupKeys = tool.groups.map((group) => group.key)
  for (const value of duplicates(groupKeys)) issues.push(`groups: key "${value}" doppelt vergeben`)
  for (const value of duplicates(tool.substances.map((substance) => substance.key))) {
    issues.push(`substances: key "${value}" doppelt vergeben`)
  }
  for (const value of duplicates(tool.substances.map((substance) => substance.name))) {
    issues.push(`substances: name "${value}" doppelt vergeben`)
  }
  const ruleKeys = tool.rules.map((rule) => rule.key)
  for (const value of duplicates(ruleKeys)) issues.push(`rules: key "${value}" doppelt vergeben`)
  for (const substance of tool.substances) {
    const where = `substances (${substance.name})`
    if (!groupKeys.includes(substance.group)) issues.push(`${where}: unbekannte Gruppe "${substance.group}"`)
    for (const ruleKey of substance.rules) {
      const rule = tool.rules.find((candidate) => candidate.key === ruleKey)
      if (!rule) issues.push(`${where}: unbekannte Vorschrift "${ruleKey}"`)
      else if (rule.when !== 'selected') issues.push(`${where}: Vorschrift "${ruleKey}" gilt schon allgemein (when "${rule.when}")`)
    }
    if (substance.unit === 'Stk.' && substance.sizes.length > 0) issues.push(`${where}: sizes passen nicht zu "Stk."`)
    for (const value of duplicates(substance.sizes.map(String))) issues.push(`${where}: Größe ${value} doppelt`)
  }
  for (const group of tool.groups) {
    if (!tool.substances.some((substance) => substance.group === group.key)) issues.push(`groups (${group.label}): kein Stoff zugeordnet`)
  }
  for (const rule of tool.rules) {
    if (rule.when === 'selected' && !tool.substances.some((substance) => substance.rules.includes(rule.key))) {
      issues.push(`rules (${rule.title}): kein Stoff verweist darauf`)
    }
  }
  if (!categoryNumbers.every((number) => [0, 1, 2, 3, 4].includes(number))) return issues
  tool.examples.forEach((example, index) => {
    const where = `examples[${index}] (${example.label})`
    const unknown = example.items.filter((item) => !findSubstance(tool, item.substance))
    for (const item of unknown) issues.push(`${where}: unbekannter Stoff "${item.substance}"`)
    if (unknown.length > 0 || categoryNumbers.length !== new Set(categoryNumbers).size) return
    const { total } = summarizeLoad(tool, example.items)
    if (Math.abs(total - example.expected) > EPSILON) issues.push(`${where}: ergibt ${total} Punkte statt ${example.expected}`)
  })
  return issues
}

/** Suchbegriffe für die globale Suche */
export function hazmatPointsKeywords(tool: HazmatPointsTool): string[] {
  return [
    ...tool.groups.map((group) => group.label),
    ...tool.substances.flatMap((substance) => [
      substance.name,
      substance.officialName,
      ...substance.aliases,
      ...(substance.un ? [`UN ${substance.un}`] : []),
    ]),
  ]
}
