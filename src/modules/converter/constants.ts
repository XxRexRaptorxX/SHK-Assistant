// Ohne zod-/mathjs-Import, damit die App diese Konstanten nutzen kann, ohne beides zu bündeln.
export const CONVERTER_ID_PREFIX = 'converter'

/** Formen beim Umrechner "Anteile" (kind "ratio") */
export const RATIO_FORMS = ['percent', 'permille', 'permyriad', 'ppm', 'ppb', 'decimal', 'fraction'] as const
