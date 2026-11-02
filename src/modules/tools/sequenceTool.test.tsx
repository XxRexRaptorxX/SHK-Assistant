import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { isSequenceTool } from './schema'
import { PhaseEnd, SequenceLookup } from './SequenceLookup'
import { lexiconPathFor } from '../lexicon/termLinks'
import {
  activePhase,
  checkSequenceTool,
  faultsByPhase,
  formatSeconds,
  measuredSeconds,
  nextPhase,
  outsideLimit,
  sequenceToolSchema,
  startStopwatch,
  stopStopwatch,
  type SequenceTool,
} from './sequenceTool'
import { toolEntries, toolSearchDocuments } from './tools'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.feuerungsautomat-startablauf')
if (!entry || !isSequenceTool(entry)) throw new Error('Ablauf-Tool erwartet')
const tool: SequenceTool = entry
/** Lexikon-Links brauchen einen Router */
const render = (element: ReactElement) => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>)
const variant = (key: string) => tool.variants.find((candidate) => candidate.key === key)!

describe('Startablauf Feuerungsautomat', () => {
  it('ist fehlerfrei und deckt alle Brennerarten ab', () => {
    expect(checkSequenceTool(tool)).toEqual([])
    expect(tool.variants.map((candidate) => candidate.key)).toEqual(['gas', 'oel', 'brennwert', 'atmosphaerisch'])
    // Werte der Beispielgeräte laut Quelle
    const gas = variant('gas').phases
    expect(gas.find((phase) => phase.key === 'sicherheitszeit')).toMatchObject({ seconds: 3, limit: 'max' })
    expect(variant('oel').phases.find((phase) => phase.key === 'sicherheitszeit')).toMatchObject({ seconds: 10, limit: 'max' })
    expect(variant('oel').phases.find((phase) => phase.key === 'vorlueftung')).toMatchObject({ seconds: 15, limit: 'min' })
    // Jede Phase mit Störungen ist erreichbar, jede Variante endet im Betrieb
    for (const candidate of tool.variants) expect(candidate.phases.at(-1)!.key).toBe('betrieb')
  })

  it('meldet unbekannte Signale und Phasen', () => {
    const broken = sequenceToolSchema.parse({
      ...tool,
      variants: [
        {
          ...variant('gas'),
          phases: [{ ...variant('gas').phases[0]!, signals: ['regler', 'gibtsnicht'] }, ...variant('gas').phases.slice(1)],
          faults: [{ ...variant('gas').faults[0]!, phase: 'fehlt' }],
        },
      ],
    })
    expect(checkSequenceTool(broken)).toEqual([
      'variants (gas), Phase init: unbekanntes Signal "gibtsnicht"',
      'variants (gas), Störung "Brenner läuft nicht an": unbekannte Phase "fehlt"',
    ])
  })

  it('misst Phasen mit der Stoppuhr und erkennt, wo der Ablauf stehen bleibt', () => {
    const count = variant('gas').phases.length
    let watch = startStopwatch(1000)
    expect(activePhase(watch)).toBe(0)
    watch = nextPhase(watch, 2000, count)
    watch = nextPhase(watch, 21500, count)
    expect(activePhase(watch)).toBe(2)
    expect(measuredSeconds(watch)).toEqual([1, 19.5])
    const stopped = stopStopwatch(watch, 24000)
    expect(stopped).toMatchObject({ state: 'stopped', phase: 2 })
    expect(measuredSeconds(stopped)).toEqual([1, 19.5, 2.5])
    // Bis zum Betrieb durchgelaufen
    watch = nextPhase(watch, 23500, count)
    watch = nextPhase(watch, 26000, count)
    expect(watch.state).toBe('done')
    expect(activePhase(watch)).toBe(count - 1)
    // Nach dem Anhalten bewirkt Weiter nichts mehr
    expect(nextPhase(stopped, 30000, count)).toBe(stopped)
  })

  it('bewertet nur Höchst- und Mindestwerte, mit 1 s Spielraum für die Handmessung', () => {
    const gas = variant('gas').phases
    const ts = gas.find((phase) => phase.key === 'sicherheitszeit')!
    const tv = gas.find((phase) => phase.key === 'vorbelueftung')!
    expect(outsideLimit(ts, 3.9)).toBeUndefined()
    expect(outsideLimit(ts, 4.2)).toBe('over')
    expect(outsideLimit(tv, 40)).toBeUndefined()
    const t1 = variant('oel').phases.find((phase) => phase.key === 'vorlueftung')!
    expect(outsideLimit(t1, 13.5)).toBe('under')
    // Ganze Sekunden, aufgerundet; Rechenreste zählen nicht
    expect(formatSeconds(19.5)).toBe('20 s')
    expect(formatSeconds(19.01)).toBe('20 s')
    expect(formatSeconds(3.0000001)).toBe('3 s')
  })

  it('stellt die Störungen der angehaltenen Phase nach vorn', () => {
    const symptoms = faultsByPhase(variant('gas'), 'sicherheitszeit').map((fault) => fault.symptom)
    expect(symptoms.slice(0, 2)).toEqual(['Zündfunke da, aber keine Flamme', 'Flamme brennt kurz, Störung am Ende der Sicherheitszeit'])
    expect(faultsByPhase(variant('gas'))[0]!.symptom).toBe('Brenner läuft nicht an')
  })

  it('zeigt Diagramm, Stoppuhr und Fehlersuche', () => {
    const html = render(<SequenceLookup tool={tool} />)
    expect(html).toContain('aria-label="Brennerart"')
    expect(html).toContain('<caption class="sr-only">Ablauf Gas-Gebläsebrenner: Signale je Phase</caption>')
    expect(html).toContain('aria-label="Vorspülzeit"')
    // Deutsche Kürzel wie im Tabellenbuch
    expect(variant('gas').phases.map((phase) => phase.abbr)).toEqual(['WZ', 'VS', 'VZZ', 'SZ', 'B'])
    expect(html).not.toContain('maßstäblich')
    expect(html).toContain('Stoppuhr starten')
    expect(html).toContain('Fehlersuche: Wo bleibt der Start stehen?')
    // Signal an: gelber Balken, aus: dünne Linie; für Screenreader als Text
    expect(html).toContain('bg-yellow-400')
    expect(html).not.toContain('bg-red-600')
    expect(html).toMatch(/<span class="sr-only">an<\/span>/)
  })

  it('zeigt nach dem Anhalten die Messung und klappt die passende Störung auf', () => {
    const html = render(<SequenceLookup
        tool={tool}
        initialVariant="oel"
        initialWatch={{ state: 'stopped', marks: [0, 2500, 18000], end: 30000, phase: 2 }}
        initialFault="Keine Flamme am Ende der Sicherheitszeit"
      />,
    )
    expect(html).toContain('href="/lexikon/sicherheitszeit"')
    expect(html).toMatch(/Angehalten in <a [^>]*>Sicherheitszeit<\/a> nach 12\ss/)
    expect(html).toContain('über Höchstwert')
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('Kein Brennstoff: Ölstand, Absperrung, Filter, Saugleitung und Ölpumpe prüfen')
    expect(html).toContain('Neu messen')
  })

  it('verlinkt jede Phase ins Lexikon, in den vorhandenen Texten statt über eine Legende', () => {
    for (const candidate of tool.variants) {
      for (const phase of candidate.phases) {
        expect(lexiconPathFor([phase.term, phase.label]), `${candidate.key}: ${phase.label}`).toBeDefined()
      }
    }
    const html = render(<SequenceLookup tool={tool} />)
    // Überschrift der gewählten Phase
    expect(html).toContain('href="/lexikon/wartezeit"')
    expect(html).not.toContain('aria-label="Legende"')
    // Messwerte und Hinweis nach dem Anhalten
    const stopped = render(
      <SequenceLookup tool={tool} initialWatch={{ state: 'stopped', marks: [0, 1000, 21000], end: 22000, phase: 2 }} />,
    )
    expect(stopped).toContain('href="/lexikon/vorspuelzeit"')
    expect(stopped).toContain('href="/lexikon/vorzuendzeit"')
  })

  it('zeigt im Diagramm und in den Einzelheiten, wie oft eine Phase wiederholt werden darf', () => {
    const html = render(<SequenceLookup tool={tool} initialVariant="oel" initialWatch={{ state: 'stopped', marks: [0, 3000, 18000, 21000], end: 25000, phase: 3 }} />)
    expect(html).toContain('Wieder­holung')
    expect(html).toContain('>max. 3×</td>')
    expect(html).toContain('text-muted')
    // Ohne genannte Anzahl keine Zeile im Diagramm und nie „keine“ als Wert
    const none = render(<SequenceLookup tool={tool} initialVariant="brennwert" />)
    expect(none).not.toContain('Wieder­holung')
    expect(tool.variants.flatMap((candidate) => candidate.phases).filter((phase) => phase.repeat?.count).map((phase) => phase.repeat!.count)).toEqual([2, 3])
    expect(html).toContain('beim 4. Flammenabriss verriegelt er')
  })

  it('sagt bei der Stoppuhr deutlich, wann die Phase vorbei ist', () => {
    const gas = variant('gas').phases
    const [, vs, vzz, sz, betrieb] = gas
    expect(renderToStaticMarkup(<PhaseEnd phase={vs!} next={vzz} elapsed={12.3} />)).toContain('Phase endet in etwa 8 s.')
    const over = renderToStaticMarkup(<PhaseEnd phase={vs!} next={vzz} elapsed={20.2} />)
    expect(over).toContain('Phase vorbei, wenn: Zündfunke hörbar')
    expect(over).toContain('role="status"')
    expect(renderToStaticMarkup(<PhaseEnd phase={sz!} next={betrieb} elapsed={1.2} />)).toContain('Noch höchstens 2 s')
    expect(renderToStaticMarkup(<PhaseEnd phase={sz!} next={betrieb} elapsed={3.4} />)).toContain('Höchstzeit erreicht')
    // Ohne Vergleichswert: nur der Hinweis auf das nächste Ereignis
    const atmo = variant('atmosphaerisch').phases
    expect(renderToStaticMarkup(<PhaseEnd phase={atmo[2]!} next={atmo[3]} elapsed={5} />)).toBe(
      '<p class="mt-2 text-base font-semibold">Phase vorbei, wenn: Taster loslassen, Zündflamme brennt weiter</p>',
    )
  })

  it('ist über die Suche zu finden', () => {
    const document = toolSearchDocuments([tool])[0]!
    expect(document.subtitle).toBe(tool.summary)
    expect(document.keywords).toContain('Sicherheitszeit')
    expect(document.keywords).toContain('Kein Zündfunke')
  })
})
