import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'

// Einstufungs-Tools ("kind": "classification"): Regelwerk (z. B. Muster-Feuerungsverordnung oder ein Bundesland),
// Brennstoff und eine Menge wählen, z. B. die Lagermenge (Brennstofflagerung) oder die Nennleistung (Heizraum).
// Das Tool sagt, ob die Menge über der Grenze des Regelwerks liegt (z. B. „Brennstofflagerraum erforderlich“), und
// zeigt die Vorschriften und Empfehlungen nach Thema, auf Wunsch mit errechneten Mindestwerten.
// Grenzen, Regelwerke, Beschriftungen und Texte stehen im Inhalt, nicht im Code.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')

/** Grundeinheit einer Menge im Inhalt */
export const CLASSIFICATION_UNITS = ['kg', 'l', 'kW'] as const
export type ClassificationUnit = (typeof CLASSIFICATION_UNITS)[number]

/** Eingabeeinheiten je Grundeinheit; reine Einheitenumrechnung, keine Stoffwerte */
export const INPUT_UNITS: Record<ClassificationUnit, { label: string; factor: number }[]> = {
  kg: [
    { label: 'kg', factor: 1 },
    { label: 't', factor: 1000 },
  ],
  l: [
    { label: 'l', factor: 1 },
    { label: 'm³', factor: 1000 },
  ],
  kW: [{ label: 'kW', factor: 1 }],
}

const limitSchema = z.strictObject({
  /** key des Brennstoffs */
  fuel: key,
  /** Einheit, in der das Regelwerk zählt; alle Mengen der Vorschriften stehen in dieser Einheit */
  unit: z.enum(CLASSIFICATION_UNITS),
  /** Grenze: Erst bei mehr als dieser Menge gilt die Einstufung „über der Grenze“ */
  above: z.number().positive(),
  /** Ergebnis über der Grenze, z. B. „Brennstofflagerraum erforderlich“ */
  aboveLabel: z.string().trim().min(1),
  /** Ergebnis bis zur Grenze, z. B. „Noch kein Brennstofflagerraum nötig“ */
  belowLabel: z.string().trim().min(1),
  /** Wofür die Grenze gilt, steht hinter der Zahl, z. B. „je Gebäude oder Brandabschnitt“ */
  scope: z.string().trim().default(''),
  /** Höchstmenge, die das Regelwerk überhaupt zulässt, mit Hinweis, z. B. Fassungsvermögen je Lagerraum */
  max: z.strictObject({ value: z.number().positive(), text: z.string().trim().min(1) }).optional(),
  /** Hinweis unter der Eingabe, z. B. wie gezählt wird */
  hint: z.string().trim().default(''),
  /** Fundstelle der Grenze, z. B. „MFeuV § 11 Abs. 1 Nr. 1“ */
  source: z.string().trim().min(1),
})

const regulationSchema = z.strictObject({
  key,
  /** Beschriftung in der Leiste, z. B. „Muster (MFeuV)“ */
  label: z.string().trim().min(1),
  /** Hinweis unter der Leiste, z. B. Stand und Abweichungen */
  note: z.string().trim().default(''),
  limits: z.array(limitSchema).min(1),
})

const fuelSchema = z.strictObject({
  key,
  name: z.string().trim().min(1),
  aliases: z.array(z.string().trim().min(1)).default([]),
  /** Zusatz unter dem Namen, z. B. Beispiele */
  note: z.string().trim().default(''),
})

const topicSchema = z.strictObject({
  key,
  label: z.string().trim().min(1),
})

/** Optionale Ja/Nein-Frage zu einer Bedingung, z. B. „Ist die Feuerstätte raumluftabhängig?“ */
const questionSchema = z.strictObject({
  key,
  label: z.string().trim().min(1),
  /** Erklärung unter der Frage */
  hint: z.string().trim().default(''),
  /** Nur bei diesen Brennstoffen fragen; leer = alle. Sonst gilt die Bedingung als nicht zutreffend für die Auswahl */
  fuels: z.array(key).default([]),
  /** Nur bei diesen Regelwerken fragen; leer = alle */
  regulations: z.array(key).default([]),
  /** Links zum Nachschauen, z. B. Hochwasserkarten; optional nur bei bestimmten Regelwerken */
  links: z
    .array(
      z.strictObject({
        label: z.string().trim().min(1),
        url: z.url({ protocol: /^https$/ }),
        regulations: z.array(key).default([]),
      }),
    )
    .default([]),
})

