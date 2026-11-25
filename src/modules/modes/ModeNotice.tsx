import { Link, useLocation } from 'react-router'
import { MODE_PAGE_PATH, type ModePageOrigin } from './ModePage'
import type { ModeEntry } from './schema'

interface ModeNoticeProps {
  modes: readonly ModeEntry[]
  /** Anzahl der Einträge, die der Modus in dieser Liste ausblendet */
  hiddenCount: number
  /** Mehrzahl des Eintrags, z. B. "Tools" oder "Formeln" */
  noun: string
  /** Name der Liste für den Zurück-Link der Modus-Seite, z. B. "Tools" */
  listTitle: string
}

/** Kompakte Zeile über einer Liste: aktiver Modus, wie viel er ausblendet, Link zur Modus-Auswahl */
export function ModeNotice({ modes, hiddenCount, noun, listTitle }: ModeNoticeProps) {
  const { pathname } = useLocation()
  const origin: ModePageOrigin = { from: pathname, label: listTitle }
  return (
    <p className="mt-3 flex flex-wrap items-center justify-between gap-x-3 rounded-2xl border border-edge bg-surface px-4 py-1 text-base">
      <span>
        <span className="font-semibold">Modus: {modes.length === 0 ? 'Alles' : modes.map((mode) => mode.title).join(', ')}</span>
        {modes.length > 0 && hiddenCount > 0 && (
          <span className="text-muted">
            {' · '}
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
    </p>
  )
}
