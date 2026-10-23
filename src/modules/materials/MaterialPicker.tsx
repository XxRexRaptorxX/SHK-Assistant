import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { DraftBadge } from '../../components/DraftBadge'
import { formatAnyUnit } from '../units/labels'
import type { MaterialPreset } from './materials'

const valueFormat = new Intl.NumberFormat('de-DE', { maximumSignificantDigits: 10 })

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`size-6 transition-transform ${open ? 'rotate-180' : ''}`}>
      <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Eingabefeld mit Pfeil rechts: öffnet eine Liste bekannter Stoffwerte, die Auswahl wird
 * eingetragen. Freie Eingabe bleibt möglich; das Feld selbst kommt als children.
 */
export function MaterialPicker({ label, presets, onPick, children }: {
  /** Name der Größe, für Bedienhilfen */
  label: string
  presets: readonly MaterialPreset[]
  onPick: (preset: MaterialPreset) => void
  /** Das eigentliche Eingabefeld (mit Platz rechts für den Pfeil) */
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const container = useRef<HTMLDivElement>(null)

  // Schließen bei Tipp außerhalb und mit Escape
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const sources = [...new Set(presets.map((preset) => preset.source))]

  return (
    <div ref={container} className="relative min-w-0 flex-1">
      {children}
      <button
        type="button"
        aria-label={`Bekannte Werte für ${label}`}
        title="Bekannte Werte"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
        className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-raised"
      >
        <ChevronDown open={open} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 w-max max-w-[min(28rem,calc(100vw-2rem))] min-w-full overflow-hidden rounded-xl border-2 border-line bg-surface shadow-xl shadow-black/30">
          <ul id={listId} role="listbox" aria-label={`Bekannte Werte für ${label}`} className="max-h-72 divide-y divide-edge overflow-y-auto">
            {presets.map((preset, index) => (
              <li key={index}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    onPick(preset)
                    setOpen(false)
                  }}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-raised"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{preset.name}</span>
                    {preset.note && <span className="block text-base text-muted">{preset.note}</span>}
                  </span>
                  <span className="shrink-0 whitespace-nowrap tabular-nums">
                    {valueFormat.format(preset.value)} {formatAnyUnit(preset.unit)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-edge px-3 py-2 text-sm text-muted [overflow-wrap:anywhere]">
            {presets.some((preset) => preset.draft) && (
              <span className="mr-2 align-middle">
                <DraftBadge variant="inline" />
              </span>
            )}
            Richtwerte · Quelle: {sources.join('; ')}
          </div>
        </div>
      )}
    </div>
  )
}
