import { useEffect, useRef, useState } from 'react'
import {
  INITIAL_STATE,
  keyForKeyboard,
  press,
  scientificKeys,
  screen,
  STANDARD_KEYS,
  type CalculatorState,
  type Key,
  type KeyStyle,
} from './keypad'

const KEY_STYLES: Record<KeyStyle, string> = {
  digit: 'border border-edge bg-surface text-ink',
  operator: 'bg-raised font-bold text-accent',
  function: 'bg-raised text-ink',
  equals: 'bg-accent font-bold text-accent-ink',
  clear: 'bg-warn font-bold text-warn-ink',
}

/** Taschenrechner bzw. wissenschaftlicher Rechner: Anzeige und Tastenfeld */
export function KeypadCalculator({ mode, initialState = INITIAL_STATE }: {
  mode: 'standard' | 'scientific'
  /** Für Tests */
  initialState?: CalculatorState
}) {
  const [state, setState] = useState(initialState)
  const scientific = mode === 'scientific'
  const keys = scientific ? scientificKeys(state.second, state.angle) : STANDARD_KEYS
  const { input, preview } = screen(state)

  // Computertastatur: aktuelle Tastenbelegung ohne neues Abonnieren bei jedem Tastendruck
  const keysRef = useRef(keys)
  keysRef.current = keys
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      const key = keyForKeyboard(event, keysRef.current)
      if (!key) return
      event.preventDefault()
      setState((current) => press(current, key))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="mx-auto max-w-md">
      <div className={`rounded-2xl border-2 border-line bg-surface text-right ${scientific ? 'px-4 py-2' : 'p-4'}`}>
        <div className="flex min-h-6 items-center justify-between gap-2 text-base text-muted">
          <span className="flex gap-2 text-sm font-bold">
            {scientific && <span>{state.angle === 'deg' ? 'DEG' : 'RAD'}</span>}
            {scientific && state.second && <span className="text-accent">2nd</span>}
          </span>
          <span className="break-all">{state.previous}</span>
        </div>
        <output
          aria-live="polite"
          aria-label="Eingabe"
          className={`mt-1 block min-h-12 font-semibold break-all ${state.evaluated ? 'text-4xl' : 'text-3xl'}`}
        >
          {input}
        </output>
        <p className="min-h-8 text-xl text-muted" aria-live="polite">
          {state.message ? (
            <span className="rounded-lg bg-warn px-2 font-semibold text-warn-ink">{state.message}</span>
          ) : (
            preview && `= ${preview}`
          )}
        </p>
      </div>

      <div className={`mt-3 grid ${scientific ? 'grid-cols-5 gap-1.5' : 'grid-cols-4 gap-2'}`}>
        {keys.map((key: Key) => {
          const pressed = key.kind === 'action' && key.action === 'second' ? state.second : undefined
          return (
            <button
              key={key.id}
              type="button"
              aria-label={key.aria}
              aria-pressed={pressed}
              onClick={() => setState((current) => press(current, key))}
              className={`rounded-2xl select-none active:scale-95 ${
                scientific ? 'min-h-12 text-lg' : 'min-h-16 text-2xl'
              } ${KEY_STYLES[key.style]} ${pressed ? 'ring-2 ring-accent' : ''} ${
                key.kind === 'digit' ? 'font-semibold' : ''
              }`}
            >
              {/* Zeichen der Taste „letzte Eingabe löschen“ rot */}
              {key.kind === 'action' && key.action === 'back' ? (
                <span className="text-[var(--fig-hot)]">{key.label}</span>
              ) : (
                key.label
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
