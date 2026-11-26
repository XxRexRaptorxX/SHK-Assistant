import { useEffect, useId, useRef, useState } from 'react'
import { fieldBase } from '../../components/surfaces'
import type { Refrigerant } from './refrigerantTool'

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`size-6 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
      <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** R-Nummer, dahinter grau der ausgeschriebene Name, falls bekannt */
function RefrigerantLabel({ refrigerant }: { refrigerant: Refrigerant }) {
  return (
    <span className="min-w-0">
      <span className="font-semibold">{refrigerant.name}</span>
      {refrigerant.fullName && <span className="ml-2 text-muted">{refrigerant.fullName}</span>}
    </span>
  )
}

/**
 * Auswahl eines Kältemittels als aufklappbare Liste. Eigene Liste statt <select>, weil Optionen eines
 * <select> keinen teilweise grauen Text erlauben. Schließt bei Tipp außerhalb und mit Escape.
 */
export function RefrigerantSelect({
  label,
  refrigerants,
  value,
  onChange,
}: {
  label: string
  refrigerants: readonly Refrigerant[]
  /** Gewählter Name, z. B. „R32“; leer = noch keins */
  value: string
  onChange: (name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const container = useRef<HTMLDivElement>(null)
  const selected = refrigerants.find((refrigerant) => refrigerant.name === value)

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

  return (
    <div ref={container} className="relative mt-1 w-full max-w-xs">
      <p id={`${id}-label`} className="sr-only">
        {label}
      </p>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => setOpen(!open)}
        className={`${fieldBase} flex w-full items-center justify-between gap-2 text-left`}
      >
        <span id={`${id}-value`} className="min-w-0 truncate">
          {selected ? <RefrigerantLabel refrigerant={selected} /> : <span className="text-muted">Kältemittel wählen …</span>}
        </span>
        <ChevronDown open={open} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 w-full overflow-hidden rounded-xl border-2 border-line bg-surface shadow-xl shadow-black/30">
          <ul id={`${id}-list`} role="listbox" aria-label={label} className="max-h-80 divide-y divide-edge overflow-y-auto">
            {refrigerants.map((refrigerant) => {
              const active = refrigerant.name === value
              return (
                <li key={refrigerant.name}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(refrigerant.name)
                      setOpen(false)
                    }}
                    className={`flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left hover:bg-raised ${active ? 'bg-raised' : ''}`}
                  >
                    <span aria-hidden="true" className="w-4 shrink-0">
                      {active ? '✓' : ''}
                    </span>
                    <RefrigerantLabel refrigerant={refrigerant} />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
