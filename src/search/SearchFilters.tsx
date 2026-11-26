import { FilterIcon } from '../components/icons'
import { topicTagColor } from '../components/TopicTags'
import { TOPIC_TAGS, topicTagLabel, type TopicTag } from '../content/schema/topicTags'
import type { SearchEngine, SearchFilter } from './search'

export const SEARCH_FILTERS_ID = 'search-filters'

/** Symbol-Knopf rechts in der Suchleiste; zeigt die Zahl der aktiven Filter */
export function SearchFilterButton({ open, activeCount, onToggle }: { open: boolean; activeCount: number; onToggle: () => void }) {
  const label = activeCount > 0 ? `Filter (${activeCount} aktiv)` : 'Filter'
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={SEARCH_FILTERS_ID}
      aria-label={label}
      title={label}
      onClick={onToggle}
      className={`relative flex size-11 items-center justify-center rounded-lg ${
        activeCount > 0 ? 'bg-accent text-accent-ink' : open ? 'bg-raised text-ink' : 'text-ink'
      }`}
    >
      <FilterIcon className="size-6" />
      {activeCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-surface bg-ink text-xs font-bold text-surface"
        >
          {activeCount}
        </span>
      )}
    </button>
  )
}

const chipBase = 'inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 text-base font-semibold'
/** Gewählt: Haken und deutlicher Ring, damit es auch bei farbigen Knöpfen klar erkennbar ist */
const chipRing = 'ring-4 ring-ink ring-offset-2 ring-offset-surface'

// Gedämpfte Farben für Kategorien und Bereiche: zarter Grund, getönter Rahmen, dunkle bzw. helle Schrift.
// Bewusst ruhiger als die Themen-Tags, damit die Themen hervorstechen. Klassen ausgeschrieben für Tailwind.
const MUTED = {
  red: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
  orange: 'border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200',
  amber: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
  yellow: 'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200',
  lime: 'border-lime-200 bg-lime-50 text-lime-900 dark:border-lime-900 dark:bg-lime-950/40 dark:text-lime-200',
  green: 'border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200',
  teal: 'border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-200',
  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200',
  sky: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200',
  blue: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200',
  violet: 'border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200',
  purple: 'border-purple-200 bg-purple-50 text-purple-900 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-200',
  fuchsia:
    'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 dark:border-fuchsia-900 dark:bg-fuchsia-950/40 dark:text-fuchsia-200',
  pink: 'border-pink-200 bg-pink-50 text-pink-900 dark:border-pink-900 dark:bg-pink-950/40 dark:text-pink-200',
  rose: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200',
  zinc: 'border-zinc-300 bg-zinc-50 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200',
} as const
type Hue = keyof typeof MUTED

/** Farbton des gleichnamigen Themen-Tags (wie in src/components/TopicTags.tsx), nur gedämpft */
const TAG_HUES: Record<TopicTag, Hue> = {
  heizung: 'red',
  sanitaer: 'blue',
  trinkwasser: 'sky',
  abwasser: 'amber',
  lueftung: 'green',
  klima: 'teal',
  kaelte: 'cyan',
  solar: 'orange',
  strom: 'yellow',
  kundendienst: 'purple',
  planung: 'fuchsia',
  allgemein: 'zinc',
}

/** Ohne gleichnamigen Tag: Farbton fest aus dem Namen berechnet, damit er überall gleich bleibt */
const SPARE_HUES = (Object.keys(MUTED) as Hue[]).filter((hue) => hue !== 'zinc')

/** Gedämpfte Farbklassen einer Kategorie oder eines Bereichs, z. B. „Hydraulik“ oder „Formeln“ */
export function categoryColor(label: string): string {
  const tag = TOPIC_TAGS.find((entry) => entry.label === label)?.key
  if (tag) return MUTED[TAG_HUES[tag]]
  let hash = 0
  for (const char of label) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return MUTED[SPARE_HUES[hash % SPARE_HUES.length]!]
}

/** Filter-Knopf in der übergebenen Farbe; gewählt mit Ring */
const chipClass = (color: string, on: boolean): string => `${chipBase} ${color} ${on ? chipRing : ''}`

function toggle<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item]
}

/** Auswahl der Filter unter der Suchleiste: Bereiche (Module) und Themen (Tool-Tags) */
export function SearchFilters({
  options,
  filter,
  onChange,
  tagNote,
  modulesLegend = 'Bereiche',
}: {
  /** Ohne Module (z. B. im Lexikon) entfällt der Abschnitt „Bereiche“ */
  options: SearchEngine['filterOptions']
  filter: SearchFilter
  onChange: (filter: SearchFilter) => void
  /** Zusatz hinter „Themen“, z. B. „(nur Tools und Lexikon)“ */
  tagNote?: string
  /** Überschrift der ersten Auswahl, z. B. „Kategorien“ im Lexikon */
  modulesLegend?: string
}) {
  const active = filter.modules.length + filter.tags.length > 0
  return (
    <div id={SEARCH_FILTERS_ID} className="mt-2 rounded-2xl border border-edge bg-surface p-4">
      {options.modules.length > 0 && (
        <fieldset className="mb-4">
          <legend className="font-bold">{modulesLegend}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {options.modules.map((module) => {
              const on = filter.modules.includes(module)
              return (
                <button
                  key={module}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange({ ...filter, modules: toggle(filter.modules, module) })}
                  className={chipClass(categoryColor(module), on)}
                >
                  {on && <span aria-hidden="true">✓</span>}
                  {module}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}
      {options.tags.length > 0 && (
        <fieldset>
          <legend className="font-bold">
            Themen {tagNote && <span className="font-normal text-muted">{tagNote}</span>}
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {options.tags.map((tag: TopicTag) => {
              const on = filter.tags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange({ ...filter, tags: toggle(filter.tags, tag) })}
                  className={chipClass(topicTagColor(tag), on)}
                >
                  {on && <span aria-hidden="true">✓</span>}
                  {topicTagLabel(tag)}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}
      {active && (
        <button
          type="button"
          onClick={() => onChange({ modules: [], tags: [] })}
          className="mt-4 min-h-12 font-semibold text-accent"
        >
          Filter zurücksetzen
        </button>
      )}
    </div>
  )
}
