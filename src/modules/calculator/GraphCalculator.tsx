import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { secondaryButton } from '../../components/buttons'
import { chip, fieldBase } from '../../components/surfaces'
import {
  compileFunction,
  DEFAULT_VIEW,
  panView,
  sampleFunction,
  ticks,
  tickStep,
  zoomView,
  type View,
} from './graph'

// Zeichenfläche in viewBox-Einheiten; die Grafik skaliert mit der Breite
const W = 400
const H = 300

const FUNCTIONS = [
  { name: 'f', color: 'var(--graph-1)' },
  { name: 'g', color: 'var(--graph-2)' },
  { name: 'h', color: 'var(--graph-3)' },
] as const

/** Einfügeknöpfe, weil ^, π und Wurzel auf der Handytastatur umständlich sind */
const INSERTS = ['x', '^', '²', '√(', 'π', 'sin(', 'cos(', '(', ')'] as const

const labelFormat = new Intl.NumberFormat('de-DE', { maximumSignificantDigits: 6 })
const valueFormat = new Intl.NumberFormat('de-DE', { maximumSignificantDigits: 8 })

export function GraphCalculator({ initialInputs = ['x^2', '', ''] }: { initialInputs?: string[] }) {
  const [inputs, setInputs] = useState(initialInputs)
  const [view, setView] = useState<View>(DEFAULT_VIEW)
  const [traceX, setTraceX] = useState<number | undefined>(undefined)
  const focused = useRef<{ index: number; element: HTMLInputElement | null }>({ index: 0, element: null })

  const compiled = useMemo(() => inputs.map((input) => compileFunction(input)), [inputs])

  const insert = (text: string) => {
    const { index, element } = focused.current
    const value = inputs[index] ?? ''
    const start = element?.selectionStart ?? value.length
    const end = element?.selectionEnd ?? value.length
    const value2 = text === '²' ? '^2' : text
    const next = value.slice(0, start) + value2 + value.slice(end)
    setInputs(inputs.map((v, i) => (i === index ? next : v)))
    // Cursor hinter den eingefügten Text setzen
    requestAnimationFrame(() => {
      element?.focus()
      element?.setSelectionRange(start + value2.length, start + value2.length)
    })
  }

  return (
    <div>
      <div className="space-y-2">
        {FUNCTIONS.map((fn, index) => {
          const result = compiled[index]
          const error = result && !result.ok ? result.error : ''
          return (
            <div key={fn.name}>
              <label className="flex items-center gap-2">
                <span className="w-14 shrink-0 font-bold" style={{ color: fn.color }}>
                  {fn.name}(x) =
                </span>
                <input
                  type="text"
                  value={inputs[index] ?? ''}
                  onChange={(event) => setInputs(inputs.map((v, i) => (i === index ? event.target.value : v)))}
                  onFocus={(event) => (focused.current = { index, element: event.currentTarget })}
                  onSelect={(event) => (focused.current = { index, element: event.currentTarget })}
                  placeholder={index === 0 ? 'z. B. 0,5x^2 − 2' : 'optional'}
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={error !== ''}
                  className={`${fieldBase} min-h-12 w-full min-w-0 font-mono`}
                />
              </label>
              {error && (
                <p role="alert" className="mt-1 ml-16 text-base font-semibold text-warn-ink">
                  <span className="rounded-lg bg-warn px-2">{error}</span>
                </p>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Zeichen einfügen">
        {INSERTS.map((text) => (
          <button
            key={text}
            type="button"
            // Fokus im Eingabefeld lassen, damit die Cursorposition erhalten bleibt
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => insert(text)}
            className={`${chip} min-h-11 min-w-11 justify-center font-mono text-base`}
          >
            {text === '²' ? 'x²' : text}
          </button>
        ))}
      </div>
      <Plot
        view={view}
        onViewChange={setView}
        traceX={traceX}
        onTrace={setTraceX}
        curves={FUNCTIONS.map((fn, index) => {
          const result = compiled[index]
          return { ...fn, fn: result?.ok ? result.fn : undefined }
        })}
      />

      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={secondaryButton} aria-label="Vergrößern" onClick={() => setView(zoomView(view, 0.5))}>
          +
        </button>
        <button type="button" className={secondaryButton} aria-label="Verkleinern" onClick={() => setView(zoomView(view, 2))}>
          −
        </button>
        <button
          type="button"
          className={secondaryButton}
          onClick={() => {
            setView(DEFAULT_VIEW)
            setTraceX(undefined)
          }}
        >
          Ansicht zurücksetzen
        </button>
      </div>
      <p className="mt-2 text-base text-muted">
        Dezimalkomma, Argumente mit „;“ trennen, Winkel im Bogenmaß. Verschieben mit dem Finger, zoomen mit
        zwei Fingern; Tippen zeigt die Werte.
      </p>

      {traceX !== undefined && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-lg" aria-live="polite">
          <dt className="font-semibold">x</dt>
          <dd>{valueFormat.format(traceX)}</dd>
          {FUNCTIONS.map((fn, index) => {
            const result = compiled[index]
            if (!result?.ok) return null
            const y = result.fn(traceX)
            return (
              <div key={fn.name} className="contents">
                <dt className="font-semibold" style={{ color: fn.color }}>
                  {fn.name}(x)
                </dt>
                <dd>{Number.isFinite(y) ? valueFormat.format(Number(y.toPrecision(10))) : 'nicht definiert'}</dd>
              </div>
            )
          })}
        </dl>
      )}
    </div>
  )
}

interface Curve {
  name: string
  color: string
  fn?: (x: number) => number
}

function Plot({ view, onViewChange, traceX, onTrace, curves }: {
  view: View
  onViewChange: (update: (view: View) => View) => void
  traceX: number | undefined
  onTrace: (x: number) => void
  curves: Curve[]
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const moved = useRef(false)

  const width = view.xMax - view.xMin
  const height = view.yMax - view.yMin
  const sx = (x: number) => ((x - view.xMin) / width) * W
  const sy = (y: number) => H - ((y - view.yMin) / height) * H
  const dataX = (px: number) => view.xMin + (px / W) * width
  const dataY = (py: number) => view.yMin + ((H - py) / H) * height

  /** Bildschirmpunkt in viewBox-Einheiten */
  const toViewBox = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return { x: 0, y: 0 }
    return { x: ((clientX - rect.left) / rect.width) * W, y: ((clientY - rect.top) / rect.height) * H }
  }

  // Mausrad zoomt um den Mauszeiger; braucht einen nicht-passiven Listener, sonst scrollt die Seite
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const point = toViewBox(event.clientX, event.clientY)
      const factor = event.deltaY > 0 ? 1.2 : 1 / 1.2
      onViewChange((current) =>
        zoomView(current, factor, {
          x: current.xMin + (point.x / W) * (current.xMax - current.xMin),
          y: current.yMin + ((H - point.y) / H) * (current.yMax - current.yMin),
        }),
      )
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [onViewChange])

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, toViewBox(event.clientX, event.clientY))
    moved.current = false
  }

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return
    const point = toViewBox(event.clientX, event.clientY)
    const others = [...pointers.current.entries()].filter(([id]) => id !== event.pointerId).map(([, p]) => p)
    pointers.current.set(event.pointerId, point)
    if (others.length === 0) {
      if (Math.hypot(point.x - previous.x, point.y - previous.y) > 0.5) moved.current = true
      // Verschieben: Fläche folgt dem Finger
      onViewChange((current) =>
        panView(
          current,
          (-(point.x - previous.x) / W) * (current.xMax - current.xMin),
          ((point.y - previous.y) / H) * (current.yMax - current.yMin),
        ),
      )
    } else {
      // Zwei Finger: Abstand ändert den Maßstab um die Mitte
      const other = others[0]!
      const before = Math.hypot(previous.x - other.x, previous.y - other.y)
      const after = Math.hypot(point.x - other.x, point.y - other.y)
      if (before > 0 && after > 0) {
        moved.current = true
        const mid = { x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 }
        onViewChange((current) =>
          zoomView(current, before / after, {
            x: current.xMin + (mid.x / W) * (current.xMax - current.xMin),
            y: current.yMin + ((H - mid.y) / H) * (current.yMax - current.yMin),
          }),
        )
      }
    }
  }

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = pointers.current.get(event.pointerId)
    pointers.current.delete(event.pointerId)
    if (point && !moved.current && pointers.current.size === 0) onTrace(dataX(point.x))
  }

  const xStep = tickStep(width)
  const yStep = tickStep(height, 6)
  const xTicks = ticks(view.xMin, view.xMax, xStep)
  const yTicks = ticks(view.yMin, view.yMax, yStep)
  // Achsen am Rand halten, wenn der Nullpunkt außerhalb liegt
  const axisY = Math.min(H - 14, Math.max(0, sy(0)))
  const axisX = Math.min(W - 2, Math.max(2, sx(0)))

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Funktionsgraph"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="mt-3 block w-full touch-none rounded-2xl border-2 border-line bg-surface select-none"
    >
      {xTicks.map((x) => (
        <line key={`gx${x}`} x1={sx(x)} x2={sx(x)} y1={0} y2={H} stroke="var(--edge)" strokeWidth={1} />
      ))}
      {yTicks.map((y) => (
        <line key={`gy${y}`} x1={0} x2={W} y1={sy(y)} y2={sy(y)} stroke="var(--edge)" strokeWidth={1} />
      ))}
      <line x1={0} x2={W} y1={sy(0)} y2={sy(0)} stroke="var(--line)" strokeWidth={1.5} />
      <line x1={sx(0)} x2={sx(0)} y1={0} y2={H} stroke="var(--line)" strokeWidth={1.5} />
      <g fill="var(--muted)" style={{ fontSize: 11 }}>
        {xTicks
          .filter((x) => x !== 0)
          .map((x) => (
            <text key={`tx${x}`} x={sx(x)} y={axisY + 12} textAnchor="middle">
              {labelFormat.format(x)}
            </text>
          ))}
        {yTicks
          .filter((y) => y !== 0)
          .map((y) => (
            <text key={`ty${y}`} x={axisX + (axisX > W - 40 ? -4 : 4)} y={sy(y) + 4} textAnchor={axisX > W - 40 ? 'end' : 'start'}>
              {labelFormat.format(y)}
            </text>
          ))}
      </g>
      {curves.map((curve) =>
        curve.fn
          ? sampleFunction(curve.fn, view).map((segment, index) => (
              <polyline
                key={`${curve.name}${index}`}
                points={segment.map(([x, y]) => `${sx(x).toFixed(2)},${sy(y).toFixed(2)}`).join(' ')}
                fill="none"
                stroke={curve.color}
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
            ))
          : null,
      )}
      {traceX !== undefined && (
        <g>
          <line x1={sx(traceX)} x2={sx(traceX)} y1={0} y2={H} stroke="var(--muted)" strokeDasharray="4 4" />
          {curves.map((curve) => {
            const y = curve.fn?.(traceX)
            return y !== undefined && Number.isFinite(y) && y >= view.yMin && y <= view.yMax ? (
              <circle key={curve.name} cx={sx(traceX)} cy={sy(y)} r={5} fill={curve.color} />
            ) : null
          })}
        </g>
      )}
      <title>{`Ausschnitt x ${labelFormat.format(view.xMin)} bis ${labelFormat.format(view.xMax)}, y ${labelFormat.format(dataY(H))} bis ${labelFormat.format(dataY(0))}`}</title>
    </svg>
  )
}
