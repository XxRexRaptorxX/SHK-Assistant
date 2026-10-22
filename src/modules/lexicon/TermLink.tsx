import type { ReactNode } from 'react'
import { Link } from 'react-router'

/**
 * Unauffälliger Link ins Lexikon: sieht aus wie der umgebende Text (Vorgabe des Inhabers),
 * ist aber antippbar und mit der Tastatur erreichbar. Ohne Ziel bleibt es normaler Text.
 */
export function TermLink({ to, children }: { to?: string; children: ReactNode }) {
  if (!to) return <>{children}</>
  return (
    <Link to={to} className="text-inherit no-underline">
      {children}
    </Link>
  )
}
