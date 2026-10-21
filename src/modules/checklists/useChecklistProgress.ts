import { useCallback, useEffect, useState } from 'react'
import {
  getChecklistProgress,
  listChecklistProgress,
  resetChecklistProgress,
  setChecklistItemChecked,
} from '../../storage/checklistProgress'

export type ProgressState =
  | { status: 'loading' }
  | { status: 'ready'; checked: ReadonlySet<string> }
  /** IndexedDB nicht nutzbar: abhaken geht, wird aber nicht gespeichert */
  | { status: 'unavailable'; checked: ReadonlySet<string> }

/** Fortschritt einer Checkliste: sofort in der Anzeige, gespeichert im Hintergrund. */
export function useChecklistProgress(checklistId: string) {
  const [state, setState] = useState<ProgressState>({ status: 'loading' })

  const reload = useCallback(async () => {
    try {
      const record = await getChecklistProgress(checklistId)
      setState({ status: 'ready', checked: new Set(record?.checkedItemIds ?? []) })
    } catch {
      setState((previous) => ({ status: 'unavailable', checked: 'checked' in previous ? previous.checked : new Set() }))
    }
  }, [checklistId])

  useEffect(() => {
    void reload()
  }, [reload])

  const setChecked = useCallback(
    async (itemId: string, checked: boolean) => {
      setState((previous) => {
        if (previous.status === 'loading') return previous
        const next = new Set(previous.checked)
        if (checked) next.add(itemId)
        else next.delete(itemId)
        return { ...previous, checked: next }
      })
      try {
        await setChecklistItemChecked(checklistId, itemId, checked)
      } catch {
        await reload()
      }
    },
    [checklistId, reload],
  )

  const reset = useCallback(async () => {
    setState((previous) => (previous.status === 'loading' ? previous : { ...previous, checked: new Set() }))
    try {
      await resetChecklistProgress(checklistId)
    } catch {
      await reload()
    }
  }, [checklistId, reload])

  return { state, setChecked, reset }
}

/** Gespeicherte Haken aller Checklisten (für die Übersicht) */
export function useAllChecklistProgress(): ReadonlyMap<string, ReadonlySet<string>> {
  const [progress, setProgress] = useState<ReadonlyMap<string, ReadonlySet<string>>>(new Map())
  useEffect(() => {
    let active = true
    listChecklistProgress()
      .then((records) => {
        if (active) setProgress(new Map(records.map((r) => [r.checklistId, new Set(r.checkedItemIds)])))
      })
      .catch(() => {
        // ohne Speicher keine Fortschrittsanzeige in der Übersicht
      })
    return () => {
      active = false
    }
  }, [])
  return progress
}
