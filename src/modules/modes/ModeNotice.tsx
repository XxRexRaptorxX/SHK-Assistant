import { Link, useLocation } from 'react-router'
import { MODE_PAGE_PATH, type ModePageOrigin } from './ModePage'
import type { ModeEntry } from './schema'

// Eigene Farbe je Modus, im Stil der Themen-Tags (src/components/TopicTags.tsx), Kontrast > 7:1.
// Schlüssel: id ohne Präfix „mode.“. Klassen ausgeschrieben, damit Tailwind sie findet.
const MODE_COLORS: Record<string, string> = {
  'anlagenmechaniker-shk': 'border-red-500 bg-red-800 text-white',
  elektriker: 'border-yellow-500 bg-yellow-300 text-yellow-950 dark:border-yellow-300 dark:bg-yellow-400 dark:text-yellow-950',
  lueftungsbauer: 'border-green-300 bg-green-100 text-green-900 dark:border-green-700 dark:bg-green-950 dark:text-green-200',
  kaeltetechniker: 'border-cyan-300 bg-cyan-100 text-cyan-900 dark:border-cyan-700 dark:bg-cyan-950 dark:text-cyan-200',
  azubi: 'border-lime-500 bg-lime-200 text-lime-950 dark:border-lime-600 dark:bg-lime-950 dark:text-lime-200',
  'kundendienst-monteur':
    'border-purple-300 bg-purple-100 text-purple-900 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-200',
  'rohbau-monteur': 'border-amber-900 bg-amber-800 text-white dark:border-amber-700 dark:bg-amber-900 dark:text-amber-50',
  installateur: 'border-blue-300 bg-blue-100 text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200',
  planer: 'border-fuchsia-500 bg-fuchsia-800 text-white',
}

/** Neutral für Modi ohne eigene Farbe */
const FALLBACK_COLOR = 'border-zinc-400 bg-zinc-200 text-zinc-900 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100'

export const modeColor = (mode: ModeEntry): string => MODE_COLORS[mode.id.replace(/^mode\./, '')] ?? FALLBACK_COLOR

/** Farbige Kästchen der gewählten Modi, nebeneinander */
export function ModeChips({ modes }: { modes: readonly ModeEntry[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <span className="sr-only">Modus:</span>
      {modes.map((mode) => (
        <span key={mode.id} className={`rounded-full border px-2.5 py-0.5 text-sm font-semibold ${modeColor(mode)}`}>
          {mode.title}
        </span>
      ))}
    </span>
  )
}

interface ModeNoticeProps {
  modes: readonly ModeEntry[]
  /** Anzahl der Einträge, die der Modus in dieser Liste ausblendet */
  hiddenCount: number
  /** Mehrzahl des Eintrags, z. B. "Tools" oder "Formeln" */
  noun: string
  /** Name der Liste für den Zurück-Link der Modus-Seite, z. B. "Tools" */
  listTitle: string
}

/** Kompakte Zeile über einer Liste: gewählte Modi als farbige Kästchen, Link zur Modus-Auswahl. Bei „Alles“ nichts. */
export function ModeNotice({ modes, hiddenCount, noun, listTitle }: ModeNoticeProps) {
  const { pathname } = useLocation()
  if (modes.length === 0) return null
  const origin: ModePageOrigin = { from: pathname, label: listTitle }
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl border border-edge bg-surface px-4 py-1.5 text-base">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <ModeChips modes={modes} />
        {hiddenCount > 0 && (
          <span className="text-muted">
            {hiddenCount} {noun} ausgeblendet
          </span>
        )}
      </span>
      <Link
        to={MODE_PAGE_PATH}
        state={origin}
        className="inline-flex min-h-12 items-center font-semibold text-accent underline"
      >
        Ändern
      </Link>
    </div>
  )
}
