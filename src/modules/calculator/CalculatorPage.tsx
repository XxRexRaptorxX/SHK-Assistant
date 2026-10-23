import { Link, useParams } from 'react-router'
import { modules } from '../../app/modules'
import { BackLink } from '../../components/ContentPage'
import { ChevronLeftIcon, ChevronRightIcon } from '../../components/icons'
import { FavoriteButton } from '../../favorites/FavoriteButton'
import { usePageTitle } from '../../lib/usePageTitle'
import { calculatorId, calculatorPath, findCalculator, neighbors, type CalculatorInfo } from './calculators'
import { GraphCalculator } from './GraphCalculator'
import { KeypadCalculator } from './KeypadCalculator'

const BACK = { to: modules.calculator.path, label: modules.calculator.title }

/** Pfeil zum Nachbarrechner, großes Tippziel */
function SwitchLink({ target, direction }: { target: CalculatorInfo; direction: 'previous' | 'next' }) {
  const Icon = direction === 'previous' ? ChevronLeftIcon : ChevronRightIcon
  const label = `${direction === 'previous' ? 'Vorheriger' : 'Nächster'} Rechner: ${target.title}`
  return (
    <Link
      to={calculatorPath(target)}
      aria-label={label}
      title={label}
      className="flex size-12 shrink-0 items-center justify-center rounded-full border border-edge bg-raised text-accent"
    >
      <Icon className="size-7" />
    </Link>
  )
}

/** Einer der drei Rechner; nachgeladen, weil er mathjs braucht */
export default function CalculatorPage() {
  const { slug } = useParams()
  const info = findCalculator(slug)
  usePageTitle(info?.title ?? 'Rechner nicht gefunden')

  if (!info) {
    return (
      <>
        <BackLink to={BACK.to} label={BACK.label} />
        <h1 className="text-2xl font-bold">Rechner nicht gefunden</h1>
      </>
    )
  }

  const { previous, next } = neighbors(info)
  return (
    <article>
      <div className="flex items-center justify-between gap-2">
        <BackLink to={BACK.to} label={BACK.label} />
        <FavoriteButton id={calculatorId(info)} title={info.title} />
      </div>
      {/* Pfeile links und rechts: bequem zwischen den Rechnern wechseln */}
      <header className="mb-4 flex items-center gap-2">
        <SwitchLink target={previous} direction="previous" />
        <h1 className="flex-1 text-center text-2xl font-bold">{info.title}</h1>
        <SwitchLink target={next} direction="next" />
      </header>
      {info.slug === 'grafik' ? (
        <GraphCalculator />
      ) : (
        <KeypadCalculator key={info.slug} mode={info.slug === 'standard' ? 'standard' : 'scientific'} />
      )}
    </article>
  )
}
