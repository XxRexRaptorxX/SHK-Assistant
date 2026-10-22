import { Link } from 'react-router'
import { usePageTitle } from '../lib/usePageTitle'

export function NotFoundPage() {
  usePageTitle('Seite nicht gefunden')
  return (
    <>
      <h1 className="text-2xl font-bold">Seite nicht gefunden</h1>
      <p className="mt-2 text-muted">Diese Adresse gibt es in der App nicht (mehr).</p>
      <Link
        to="/"
        className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-accent px-5 font-bold text-accent-ink"
      >
        Zur Startseite
      </Link>
    </>
  )
}
