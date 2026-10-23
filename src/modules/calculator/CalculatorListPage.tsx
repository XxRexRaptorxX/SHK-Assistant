import { Link } from 'react-router'
import { modules } from '../../app/modules'
import { pageTitle } from '../../components/headings'
import { listCard } from '../../components/surfaces'
import { ModuleFavorites } from '../../favorites/ModuleFavorites'
import { usePageTitle } from '../../lib/usePageTitle'
import { calculatorPath, CALCULATORS } from './calculators'

export function CalculatorListPage() {
  usePageTitle(modules.calculator.title)
  return (
    <>
      <h1 className={pageTitle}>{modules.calculator.title}</h1>
      <ModuleFavorites moduleTitle={modules.calculator.title} />
      <ul className={`mt-5 ${listCard}`}>
        {CALCULATORS.map((info) => (
          <li key={info.slug}>
            <Link to={calculatorPath(info)} className="flex min-h-16 items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="block text-lg font-semibold">{info.title}</span>
                <span className="block text-base text-muted">{info.description}</span>
              </span>
              <span aria-hidden="true" className="text-2xl text-muted">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
