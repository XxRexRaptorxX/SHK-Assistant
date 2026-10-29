import type { ReactNode } from 'react'
import { EraserIcon } from './icons'

/**
 * Knopf mit rotem Radiergummi: setzt alle Eingabefelder eines Rechners auf den Ausgangszustand zurück
 * (leer bzw. Vorbelegung). Unsichtbar, solange nichts eingegeben wurde; der Platz bleibt
 * reserviert, damit die Überschrift beim Tippen nicht springt.
 */
export function ClearInputsButton({ onClear, disabled }: { onClear: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClear}
      disabled={disabled}
      aria-label="Alle Eingaben löschen"
      title="Alle Eingaben löschen"
      className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl border-2 border-red-600 bg-surface text-red-600 disabled:invisible dark:border-red-400 dark:text-red-400 print:hidden"
    >
      <EraserIcon className="size-6" />
    </button>
  )
}

/** Überschrift eines Rechners mit dem Löschen-Knopf rechts daneben */
export function HeadingWithClear({
  id,
  children,
  onClear,
  disabled,
}: {
  id: string
  children: ReactNode
  onClear: () => void
  disabled: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="text-xl font-bold">
        {children}
      </h2>
      <ClearInputsButton onClear={onClear} disabled={disabled} />
    </div>
  )
}
