import { math } from '../../lib/math'

// Rechenteil des Grafikrechners: Funktionen einlesen, Achsenteilung, Kurven abtasten.

export interface View {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

export const DEFAULT_VIEW: View = { xMin: -10, xMax: 10, yMin: -7.5, yMax: 7.5 }

export type CompiledFunction = { ok: true; fn: (x: number) => number } | { ok: false; error: string }

/**
 * Eingabe wie auf dem Zettel: Dezimalkomma ("0,5x"), Argumente mit Semikolon ("nthRoot(x; 3)"),
 * × und ÷ sowie "ln" für den natürlichen Logarithmus.
 */
export function normalizeFunction(input: string): string {
  return input
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/;/g, ',')
    .replace(/×|·/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt')
    .replace(/\bln\(/g, 'log(')
}

/** Übersetzt "f(x) = …" in eine Funktion; Winkel im Bogenmaß */
export function compileFunction(input: string): CompiledFunction {
  const text = normalizeFunction(input.replace(/^\s*(?:[fgh]\s*\(\s*x\s*\)|y)\s*=/, '')).trim()
  if (text === '') return { ok: false, error: '' }
  try {
    const compiled = math.compile(text)
    const probe = (x: number): unknown => compiled.evaluate({ x })
    // Probelauf an einer Stelle, an der übliche Funktionen definiert sind
    const sample = probe(1.2345)
    if (typeof sample !== 'number') return { ok: false, error: 'Ergebnis ist keine Zahl' }
    return {
      ok: true,
      fn: (x) => {
        try {
          const value = probe(x)
          return typeof value === 'number' ? value : NaN
        } catch {
          return NaN
        }
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const unknown = /Undefined symbol (\w+)/.exec(message)?.[1]
    return { ok: false, error: unknown ? `Unbekannt: „${unknown}“ (nur x erlaubt)` : 'Eingabe nicht lesbar' }
  }
}

/** Gut lesbare Schrittweite der Achsenteilung (1, 2 oder 5 mal Zehnerpotenz), etwa 8 Teile */
export function tickStep(range: number, parts = 8): number {
  const raw = range / parts
  const power = 10 ** Math.floor(Math.log10(raw))
  const factor = raw / power
  return (factor < 1.5 ? 1 : factor < 3.5 ? 2 : factor < 7.5 ? 5 : 10) * power
}

/** Teilstriche im Bereich, als Vielfache der Schrittweite */
export function ticks(min: number, max: number, step: number): number[] {
  const values: number[] = []
  for (let i = Math.ceil(min / step); i * step <= max + step * 1e-9; i += 1) {
    // Rundung gegen 0,30000000000000004
    values.push(Number((i * step).toPrecision(12)))
  }
  return values
}

/**
 * Kurve als Liste von Linienzügen in Datenkoordinaten. Unterbrochen an undefinierten Stellen
 * und an Sprüngen über den ganzen Bildausschnitt (Polstellen wie bei tan oder 1/x).
 */
export function sampleFunction(fn: (x: number) => number, view: View, samples = 400): [number, number][][] {
  const height = view.yMax - view.yMin
  const limit = height * 20
  const segments: [number, number][][] = []
  let current: [number, number][] = []
  let previous: number | undefined
  for (let i = 0; i <= samples; i += 1) {
    const x = view.xMin + ((view.xMax - view.xMin) * i) / samples
    const y = fn(x)
    const usable = Number.isFinite(y)
    const jump = usable && previous !== undefined && Math.abs(y - previous) > height * 2
    if (!usable || jump) {
      if (current.length > 1) segments.push(current)
      current = []
    }
    if (usable) {
      // weit außerhalb abschneiden, damit die Zeichnung keine riesigen Koordinaten bekommt
      current.push([x, Math.max(view.yMin - limit, Math.min(view.yMax + limit, y))])
    }
    previous = usable ? y : undefined
  }
  if (current.length > 1) segments.push(current)
  return segments
}

/** Um einen Punkt zoomen; factor < 1 vergrößert */
export function zoomView(view: View, factor: number, center = { x: (view.xMin + view.xMax) / 2, y: (view.yMin + view.yMax) / 2 }): View {
  return {
    xMin: center.x - (center.x - view.xMin) * factor,
    xMax: center.x + (view.xMax - center.x) * factor,
    yMin: center.y - (center.y - view.yMin) * factor,
    yMax: center.y + (view.yMax - center.y) * factor,
  }
}

export function panView(view: View, dx: number, dy: number): View {
  return { xMin: view.xMin + dx, xMax: view.xMax + dx, yMin: view.yMin + dy, yMax: view.yMax + dy }
}
