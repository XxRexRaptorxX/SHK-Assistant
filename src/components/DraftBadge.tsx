import { WarningIcon } from './icons'

interface DraftBadgeProps {
  /** "banner" für Detailseiten, "inline" für Listeneinträge */
  variant?: 'banner' | 'inline'
}

export function DraftBadge({ variant = 'banner' }: DraftBadgeProps) {
  if (variant === 'inline') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-warn px-2 py-0.5 text-sm font-bold text-warn-ink">
        <WarningIcon className="size-4" />
        Ungeprüft
      </span>
    )
  }

  return (
    <div role="note" className="flex items-start gap-3 rounded-xl border-2 border-warn-ink bg-warn p-3 text-warn-ink">
      <WarningIcon className="mt-0.5 size-7 shrink-0" />
      <p>
        <strong>Ungeprüft:</strong> Dieser Inhalt ist noch nicht fachlich freigegeben. Nicht ohne
        eigene Prüfung verwenden.
      </p>
    </div>
  )
}
