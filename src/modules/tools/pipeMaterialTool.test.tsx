import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { PipeMaterialLookup } from './PipeMaterialLookup'
import { checkPipeMaterialTool, CONTENT_MISSING, pipeMaterialToolSchema, pipeSelection, type PipeMaterialTool } from './pipeMaterialTool'
import { isPipeMaterialTool } from './schema'
import ToolPage from './ToolPage'
import { toolEntries, toolSearchDocuments } from './tools'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.rohrwerkstoffe')
if (!entry || !isPipeMaterialTool(entry)) throw new Error('Rohrwerkstoff-Tool erwartet')
const tool: PipeMaterialTool = entry

const system = (key: string) => {
  const found = tool.systems.find((candidate) => candidate.key === key)
  if (!found) throw new Error(`System ${key} fehlt`)
  return found
}
const subsystem = (systemKey: string, key: string) => system(systemKey).subsystems.find((candidate) => candidate.key === key)
const render = (systemKey: string, installation = 'aufputz', subsystemKey?: string, which: PipeMaterialTool = tool) =>
  renderToStaticMarkup(
    <PipeMaterialLookup tool={which} initialSystem={systemKey} initialSubsystem={subsystemKey} initialInstallation={installation} />,
  )
/** Werkstoffe in der Reihenfolge der Karten */
const cardNames = (fullHtml: string) => {
  // Nur die Rohre, die Fittingwerkstoffe stehen in einer eigenen Liste darunter
  const end = fullHtml.indexOf('aria-label="Fittingwerkstoffe"')
  const html = end === -1 ? fullHtml : fullHtml.slice(0, end)
  return [...html.matchAll(/<article[^>]*><div[^>]*><h3[^>]*>([^<]+)<\/h3>/g)].map((match) => match[1])
}
const levelsOf = (systemKey: string, installation: string, subsystemKey?: string) =>
  pipeSelection(system(systemKey), subsystemKey ? subsystem(systemKey, subsystemKey) : undefined, installation).recommendations.map(
    (item) => `${item.material}:${item.level}`,
  )
const allStatements = () => [
  ...tool.materials.flatMap((material) => [...material.pros, ...material.cons]),
  ...tool.systems.flatMap((item) => [item, ...item.subsystems]).flatMap((item) => [...item.requirements, ...item.recommendations]),
]

