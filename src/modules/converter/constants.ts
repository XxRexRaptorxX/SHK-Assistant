// Ohne zod-/mathjs-Import, damit die App diese Konstanten nutzen kann, ohne beides zu bündeln.
export const CONVERTER_ID_PREFIX = 'converter'

/** Formen beim Umrechner "Anteile" (kind "ratio") */
export const RATIO_FORMS = ['percent', 'permille', 'permyriad', 'ppm', 'ppb', 'decimal', 'fraction'] as const

/** Nenner beim Umrechner "Brüche" (kind "fractions"), als Schlüssel für rare */
export const FRACTION_DENOMINATORS = ['2', '3', '4', '5', '6', '8', '10', '12', '16', '32', '64', '100'] as const

/** Zahlensysteme beim Umrechner "Zahlensysteme" (kind "numeral") */
export const NUMERAL_SYSTEMS = ['bin', 'ter', 'oct', 'dec', 'duo', 'hex'] as const
