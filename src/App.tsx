import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { Layout } from './app/Layout'
import { modules } from './app/modules'
import { FavoritesPage } from './favorites/FavoritesPage'
import { ConverterListPage } from './modules/converter/ConverterListPage'
import { FormulaListPage } from './modules/formulas/FormulaListPage'
import { LexiconDetailPage } from './modules/lexicon/LexiconDetailPage'
import { LexiconListPage } from './modules/lexicon/LexiconListPage'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { SearchPage } from './search/SearchPage'

// Seiten mit mathjs werden erst bei Bedarf geladen (kleineres Start-Bundle, offline trotzdem vorgecacht)
const FormulaDetailPage = lazy(() => import('./modules/formulas/FormulaDetailPage'))
const ConverterPage = lazy(() => import('./modules/converter/ConverterPage'))

function Loading() {
  return <p className="text-muted">Wird geladen …</p>
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
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
        <Route path={modules.checklists.path} element={<PlaceholderPage module={modules.checklists} />} />
        <Route path={modules.lexicon.path} element={<LexiconListPage />} />
        <Route path={`${modules.lexicon.path}/:slug`} element={<LexiconDetailPage />} />
        <Route path={modules.favorites.path} element={<FavoritesPage />} />
        <Route path={modules.search.path} element={<SearchPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
