import { all, create } from 'mathjs'

// Gemeinsame mathjs-Instanz für Formeln und Umrechner (kein eval()).
// SHK-typische Zusatzeinheiten werden im Umrechner-Schritt hier ergänzt.
if (!all) throw new Error('mathjs: Funktionssammlung "all" fehlt')
export const math = create(all, { number: 'number' })
