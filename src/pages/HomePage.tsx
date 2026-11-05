import { useState, type FormEvent } from 'react'
import { createSearchParams, Link, useNavigate } from 'react-router'
import { homeTileModules, modules, type AppModule } from '../app/modules'
import { pageTitle } from '../components/headings'
import { SearchInput } from '../components/SearchInput'
import { Slogan } from '../components/Slogan'
import { card, chip, featureCard } from '../components/surfaces'
import { HOME_HEADING, SEO_SECTIONS, SITE_DESCRIPTION } from '../config/seo'
import { content } from '../content'
import { CALCULATORS } from '../modules/calculator/calculators'
import { useFavoriteIds } from '../favorites/favoritesStore'
import { usePageTitle } from '../lib/usePageTitle'

/** Kurze Angabe im Chip oben auf der Kachel, z. B. „48 Formeln“ */
function useTileChips(): Record<string, string> {
  const favorites = useFavoriteIds().size
  return {
    [modules.tools.path]: `${content.tools.length} ${content.tools.length === 1 ? 'Tool' : 'Tools'}`,
    [modules.formulas.path]: `${content.formulas.length} Formeln`,
    [modules.converter.path]: `${content.converter.length} Größen`,
    [modules.checklists.path]: `${content.checklists.length} Checklisten`,
    [modules.lexicon.path]: `${content.lexicon.length} Begriffe`,
    [modules.calculator.path]: `${CALCULATORS.length} Rechner`,
    [modules.news.path]: 'Täglich neu',
    [modules.expert.path]: `${content.expertCodes.length} Codes`,
    [modules.favorites.path]: `${favorites} gemerkt`,
  }
}

function Tile({ module, chipText }: { module: AppModule; chipText?: string }) {
  const Icon = module.icon
  return (
    <Link
      to={module.path}
      className={`${featureCard} flex min-h-36 flex-col justify-between gap-3 p-5 pl-6`}
    >
      {/* Farbleiste links als Blickfang */}
      <span aria-hidden="true" className="absolute inset-y-6 left-0 w-1.5 rounded-r-full bg-accent" />
      {/* Großes, blasses Symbol als Bildersatz, wie ein Motiv auf der Karte */}
      <Icon aria-hidden="true" className="pointer-events-none absolute -right-5 -bottom-6 size-36 -rotate-12 text-tile-icon opacity-45 dark:opacity-60 dark:drop-shadow-[0_0_10px_rgba(255,212,0,0.45)]" />
      {chipText && (
        <span className={`${chip} relative self-start`}>
          <Icon className="size-5 text-accent" />
          {chipText}
        </span>
      )}
      <span className="relative">
        <span className="block text-[1.65rem] leading-tight font-extrabold">{module.title}</span>
        <span className="mt-1 block max-w-[80%] text-base text-muted">{module.description}</span>
      </span>
    </Link>
  )
}

/**
 * Echte Links auf die statischen Übersichten: Suchmaschinen folgen den Hash-Adressen der App nicht.
 * Offline ausgeblendet, weil diese Seiten nicht im Offline-Cache liegen.
 */
function DirectoryLinks() {
  const sections = SEO_SECTIONS.filter((section) =>
    content[section.collection].some((entry) => entry.status === 'verified'),
  )
  if (globalThis.navigator?.onLine === false || sections.length === 0) return null
  return (
    <nav aria-label="Verzeichnis" className="mt-6 flex flex-wrap items-center gap-x-4 text-base text-muted">
      <span>Verzeichnis:</span>
      {sections.map((section) => (
        <a
          key={section.dir}
          href={`${import.meta.env.BASE_URL}${section.dir}/`}
          className="inline-flex min-h-12 items-center font-semibold text-accent underline"
        >
          {section.title}
        </a>
      ))}
    </nav>
  )
}

export function HomePage() {
  usePageTitle()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const chips = useTileChips()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = query.trim()
    navigate({
      pathname: modules.search.path,
      search: trimmed ? createSearchParams({ q: trimmed }).toString() : '',
    })
  }

  return (
    <>
      <h1 className={pageTitle}>
        {/* Name nur für Suchmaschinen und Screenreader: sichtbar steht er schon in der Kopfzeile */}
        <span className="sr-only">{HOME_HEADING.name} – </span>
        {HOME_HEADING.tagline}
      </h1>
      <Slogan className="mt-1" />
      <form role="search" onSubmit={submit} className="mt-4 mb-5 flex gap-2">
        <SearchInput
          id="home-search"
          label="In allen Modulen suchen"
          value={query}
          onChange={setQuery}
          placeholder="Suchen …"
        />
        <button
          type="submit"
          className="min-h-12 shrink-0 rounded-xl bg-accent px-4 font-bold text-accent-ink"
        >
          Suchen
        </button>
      </form>
      <ul className="grid gap-3 sm:grid-cols-2">
        {homeTileModules.map((module) => (
          <li key={module.path}>
            <Tile module={module} chipText={chips[module.path]} />
          </li>
        ))}
      </ul>
      <p className={`${card} mt-6 p-4 text-base text-ink`}>{SITE_DESCRIPTION}</p>
      <DirectoryLinks />
    </>
  )
}
