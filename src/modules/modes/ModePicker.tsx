import { DraftBadge } from '../../components/DraftBadge'
import { modeEntries, toggleModeId } from './modes'
import type { ModeEntry } from './schema'

interface ModePickerProps {
  /** Gewählte Modus-ids; leer = „Alles“ */
  value: readonly string[]
  onChange: (ids: string[]) => void
  /** Für Tests überschreibbar */
  entries?: readonly ModeEntry[]
}

function ModeButton({ label, selected, draft, onClick }: { label: string; selected: boolean; draft?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onClick}
      className={`flex min-h-16 items-center justify-between gap-2 rounded-2xl border-2 px-4 py-2 text-left font-semibold ${
        selected ? 'border-accent bg-accent text-accent-ink' : 'border-edge bg-surface'
      }`}
    >
      <span>
        {label}
        {draft && (
          <span className="mt-1 block">
            <DraftBadge variant="inline" />
          </span>
        )}
      </span>
      <span aria-hidden="true" className="text-2xl leading-none">
        {selected ? '✓' : ''}
      </span>
    </button>
  )
}

/** Auswahl der Modi: mehrere gleichzeitig möglich, „Alles“ hebt die Auswahl auf */
export function ModePicker({ value, onChange, entries = modeEntries }: ModePickerProps) {
  const known = value.filter((id) => entries.some((mode) => mode.id === id))
  return (
    <div role="group" aria-label="Modus" className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
      <ModeButton label="Alles" selected={known.length === 0} onClick={() => onChange([])} />
      {entries.map((mode) => (
        <ModeButton
          key={mode.id}
          label={mode.title}
          selected={known.includes(mode.id)}
          draft={mode.status === 'draft'}
          onClick={() => onChange(toggleModeId(known, mode.id))}
        />
      ))}
    </div>
  )
}