/** Bedingung einer Vorschrift: Antwort auf eine Frage; offen = Vorschrift erscheint mit „Gilt, wenn …“ */
const askSchema = z.strictObject({
  question: key,
  /** Antwort, bei der die Vorschrift gilt */
  is: z.boolean(),
})

/** pflicht: steht in einer Vorschrift; empfehlung: Fachverband, Merkblatt, Norm ohne Rechtspflicht */
export const RULE_BINDINGS = ['pflicht', 'empfehlung'] as const

const appliesSchema = z.strictObject({
  /** keys der Regelwerke; leer = alle */
  regulations: z.array(key).default([]),
  /** keys der Brennstoffe */
  fuels: z.array(key).min(1),
  /** Nur bei mehr als dieser Menge (in der Einheit des Regelwerks) */
  above: z.number().min(0).optional(),
  /** Nur bis einschließlich dieser Menge */
  upTo: z.number().positive().optional(),
  /** true: nur über der Grenze des Regelwerks; false: nur bis zur Grenze */
  overLimit: z.boolean().optional(),
})

/**
 * Errechneter Mindestwert: base + perUnit × (Menge − over), Menge unter over zählt als over.
 * Mit step zählt jede angefangene Stufe: base + perUnit × ⌈(Menge − over) / step⌉. max begrenzt das Ergebnis.
 */
const computedSchema = z.strictObject({
  /** z. B. „Mindestquerschnitt der Öffnung ins Freie“ */
  label: z.string().trim().min(1),
  base: z.number().min(0),
  perUnit: z.number().positive(),
  over: z.number().min(0).default(0),
  /** Stufe, z. B. 50 für „je angefangene weitere 50 kW“ */
  step: z.number().positive().optional(),
  /** Obergrenze des Ergebnisses */
  max: z.number().positive().optional(),
  /** Einheit des Ergebnisses, z. B. „cm²“ */
  unit: z.string().trim().min(1),
})

const ruleSchema = z.strictObject({
  key,
  /** key des Themas */
  topic: key,
  binding: z.enum(RULE_BINDINGS),
  title: z.string().trim().min(1),
  /** Bedingung als Text, z. B. „Bei Kesseln über 50 kW“; steht über dem Text, solange eine Frage dazu offen ist */
  condition: z.string().trim().default(''),
  /** Fragen zur Bedingung; alle müssen passen. Pflicht, sobald condition gesetzt ist */
  ask: z.array(askSchema).default([]),
  /** Eigene Kurzfassung, kein Normtext */
  text: z.string().trim().min(1),
  /** Mindestwert, den das Tool für die eingegebene Menge ausrechnet und unter dem Text zeigt */
  computed: computedSchema.optional(),
  source: z.string().trim().min(1),
  /** Wann die Vorschrift erscheint; eine passende Zeile genügt */
  applies: z.array(appliesSchema).min(1),
})

const exampleSchema = z.strictObject({
  label: z.string().trim().min(1),
  regulation: key,
  fuel: key,
  /** Menge in der Einheit des Regelwerks */
  quantity: z.number().positive(),
  overLimit: z.boolean(),
  /** Diese Vorschriften müssen erscheinen */
  rules: z.array(key).default([]),
  /** Diese Vorschriften dürfen nicht erscheinen */
  notRules: z.array(key).default([]),
  /** Errechnete Mindestwerte, nachgerechnet aus der Vorschrift */
  values: z.array(z.strictObject({ rule: key, value: z.number() })).default([]),
  /** Antworten auf Fragen: key → Ja (true) oder Nein (false); fehlende bleiben offen */
  answers: z.record(z.string(), z.boolean()).default({}),
  source: z.string().trim().min(1),
})

