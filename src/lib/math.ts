import { all, create } from 'mathjs'

// Gemeinsame mathjs-Instanz für Formeln und Umrechner (kein eval()).
if (!all) throw new Error('mathjs: Funktionssammlung "all" fehlt')
export const math = create(all, { number: 'number' })

/**
 * Einheit als Umrechnungsziel: mathjs liest "1/K" als Wert 1 mit Einheit 1/K
 * und lehnt sie dann als Ziel ab. "1/K" wird deshalb als "K^-1" geschrieben.
 */
export function asTargetUnit(unit: string): string {
  return unit.replace(/^\s*1\s*\/\s*([A-Za-z_]\w*)\s*$/, '$1^-1')
}
