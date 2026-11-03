import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { CableLookup } from './CableLookup'
import { checkCableTool, cableToolSchema, CONTENT_MISSING, groupComponents, sortedRecommendations, type CableTool } from './cableTool'
import { isCableTool } from './schema'
import ToolPage from './ToolPage'
import { toolEntries, toolSearchDocuments } from './tools'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.kabelarten')
if (!entry || !isCableTool(entry)) throw new Error('Kabel-Tool erwartet')
const tool: CableTool = entry

const component = (key: string) => {
  const found = tool.components.find((candidate) => candidate.key === key)
  if (!found) throw new Error(`Komponente ${key} fehlt`)
  return found
}
const situationKeys = () => tool.situations.map((candidate) => candidate.key)
const render = (key: string) => renderToStaticMarkup(<CableLookup tool={tool} initialSelection={key} />)
const renderSituation = (key: string) =>
  renderToStaticMarkup(<CableLookup tool={tool} initialMode="situation" initialSelection={key} />)
/** Kabelarten in der Reihenfolge der Karten */
const cardNames = (html: string) => [...html.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((match) => match[1])

describe('Kabelarten', () => {
  it('ist fehlerfrei und deckt die gewünschten Komponenten und Einbausituationen ab', () => {
    expect(checkCableTool(tool)).toEqual([])
    const keys = tool.components.map((candidate) => candidate.key)
    for (const key of ['fuehler', 'aussengeraet', 'steckdoseInnen', 'pumpe', 'pvDc']) expect(keys).toContain(key)
    for (const key of ['aufputz', 'unterputz', 'innenTrocken', 'aussen']) expect(situationKeys()).toContain(key)
  })

  it('bleibt ungeprüft, bis der Inhaber die Zuordnung freigibt', () => {
    expect(tool.status).toBe('draft')
    expect(tool.verifiedBy).toBe('')
    expect(tool.verifiedAt).toBe('')
  })

  it('zeigt vor der Auswahl nur den Hinweis und gliedert die Auswahl in Gruppen', () => {
    const html = render('')
    expect(html).toContain('Komponente wählen …')
    expect(html).toContain('<optgroup label="Photovoltaik">')
    expect(html).not.toContain('<article')
    expect(groupComponents(tool.components).flatMap((group) => group.components)).toHaveLength(tool.components.length)
  })

  it('schaltet über die Leiste zwischen Komponente und Einbausituation um', () => {
    const components = render('')
    expect(components).toContain('aria-label="Auswahl nach"')
    expect(components).toMatch(/aria-pressed="true"[^>]*>.*?Komponente/)
    expect(components).toMatch(/aria-pressed="false"[^>]*>.*?Einbausituation/)
    expect(components).toContain('value="fuehler"')
    expect(components).not.toContain('value="unterputz"')

    const situations = renderToStaticMarkup(<CableLookup tool={tool} initialMode="situation" />)
    expect(situations).toMatch(/aria-pressed="true"[^>]*>.*?Einbausituation/)
    expect(situations).toContain('Einbausituation wählen …')
    expect(situations).toContain('<optgroup label="Umgebung">')
    expect(situations).toContain('value="unterputz"')
    expect(situations).not.toContain('value="fuehler"')
  })

  it('zeigt zur Einbausituation die passenden Kabelarten', () => {
    const under = renderSituation('unterputz')
    expect(under).toContain('<option value="unterputz" selected="">')
    expect(cardNames(under)).toEqual(['NYM-J', 'H07V-K', 'LiYCY', 'J-Y(St)Y'])
    expect(under).toContain('Nur im Elektroinstallationsrohr')
    // Für die offene Verlegung auf Putz nennt die Quelle J-Y(St)Y nicht
    expect(cardNames(renderSituation('aufputz'))).not.toContain('J-Y(St)Y')

    const outside = renderSituation('aussen')
    expect(cardNames(outside)[0]).toBe('NYY-J')
    expect(cardNames(outside).at(-1)).toBe('H05VV-F')
    expect(outside).toContain('Nur vor direkter Sonne geschützt.')
    expect(outside.lastIndexOf('Geeignet')).toBeLessThan(outside.lastIndexOf('Nicht geeignet'))
  })

  it('zeigt zur Komponente Kabelart, Bewertung, Eigenschaften und Quelle', () => {
    const html = render('steckdoseAussen')
    expect(html).toContain('<option value="steckdoseAussen" selected="">')
    expect(html).toContain('>NYY-J</h3>')
    expect(html).toContain('Geeignet')
    expect(html).toContain('UV-beständig')
    expect(html).toContain('0,6/1 kV')
    expect(html).toContain('Zuordnung: ')
    expect(html).toContain('Kabeldaten laut')
    expect(html).toContain('Einschränkung:')
    // Eigenschaften sind nicht nur über Farbe erkennbar
    expect(html).toContain('<span class="sr-only">Ja: </span>')
    expect(html).toContain('<span class="sr-only">Nein: </span>')
    expect(html).toContain('Keine Angabe: ')
  })

  it('sortiert Vorgeschriebenes nach vorn und Ungeeignetes nach hinten', () => {
    const levels = sortedRecommendations(component('aussengeraet')).map((item) => item.level)
    expect(levels).toEqual(['required', 'suitable', 'suitable', 'avoid', 'avoid'])
    const html = render('aussengeraet')
    expect(html.indexOf('Vorgeschrieben')).toBeLessThan(html.indexOf('Geeignet'))
    expect(html.indexOf('Geeignet')).toBeLessThan(html.indexOf('Nicht geeignet'))
    expect(html).toContain('60245 IEC 57')
  })

  it('behauptet „Vorgeschrieben“ nur mit Quelle und genanntem Gerät', () => {
    const required = [...tool.components, ...tool.situations].flatMap((item) =>
      item.recommendations.filter((rec) => rec.level === 'required'),
    )
    expect(required.length).toBeGreaterThan(0)
    for (const recommendation of required) {
      expect(recommendation.source).toMatch(/Vaillant|Panasonic/)
      expect(recommendation.note).toMatch(/Vaillant|Panasonic/)
    }
  })

  it('lässt bei „Nicht geeignet“ die Daten weg, damit es nicht wie eine Empfehlung aussieht', () => {
    const html = renderSituation('erdreich')
    const avoided = html.slice(html.indexOf('>NYM-J</h3>'))
    expect(avoided).toContain('Nicht geeignet')
    expect(avoided).not.toContain('300/500 V')
    expect(avoided).not.toContain('Kabeldaten laut')
  })

  it('bietet nur Optionen mit Inhalt an', () => {
    for (const item of [...tool.components, ...tool.situations]) {
      expect(item.recommendations.length, item.label).toBeGreaterThan(0)
    }
  })

  it('markiert eine Option ohne Beleg deutlich, falls sie als Platzhalter angelegt wird', () => {
    const placeholder = { ...tool.components[0]!, key: 'platzhalter', note: `${CONTENT_MISSING}.`, recommendations: [] }
    const withPlaceholder: CableTool = { ...tool, components: [...tool.components, placeholder] }
    expect(checkCableTool(withPlaceholder)).toEqual([])
    const html = renderToStaticMarkup(<CableLookup tool={withPlaceholder} initialSelection="platzhalter" />)
    expect(html).toContain(CONTENT_MISSING)
    expect(html).not.toContain('<article')
  })

  it('meldet Fehler im Inhalt', () => {
    const first = tool.components[0]!
    const broken: CableTool = {
      ...tool,
      components: [
        { ...first, recommendations: [{ cable: 'gibtEsNicht', level: 'required', note: '', source: 'x' }] },
        { ...first, key: 'leer', note: '', recommendations: [] },
      ],
      situations: [{ ...first, key: 'ort', label: 'Ort', note: '', recommendations: [] }],
    }
    const issues = checkCableTool(broken).join(' | ')
    expect(issues).toContain('unbekannte Kabelart "gibtEsNicht"')
    expect(issues).toContain('braucht note')
    expect(issues).toContain('keine Kabelart und kein')
    expect(issues).toContain('situations (Ort)')
    expect(issues).toContain('nirgends verwendet')
    const placeholder = { ...first, key: 'platzhalter', note: `${CONTENT_MISSING}.`, recommendations: [] }
    expect(checkCableTool({ ...tool, status: 'verified', components: [...tool.components, placeholder] }).join(' ')).toContain(
      'bei verified nicht erlaubt',
    )
    expect(cableToolSchema.safeParse({ ...tool, properties: [] }).success).toBe(false)
    const { situations: _situations, ...withoutSituations } = tool
    expect(cableToolSchema.safeParse(withoutSituations).success).toBe(false)
  })

  it('zeigt Quelle und Prüfstand auf der Tool-Seite', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/tools/kabelarten']}>
        <Routes>
          <Route path="/tools/:slug" element={<ToolPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(html).toContain('Kabelarten')
    expect(html).toContain('Ungeprüft')
    expect(html).toContain('noch nicht geprüft')
    expect(html).toContain('HELUKABEL')
  })

  it('ist über die globale Suche auffindbar', () => {
    const doc = toolSearchDocuments().find((item) => item.id === 'tool.kabelarten')!
    for (const keyword of ['NYM-J', 'Erdkabel', 'Außeneinheit', 'UV-beständig', 'Unterputz', 'Leerrohr']) {
      expect(doc.keywords).toContain(keyword)
    }
  })
})
