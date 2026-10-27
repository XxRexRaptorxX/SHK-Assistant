import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { Layout } from './app/Layout'
import { modules } from './app/modules'
import { FavoritesPage } from './favorites/FavoritesPage'
import { CalculatorListPage } from './modules/calculator/CalculatorListPage'
import { ChecklistListPage } from './modules/checklists/ChecklistListPage'
import { ChecklistPage } from './modules/checklists/ChecklistPage'
import { ConverterListPage } from './modules/converter/ConverterListPage'
import { FormulaListPage } from './modules/formulas/FormulaListPage'
import { LEGAL_PAGES } from './modules/legal/legal'
import { LegalPage } from './modules/legal/LegalPage'
import { LexiconDetailPage } from './modules/lexicon/LexiconDetailPage'
import { LexiconListPage } from './modules/lexicon/LexiconListPage'
import { NewsPage } from './modules/news/NewsPage'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SearchPage } from './search/SearchPage'
import { ToolListPage } from './modules/tools/ToolListPage'
import { SettingsPage } from './settings/SettingsPage'

// Seiten mit mathjs werden erst bei Bedarf geladen (kleineres Start-Bundle, offline trotzdem vorgecacht)
const FormulaDetailPage = lazy(() => import('./modules/formulas/FormulaDetailPage'))
const ConverterPage = lazy(() => import('./modules/converter/ConverterPage'))
const CalculatorPage = lazy(() => import('./modules/calculator/CalculatorPage'))
const ToolPage = lazy(() => import('./modules/tools/ToolPage'))
const ExpertPage = lazy(() => import('./modules/expert/ExpertPage'))

function Loading() {
  return <p className="text-muted">Wird geladen …</p>
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path={modules.tools.path} element={<ToolListPage />} />
        <Route
          path={`${modules.tools.path}/:slug`}
          element={
            <Suspense fallback={<Loading />}>
              <ToolPage />
            </Suspense>
          }
        />
        <Route path={modules.formulas.path} element={<FormulaListPage />} />
        <Route
          path={`${modules.formulas.path}/:slug`}
          element={
            <Suspense fallback={<Loading />}>
              <FormulaDetailPage />
            </Suspense>
          }
        />
        <Route path={modules.converter.path} element={<ConverterListPage />} />
        <Route
          path={`${modules.converter.path}/:slug`}
          element={
            <Suspense fallback={<Loading />}>
              <ConverterPage />
            </Suspense>
          }
        />
        <Route path={modules.calculator.path} element={<CalculatorListPage />} />
        <Route
          path={`${modules.calculator.path}/:slug`}
          element={
            <Suspense fallback={<Loading />}>
              <CalculatorPage />
            </Suspense>
          }
        />
        <Route path={modules.checklists.path} element={<ChecklistListPage />} />
        <Route path={`${modules.checklists.path}/:slug`} element={<ChecklistPage />} />
        <Route path={modules.lexicon.path} element={<LexiconListPage />} />
        <Route path={`${modules.lexicon.path}/:slug`} element={<LexiconDetailPage />} />
        <Route
          path={modules.expert.path}
          element={
            <Suspense fallback={<Loading />}>
              <ExpertPage />
            </Suspense>
          }
        />
        <Route path={modules.news.path} element={<NewsPage />} />
        <Route path={modules.favorites.path} element={<FavoritesPage />} />
        <Route path={modules.search.path} element={<SearchPage />} />
        <Route path={modules.settings.path} element={<SettingsPage />} />
        {LEGAL_PAGES.map((page) => (
          <Route key={page.path} path={page.path} element={<LegalPage page={page} />} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
