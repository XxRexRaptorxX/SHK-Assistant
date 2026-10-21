import { Route, Routes } from 'react-router'
import { Layout } from './app/Layout'
import { modules } from './app/modules'
import { LexiconDetailPage } from './modules/lexicon/LexiconDetailPage'
import { LexiconListPage } from './modules/lexicon/LexiconListPage'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PlaceholderPage } from './pages/PlaceholderPage'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path={modules.formulas.path} element={<PlaceholderPage module={modules.formulas} />} />
        <Route path={modules.converter.path} element={<PlaceholderPage module={modules.converter} />} />
        <Route path={modules.checklists.path} element={<PlaceholderPage module={modules.checklists} />} />
        <Route path={modules.lexicon.path} element={<LexiconListPage />} />
        <Route path={`${modules.lexicon.path}/:slug`} element={<LexiconDetailPage />} />
        <Route path={modules.favorites.path} element={<PlaceholderPage module={modules.favorites} />} />
        <Route path={modules.search.path} element={<PlaceholderPage module={modules.search} />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
