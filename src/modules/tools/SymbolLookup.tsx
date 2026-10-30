import { useId, useState } from 'react'
import { HeadingWithClear } from '../../components/ClearInputsButton'
import { fieldBase } from '../../components/surfaces'
import {
  filterSymbolGroups,
  SYMBOL_COLORS,
  SYMBOL_VIEWBOX,
  type SymbolEntry,
  type SymbolShape,
  type SymbolTool,
} from './symbolTool'

const BOLD_STROKE = 3
const STROKE = 1.5
/** Feine Details, z. B. dicht stehende Linien im Gassicherheitsverteiler */
const THIN_STROKE = 0.9
/** Strichfarbe auf weißem Grund (farbige Sinnbilder) */
const PAPER_INK = '#1f2937'

function Shape({ shape }: { shape: SymbolShape }) {
  const color = shape.color ? SYMBOL_COLORS[shape.color] : undefined
  if ('text' in shape) {
    return (
      <text
        x={shape.x}
        y={shape.y}
        fontSize={shape.size}
        fill={color ?? 'currentColor'}
        stroke="none"
        textAnchor="middle"
        dominantBaseline="central"
        fontWeight={600}
      >
        {shape.text}
      </text>
    )
  }
  const props = {
    fill: shape.fill ? (color ?? 'currentColor') : 'none',
    stroke: color,
    strokeWidth: shape.bold ? BOLD_STROKE : shape.thin ? THIN_STROKE : STROKE,
    // Fette Striche brauchen größere Lücken, sonst schließen die runden Enden sie
    strokeDasharray: shape.dash
      ? shape.bold
        ? '6 6'
        : '3 2.5'
      : shape.dashDot
        ? shape.bold
          ? '9 5.5 0.1 5.5'
          : '6 2.5 1 2.5'
        : undefined,
  }
  if ('circle' in shape) {
    const [cx, cy, r] = shape.circle
    return <circle cx={cx} cy={cy} r={r} {...props} />
  }
  return <path d={shape.d} {...props} />
}

/**
 * Sinnbild als Strichgrafik in Textfarbe (passt zu hellem und dunklem Design). Mit Farben steht es
 * wie auf einem Plan auf weißem Grund, damit Schwarz, Gelb und Weiß in beiden Designs erkennbar sind.
 */
export function SymbolDrawing({ symbol, className = '' }: { symbol: SymbolEntry; className?: string }) {
  const paper = symbol.draw.some((shape) => shape.color !== undefined)
  return (
    <svg
      viewBox={`0 0 ${SYMBOL_VIEWBOX.width} ${SYMBOL_VIEWBOX.height}`}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={paper ? { color: PAPER_INK } : undefined}
    >
      {paper && <rect width={SYMBOL_VIEWBOX.width} height={SYMBOL_VIEWBOX.height} rx={3} fill="#ffffff" stroke="none" />}
      {symbol.draw.map((shape, index) => (
        <Shape key={index} shape={shape} />
      ))}
    </svg>
  )
}

/** Sinnbild-Tool: Suchfeld, darunter die passenden Sinnbilder nach Gruppen */
export function SymbolLookup({ tool, initialQuery = '' }: { tool: SymbolTool; initialQuery?: string }) {
  const idPrefix = useId()
  const inputId = `${idPrefix}-input`
  const [query, setQuery] = useState(initialQuery)
  const groups = filterSymbolGroups(tool, query)
  const count = groups.reduce((sum, group) => sum + group.symbols.length, 0)

  return (
    <section className="mt-6" aria-labelledby={`${idPrefix}-heading`}>
      <HeadingWithClear id={`${idPrefix}-heading`} onClear={() => setQuery('')} disabled={query === ''}>
        Suchen
      </HeadingWithClear>
      <label htmlFor={inputId} className="mt-3 block font-semibold">
        Bauteil oder Begriff
      </label>
      <input
        id={inputId}
        type="search"
        autoComplete="off"
        placeholder="z. B. Kugelhahn"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className={`${fieldBase} mt-1 w-full`}
      />
      <p className="mt-2 text-base text-muted" aria-live="polite">
        {count === 0 ? 'Kein Sinnbild gefunden.' : count === 1 ? '1 Sinnbild' : `${count} Sinnbilder`}
      </p>

      {groups.map((group) => (
        <section key={group.title} className="mt-6" aria-label={group.title}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 className="text-lg font-bold text-accent">{group.title}</h3>
            <span className="text-base text-muted">{group.norm}</span>
          </div>
          {group.note && <p className="text-base text-muted">{group.note}</p>}
          {/* Handy: Zeilen mit Sinnbild links, damit lange Namen Platz haben; breiter: Kacheln */}
          <ul className="mt-2 grid gap-2 sm:grid-cols-3 sm:gap-3">
            {group.symbols.map((symbol) => (
              <li
                key={symbol.name}
                className="flex items-center gap-3 rounded-2xl border-2 border-edge bg-surface p-3 sm:flex-col sm:items-stretch"
              >
                <SymbolDrawing symbol={symbol} className="h-auto w-28 shrink-0 text-ink sm:w-full" />
                <span className="min-w-0">
                  <span className="block font-semibold leading-tight hyphens-auto sm:mt-2">{symbol.name}</span>
                  {symbol.note && <span className="mt-1 block text-sm text-muted hyphens-auto">{symbol.note}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  )
}
