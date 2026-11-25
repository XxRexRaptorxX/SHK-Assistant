import { EyeIcon, EyeOffIcon } from '../components/icons'
import type { TopicTag } from '../content/schema/topicTags'
import { indexedItem, setVisible, useVisibilityState, visibilityOf, type Visibility } from './visibility'

interface HideButtonProps {
  id: string
  /** Name des Eintrags für die Beschriftung (Screenreader) */
  title: string
  /** Themen-Tags für den Modus; ohne Angabe aus dem Inhaltsverzeichnis */
  tags?: readonly TopicTag[]
  /** Für Tests überschreibbar */
  visibility?: Visibility
}

const LABELS: Record<Visibility, (title: string) => string> = {
  visible: (title) => `„${title}“ in der Liste ausblenden`,
  manual: (title) => `„${title}“ in der Liste wieder einblenden`,
  mode: (title) => `„${title}“ in der Liste einblenden (vom Modus ausgeblendet)`,
}

/** Auge: Eintrag in der Liste seines Moduls aus- bzw. einblenden, auch gegen den gewählten Modus */
export function HideButton({ id, title, tags, visibility }: HideButtonProps) {
  const state = useVisibilityState()
  const item = tags ? { id, tags } : indexedItem(id)
  const current = visibility ?? visibilityOf(item, state)
  const label = LABELS[current](title)
  const Icon = current === 'visible' ? EyeIcon : EyeOffIcon

  return (
    <button
      type="button"
      aria-pressed={current !== 'visible'}
      aria-label={label}
      title={label}
      onClick={() => setVisible(item, current !== 'visible', state)}
      className="flex size-12 shrink-0 items-center justify-center rounded-xl text-muted"
    >
      <Icon className="size-8" />
    </button>
  )
}
