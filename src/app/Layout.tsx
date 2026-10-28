import { Link, NavLink, Outlet } from 'react-router'
import { COMPANY_LINK_LABEL, companyLogoUrl } from '../components/CompanyLogo'
import { HomeIcon } from '../components/icons'
import { TechBackdrop } from '../components/TechBackdrop'
import { isInternalEdition } from '../config/edition'
import { COMPANY_URL } from '../config/links'
import { ShakeToReport } from '../feedback/ShakeToReport'
import { DisclaimerGate } from '../modules/legal/DisclaimerDialog'
import { useApplyTheme } from '../theme/useTheme'
import { bottomNavModules, modules, type AppModule } from './modules'

const iconButton =
  'flex size-12 items-center justify-center rounded-full text-bar-ink hover:bg-bar-active active:bg-bar-active'
const iconButtonActive = 'bg-bar-active text-bar-active-ink'

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
    <header className="sticky top-0 z-10 border-b-[3px] border-bar-stripe bg-bar bg-linear-to-r from-bar-from via-bar-via to-bar-to pt-[env(safe-area-inset-top)] text-bar-ink shadow-lg shadow-black/30 print:hidden">
      <div className="mx-auto grid h-16 max-w-3xl grid-cols-[auto_1fr_auto] items-center gap-1 px-1 min-[360px]:px-2">
        <Link
          to="/"
          className="flex min-h-12 items-center gap-1.5 rounded-xl px-1 font-bold whitespace-nowrap"
        >
          {/* App-Symbol erst ab etwas breiteren Bildschirmen, damit das Firmenlogo Platz hat */}
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="hidden size-9 shrink-0 min-[430px]:block" />
          {/* "Intern" unter dem Namen, damit die Kopfzeile auch auf 320 px passt */}
          <span className="flex flex-col leading-tight">
            {/* Wortmarke wie im Style-Guide: „SHK-“ extra fett, „Assistant“ etwas leichter */}
            <span className="text-base min-[400px]:text-lg sm:text-xl">
              <span className="font-extrabold">SHK-</span>
              <span className="font-semibold">Assistant</span>
            </span>
            {isInternalEdition && (
              <span className="text-[0.65rem] leading-3 font-bold tracking-wider text-bar-muted uppercase">Intern</span>
            )}
          </span>
        </Link>
        {/* Firmenlogo mittig im freien Raum zwischen Name und Knöpfen */}
        <div className="flex min-w-0 justify-center">
          {companyLogoUrl && (
            <a
              href={COMPANY_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={COMPANY_LINK_LABEL}
              title={COMPANY_LINK_LABEL}
              className="flex min-h-12 min-w-0 items-center rounded-xl px-1"
            >
              <img src={companyLogoUrl} alt="" className="max-h-10 w-auto max-w-full object-contain" />
            </a>
          )}
        </div>
        <nav aria-label="Werkzeuge" className="flex shrink-0 items-center">
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
      <ul className="mx-auto grid max-w-xl grid-cols-7 rounded-full border border-edge bg-surface/90 p-1 shadow-xl shadow-black/25 backdrop-blur-md">
        {bottomItems.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-full text-[0.5625rem] font-semibold tracking-tighter min-[360px]:text-[0.625rem] min-[400px]:text-xs min-[400px]:tracking-normal ${
                    isActive ? 'bg-raised text-accent' : 'text-ink'
                  }`
                }
              >
                <Icon className="size-6" />
                <span className="max-w-full truncate">{item.navTitle ?? item.title}</span>
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
      <ShakeToReport />
      <DisclaimerGate />
    </div>
  )
}
