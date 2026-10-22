import { DraftBadge } from '../../components/DraftBadge'
import { content } from '../../content'
import type { FigureEntry } from './schema'

/**
 * Bettet eine Skizze aus content/figures ein. Die SVG stammt aus geprüften Inhaltsdateien
 * (Build verbietet Skripte, Ereignisse und externe Verweise) und übernimmt die Designfarben.
 */
export function FigureView({ id, figures = content.figures }: { id?: string; figures?: readonly FigureEntry[] }) {
  const figure = id ? figures.find((entry) => entry.id === id) : undefined
  if (!figure) return null
  return (
    <figure className="mt-4 rounded-2xl border border-edge bg-surface p-3 break-inside-avoid">
      <div className="figure-art" role="img" aria-label={figure.title} dangerouslySetInnerHTML={{ __html: figure.svg }} />
      {figure.status === 'draft' && (
        <figcaption className="mt-2 flex items-center gap-2 text-sm text-muted">
          <DraftBadge variant="inline" /> Skizze noch nicht fachlich geprüft
        </figcaption>
      )}
    </figure>
  )
}
