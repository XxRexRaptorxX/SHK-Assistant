// Steigung: alle Angaben werden über das Verhältnis Höhe/Länge (r) umgerechnet.
// Prozent = r · 100, Promille = r · 1000, Winkel = arctan(r), Verhältnis 1:x mit x = 1/r.

export const SLOPE_FORMS = ['percent', 'permille', 'degree', 'oneTo'] as const
export type SlopeForm = (typeof SLOPE_FORMS)[number]

export const SLOPE_LABELS: Record<SlopeForm, string> = {
  percent: 'Prozent (%)',
  permille: 'Promille (‰)',
  degree: 'Winkel (°)',
  oneTo: 'Verhältnis 1 : x',
}

const RAD_PER_DEGREE = Math.PI / 180

/** Verhältnis Höhe/Länge aus einer Angabe; undefined, wenn nicht darstellbar */
export function slopeToRatio(value: number, form: SlopeForm): number | undefined {
  switch (form) {
    case 'percent':
      return value / 100
    case 'permille':
      return value / 1000
    case 'degree':
      return Math.abs(value) < 90 ? Math.tan(value * RAD_PER_DEGREE) : undefined
    case 'oneTo':
      return value !== 0 ? 1 / value : undefined
  }
}

/** Angabe aus dem Verhältnis; undefined, wenn nicht darstellbar (1:x bei Steigung 0) */
export function ratioToSlope(ratio: number, form: SlopeForm): number | undefined {
  switch (form) {
    case 'percent':
      return ratio * 100
    case 'permille':
      return ratio * 1000
    case 'degree':
      return Math.atan(ratio) / RAD_PER_DEGREE
    case 'oneTo':
      return ratio !== 0 ? 1 / ratio : undefined
  }
}
