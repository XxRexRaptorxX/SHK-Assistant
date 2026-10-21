import { useState, type FormEvent } from 'react'
import { createSearchParams, Link, useNavigate } from 'react-router'
import { homeTileModules, modules } from '../app/modules'
import { SearchInput } from '../components/SearchInput'
import { usePageTitle } from '../lib/usePageTitle'

export function HomePage() {
  usePageTitle()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

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
      <h1 className="sr-only">Start</h1>
      <form role="search" onSubmit={submit} className="mb-4 flex gap-2">
        <SearchInput
          id="home-search"
          label="In allen Modulen suchen"
          value={query}
          onChange={setQuery}
          placeholder="Suchen …"
        />
        <button
          type="submit"
          className="min-h-12 shrink-0 rounded-lg bg-accent px-4 font-bold text-accent-ink"
        >
          Suchen
        </button>
      </form>
      <ul className="grid gap-3 sm:grid-cols-2">
        {homeTileModules.map((module) => {
          const Icon = module.icon
          return (
            <li key={module.path}>
              <Link
                to={module.path}
                className="flex min-h-20 items-center gap-4 rounded-xl border-2 border-line bg-surface p-4 active:border-accent"
              >
                <Icon className="size-10 shrink-0 text-accent" />
                <span>
                  <span className="block text-xl font-bold">{module.title}</span>
                  <span className="block text-base text-muted">{module.description}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
