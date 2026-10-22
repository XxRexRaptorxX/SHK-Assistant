/** Anzeige für mathjs-Einheitennamen, die im Handwerk anders geschrieben werden */
const UNIT_LABELS: Record<string, string> = {
  degC: '°C',
  degF: '°F',
  deg: '°',
  grad: 'gon', // mathjs "grad" = Neugrad (Gon), 400 gon = Vollkreis
  arcmin: '′',
  arcsec: '″',
  uV: 'µV',
  uA: 'µA',
  ohm: 'Ω',
  mohm: 'mΩ',
  kohm: 'kΩ',
  Mohm: 'MΩ',
  hectare: 'ha',
  day: 'Tag',
  week: 'Woche',
  inch: 'in',
  kgf: 'kp',
  b: 'bit', // mathjs "b" = Bit
  uS: 'µS',
  mile: 'mi',
  acre: 'ac',
  lbm: 'lb', // mathjs "lbm" = Pound (Masse)
  floz: 'fl oz', // geschütztes Leerzeichen, sonst würde daraus „fl·oz“
  pint: 'pt',
  quart: 'qt',
  oilbarrel: 'bbl',
}

/**
 * mathjs-Einheit lesbar darstellen, z. B. "m^3/h" → "m³/h", "kJ/(kg K)" → "kJ/(kg·K)", "kohm" → "kΩ".
 * extraLabels: zusätzliche Bezeichnungen, z. B. aus content/units ("gradDH" → "°dH").
 */
export function formatUnit(unit: string, extraLabels?: ReadonlyMap<string, string>): string {
  return unit
    .replace(/[A-Za-z_][A-Za-z0-9_]*/g, (name) => extraLabels?.get(name) ?? UNIT_LABELS[name] ?? name)
    .replace(/\^2\b/g, '²')
    .replace(/\^3\b/g, '³')
    .replace(/(?<=\S) (?=\S)/g, '·')
}
