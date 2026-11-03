import { createStoredState } from '../../lib/storedState'
import { EXPERT_UNLOCK_KEY } from './constants'

// Einfache Sperre, kein Schutz: Codes und PINs stehen im Bundle.
// Nach richtiger Eingabe merkt sich das Gerät die Freischaltung dauerhaft.

/** Gültige PINs; alle gleich lang, weil das Formular bei dieser Länge automatisch prüft */
export const EXPERT_PINS: readonly string[] = ['0815', '1163']

export const EXPERT_PIN_LENGTH = 4

const unlockState = createStoredState<boolean>({
  key: EXPERT_UNLOCK_KEY,
  read: () => {
    try {
      return globalThis.localStorage?.getItem(EXPERT_UNLOCK_KEY) === '1'
    } catch {
      return false
    }
  },
  write: (value) => {
    try {
      if (value) globalThis.localStorage?.setItem(EXPERT_UNLOCK_KEY, '1')
      else globalThis.localStorage?.removeItem(EXPERT_UNLOCK_KEY)
    } catch {
      // ohne Speicher gilt die Freischaltung bis zum Neuladen
    }
  },
  fallback: false,
})

export const useExpertUnlocked = unlockState.useValue

/** Prüft die PIN und schaltet bei Erfolg dauerhaft frei */
export function tryUnlockExpert(pin: string): boolean {
  if (!EXPERT_PINS.includes(pin.trim())) return false
  unlockState.set(true)
  return true
}
