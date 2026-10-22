import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { Layout } from './app/Layout'
import { modules } from './app/modules'
import { FavoritesPage } from './favorites/FavoritesPage'
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
import { SettingsPage } from './settings/SettingsPage'

// Seiten mit mathjs werden erst bei Bedarf geladen (kleineres Start-Bundle, offline trotzdem vorgecacht)
const FormulaDetailPage = lazy(() => import('./modules/formulas/FormulaDetailPage'))
const ConverterPage = lazy(() => import('./modules/converter/ConverterPage'))
// Nur intern: im public-Build entfällt die Seite samt PIN ganz. Die Bedingung muss hier direkt
// auf import.meta.env stehen; über isInternalEdition legt der Bundler den Chunk trotzdem an.
const ExpertPage =
  import.meta.env.VITE_EDITION === 'internal' ? lazy(() => import('./modules/expert/ExpertPage')) : undefined

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
        <Route path={modules.checklists.path} element={<ChecklistListPage />} />
        <Route path={`${modules.checklists.path}/:slug`} element={<ChecklistPage />} />
        <Route path={modules.lexicon.path} element={<LexiconListPage />} />
        <Route path={`${modules.lexicon.path}/:slug`} element={<LexiconDetailPage />} />
        {ExpertPage && (
          <Route
            path={modules.expert.path}
            element={
              <Suspense fallback={<Loading />}>
                <ExpertPage />
              </Suspense>
            }
          />
        )}
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
