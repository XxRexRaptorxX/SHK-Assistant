import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { modules } from '../../app/modules'
import { DraftBadge } from '../../components/DraftBadge'
import { categoryHeading, pageTitle } from '../../components/headings'
import { featureCard } from '../../components/surfaces'
import { ModuleFavorites } from '../../favorites/ModuleFavorites'
import { useHiddenIds } from '../../hidden/hiddenStore'
import { ModuleHidden } from '../../hidden/ModuleHidden'
import { usePageTitle } from '../../lib/usePageTitle'
import { converterEntries, converterPath, converterSummaryParts, groupConvertersByCategory } from './converter'
import { ConverterTitle } from './converterUi'
import type { ConverterEntry } from './schema'

/** Höchstens so viele Zeilen für die Einheiten in der Liste */
export const SUMMARY_MAX_LINES = 3
const SEPARATOR = ' · '

/** Text mit den ersten `shown` Teilen; fehlen hintere, endet er mit „…“ (wie beim Umrechner Brüche) */
export function summaryText(parts: readonly string[], shown: number): string {
  return shown >= parts.length ? parts.join(SEPARATOR) : [...parts.slice(0, Math.max(1, shown)), '…'].join(SEPARATOR)
}

/**
 * Einheiten als eine Zeile „a · b · c“. Bräuchte sie mehr als SUMMARY_MAX_LINES Zeilen, fallen hinten Einheiten weg,
 * bis sie passt. Gemessen wird nach dem Layout und bei jeder Breitenänderung neu (Drehen, Fenster).
 */
function ClampedSummary({ parts }: { parts: readonly string[] }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [width, setWidth] = useState(0)
  const [shown, setShown] = useState(parts.length)

  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry?.contentRect.width ?? 0)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Neue Breite: wieder mit allen Einheiten anfangen
  useLayoutEffect(() => setShown(parts.length), [width, parts.length])

  useLayoutEffect(() => {
    const element = ref.current
    if (!element || shown <= 1) return
    const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight)
    if (!Number.isFinite(lineHeight)) return
    if (element.getBoundingClientRect().height > lineHeight * SUMMARY_MAX_LINES + 1) setShown(shown - 1)
  })

  const full = parts.join(SEPARATOR)
  const text = summaryText(parts, shown)
  return (
    <span ref={ref} className="block text-base text-muted" title={text === full ? undefined : full}>
      {text}
    </span>
  )
}

export function ConverterListPage({ entries = converterEntries, hiddenIds }: {
  entries?: ConverterEntry[]
  /** Für Tests überschreibbar */
  hiddenIds?: ReadonlySet<string>
}) {
  usePageTitle('Umrechner')
  const storedHidden = useHiddenIds()
  const hidden = hiddenIds ?? storedHidden
  const listed = entries.filter((entry) => !hidden.has(entry.id))
  return (
    <>
      <h1 className={pageTitle}>Umrechner</h1>
      <ModuleFavorites moduleTitle={modules.converter.title} />
      {entries.length === 0 && <p className="mt-2 text-muted">Noch keine Größen vorhanden.</p>}
      {groupConvertersByCategory(listed).map((group) => (
        <section key={group.category} className="mt-5">
          <h2 className={categoryHeading}>{group.category}</h2>
          <ul className="mt-2 grid gap-3 sm:grid-cols-2">
            {group.entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  to={converterPath(entry.id)}
                  className={`${featureCard} flex min-h-20 flex-col justify-center gap-1 p-5 pl-6`}
                >
                  <span aria-hidden="true" className="absolute inset-y-5 left-0 w-1.5 rounded-r-full bg-accent" />
                  <span className="relative flex items-center justify-between gap-2">
                    <span className="text-xl font-bold">
                      <ConverterTitle entry={entry} />
                    </span>
                    {entry.status === 'draft' && <DraftBadge variant="inline" />}
                  </span>
                  <ClampedSummary parts={converterSummaryParts(entry)} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <ModuleHidden moduleTitle={modules.converter.title} hiddenIds={hidden} />
    </>
  )
}
