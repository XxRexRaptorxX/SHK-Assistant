// Reine Hilfsfunktionen ohne import.meta.env, damit sie auch im Build (Node) nutzbar sind.

export const EDITIONS = ['internal', 'public'] as const

export type Edition = (typeof EDITIONS)[number]

export function parseEdition(value: string | undefined): Edition {
  if (value === 'internal' || value === 'public') return value
  throw new Error(
    `Ungültige Edition: VITE_EDITION="${value ?? ''}". Erlaubt: ${EDITIONS.join(', ')}`,
  )
}
