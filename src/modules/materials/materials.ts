import { content } from '../../content'
import { asTargetUnit, math } from '../../lib/math'
import { normalizeForSearch } from '../../lib/text'
import type { MaterialSet } from './schema'

/** Ein auswählbarer Stoffwert für ein Eingabefeld */
export interface MaterialPreset {
  name: string
  note: string
  value: number
  /** Einheit des Werts; leer = ohne Einheit */
  unit: string
  source: string
  draft: boolean
}

/** Stoffwerte für eine Formel-Variable: passend über ihren Namen oder Lexikon-Begriff (term) */
export function presetsFor(item: { name: string; term?: string }, sets: readonly MaterialSet[] = content.materials): MaterialPreset[] {
  const keys = new Set([item.name, item.term].filter((text) => text !== undefined).map(normalizeForSearch))
  return sets
    .filter((set) => set.quantities.some((quantity) => keys.has(normalizeForSearch(quantity))))
    .flatMap((set) =>
      set.values.map((value) => ({
        name: value.name,
        note: value.note,
        value: value.value,
        unit: value.unit ?? set.unit,
        source: value.source ?? set.source,
        draft: set.status === 'draft',
      })),
    )
}

const inputFormat = new Intl.NumberFormat('de-DE', { useGrouping: false, maximumSignificantDigits: 10 })

/**
 * Text und Einheit für das Eingabefeld nach Auswahl eines Stoffwerts: die Einheit des Werts,
 * wenn das Feld sie anbietet, sonst umgerechnet in die gerade eingestellte Einheit.
 */
export function presetInput(
  preset: Pick<MaterialPreset, 'value' | 'unit'>,
  currentUnit: string,
  availableUnits: readonly string[],
): { text: string; unit: string } {
  if (preset.unit === '' || preset.unit === currentUnit || availableUnits.includes(preset.unit)) {
    return { text: inputFormat.format(preset.value), unit: preset.unit === '' ? currentUnit : preset.unit }
  }
  const converted = math.unit(preset.value, preset.unit).toNumber(asTargetUnit(currentUnit))
  return { text: inputFormat.format(converted), unit: currentUnit }
}
