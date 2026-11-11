import { useEffect, useRef, useState, type ReactNode } from 'react'
import { fieldBase } from './surfaces'

/**
 * Eingabefeld mit früheren Eingaben als Vorschlägen (z. B. Bauvorhaben, Artikel). Die Liste liegt über dem Formular und
 * erscheint nur, solange das Feld in Benutzung ist, damit sie nichts verschiebt und keinen Platz belegt.
 */
export function SuggestInput({
  id,
  value,
  onChange,
  suggestions,
  listLabel,
  placeholder,
  onPick,
  onForget,
  initialOpen = false,
  children,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  /** Name der Vorschlagsliste für Screenreader, z. B. „Frühere Bauvorhaben“ */
  listLabel: string
  placeholder?: string
  /** Vorschlag angetippt; ohne Angabe wie eine Eingabe */
  onPick?: (suggestion: string) => void
  /** Vorschlag aus dem Gedächtnis löschen (z. B. Tippfehler); ohne Angabe gibt es keinen Knopf dafür */
  onForget?: (suggestion: string) => void
  /** Liste schon offen (Tests) */
  initialOpen?: boolean
  /** Weitere Knöpfe rechts neben dem Feld */
  children?: ReactNode
}) {
  const [open, setOpen] = useState(initialOpen)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const inside = (target: EventTarget | null) =>
    target instanceof Node && (input.current?.contains(target) === true || list.current?.contains(target) === true)

  // Tippen daneben schließt die Liste; iOS nimmt dem Feld dabei nicht immer den Fokus
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!inside(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  const pick = (suggestion: string) => {
    if (onPick) onPick(suggestion)
    else onChange(suggestion)
    setOpen(false)
    input.current?.blur()
  }

  return (
    <div
      className="relative mt-1 flex gap-2"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
      }}
      onBlur={(event) => {
        // Nur beim Weitergehen per Tastatur; beim Antippen eines Vorschlags ist relatedTarget oft leer
        if (event.relatedTarget && !inside(event.relatedTarget)) setOpen(false)
      }}
    >
      <input
        ref={input}
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        className={`${fieldBase} w-full min-w-0 flex-1`}
      />
      {children}
      {open && suggestions.length > 0 && (
        <ul
          ref={list}
          aria-label={listLabel}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-52 divide-y divide-edge overflow-y-auto rounded-xl border-2 border-line bg-surface shadow-xl shadow-black/40"
        >
          {suggestions.map((suggestion) => (
            <li key={suggestion} className="flex items-stretch">
              <button
                type="button"
                onClick={() => pick(suggestion)}
                className="min-h-12 w-full min-w-0 flex-1 px-3 py-2 text-left font-semibold [overflow-wrap:anywhere]"
              >
                {suggestion}
              </button>
              {onForget && (
                <button
                  type="button"
                  aria-label={`„${suggestion}“ nicht mehr vorschlagen`}
                  title="Nicht mehr vorschlagen"
                  onClick={() => onForget(suggestion)}
                  className="min-h-12 w-12 shrink-0 text-2xl text-muted"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
