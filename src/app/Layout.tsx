import { Link, NavLink, Outlet } from 'react-router'
import { HomeIcon } from '../components/icons'
import { isInternalEdition } from '../config/edition'
import { bottomNavModules, modules, type AppModule } from './modules'
import { ThemeToggle } from './ThemeToggle'

const iconButton =
  'flex size-12 items-center justify-center rounded-lg text-ink hover:bg-page active:bg-page'
const iconButtonActive = 'bg-accent text-accent-ink hover:bg-accent active:bg-accent'

function HeaderLink({ module }: { module: AppModule }) {
  const Icon = module.icon
  return (
    <NavLink
      to={module.path}
      aria-label={module.title}
      title={module.title}
      className={({ isActive }) => `${iconButton} ${isActive ? iconButtonActive : ''}`}
    >
      <Icon className="size-7" />
    </NavLink>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-10 border-b-2 border-line bg-surface pt-[env(safe-area-inset-top)] print:hidden">
      <div className="mx-auto flex h-16 max-w-3xl items-center gap-1 px-1 min-[360px]:px-2">
        <Link
          to="/"
          className="flex min-h-12 items-center gap-1.5 rounded-lg px-1 font-bold whitespace-nowrap"
        >
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-9 shrink-0" />
          {/* "Intern" unter dem Namen, damit die Kopfzeile auch auf 320 px passt */}
          <span className="flex flex-col leading-tight">
            <span className="text-base min-[360px]:text-lg sm:text-xl">SHK-Assistant</span>
            {isInternalEdition && (
              <span className="text-[0.65rem] leading-3 font-bold tracking-wider text-muted uppercase">Intern</span>
            )}
          </span>
        </Link>
        <nav aria-label="Werkzeuge" className="ml-auto flex shrink-0 items-center">
          <HeaderLink module={modules.search} />
          <HeaderLink module={modules.favorites} />
          <ThemeToggle className={iconButton} />
        </nav>
      </div>
    </header>
  )
}

const bottomItems: AppModule[] = [
  { path: '/', title: 'Start', description: '', icon: HomeIcon },
  ...bottomNavModules,
]

function BottomNav() {
  return (
    <nav
      aria-label="Module"
      className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-line bg-surface pb-[env(safe-area-inset-bottom)] print:hidden"
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-5">
        {bottomItems.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-semibold tracking-tight min-[360px]:text-xs min-[360px]:tracking-normal ${
                    isActive ? 'bg-accent text-accent-ink' : 'text-ink'
                  }`
                }
              >
                <Icon className="size-7" />
                <span className="max-w-full truncate">{item.title}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-28 print:p-0">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