export const classificationToolSchema = defineEntrySchema({
  kind: z.literal('classification'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  tags: topicTagsSchema,
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  related: z.array(z.string().startsWith('tool.')).default([]),
  /** Überschrift der Brennstoff-Auswahl, z. B. „Brennstoff der Feuerstätten“ */
  fuelsLabel: z.string().trim().default('Brennstoff'),
  /** Beschriftung der Eingabe, z. B. „Lagermenge“ oder „Gesamtnennleistung“ */
  quantityLabel: z.string().trim().min(1),
  /** Erstes Regelwerk ist vorausgewählt */
  regulations: z.array(regulationSchema).min(1),
  fuels: z.array(fuelSchema).min(1),
  /** Reihenfolge der Themen im Ergebnis */
  topics: z.array(topicSchema).min(1),
  /** Optionale Fragen; erscheinen nur, wenn eine Vorschrift der Auswahl sie braucht */
  questions: z.array(questionSchema).default([]),
  rules: z.array(ruleSchema).min(1),
  /** Einschränkungen des Tools, stehen am Seitenende */
  closingNote: z.string().trim().min(1),
  /** Fälle aus den Quellen; der Build prüft Einstufung, Vorschriften und errechnete Werte */
  examples: z.array(exampleSchema).min(1),
})

export type ClassificationTool = z.output<typeof classificationToolSchema>
export type ClassificationRegulation = ClassificationTool['regulations'][number]
export type ClassificationLimit = ClassificationRegulation['limits'][number]
export type ClassificationFuel = ClassificationTool['fuels'][number]
export type ClassificationRule = ClassificationTool['rules'][number]
export type ClassificationComputed = NonNullable<ClassificationRule['computed']>
export type ClassificationQuestion = ClassificationTool['questions'][number]
/** Antworten: key der Frage → Ja (true) oder Nein (false); fehlt der key, ist die Frage offen */
export type ClassificationAnswers = Readonly<Record<string, boolean | undefined>>

export interface ClassificationResult {
  limit: ClassificationLimit
  /** Mehr als die Grenze */
  overLimit: boolean
  /** Mehr als die Höchstmenge des Regelwerks */
  overMax: boolean
}

export function findRegulation(tool: ClassificationTool, regulationKey: string): ClassificationRegulation | undefined {
  return tool.regulations.find((regulation) => regulation.key === regulationKey)
}

export function findFuel(tool: ClassificationTool, fuelKey: string): ClassificationFuel | undefined {
  return tool.fuels.find((fuel) => fuel.key === fuelKey)
}

export function limitFor(tool: ClassificationTool, regulationKey: string, fuelKey: string): ClassificationLimit | undefined {
  return findRegulation(tool, regulationKey)?.limits.find((limit) => limit.fuel === fuelKey)
}

/** Einstufung einer Menge (in der Einheit des Regelwerks); undefined, wenn das Regelwerk den Brennstoff nicht kennt */
export function classify(
  tool: ClassificationTool,
  regulationKey: string,
  fuelKey: string,
  quantity: number,
): ClassificationResult | undefined {
  const limit = limitFor(tool, regulationKey, fuelKey)
  if (!limit) return undefined
  return {
    limit,
    overLimit: quantity > limit.above,
    overMax: limit.max !== undefined && quantity > limit.max.value,
  }
}

// Rundungsfehler beim Rechnen (z. B. 1,6 × 7) sollen weder Stufen noch Beispiele verfälschen
const EPSILON = 1e-9

/** Errechneter Mindestwert einer Vorschrift für die Menge */
export function computeValue(computed: ClassificationComputed, quantity: number): number {
  const excess = Math.max(0, quantity - computed.over)
  // Rundungsfehler (z. B. 100,0000001 kW) sollen keine zusätzliche Stufe auslösen
  const units = computed.step === undefined ? excess : Math.ceil(excess / computed.step - EPSILON)
  const value = computed.base + computed.perUnit * units
  return computed.max === undefined ? value : Math.min(value, computed.max)
}

/** Die Frage passt zu Regelwerk und Brennstoff; sonst zählt ihre Bedingung bei dieser Auswahl nicht */
function questionApplies(tool: ClassificationTool, questionKey: string, regulationKey: string, fuelKey: string): boolean {
  const question = tool.questions.find((candidate) => candidate.key === questionKey)
  return (
    question !== undefined &&
    (question.fuels.length === 0 || question.fuels.includes(fuelKey)) &&
    (question.regulations.length === 0 || question.regulations.includes(regulationKey))
  )
}

/** Bedingungen der Vorschrift, die bei dieser Auswahl abgefragt werden */
function applicableAsks(tool: ClassificationTool, rule: ClassificationRule, regulationKey: string, fuelKey: string) {
  return rule.ask.filter((ask) => questionApplies(tool, ask.question, regulationKey, fuelKey))
}

/** Mindestens eine Frage zur Bedingung ist noch offen: „Gilt, wenn …“ anzeigen */
export function hasOpenCondition(
  tool: ClassificationTool,
  rule: ClassificationRule,
  regulationKey: string,
  fuelKey: string,
  answers: ClassificationAnswers,
): boolean {
  return applicableAsks(tool, rule, regulationKey, fuelKey).some((ask) => answers[ask.question] === undefined)
}

/** Vorschriften für Regelwerk, Brennstoff und Menge, nach Thema sortiert, Pflichten vor Empfehlungen. Eine Antwort, die
 * einer Bedingung widerspricht, blendet die Vorschrift aus; offene Fragen blenden nichts aus */
export function rulesFor(
  tool: ClassificationTool,
  regulationKey: string,
  fuelKey: string,
  quantity: number,
  answers: ClassificationAnswers = {},
): ClassificationRule[] {
  return candidateRules(tool, regulationKey, fuelKey, quantity).filter((rule) =>
    applicableAsks(tool, rule, regulationKey, fuelKey).every(
      (ask) => answers[ask.question] === undefined || answers[ask.question] === ask.is,
    ),
  )
}

/**
 * Fragen, die bei dieser Auswahl eine Vorschrift betreffen, in der Reihenfolge des Inhalts. Schließen andere Antworten
 * alle Vorschriften einer Frage schon aus, entfällt die Frage (z. B. „Luft absaugende Anlagen?“ bei raumluftunabhängig)
 */
export function questionsFor(
  tool: ClassificationTool,
  regulationKey: string,
  fuelKey: string,
  quantity: number,
  answers: ClassificationAnswers = {},
): ClassificationQuestion[] {
  const used = new Set<string>()
  for (const rule of candidateRules(tool, regulationKey, fuelKey, quantity)) {
    const asks = applicableAsks(tool, rule, regulationKey, fuelKey)
    for (const ask of asks) {
      const othersAllow = asks.every(
        (other) => other.question === ask.question || answers[other.question] === undefined || answers[other.question] === other.is,
      )
      if (othersAllow) used.add(ask.question)
    }
  }
  return tool.questions.filter((question) => used.has(question.key))
}

/** Vorschriften nach Regelwerk, Brennstoff und Menge, ohne Rücksicht auf Antworten */
function candidateRules(tool: ClassificationTool, regulationKey: string, fuelKey: string, quantity: number): ClassificationRule[] {
  const result = classify(tool, regulationKey, fuelKey, quantity)
  if (!result) return []
  const matches = (rule: ClassificationRule) =>
    rule.applies.some(
      (applies) =>
        (applies.regulations.length === 0 || applies.regulations.includes(regulationKey)) &&
        applies.fuels.includes(fuelKey) &&
        (applies.above === undefined || quantity > applies.above) &&
        (applies.upTo === undefined || quantity <= applies.upTo) &&
        (applies.overLimit === undefined || applies.overLimit === result.overLimit),
    )
  const topicRank = (rule: ClassificationRule) => tool.topics.findIndex((topic) => topic.key === rule.topic)
  const bindingRank = (rule: ClassificationRule) => RULE_BINDINGS.indexOf(rule.binding)
  return tool.rules
    .filter(matches)
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => topicRank(a.rule) - topicRank(b.rule) || bindingRank(a.rule) - bindingRank(b.rule) || a.index - b.index)
    .map(({ rule }) => rule)
}