describe('Rohrwerkstoffe', () => {
  it('ist fehlerfrei und deckt die gewünschten Anlagensysteme ab', () => {
    expect(checkPipeMaterialTool(tool)).toEqual([])
    const keys = tool.systems.map((candidate) => candidate.key)
    for (const key of ['trinkwasser', 'heizung', 'abwasser', 'gas', 'kaelte', 'solar', 'druckluft', 'prozesswasser']) {
      expect(keys).toContain(key)
    }
    expect(tool.installations.map((candidate) => candidate.label)).toEqual(['Aufputz', 'Unterputz'])
  })

  it('stützt sich nur auf Quellen für Deutschland, nicht auf österreichische', () => {
    const austrian = /ÖVGW|ÖNORM|TRVB|Österreich|geberit\.at|\(AT\)|de_AT/
    expect(tool.source).not.toMatch(austrian)
    for (const statement of allStatements()) {
      expect(`${statement.source} ${'text' in statement ? statement.text : statement.note}`).not.toMatch(austrian)
    }
  })

  it('bleibt ungeprüft, bis der Inhaber die Zuordnung freigibt', () => {
    expect(tool.status).toBe('draft')
    expect(tool.verifiedBy).toBe('')
    expect(tool.verifiedAt).toBe('')
  })

  it('zeigt vor der Auswahl nur den Hinweis', () => {
    const html = render('')
    expect(html).toContain('Anlagensystem wählen …')
    expect(html).not.toContain('aria-label="Verlegung"')
    expect(html).not.toContain('<article')
    expect(html).not.toContain('aria-label="Untersystem"')
  })

  it('fragt erst Anlagensystem, dann Untersystem und nur bei Bedarf die Verlegung ab', () => {
    const html = render('trinkwasser', 'aufputz', 'kaltwasser')
    const systemLabel = html.indexOf('Anlagensystem</label>')
    const sub = html.indexOf('aria-label="Untersystem"')
    const installation = html.indexOf('aria-label="Verlegung"')
    expect(systemLabel).toBeGreaterThan(-1)
    expect(systemLabel).toBeLessThan(sub)
    expect(sub).toBeLessThan(installation)
    // Ohne Unterschied zwischen Aufputz und Unterputz keine Leiste
    for (const [key, sub] of [['abwasser', 'gebaeude'], ['solar', undefined], ['druckluft', undefined], ['heizung', 'fussbodenheizung']] as const) {
      expect(render(key, 'aufputz', sub)).not.toContain('aria-label="Verlegung"')
    }
    expect(render('gas')).toContain('aria-label="Verlegung"')
  })

  it('zeigt die Vorgaben und Einsatzgrenzen unter den Ergebnissen', () => {
    const html = render('trinkwasser', 'aufputz', 'kaltwasser')
    expect(html.indexOf('Vorgaben und Einsatzgrenzen')).toBeGreaterThan(html.lastIndexOf('</article>'))
  })

  it('führt die Edelstahlsorten einzeln mit verständlichem Namen', () => {
    const names = tool.materials.map((material) => material.name)
    for (const name of ['Edelstahl 1.4401 (austenitisch)', 'Edelstahl 1.4521 (ferritisch, nickelfrei)', 'Edelstahl 1.4520 (kein Trinkwasser)']) {
      expect(names).toContain(name)
    }
    expect(levelsOf('trinkwasser', 'aufputz', 'kaltwasser')).toContain('edelstahl4520:avoid')
    expect(levelsOf('loeschwasser', 'aufputz', 'trocken')).toEqual(['edelstahl4521:recommended', 'edelstahl4401:avoid'])
    expect(levelsOf('heizung', 'aufputz', 'heizkreis')).toEqual(
      expect.arrayContaining(['edelstahl4401:suitable', 'edelstahl4521:suitable', 'edelstahl4520:recommended']),
    )
    expect(render('trinkwasser', 'aufputz', 'kaltwasser')).not.toContain('Mapress')
  })

  it('unterscheidet Aufputz und Unterputz', () => {
    expect(levelsOf('heizung', 'aufputz', 'heizkreis')).toEqual(
      expect.arrayContaining(['cStahlKunststoffmantel:suitable', 'cStahlVerzinkt:suitable']),
    )
    expect(levelsOf('heizung', 'unterputz', 'heizkreis')).toEqual(
      expect.arrayContaining(['cStahlKunststoffmantel:suitable', 'cStahlVerzinkt:limited', 'mehrschichtverbund:recommended']),
    )
    const under = render('heizung', 'unterputz', 'heizkreis')
    expect(under).toMatch(/aria-pressed="true"[^>]*>.*?Unterputz/)
    expect(under).toContain('Der Hersteller empfiehlt unter Putz das PP-ummantelte Rohr.')
    expect(render('heizung', 'aufputz', 'heizkreis')).not.toContain('Der Hersteller empfiehlt unter Putz')
  })

  it('nimmt die Werkstoffe des Systems ins Untersystem mit und ergänzt dessen eigene', () => {
    const cold = levelsOf('trinkwasser', 'aufputz', 'kaltwasser')
    const warm = levelsOf('trinkwasser', 'aufputz', 'warmwasser')
    expect(cold).toContain('edelstahl4401:suitable')
    expect(warm).toContain('edelstahl4521:recommended')
    expect(cold).toContain('verzinkterStahl:limited')
    expect(warm).toContain('verzinkterStahl:avoid')
    const html = render('trinkwasser', 'aufputz', 'warmwasser')
    expect(html).toContain('aria-label="Untersystem"')
    expect(html).toMatch(/aria-pressed="true"[^>]*>.*?Warmwasser und Zirkulation/)
  })

  it('sortiert Empfohlenes nach vorn und Ungeeignetes nach hinten', () => {
    const names = cardNames(render('trinkwasser', 'unterputz', 'warmwasser'))
    expect(names.slice(0, 2)).toEqual(['Mehrschichtverbundrohr', 'PE-X mit Sauerstoffsperre'])
    expect(names.slice(-3)).toEqual(['Blei', 'Stahl schmelztauchverzinkt', 'PVC-U'])
    const html = render('trinkwasser', 'unterputz', 'warmwasser')
    expect(html.indexOf('>Empfohlen<')).toBeLessThan(html.indexOf('>Geeignet<'))
    expect(html.indexOf('>Geeignet<')).toBeLessThan(html.indexOf('>Eingeschränkt geeignet<'))
    expect(html.indexOf('>Eingeschränkt geeignet<')).toBeLessThan(html.indexOf('>Nicht geeignet<'))
    const heating = cardNames(render('heizung', 'aufputz', 'heizkreis'))
    expect(heating[0]).toBe('Edelstahl 1.4520 (kein Trinkwasser)')
  })

  it('zeigt Vorgaben, Bewertung, Vor- und Nachteile mit Quelle', () => {
    const html = render('trinkwasser', 'aufputz', 'kaltwasser')
    expect(html).toContain('Vorgaben und Einsatzgrenzen')
    expect(html).toContain('Positivliste')
    expect(html).toContain('Zuordnung: ')
    expect(html).toContain('Vor- und Nachteile')
    expect(html).toContain('Glatte Innenwandungen.')
    expect(html).toContain('(UBA 2026)')
    // Ohne Angaben in den Quellen steht das ausdrücklich da
    expect(render('abwasser', 'aufputz', 'gebaeude')).toContain('Keine Angabe in den Quellen.')
  })

  it('lässt bei „Nicht geeignet“ die Vorteile weg, damit es nicht wie eine Empfehlung aussieht', () => {
    const html = render('trinkwasser', 'aufputz', 'warmwasser')
    const avoided = html.slice(html.indexOf('>Stahl schmelztauchverzinkt</h3>'))
    expect(avoided).toContain('Nicht geeignet')
    expect(avoided).not.toContain('sehr widerstandsfähig')
  })

  it('meldet, wenn für eine Verlegeart kein Werkstoff genannt ist', () => {
    const oil = system('oel')
    const onlyOnTop: PipeMaterialTool = {
      ...tool,
      systems: [{ ...oil, recommendations: oil.recommendations.map((item) => ({ ...item, installations: ['aufputz'] })) }],
    }
    expect(render('oel', 'unterputz', undefined, onlyOnTop)).toContain('Für Unterputz nennen die Quellen hier keinen Werkstoff.')
  })

  it('markiert Systeme ohne Beleg deutlich als Platzhalter', () => {
    const refrigerant = subsystem('kaelte', 'kaeltemittel')!
    expect(levelsOf('kaelte', 'aufputz', 'kaeltemittel')).toEqual(['kupfer:recommended'])
    const placeholder: PipeMaterialTool = {
      ...tool,
      systems: [{ ...system('kaelte'), subsystems: [{ ...refrigerant, note: `${CONTENT_MISSING}.`, recommendations: [] }] }],
    }
    for (const html of [render('kaelte', 'aufputz', 'kaeltemittel', placeholder)]) {
      expect(html).toContain(CONTENT_MISSING)
      expect(html).not.toContain('<article')
      expect(html).not.toContain('nennen die Quellen hier keinen Werkstoff')
    }
  })

  it('behauptet „Vorgeschrieben“, „Empfohlen“ und „Nicht geeignet“ nur mit Begründung', () => {
    const all = tool.systems.flatMap((item) => [item, ...item.subsystems]).flatMap((item) => item.recommendations)
    for (const recommendation of all.filter((item) => item.level !== 'suitable')) {
      expect(recommendation.note).not.toBe('')
      expect(recommendation.source).not.toBe('')
    }
  })

  it('meldet Fehler im Inhalt', () => {
    const first = tool.systems.find((item) => item.subsystems.length === 0 && item.recommendations.length > 0)!
    const broken: PipeMaterialTool = {
      ...tool,
      systems: [
        {
          ...first,
          recommendations: [
            { material: 'gibtEsNicht', level: 'avoid', installations: ['keller'], note: '', source: 'x' },
            { material: 'edelstahl4401', level: 'suitable', installations: [], note: '', source: 'x' },
            { material: 'edelstahl4401', level: 'suitable', installations: ['aufputz'], note: '', source: 'x' },
          ],
        },
        { ...first, key: 'leer', label: 'Leer', note: '', recommendations: [] },
      ],
    }
    const issues = checkPipeMaterialTool(broken).join(' | ')
    expect(issues).toContain('unbekannter Werkstoff "gibtEsNicht"')
    expect(issues).toContain('unbekannte Verlegeart "keller"')
    expect(issues).toContain('braucht note')
    expect(issues).toContain('Werkstoff "edelstahl4401" bei "aufputz" doppelt')
    expect(issues).toContain('keine Werkstoffe und kein')
    expect(issues).toContain('nirgends verwendet')
    expect(issues).toContain('0 Empfehlungen, erlaubt 1–3')
    const todo = { ...first, key: 'offen', note: `${CONTENT_MISSING}.`, recommendations: [] }
    expect(checkPipeMaterialTool({ ...tool, status: 'verified', systems: [...tool.systems, todo] }).join(' ')).toContain(
      'bei verified nicht erlaubt',
    )
    expect(pipeMaterialToolSchema.safeParse({ ...tool, installations: [tool.installations[0]] }).success).toBe(false)
  })

  it('nennt in jedem Ergebnis 1 bis 3 Empfehlungen mit Begründung', () => {
    for (const item of tool.systems) {
      const parts = item.subsystems.length > 0 ? item.subsystems : [undefined]
      for (const sub of parts) {
        if ((sub ?? item).note.startsWith(CONTENT_MISSING)) continue
        for (const installation of tool.installations) {
          const recommended = pipeSelection(item, sub, installation.key).recommendations.filter((rec) => rec.level === 'recommended')
          const where = `${item.label} ${sub?.label ?? ''} ${installation.label}`
          expect(recommended.length, where).toBeGreaterThanOrEqual(1)
          expect(recommended.length, where).toBeLessThanOrEqual(3)
        }
      }
    }
  })

  it('führt Pool mit Kunststoff als Empfehlung und Edelstahl nur nach Chloridgehalt', () => {
    expect(levelsOf('pool', 'aufputz', 'beckenwasser')).toEqual(['pvcU:recommended', 'edelstahl4401:limited'])
    expect(levelsOf('pool', 'aufputz', 'sole')).toEqual(['pvcU:recommended', 'edelstahl4401:avoid'])
    const html = render('pool', 'aufputz', 'beckenwasser')
    expect(html).toContain('1.000 mg/l Chlorid')
    expect(html).not.toContain('aria-label="Verlegung"')
  })

  it('zeigt beim Abwasser im Gebäude die Schallschutz-Vorgaben', () => {
    const html = render('abwasser', 'aufputz', 'gebaeude')
    expect(html).toContain('30 dB(A)')
    expect(html).toContain('Rohr und Rohrschelle')
    expect(levelsOf('abwasser', 'aufputz', 'grundleitung')).toEqual([
      'kgRohr:recommended',
      'beton:recommended',
      'peHd:suitable',
      'steinzeug:limited',
    ])
  })

  it('markiert veraltete Werkstoffe und zeigt Beispielprodukte', () => {
    const sewer = render('abwasser', 'aufputz', 'gebaeude')
    const sml = sewer.slice(sewer.indexOf('>SML-Gussrohr</h3>'))
    expect(sml).toContain('>Veraltet<')
    expect(sml).toContain('Düker SML')
    expect(sewer.slice(0, sewer.indexOf('>SML-Gussrohr</h3>'))).not.toContain('>Veraltet<')
    const drinking = render('trinkwasser', 'aufputz', 'kaltwasser')
    expect(drinking).toContain('Beispielprodukte')
    expect(drinking).toContain('Viega Sanpress Inox')
    expect(drinking).toContain('TECE TECEflex Verbundrohr')
  })

  it('empfiehlt unter Putz nur flexible und auf Putz nur starre Rohre', () => {
    const form = (key: string) => tool.materials.find((material) => material.key === key)!.form
    for (const [systemKey, sub] of [['trinkwasser', 'kaltwasser'], ['trinkwasser', 'warmwasser'], ['heizung', 'heizkreis'], ['gas', undefined]] as const) {
      const recommended = (installation: string) =>
        pipeSelection(system(systemKey), sub ? subsystem(systemKey, sub) : undefined, installation)
          .recommendations.filter((rec) => rec.level === 'recommended' && tool.materials.find((m) => m.key === rec.material)!.kind === 'pipe')
          .map((rec) => form(rec.material))
      expect(recommended('aufputz').length, `${systemKey} AP`).toBeGreaterThan(0)
      expect(new Set(recommended('aufputz')), `${systemKey} AP`).toEqual(new Set(['rigid']))
      expect(new Set(recommended('unterputz')), `${systemKey} UP`).toEqual(new Set(['flexible']))
    }
    // Die Prüfung meldet einen Verstoß
    const gas = system('gas')
    const broken: PipeMaterialTool = {
      ...tool,
      systems: [{ ...gas, recommendations: gas.recommendations.map((rec) => (rec.material === 'edelstahl4401' ? { ...rec, level: 'recommended' } : rec)) }],
    }
    expect(checkPipeMaterialTool(broken).join(' ')).toContain('"edelstahl4401" (rigid) empfohlen, erlaubt nur flexible')
    // Der Hinweis steht bei der Bewertung
    expect(render('heizung', 'unterputz', 'heizkreis')).toContain('unter Putz werden nur flexible Rohre empfohlen')
  })

  it('führt Edelstahl bei Gas nur als 1.4401', () => {
    expect(levelsOf('gas', 'aufputz')).toEqual(expect.arrayContaining(['edelstahl4401:recommended', 'kupfer:recommended', 'edelstahl4521:avoid']))
    expect(levelsOf('gas', 'unterputz')).toEqual(expect.arrayContaining(['mehrschichtverbund:recommended', 'edelstahl4401:suitable']))
  })

  it('zeigt Fittingwerkstoffe in einer eigenen Liste', () => {
    const html = render('trinkwasser', 'aufputz', 'kaltwasser')
    const fittingsAt = html.indexOf('aria-label="Fittingwerkstoffe"')
    expect(fittingsAt).toBeGreaterThan(html.lastIndexOf('>PVC-U</h3>'))
    const fittingsHtml = html.slice(fittingsAt)
    for (const name of ['Rotguss', 'Siliziumbronze', 'Messing']) expect(fittingsHtml).toContain(`>${name}</h3>`)
    expect(levelsOf('trinkwasser', 'aufputz', 'kaltwasser')).toContain('messing:limited')
    expect(levelsOf('heizung', 'aufputz', 'heizkreis')).toContain('messing:suitable')
  })

  it('nennt empfohlene oder vorgeschriebene Dämmung und Schutz', () => {
    const cold = render('trinkwasser', 'aufputz', 'kaltwasser')
    expect(cold).toContain('Dämmung und Schutz')
    expect(cold).toContain('Kaltwasser gegen Erwärmung schützen')
    expect(cold).toContain('Mindestdämmdicke')
    expect(render('heizung', 'unterputz', 'heizkreis')).toContain('Korrosionsschutzbinde')
    expect(render('lueftung')).toContain('gegen Wärmeverlust und Schwitzwasser dämmen')
    // Dämmung steht über den Vorgaben
    expect(cold.indexOf('Dämmung und Schutz')).toBeLessThan(cold.indexOf('Vorgaben und Einsatzgrenzen'))
  })

  it('markiert „Eingeschränkt geeignet“ leicht farbig', () => {
    expect(render('trinkwasser', 'aufputz', 'kaltwasser')).toMatch(/bg-warn\/25[^"]*">Eingeschränkt geeignet</)
  })

  it('führt Lüftung, Regenwasser, Anschlusskanal, Fernwärme und Prozesswasser', () => {
    const keys = tool.systems.map((item) => item.key)
    for (const key of ['lueftung', 'regenwasser', 'fernwaerme', 'prozesswasser', 'pool']) expect(keys).toContain(key)
    expect(system('abwasser').subsystems.map((item) => item.key)).toContain('anschlusskanal')
    expect(levelsOf('fernwaerme', 'aufputz', 'netz')).toEqual(['kmr:recommended', 'nahwaermePeXa:recommended'])
    expect(levelsOf('fernwaerme', 'aufputz', 'hausstation')).toContain('edelstahl4521:recommended')
    expect(render('fernwaerme', 'aufputz', 'netz')).toContain('REHAU RAUTHERMEX')
    expect(levelsOf('prozesswasser', 'aufputz', 'rein')).toEqual(['edelstahl4401:recommended', 'edelstahl4521:recommended'])
    expect(levelsOf('regenwasser', 'aufputz', 'fallrohrAussen')[0]).toBe('titanzink:recommended')
    const sewer = render('abwasser', 'aufputz', 'anschlusskanal')
    expect(sewer.slice(sewer.indexOf('>Steinzeug (Ton)</h3>'))).toContain('>Veraltet<')
  })

  it('zeigt Quelle und Prüfstand auf der Tool-Seite', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/tools/rohrwerkstoffe']}>
        <Routes>
          <Route path="/tools/:slug" element={<ToolPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(html).toContain('Rohrwerkstoffe')
    expect(html).toContain('Ungeprüft')
    expect(html).toContain('Viega')
    expect(html).toContain('Anlagensystem wählen …')
  })

  it('ist über die globale Suche auffindbar', () => {
    const doc = toolSearchDocuments().find((item) => item.id === 'tool.rohrwerkstoffe')!
    for (const keyword of ['Edelstahl 1.4401 (austenitisch)', 'X5CrNiMo17-12-2', 'X2CrTi17', 'Mehrschichtverbundrohr', 'Unterputz', 'Druckluft', 'Fußbodenheizung', 'HT-Rohr']) {
      expect(doc.keywords).toContain(keyword)
    }
  })
})
