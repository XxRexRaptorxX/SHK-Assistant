import type { AppModule } from '../app/modules'
import { usePageTitle } from '../lib/usePageTitle'

/** Vorläufige Seite für Module, die noch gebaut werden */
export function PlaceholderPage({ module }: { module: AppModule }) {
  usePageTitle(module.title)
  return (
    <>
      <h1 className="text-2xl font-bold">{module.title}</h1>
      <p className="mt-2 text-muted">Dieses Modul ist noch in Arbeit.</p>
    </>
  )
}