function duplicates(values: string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
}

export function checkClassificationTool(tool: ClassificationTool): string[] {
  const issues: string[] = []
  const regulationKeys = tool.regulations.map((regulation) => regulation.key)
  const fuelKeys = tool.fuels.map((fuel) => fuel.key)
  const topicKeys = tool.topics.map((topic) => topic.key)
  for (const value of duplicates(regulationKeys)) issues.push(`regulations: key "${value}" doppelt vergeben`)
  for (const value of duplicates(fuelKeys)) issues.push(`fuels: key "${value}" doppelt vergeben`)
  for (const value of duplicates(topicKeys)) issues.push(`topics: key "${value}" doppelt vergeben`)
  for (const value of duplicates(tool.rules.map((rule) => rule.key))) issues.push(`rules: key "${value}" doppelt vergeben`)
  const questionKeys = tool.questions.map((question) => question.key)
  for (const value of duplicates(questionKeys)) issues.push(`questions: key "${value}" doppelt vergeben`)

  for (const regulation of tool.regulations) {
    const where = `regulations (${regulation.label})`
    for (const value of duplicates(regulation.limits.map((limit) => limit.fuel))) issues.push(`${where}: Brennstoff "${value}" doppelt`)
    for (const limit of regulation.limits) {
      if (!fuelKeys.includes(limit.fuel)) issues.push(`${where}: unbekannter Brennstoff "${limit.fuel}"`)
      if (limit.max !== undefined && limit.max.value <= limit.above) {
        issues.push(`${where} (${limit.fuel}): max muss größer als above sein`)
      }
    }
  }
  for (const fuel of tool.fuels) {
    if (!tool.regulations.some((regulation) => regulation.limits.some((limit) => limit.fuel === fuel.key))) {
      issues.push(`fuels (${fuel.name}): in keinem Regelwerk eine Grenze`)
    }
  }

  for (const rule of tool.rules) {
    const where = `rules (${rule.title})`
    if (!topicKeys.includes(rule.topic)) issues.push(`${where}: unbekanntes Thema "${rule.topic}"`)
    // Jede Bedingung ist abfragbar und jede Frage hat einen Text für den offenen Fall
    if (rule.condition && rule.ask.length === 0) issues.push(`${where}: condition ohne ask`)
    if (!rule.condition && rule.ask.length > 0) issues.push(`${where}: ask ohne condition`)
    for (const ask of rule.ask) {
      if (!questionKeys.includes(ask.question)) issues.push(`${where}: unbekannte Frage "${ask.question}"`)
    }
    for (const value of duplicates(rule.ask.map((ask) => ask.question))) issues.push(`${where}: Frage "${value}" doppelt`)
    if (rule.computed?.max !== undefined && rule.computed.max < rule.computed.base) {
      issues.push(`${where}: computed.max ist kleiner als computed.base`)
    }
    for (const applies of rule.applies) {
      for (const regulationKey of applies.regulations) {
        if (!regulationKeys.includes(regulationKey)) issues.push(`${where}: unbekanntes Regelwerk "${regulationKey}"`)
      }
      for (const fuelKey of applies.fuels) {
        if (!fuelKeys.includes(fuelKey)) issues.push(`${where}: unbekannter Brennstoff "${fuelKey}"`)
      }
      if (applies.above !== undefined && applies.upTo !== undefined && applies.above >= applies.upTo) {
        issues.push(`${where}: above muss kleiner als upTo sein`)
      }
      // Mengen stehen in der Einheit des Regelwerks: Bei mehreren Regelwerken muss sie dieselbe sein
      if (applies.above !== undefined || applies.upTo !== undefined || rule.computed) {
        const regulations = applies.regulations.length === 0 ? regulationKeys : applies.regulations
        for (const fuelKey of applies.fuels) {
          const units = new Set(regulations.flatMap((regulationKey) => limitFor(tool, regulationKey, fuelKey)?.unit ?? []))
          if (units.size > 1) issues.push(`${where}: Mengen für "${fuelKey}" in verschiedenen Einheiten je Regelwerk`)
        }
      }
    }
  }
  for (const topic of tool.topics) {
    if (!tool.rules.some((rule) => rule.topic === topic.key)) issues.push(`topics (${topic.label}): keine Vorschrift`)
  }
  for (const question of tool.questions) {
    const where = `questions (${question.label})`
    if (!tool.rules.some((rule) => rule.ask.some((ask) => ask.question === question.key))) issues.push(`${where}: keine Vorschrift fragt danach`)
    for (const fuelKey of question.fuels) if (!fuelKeys.includes(fuelKey)) issues.push(`${where}: unbekannter Brennstoff "${fuelKey}"`)
    for (const regulationKey of question.regulations) {
      if (!regulationKeys.includes(regulationKey)) issues.push(`${where}: unbekanntes Regelwerk "${regulationKey}"`)
    }
  }

  const ruleKeys = tool.rules.map((rule) => rule.key)
  tool.examples.forEach((example, index) => {
    const where = `examples[${index}] (${example.label})`
    const result = classify(tool, example.regulation, example.fuel, example.quantity)
    if (!result) {
      issues.push(`${where}: keine Grenze für "${example.fuel}" in "${example.regulation}"`)
      return
    }
    if (result.overLimit !== example.overLimit) {
      issues.push(`${where}: ergibt ${result.overLimit ? 'über' : 'bis zur'} Grenze, erwartet das Gegenteil`)
    }
    for (const questionKey of Object.keys(example.answers)) {
      if (!questionKeys.includes(questionKey)) issues.push(`${where}: unbekannte Frage "${questionKey}"`)
    }
    const shown = rulesFor(tool, example.regulation, example.fuel, example.quantity, example.answers)
    const shownKeys = shown.map((rule) => rule.key)
    for (const ruleKey of [...example.rules, ...example.notRules, ...example.values.map((value) => value.rule)]) {
      if (!ruleKeys.includes(ruleKey)) issues.push(`${where}: unbekannte Vorschrift "${ruleKey}"`)
    }
    for (const ruleKey of example.rules) {
      if (ruleKeys.includes(ruleKey) && !shownKeys.includes(ruleKey)) issues.push(`${where}: Vorschrift "${ruleKey}" fehlt`)
    }
    for (const ruleKey of example.notRules) {
      if (shownKeys.includes(ruleKey)) issues.push(`${where}: Vorschrift "${ruleKey}" erscheint, sollte aber nicht`)
    }
    for (const expected of example.values) {
      const rule = shown.find((candidate) => candidate.key === expected.rule)
      if (!rule) {
        if (ruleKeys.includes(expected.rule)) issues.push(`${where}: Vorschrift "${expected.rule}" mit Wert fehlt`)
      } else if (!rule.computed) {
        issues.push(`${where}: Vorschrift "${expected.rule}" rechnet keinen Wert`)
      } else {
        const value = computeValue(rule.computed, example.quantity)
        if (Math.abs(value - expected.value) > EPSILON) issues.push(`${where}: "${expected.rule}" ergibt ${value} statt ${expected.value}`)
      }
    }
  })
  return issues
}

/** Suchbegriffe für die globale Suche */
export function classificationKeywords(tool: ClassificationTool): string[] {
  return [
    ...tool.regulations.map((regulation) => regulation.label),
    ...tool.fuels.flatMap((fuel) => [fuel.name, ...fuel.aliases]),
    ...tool.topics.map((topic) => topic.label),
    ...tool.questions.map((question) => question.label),
    ...tool.rules.map((rule) => rule.title),
  ]
}
