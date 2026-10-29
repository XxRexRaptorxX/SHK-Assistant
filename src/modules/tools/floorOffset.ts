// Montagehöhen über Fertigfußboden (OKFF) auf Rohfußboden (OKRFB) umrechnen: jede Höhenzahl um den
// Fußbodenaufbau erhöhen. Angaben über einem anderen Bezug (z. B. „über Wannenrand“, „über
// Sitzhöhe“) und Abstände („Abstand 45 cm“) bleiben unverändert.

/** Bezug ist nicht der Fußboden, z. B. „10 cm über Wannenrand“ */
const OTHER_REFERENCE = /über (?!(dem )?Fußboden)/
/** Zahl mit optionalem Dezimalkomma, nicht direkt nach „Abstand “ */
const HEIGHT_NUMBER = /(?<!Abstand )\b\d+(?:,\d+)?\b/g

const format = (value: number) => String(Math.round(value * 10) / 10).replace('.', ',')

/** Wert über OKFF → Wert über OKRFB (Aufbau in cm) */
export function shiftFloorHeight(value: string, buildUp: number): string {
  if (OTHER_REFERENCE.test(value)) return value
  return value.replace(HEIGHT_NUMBER, (number) => format(Number(number.replace(',', '.')) + buildUp))
}
