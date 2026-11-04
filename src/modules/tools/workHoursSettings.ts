import { createStoredState } from '../../lib/storedState'
import { DEFAULT_WORK_HOURS_SETTINGS, parseWorkHoursSettings, type WorkHoursSettings } from './workHoursCalc'

// Einstellungen des Stundenzettels: gelten nur für dieses Gerät, daher localStorage wie die übrigen Einstellungen.

export const WORK_HOURS_STORAGE_KEY = 'shk-work-hours'

const settingsState = createStoredState<WorkHoursSettings>({
  key: WORK_HOURS_STORAGE_KEY,
  read: () => {
    try {
      return parseWorkHoursSettings(globalThis.localStorage?.getItem(WORK_HOURS_STORAGE_KEY) ?? null)
    } catch {
      return DEFAULT_WORK_HOURS_SETTINGS
    }
  },
  write: (value) => {
    try {
      globalThis.localStorage?.setItem(WORK_HOURS_STORAGE_KEY, JSON.stringify(value))
    } catch {
      // ohne Speicher gilt die Einstellung bis zum Neuladen
    }
  },
  fallback: DEFAULT_WORK_HOURS_SETTINGS,
})

export const useWorkHoursSettings = settingsState.useValue

export function updateWorkHoursSettings(change: Partial<WorkHoursSettings>): void {
  settingsState.set({ ...settingsState.get(), ...change })
}
