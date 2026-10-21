import { Link } from 'react-router'
import { homeTileModules } from '../app/modules'
import { usePageTitle } from '../lib/usePageTitle'

export function HomePage() {
  usePageTitle()
  return (
    <>
      <h1 className="sr-only">Start</h1>
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
