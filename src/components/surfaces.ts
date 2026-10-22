// Gemeinsame Flächen-Stile: abgerundete Karten, über dem Fotohintergrund deutlich hervorgehoben

/** Liste als Karte mit Trennlinien; Zeilen brauchen px-4 */
export const listCard =
  'overflow-hidden rounded-2xl border-2 border-brand/40 bg-surface/95 shadow-xl shadow-black/40 backdrop-blur-md divide-y divide-edge'

/** Große Kachel (Startseite, Umrechner): blauer Rand, Verlauf, Schatten; braucht eigenes Innenlayout */
export const featureCard =
  'relative overflow-hidden rounded-3xl border-2 border-brand/50 bg-linear-135 from-brand/35 via-surface/90 to-surface/95 shadow-xl shadow-black/40 backdrop-blur-md active:border-accent'

/** Einzelne Karte, z. B. Einstellung oder Kachel */
export const card = 'rounded-2xl border border-edge bg-surface'

/** Kleine runde Marke, z. B. „48 Formeln“ */
export const chip = 'inline-flex items-center gap-1.5 rounded-full bg-raised px-3 py-1 text-base font-semibold text-ink'

/** Eingabefeld: kräftiger Rand, damit es auch bei Sonnenlicht erkennbar bleibt */
export const fieldBase = 'min-h-12 rounded-xl border-2 border-line bg-surface px-3 text-lg'
