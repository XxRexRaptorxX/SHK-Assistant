// Einheitliche Knopf-Stile (große Touch-Ziele)

const base =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-4 font-bold disabled:opacity-40'

export const primaryButton = `${base} bg-accent text-accent-ink`

export const secondaryButton = `${base} border-2 border-line bg-surface text-ink`

export const dangerButton = `${base} border-2 border-warn-ink bg-warn text-warn-ink`
