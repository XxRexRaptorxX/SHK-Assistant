import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getChecklistProgress,
  listChecklistProgress,
  resetChecklistProgress,
  setChecklistItemChecked,
  setChecklistTexts,
  type ChecklistTextField,
} from '../../storage/checklistProgress'

interface LoadedProgress {
  checked: ReadonlySet<string>
  /** Freitext-Titel, z. B. Kunde oder Anlage */
  title: string
  notes: string
}

export type ProgressState =
  | { status: 'loading' }
  | ({ status: 'ready' } & LoadedProgress)
  /** IndexedDB nicht nutzbar: abhaken geht, wird aber nicht gespeichert */
  | ({ status: 'unavailable' } & LoadedProgress)

const EMPTY: LoadedProgress = { checked: new Set(), title: '', notes: '' }

/** Freitexte erst nach einer kurzen Tipp-Pause speichern */
const TEXT_SAVE_DELAY_MS = 500

/** Fortschritt einer Checkliste: sofort in der Anzeige, gespeichert im Hintergrund. */
export function useChecklistProgress(checklistId: string) {
  const [state, setState] = useState<ProgressState>({ status: 'loading' })
  const pendingTexts = useRef<{ timer: ReturnType<typeof setTimeout>; changes: Partial<Record<ChecklistTextField, string>> }>(
    undefined,
  )

  const reload = useCallback(async () => {
    try {
      const record = await getChecklistProgress(checklistId)
      setState({
        status: 'ready',
        checked: new Set(record?.checkedItemIds ?? []),
        title: record?.title ?? '',
        notes: record?.notes ?? '',
      })
    } catch {
      setState((previous) =>
        previous.status === 'loading' ? { status: 'unavailable', ...EMPTY } : { ...previous, status: 'unavailable' },
      )
    }
  }, [checklistId])

  useEffect(() => {
    void reload()
  }, [reload])

  const flushTexts = useCallback(() => {
    const pending = pendingTexts.current
    if (!pending) return
    clearTimeout(pending.timer)
    pendingTexts.current = undefined
    setChecklistTexts(checklistId, pending.changes).catch(() => {
      setState((previous) => (previous.status === 'loading' ? previous : { ...previous, status: 'unavailable' }))
    })
  }, [checklistId])

  // Beim Verlassen der Seite noch nicht gespeicherte Texte sichern
  useEffect(() => flushTexts, [flushTexts])

  const setText = useCallback(
    (field: ChecklistTextField, value: string) => {
      setState((previous) => (previous.status === 'loading' ? previous : { ...previous, [field]: value }))
      const changes = { ...pendingTexts.current?.changes, [field]: value }
      if (pendingTexts.current) clearTimeout(pendingTexts.current.timer)
      pendingTexts.current = { changes, timer: setTimeout(flushTexts, TEXT_SAVE_DELAY_MS) }
    },
    [flushTexts],
  )

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

  /** Entfernt Haken, Titel und Notizen */
  const reset = useCallback(async () => {
    if (pendingTexts.current) clearTimeout(pendingTexts.current.timer)
    pendingTexts.current = undefined
    setState((previous) => (previous.status === 'loading' ? previous : { ...previous, ...EMPTY }))
    try {
      await resetChecklistProgress(checklistId)
    } catch {
      await reload()
    }
  }, [checklistId, reload])

  return {
    state,
    setChecked,
    setTitle: (value: string) => setText('title', value),
    setNotes: (value: string) => setText('notes', value),
    reset,
  }
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
