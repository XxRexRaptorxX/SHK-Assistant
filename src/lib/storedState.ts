import { useSyncExternalStore } from 'react'

interface StoredStateOptions<T> {
  /** localStorage-Schlüssel, für die Abstimmung zwischen Tabs */
  key: string
  /** Liest den Wert; muss bei fehlendem/kaputtem Speicher einen Standardwert liefern */
  read: () => T
  write: (value: T) => void
  /** Wert für das Rendern ohne Browser (Tests) */
  fallback: T
}

/**
 * Kleine geteilte Einstellung im localStorage: alle Komponenten sehen denselben Wert,
 * andere Tabs werden über das storage-Ereignis mitgezogen.
 */
export function createStoredState<T>({ key, read, write, fallback }: StoredStateOptions<T>) {
  let value: T | undefined
  const listeners = new Set<() => void>()

  const get = (): T => {
    value ??= read()
    return value
  }

  const set = (next: T) => {
    value = next
    write(next)
    for (const listener of listeners) listener()
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return
      value = read()
      listener()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(listener)
      window.removeEventListener('storage', onStorage)
    }
  }

  const useValue = (): T => useSyncExternalStore(subscribe, get, () => fallback)

  return { get, set, useValue }
}
