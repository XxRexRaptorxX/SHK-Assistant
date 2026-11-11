import { FilterIcon } from '../components/icons'
import { toolTagColor } from '../modules/tools/ToolTagList'
import { toolTagLabel, type ToolTag } from '../modules/tools/toolTags'
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
const chipOff = 'border-line bg-surface text-ink'

function toggle<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item]
}

/** Auswahl der Filter unter der Suchleiste: Bereiche (Module) und Themen (Tool-Tags) */
export function SearchFilters({
  options,
  filter,
  onChange,
}: {
  options: SearchEngine['filterOptions']
  filter: SearchFilter
  onChange: (filter: SearchFilter) => void
}) {
  const active = filter.modules.length + filter.tags.length > 0
  return (
    <div id={SEARCH_FILTERS_ID} className="mt-2 rounded-2xl border border-edge bg-surface p-4">
      <fieldset>
        <legend className="font-bold">Bereiche</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {options.modules.map((module) => {
            const on = filter.modules.includes(module)
            return (
              <button
                key={module}
                type="button"
                aria-pressed={on}
                onClick={() => onChange({ ...filter, modules: toggle(filter.modules, module) })}
                className={`${chipBase} ${on ? 'border-accent bg-accent text-accent-ink' : chipOff}`}
              >
                {on && <span aria-hidden="true">✓</span>}
                {module}
              </button>
            )
          })}
        </div>
      </fieldset>
      {options.tags.length > 0 && (
        <fieldset className="mt-4">
          <legend className="font-bold">
            Themen <span className="font-normal text-muted">(nur Tools)</span>
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {options.tags.map((tag: ToolTag) => {
              const on = filter.tags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange({ ...filter, tags: toggle(filter.tags, tag) })}
                  className={`${chipBase} ${on ? toolTagColor(tag) : chipOff}`}
                >
                  {on && <span aria-hidden="true">✓</span>}
                  {toolTagLabel(tag)}
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
