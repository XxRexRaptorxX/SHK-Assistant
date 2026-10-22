import { createStoredState } from '../../lib/storedState'
import { EXPERT_UNLOCK_KEY } from './constants'

// Einfache Sperre, kein Schutz: Code und PIN stehen im Bundle der internen Edition.
// Nach richtiger Eingabe merkt sich das Gerät die Freischaltung dauerhaft.

export const EXPERT_PIN = '0815'

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
  if (pin.trim() !== EXPERT_PIN) return false
  unlockState.set(true)
  return true
}
