/** mathjs-Einheit lesbar darstellen, z. B. "m^3/h" → "m³/h", "kJ/(kg K)" → "kJ/(kg·K)" */
export function formatUnit(unit: string): string {
  return unit
    .replace(/\^2\b/g, '²')
    .replace(/\^3\b/g, '³')
    .replace(/\bdegC\b/g, '°C')
    .replace(/\bdegF\b/g, '°F')
    .replace(/\bdeg\b/g, '°')
    .replace(/(?<=\w) (?=\w)/g, '·')
}
