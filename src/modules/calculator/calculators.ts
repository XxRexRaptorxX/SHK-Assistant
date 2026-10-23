import { modules } from '../../app/modules'
import type { SearchDocument } from '../../search/search'

// Die drei Rechner unter „Taschenrechner“. Werkzeuge ohne Fachinhalt, daher nicht in content/.

export const CALCULATOR_ID_PREFIX = 'calculator'

export interface CalculatorInfo {
  slug: 'standard' | 'wissenschaftlich' | 'grafik'
  title: string
  description: string
}

export const CALCULATORS: CalculatorInfo[] = [
  { slug: 'standard', title: 'Standardrechner', description: 'Grundrechenarten, Prozent, Vorzeichen' },
  {
    slug: 'wissenschaftlich',
    title: 'Wissenschaftlicher Rechner',
    description: 'Winkelfunktionen, Potenzen, Wurzeln, Logarithmen',
  },
  { slug: 'grafik', title: 'Grafikrechner', description: 'Funktionen zeichnen, zoomen, Werte ablesen' },
]

export const calculatorId = (info: CalculatorInfo) => `${CALCULATOR_ID_PREFIX}.${info.slug}`
export const calculatorPath = (info: CalculatorInfo) => `${modules.calculator.path}/${info.slug}`

export function findCalculator(slug: string | undefined): CalculatorInfo | undefined {
  return CALCULATORS.find((info) => info.slug === slug)
}

/** Vorheriger und nächster Rechner, im Kreis (nach dem letzten kommt wieder der erste) */
export function neighbors(info: CalculatorInfo): { previous: CalculatorInfo; next: CalculatorInfo } {
  const index = CALCULATORS.indexOf(info)
  const count = CALCULATORS.length
  return { previous: CALCULATORS[(index - 1 + count) % count]!, next: CALCULATORS[(index + 1) % count]! }
}

/** Für Suche und Favoriten */
export function calculatorSearchDocuments(): SearchDocument[] {
  return CALCULATORS.map((info) => ({
    id: calculatorId(info),
    moduleTitle: modules.calculator.title,
    title: info.title,
    subtitle: info.description,
    keywords: ['Rechner', 'Taschenrechner'],
    text: info.description,
    path: calculatorPath(info),
    status: 'verified',
  }))
}
