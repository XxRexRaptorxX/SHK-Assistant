import { Link, NavLink, Outlet } from 'react-router'
import { HomeIcon } from '../components/icons'
import { TechBackdrop } from '../components/TechBackdrop'
import { isInternalEdition } from '../config/edition'
import { useApplyTheme } from '../theme/useTheme'
import { bottomNavModules, modules, type AppModule } from './modules'

const iconButton =
  'flex size-12 items-center justify-center rounded-full text-ink hover:bg-raised active:bg-raised'
const iconButtonActive = 'bg-raised text-accent'

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
    <header className="sticky top-0 z-10 border-b border-edge bg-page/85 pt-[env(safe-area-inset-top)] backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-16 max-w-3xl items-center gap-1 px-1 min-[360px]:px-2">
        <Link
          to="/"
          className="flex min-h-12 items-center gap-1.5 rounded-xl px-1 font-bold whitespace-nowrap"
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
          <HeaderLink module={modules.settings} />
        </nav>
      </div>
    </header>
  )
}

const bottomItems: AppModule[] = [
  { path: '/', title: 'Start', description: '', icon: HomeIcon },
  ...bottomNavModules,
]

/** Schwebende Leiste mit runden Ecken; der aktive Reiter ist als Fläche in Akzentfarbe hervorgehoben */
function BottomNav() {
  return (
    <nav
      aria-label="Module"
      className="fixed inset-x-1.5 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-10 print:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5 rounded-full border border-edge bg-surface/90 p-1 shadow-xl shadow-black/25 backdrop-blur-md">
        {bottomItems.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-full text-[0.6875rem] font-semibold tracking-tight min-[360px]:text-xs min-[360px]:tracking-normal ${
                    isActive ? 'bg-raised text-accent' : 'text-ink'
                  }`
                }
              >
                <Icon className="size-6" />
                <span className="max-w-full truncate px-0.5">{item.title}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function Layout() {
  useApplyTheme()
  return (
    <div className="flex min-h-dvh flex-col">
      <TechBackdrop />
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-5 pb-32 print:p-0">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
