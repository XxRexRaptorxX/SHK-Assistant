import type { ReactNode } from 'react'
import { EyeIcon, EyeOffIcon } from '../../components/icons'
import { updateSettings } from '../../settings/settings'
import { TermLink } from '../lexicon/TermLink'
import type { ConverterEntry } from './schema'
import { fieldBase } from '../../components/surfaces'

// Gemeinsame Bausteine der Umrechner-Ansichten

/** Name mit grauem Formelzeichen dahinter, z. B. „Fläche A“ */
export function ConverterTitle({ entry }: { entry: Pick<ConverterEntry, 'title' | 'symbol'> }) {
  return (
    <>
      {entry.title}
      {entry.symbol && <span className="ml-2 font-normal text-muted">{entry.symbol}</span>}
    </>
  )
}

const fieldClass = fieldBase

export function Select<T extends string>({ id, label, options, value, onChange, className = 'min-w-28 shrink-0' }: {
  id: string
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  /** Breite/Ausrichtung, Standard: so breit wie nötig */
  className?: string
}) {
  return (
    <select
      id={id}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className={`${fieldClass} ${className}`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

const ROW = 'mt-1 grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2'

/**
 * Zwei Zeilen: „Von“ mit Eingabe und Einheit, „Nach“ mit Ergebnis und Einheit.
 * Das Ergebnis steht im Feld der Nach-Zeile (hervorgehoben), Hinweise unter der Eingabe.
 */
export function ConversionInputs<T extends string>({
  id,
  raw,
  onRawChange,
  invalid,
  hint,
  emptyHint,
  result,
  options,
  from,
  to,
  onFromChange,
  onToChange,
}: {
  /** Präfix für die ids der Felder */
  id: string
  raw: string
  onRawChange: (value: string) => void
  invalid: boolean
  hint?: string
  /** Hinweis bei leerem Feld, z. B. „Bitte einen Wert eingeben.“ */
  emptyHint: string
  /** Ergebnis ohne Einheit, z. B. „1.000“; „–“ ohne gültige Eingabe */
  result: string
  options: readonly { value: T; label: string }[]
  from: T
  to: T
  onFromChange: (value: T) => void
  onToChange: (value: T) => void
}) {
  return (
    <div className="mt-2">
      <label htmlFor={`${id}-value`} className="block font-semibold">
        Von
      </label>
      <div className={ROW}>
        <ValueInput id={`${id}-value`} value={raw} onChange={onRawChange} invalid={invalid} showError={false} />
        <Select id={`${id}-from`} label="Von: Einheit" options={options} value={from} onChange={onFromChange} className="w-full min-w-0" />
      </div>
      {invalid && <InvalidHint id={`${id}-value`} hint={hint} />}
      {raw.trim() === '' && <p className="mt-1 text-base text-muted">{emptyHint}</p>}

      <label htmlFor={`${id}-to`} className="mt-3 block font-semibold">
        Nach
      </label>
      <div className={ROW}>
        <output
          htmlFor={`${id}-value ${id}-from ${id}-to`}
          aria-live="polite"
          className="flex min-h-12 min-w-0 items-center rounded-xl border-2 border-accent bg-surface px-3 text-xl font-bold break-all"
        >
          {result}
        </output>
        <Select id={`${id}-to`} label="Nach: Einheit" options={options} value={to} onChange={onToChange} className="w-full min-w-0" />
      </div>
    </div>
  )
}

const DEFAULT_HINT = 'Beispiel: 12,5'

function InvalidHint({ id, hint = DEFAULT_HINT }: { id: string; hint?: string }) {
  return (
    <p id={`${id}-error`} className="mt-1 basis-full text-base font-semibold">
      Ungültige Eingabe ({hint})
    </p>
  )
}

export function ValueInput({ id, value, onChange, invalid, hint = DEFAULT_HINT, inputMode = 'decimal', showError = true }: {
  id: string
  value: string
  onChange: (value: string) => void
  invalid: boolean
  hint?: string
  inputMode?: 'decimal' | 'text'
  /** false: Fehlermeldung zeigt der Aufrufer selbst (z. B. unter einer Zeile mit mehreren Feldern) */
  showError?: boolean
}) {
  return (
    <>
      <input
        id={id}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        value={value}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`${fieldClass} w-full min-w-0`}
      />
      {invalid && showError && <InvalidHint id={id} hint={hint} />}
    </>
  )
}

export interface ResultRow {
  key: string
  value: string
  label: string
  /** Ausgeschriebener Name, grau hinter der Einheit */
  name?: string
  /** Lexikon-Eintrag zur Einheit; Einheit und Name werden dann unauffällig verlinkt */
  href?: string
  highlight?: boolean
}

/** Umschalter: unübliche Einheiten ein- oder ausblenden (gleiche Einstellung wie in den Einstellungen) */
export function RareUnitsToggle({ hidden }: { hidden: boolean }) {
  // Nur Symbol: offenes Auge = alle sichtbar, durchgestrichen = unübliche ausgeblendet
  const Icon = hidden ? EyeOffIcon : EyeIcon
  const label = hidden ? 'Unübliche Einheiten einblenden' : 'Unübliche Einheiten ausblenden'
  return (
    <button
      type="button"
      aria-pressed={hidden}
      aria-label={label}
      title={label}
      onClick={() => updateSettings({ hideRareUnits: !hidden })}
      className="flex size-11 items-center justify-center rounded-full border border-edge bg-raised text-ink"
    >
      <Icon className="size-6" />
    </button>
  )
}

/** Name nur, wenn eingeschaltet und nicht gleich der Kurzform (z. B. „Tag“) */
export function displayName(names: Record<string, string>, key: string, label: string, show: boolean): string | undefined {
  const name = names[key]
  return show && name && name.toLowerCase() !== label.toLowerCase() ? name : undefined
}

export function ResultsTable({ title, rows, wrapValues = false, action }: {
  title: string
  rows: ResultRow[]
  /** Lange Werte ohne Leerzeichen umbrechen (z. B. Hexadezimalzahlen); sonst bleiben Zahlen zusammen */
  wrapValues?: boolean
  /** Knopf rechts neben der Überschrift, z. B. unübliche Einheiten ein-/ausblenden */
  action?: ReactNode
}) {
  if (rows.length === 0) return null
  // Namen in eigener Spalte, damit sie alle auf einer Linie beginnen
  const hasNames = rows.some((row) => row.name)
  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{title}</h2>
        {action}
      </div>
      <div className="mt-2 overflow-hidden rounded-2xl border border-edge bg-surface">
        <table className="w-full text-lg" aria-live="polite">
          <tbody className="divide-y divide-edge">
            {rows.map((row) => (
              <tr key={row.key} className={row.highlight ? 'bg-raised font-bold' : ''}>
                {/* Linker Rand wächst mit der Breite: am schmalen Handy knapp, sonst etwas Luft */}
                <td
                  className={`py-2 pr-3 pl-4 text-right tabular-nums min-[400px]:pl-8 sm:pl-14 ${wrapValues ? '[overflow-wrap:anywhere]' : 'whitespace-nowrap'}`}
                >
                  {row.value}
                </td>
                <td className={`py-2 ${hasNames ? '' : 'w-full pr-4'}`}>
                  <TermLink to={row.href}>{row.label}</TermLink>
                </td>
                {hasNames && (
                  <td className="w-full py-2 pr-4 pl-5 text-base font-normal text-muted hyphens-auto">
                    {row.name && <TermLink to={row.href}>{row.name}</TermLink>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
