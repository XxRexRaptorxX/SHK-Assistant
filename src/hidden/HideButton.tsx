import { EyeIcon, EyeOffIcon } from '../components/icons'
import { toggleHidden, useHiddenIds } from './hiddenStore'

interface HideButtonProps {
  id: string
  /** Name des Eintrags für die Beschriftung (Screenreader) */
  title: string
  /** Für Tests überschreibbar */
  hidden?: boolean
}

/** Auge: Eintrag in der Liste seines Moduls aus- bzw. wieder einblenden */
export function HideButton({ id, title, hidden }: HideButtonProps) {
  const hiddenIds = useHiddenIds()
  const isHidden = hidden ?? hiddenIds.has(id)
  const label = isHidden ? `„${title}“ in der Liste wieder einblenden` : `„${title}“ in der Liste ausblenden`
  const Icon = isHidden ? EyeOffIcon : EyeIcon

  return (
    <button
      type="button"
      aria-pressed={isHidden}
      aria-label={label}
      title={label}
      onClick={() => toggleHidden(id)}
      className="flex size-12 shrink-0 items-center justify-center rounded-lg text-muted"
    >
      <Icon className="size-8" />
    </button>
  )
}
