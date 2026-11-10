import { createStoredState } from '../../lib/storedState'

// Eingaben des Heizkosten-Vergleichs: gelten nur für dieses Gerät, daher localStorage wie die übrigen Einstellungen.
// Gespeichert werden die Texte der Eingabefelder; gerechnet wird mit dem, was sich davon als Zahl lesen lässt.

export const HEATING_COST_STORAGE_KEY = 'shk-heating-cost'

/** Referenz „Nutzwärme direkt eingeben“ statt eines Heizsystems */
export const HEAT_REFERENCE = 'heat'

export interface HeatingCostSettings {
  /** key des Referenzsystems oder HEAT_REFERENCE */
  reference: string
  /** Jahresverbrauch als eingegebener Text */
  amount: string
  /** Einheit des Verbrauchs je Referenzsystem */
  units: Record<string, string>
  /** Eigene Preise je Energieträger (Text, Euro je Preiseinheit) */
  prices: Record<string, string>
  /** Eigene Nutzungsgrade (Text in %) bzw. Jahresarbeitszahlen je System */
  efficiencies: Record<string, string>
}

export const DEFAULT_HEATING_COST_SETTINGS: HeatingCostSettings = {
  reference: '',
  amount: '',
  units: {},
  prices: {},
  efficiencies: {},
}

const stringRecord = (value: unknown): Record<string, string> =>
  typeof value === 'object' && value !== null
    ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    : {}

export function parseHeatingCostSettings(raw: string | null): HeatingCostSettings {
  if (!raw) return DEFAULT_HEATING_COST_SETTINGS
  try {
    const value = JSON.parse(raw) as Record<string, unknown>
    return {
      reference: typeof value.reference === 'string' ? value.reference : '',
      amount: typeof value.amount === 'string' ? value.amount : '',
      units: stringRecord(value.units),
      prices: stringRecord(value.prices),
      efficiencies: stringRecord(value.efficiencies),
    }
  } catch {
    return DEFAULT_HEATING_COST_SETTINGS
  }
}

const settingsState = createStoredState<HeatingCostSettings>({
  key: HEATING_COST_STORAGE_KEY,
  read: () => {
    try {
      return parseHeatingCostSettings(globalThis.localStorage?.getItem(HEATING_COST_STORAGE_KEY) ?? null)
    } catch {
      return DEFAULT_HEATING_COST_SETTINGS
    }
  },
  write: (value) => {
    try {
      globalThis.localStorage?.setItem(HEATING_COST_STORAGE_KEY, JSON.stringify(value))
    } catch {
      // ohne Speicher gilt die Eingabe bis zum Neuladen
    }
  },
  fallback: DEFAULT_HEATING_COST_SETTINGS,
})

export const useHeatingCostSettings = settingsState.useValue

export function updateHeatingCostSettings(change: Partial<HeatingCostSettings>): void {
  settingsState.set({ ...settingsState.get(), ...change })
}
