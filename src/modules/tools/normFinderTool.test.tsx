import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { NormFinder } from './NormFinder'
import {
  checkNormFinderTool,
  linkHost,
  NORM_TYPE_KEYS,
  NORM_TYPES,
  normFinderToolSchema,
  normsForTopics,
  type NormFinderTool,
  type NormType,
} from './normFinderTool'
import { isNormFinderTool } from './schema'
import ToolPage from './ToolPage'
import { toolEntries, toolSearchDocuments } from './tools'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.normenfinder')
if (!entry || !isNormFinderTool(entry)) throw new Error('Normen-Tool erwartet')
const tool: NormFinderTool = entry

const names = (...topics: string[]) => normsForTopics(tool, topics).map((match) => match.norm.name)
const render = (...topics: string[]) => renderToStaticMarkup(<NormFinder tool={tool} initialTopics={topics} />)
const renderHidden = (topics: string[], hidden: NormType[]) =>
  renderToStaticMarkup(<NormFinder tool={tool} initialTopics={topics} initialHiddenTypes={hidden} />)

describe('Regelwerk-Finder', () => {
  it('ist fehlerfrei und bleibt ungeprüft, bis der Inhaber freigibt', () => {
    expect(checkNormFinderTool(tool)).toEqual([])
    expect(tool.status).toBe('draft')
    expect(tool.verifiedBy).toBe('')
    expect(tool.verifiedAt).toBe('')
  })

  it('ordnet die Regelwerke den genannten Themenbereichen zu', () => {
    expect(names('heizoel')).toEqual(expect.arrayContaining(['TRÖl', 'DIN 4755', 'AwSV', 'DWA-A 791 (TRwS 791)']))
    expect(names('erdgas')).toContain('DVGW G 600 (TRGI)')
    expect(names('fluessiggas')).toContain('TRF 2021')
    expect(names('trinkwasser')).toEqual(expect.arrayContaining(['TrinkwV', 'DIN EN 806', 'DIN EN 1717', 'DVGW W 551']))
    expect(names('gewerblich')).toEqual(expect.arrayContaining(['BetrSichV', 'DGUV Vorschrift 3', 'DVGW G 631']))
    expect(names('heizoel')).not.toContain('DVGW G 600 (TRGI)')
    expect(names('erdgas')).not.toContain('TRF 2021')
  })

  it('trennt Flüssiggas in Freizeitfahrzeugen von gewerblichem Flüssiggas', () => {
    const leisure = names('fluessigFreizeit')
    expect(leisure).toEqual(expect.arrayContaining(['StVZO § 60', 'DVGW G 607', 'DIN EN 1949']))
    expect(leisure[0]).toBe('StVZO § 60')
    expect(leisure).not.toContain('DGUV Regel 110-010')

    const commercial = names('fluessigGewerbe')
    expect(commercial).toEqual(
      expect.arrayContaining(['StVZO § 60', 'BetrSichV', 'DGUV Regel 110-010', 'DGUV Grundsatz 310-003', 'DVGW G 631', 'TRF 2021']),
    )
    // G 607 ist die Prüfgrundlage für Wohnzwecke; gewerbliche Fahrzeuge werden nach der BetrSichV geprüft
    expect(commercial).not.toContain('DVGW G 607')

    const tip = (topic: string) => normsForTopics(tool, [topic]).filter((match) => match.practicalReasons.length > 0)
    expect(tip('fluessigFreizeit').map((match) => match.norm.name)).toEqual(['DVGW G 607'])
    expect(tip('fluessigGewerbe').map((match) => match.norm.name)).toEqual(['DGUV Regel 110-010'])
  })

  it('führt EU-Verordnungen und bayerisches Landesrecht mit eigenem Rang', () => {
    const level = (name: string) => tool.norms.find((norm) => norm.name === name)!.level
    expect(level('Gasgeräteverordnung (EU) 2016/426')).toBe('eu')
    expect(level('Bauprodukteverordnung (EU) 2024/3110')).toBe('eu')
    expect(level('FeuV (Bayern)')).toBe('land')
    expect(level('BayBO')).toBe('land')
    expect(names('erdgas')[0]).toBe('Gasgeräteverordnung (EU) 2016/426')
    const html = render('heizoel')
    expect(html).toContain('Landesrecht Bayern')
    expect(html).toContain('Gilt nur in Bayern')
    expect(html).toContain('in Bayern die FeuV')
    const ranks = tool.levels.map((candidate) => candidate.key)
    expect(ranks.indexOf('verordnung')).toBeLessThan(ranks.indexOf('land'))
    expect(ranks.indexOf('land')).toBeLessThan(ranks.indexOf('uvv'))
  })

  it('sagt, dass G 631 nicht für Food Trucks gilt und die DGUV Vorschrift 79 zurückgezogen werden soll', () => {
    const html = render('fluessigGewerbe')
    expect(html).toContain('nicht für Flüssiggasgeräte in Fahrzeugen wie Food Trucks')
    expect(html).toContain('empfohlen, sie zurückzuziehen')
  })

  it('zeigt bei mehreren Themen jedes Regelwerk einmal und innerhalb eines Rangs das zu beiden Passende zuerst', () => {
    const matches = normsForTopics(tool, ['erdgas', 'gewerblich'])
    const list = matches.map((match) => match.norm.name)
    expect(new Set(list).size).toBe(list.length)
    expect(list).toContain('NDAV')
    expect(list).toContain('BetrSichV')
    const technical = matches.filter((match) => match.level.key === 'technik')
    const both = technical.filter((match) => match.topics.length === 2).map((match) => match.norm.name)
    expect(both).toEqual(expect.arrayContaining(['DVGW G 600 (TRGI)', 'DVGW G 631', 'DVGW G 638-1']))
    expect(technical.slice(0, both.length).map((match) => match.norm.name)).toEqual(both)
  })

  it('sortiert nach rechtlichem Rang, das Verbindlichste zuerst', () => {
    for (const topic of tool.topics) {
      const ranks = normsForTopics(tool, [topic.key]).map((match) => match.rank)
      expect(ranks, topic.label).toEqual([...ranks].sort((a, b) => a - b))
    }
    const order = names('waermepumpe')
    expect(order[0]).toBe('F-Gase-Verordnung')
    expect(order.indexOf('Ökodesign (EU) 813/2013')).toBeLessThan(order.indexOf('GModG'))
    const heating = names('heizoel')
    expect(heating.indexOf('Ökodesign (EU) 813/2013')).toBeLessThan(heating.indexOf('GModG'))
    expect(heating.indexOf('GModG')).toBeLessThan(heating.indexOf('AwSV'))
    // Bundesrecht bricht Landesrecht; das bayerische Recht steht über dem unverbindlichen Muster
    expect(heating.indexOf('AwSV')).toBeLessThan(heating.indexOf('FeuV (Bayern)'))
    expect(heating.indexOf('FeuV (Bayern)')).toBeLessThan(heating.indexOf('MFeuV'))
    expect(heating.indexOf('MFeuV')).toBeLessThan(heating.indexOf('DIN 4755'))
    expect(heating.indexOf('DIN 4755')).toBeLessThan(heating.indexOf('TRÖl'))
  })

  it('stuft die Regelwerke passend zu ihrer Art ein', () => {
    const level = (name: string) => tool.norms.find((norm) => norm.name === name)!.level
    for (const norm of tool.norms) {
      if (norm.type === 'law') expect(['eu', 'gesetz', 'verordnung', 'land'], norm.name).toContain(norm.level)
      // Landesrecht muss als solches erkennbar sein, sonst hält es jemand in Hessen für geltend
      if (norm.level === 'land') expect(norm.note, norm.name).toContain('Gilt nur in Bayern')
      if (norm.type === 'standard' || norm.type === 'rule') expect(norm.level, norm.name).toBe('technik')
    }
    expect(level('F-Gase-Verordnung')).toBe('eu')
    expect(level('GModG')).toBe('gesetz')
    expect(level('TrinkwV')).toBe('verordnung')
    expect(level('DGUV Vorschrift 3')).toBe('uvv')
    // DGUV Regeln sind anders als Vorschriften nicht bindend
    expect(level('DGUV Regel 110-010')).toBe('technik')
    expect(level('MFeuV')).toBe('muster')
    expect(level('TRÖl')).toBe('hilfe')
  })

  it('zeigt den Rang auf der Karte und trennt Bindendes von Unverbindlichem', () => {
    const html = render('heizoel')
    expect(html).toContain('Bundesverordnung')
    expect(html).toContain('· bindend')
    expect(html).toContain('· nicht bindend')
    expect(html).toContain(`Rechtlicher Rang 3 von ${tool.levels.length}`)
    expect(html.indexOf('>AwSV</h3>')).toBeLessThan(html.indexOf('Ab hier nicht selbst rechtlich bindend'))
    expect(html.indexOf('Ab hier nicht selbst rechtlich bindend')).toBeLessThan(html.indexOf('>DIN 4755</h3>'))
    expect(html).toContain('Wie wird sortiert?')
    expect(html).toContain(tool.levelNote)
    // Ohne bindende Einträge gibt es nichts abzugrenzen
    expect(renderHidden(['heizoel'], ['law', 'accident'])).not.toContain('Ab hier nicht selbst rechtlich bindend')
  })

  it('kennzeichnet Regelwerke für Hersteller als wenig praxisrelevant und zeigt den Grund', () => {
    const low = (name: string) => tool.norms.find((norm) => norm.name === name)!.lowPractice
    for (const name of ['Ökodesign (EU) 813/2013', 'Energielabel (EU) 811/2013', 'DIN EN 303-5', 'DIN 51603-1', 'DVGW G 260']) {
      expect(low(name), name).not.toBe('')
    }
    // Was der Praktiker direkt anwendet, bleibt ohne Kennzeichnung
    for (const name of ['DVGW G 600 (TRGI)', 'DIN 1988-200', 'AwSV', 'F-Gase-Verordnung', 'StVZO § 60']) {
      expect(low(name), name).toBe('')
    }
    const html = render('holz')
    expect(html).toContain('Wenig Praxisbezug')
    expect(html).toContain('Kesselhersteller')
    const lowCard = html.slice(html.lastIndexOf('<article', html.indexOf('>DIN EN 303-5</h3>')), html.indexOf('>DIN EN 303-5</h3>'))
    expect(lowCard).toContain('border-dashed')
    // Die Sortierung bleibt rechtlich: Die Kennzeichnung verschiebt nichts
    expect(names('holz')[0]).toBe('Ökodesign (EU) 2015/1189')
  })

  it('blendet wenig Praxisbezug per Schalter aus und lässt den Praxistipp stehen', () => {
    const all = normsForTopics(tool, ['holz'])
    const practical = normsForTopics(tool, ['holz'], [], true)
    expect(practical.length).toBeLessThan(all.length)
    for (const match of practical) expect(match.norm.lowPractice, match.norm.name).toBe('')
    expect(practical.map((match) => match.norm.name)).toContain('VDI 3464 Blatt 1')

    const html = renderToStaticMarkup(<NormFinder tool={tool} initialTopics={['holz']} initialHideLow />)
    expect(html).toContain('Anzeigen')
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(1)
    expect(html).toMatch(/aria-pressed="false"[^>]*>.*?Wenig Praxisbezug<\/button>/)
    expect(html).not.toContain('>DIN EN 303-5</h3>')
    expect(html).toContain('>VDI 3464 Blatt 1</h3>')
    expect(html).toContain('Praxistipp')
    // Nur der Schalter nennt die Kennzeichnung noch, keine Karte
    expect(html.match(/Wenig Praxisbezug/g)).toHaveLength(1)
    // Standardmäßig sind diese Einträge sichtbar
    expect(render('holz')).toContain('>DIN EN 303-5</h3>')
  })

  it('hält die Beschreibung bei einem Absatz, damit das Menü schnell erreichbar ist', () => {
    expect(tool.description).not.toContain('\n\n')
    expect(tool.description).toContain('Themenbereiche wählen')
  })

  it('nennt die Einschränkungen der Liste am Ende, hinter den Ergebnissen', () => {
    for (const word of ['Auswahl', 'nur für Bayern', 'kostenpflichtig', '04.11.2026']) {
      expect(tool.closingNote).toContain(word)
      expect(tool.description).not.toContain(word === 'Auswahl' ? 'ist eine Auswahl' : word)
    }
    const html = render('holz')
    expect(html.lastIndexOf('</article>')).toBeLessThan(html.indexOf('Die Liste ist eine Auswahl'))
    expect(html).toContain('<strong>Stand vom 04.11.2026</strong>')
    expect(html).not.toContain('**')
    // Auch ohne Auswahl bleibt der Hinweis sichtbar
    expect(render()).toContain('Die Liste ist eine Auswahl')
    const { closingNote: _closingNote, ...withoutNote } = tool
    expect(normFinderToolSchema.safeParse(withoutNote).success).toBe(false)
  })

  it('trägt nie zugleich Praxistipp und „Wenig Praxisbezug“', () => {
    const tipped = tool.topics.flatMap((topic) => (topic.practical ? [topic.practical.norm] : []))
    expect(tipped.length).toBeGreaterThan(0)
    for (const key of tipped) expect(tool.norms.find((norm) => norm.key === key)!.lowPractice, key).toBe('')
    const topic = tool.topics.find((candidate) => candidate.practical)!
    const broken: NormFinderTool = {
      ...tool,
      norms: tool.norms.map((norm) => (norm.key === topic.practical!.norm ? { ...norm, lowPractice: 'x' } : norm)),
    }
    expect(checkNormFinderTool(broken).join(' ')).toContain('als wenig praxisrelevant markiert')
  })

  it('markiert je Thema den Praxistipp auf der Karte, ohne eigene Zeile über der Liste', () => {
    const html = render('heizoel')
    const practical = tool.topics.find((topic) => topic.key === 'heizoel')!.practical!
    expect(practical.norm).toBe('troel')
    expect(html).toContain(practical.reason)
    expect(html).not.toContain('Praxistipp:')
    expect(normsForTopics(tool, ['heizoel']).filter((match) => match.practicalReasons.length > 0)).toHaveLength(1)
    // Nur der Tipp-Eintrag bekommt die Marke
    expect(html.match(/font-bold">.*?Praxistipp<\/p>/g)).toHaveLength(1)

    const both = normsForTopics(tool, ['heizoel', 'erdgas']).filter((match) => match.practicalReasons.length > 0)
    expect(both.map((match) => match.norm.name).sort()).toEqual(['DVGW G 600 (TRGI)', 'TRÖl'])
  })

  it('zeigt keinen Praxistipp, wenn das Thema keinen hat oder sein Eintrag ausgeblendet ist', () => {
    expect(tool.topics.find((topic) => topic.key === 'gewerblich')!.practical).toBeUndefined()
    expect(render('gewerblich')).not.toContain('Praxistipp')
    expect(renderHidden(['heizoel'], ['guide'])).not.toContain('Praxistipp')
  })

  it('zeigt vor der Auswahl keine Ergebnisse und keinen Hinweis, kein Thema ist gewählt und alle Arten sind an', () => {
    const html = render()
    expect(html).not.toContain('Einen oder mehrere Themenbereiche wählen.')
    expect(html).not.toContain('<article')
    expect(html).toContain('Themenbereich wählen …')
    expect(html).not.toContain('Gewählte Themenbereiche')
    for (const topic of tool.topics) expect(html).toContain(`<option value="${topic.key}">`)
    expect(html).toContain('Gewerblich (Betriebe und Arbeitsstätten)')
    expect(html).not.toContain('aria-pressed="false"')
    // Alle Arten und „Wenig Praxisbezug“ sind zu Beginn an
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(NORM_TYPE_KEYS.length + 1)
    for (const type of NORM_TYPE_KEYS) expect(html).toContain(NORM_TYPES[type].filter)
    // Der Löschen-Knopf hat im Ausgangszustand nichts zu tun
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Alle Eingaben löschen"|<button[^>]*aria-label="Alle Eingaben löschen"[^>]*disabled=""/)
  })

  it('zeigt gewählte Themen als Marken und bietet sie im Menü nicht noch einmal an', () => {
    const html = render('heizoel', 'gewerblich')
    expect(html).toContain('Weiteren Themenbereich wählen …')
    expect(html).toContain('aria-label="Heizöl entfernen"')
    expect(html).toContain('aria-label="Gewerblich entfernen"')
    expect(html).not.toContain('<option value="heizoel">')
    expect(html).not.toContain('<option value="gewerblich">')
    expect(html).toContain('<option value="erdgas">')
  })

  it('zeigt keine Zeile mit der Anzahl der Regelwerke', () => {
    expect(render('heizoel')).not.toMatch(/\d+ Regelwerke/)
    expect(renderHidden(['heizoel'], ['law'])).not.toMatch(/von \d+ Regelwerken/)
    expect(render('heizoel')).not.toContain('nach rechtlichem Rang sortiert')
  })

  it('jede Art kommt im Inhalt vor, sonst wäre ihr Schalter wirkungslos', () => {
    for (const type of NORM_TYPE_KEYS) expect(tool.norms.some((norm) => norm.type === type), type).toBe(true)
  })

  it('blendet einzelne Arten aus', () => {
    const all = normsForTopics(tool, ['erdgas'])
    const onlyRules = normsForTopics(tool, ['erdgas'], ['standard', 'law', 'accident', 'guide'])
    expect(onlyRules.length).toBeGreaterThan(0)
    expect(onlyRules.length).toBeLessThan(all.length)
    for (const match of onlyRules) expect(match.norm.type).toBe('rule')

    const html = renderHidden(['erdgas'], ['law'])
    expect(html).toContain('>DVGW G 600 (TRGI)</h3>')
    expect(html).not.toContain('>NDAV</h3>')
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(NORM_TYPE_KEYS.length)
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(1)
  })

  it('erklärt eine leere Liste durch den Filter', () => {
    const all = renderHidden(['erdgas'], [...NORM_TYPE_KEYS])
    expect(all).toContain('Alle Arten sind ausgeblendet.')
    expect(all).not.toContain('<article')

    const present = new Set(normsForTopics(tool, ['abwasser']).map((match) => match.norm.type))
    const html = renderHidden(['abwasser'], [...present])
    expect(html).toContain('Mit dieser Auswahl bleibt nichts übrig.')
    expect(html).not.toContain('<article')
  })

  it('zeigt Beschreibung, Art, Ausgabe und Link', () => {
    const html = render('erdgas')
    expect(html).toContain('>DVGW G 600 (TRGI)</h3>')
    expect(html).toContain('>Technische Regel</span>')
    expect(html).toContain('Ausgabe: 2018-09')
    expect(html).toContain('href="https://www.dvgw.de/leistungen/publikationen/publikationsliste/trgi-2018"')
    expect(html).toContain('target="_blank"')
    // Die Themen auf der Karte erklären nur bei mehreren gewählten Themen etwas
    expect(html).not.toContain('Gehört zu')
    expect(render('erdgas', 'gewerblich')).toContain('Gehört zu')
  })

  it('stellt klar, wenn ein Eintrag keine Norm ist oder erst über Landesrecht gilt', () => {
    const html = render('heizoel')
    expect(html).toContain('Fachbuch, keine Norm.')
    expect(html).toContain('Feuerungsverordnung des jeweiligen Bundeslands')
    expect(render('heizung')).toContain('Hieß bis 2026 Gebäudeenergiegesetz (GEG)')
  })

  it('verlinkt jedes Regelwerk per https und nennt die Adresse', () => {
    for (const norm of tool.norms) expect(norm.url, norm.name).toMatch(/^https:\/\//)
    expect(linkHost('https://www.dinmedia.de/de/norm/din-4755/390219964')).toBe('dinmedia.de')
  })

  it('meldet Fehler im Inhalt', () => {
    const first = tool.norms[0]!
    const broken: NormFinderTool = {
      ...tool,
      topics: [...tool.topics, { key: 'leer', label: 'Leer', note: '', aliases: [] }],
      norms: [...tool.norms, { ...first, topics: ['gibtEsNicht', 'gibtEsNicht'] }],
    }
    const issues = checkNormFinderTool(broken).join(' | ')
    const heating = tool.topics.find((topic) => topic.practical)!
    const levelIssues = checkNormFinderTool({
      ...tool,
      levels: [...tool.levels, { key: 'ungenutzt', label: 'Ungenutzt', binding: true, description: 'x' }],
      topics: [
        { ...heating, practical: { norm: 'gibtEsNicht', reason: 'x' } },
        { ...heating, key: 'zweites', practical: { norm: tool.norms.find((norm) => !norm.topics.includes('zweites'))!.key, reason: 'x' } },
      ],
      norms: [{ ...first, level: 'gibtEsNicht' }, ...tool.norms.slice(1)],
    }).join(' | ')
    expect(levelIssues).toContain('levels (Ungenutzt): kein Regelwerk')
    expect(levelIssues).toContain('bindende Ränge müssen vor den nicht bindenden stehen')
    expect(levelIssues).toContain('Praxistipp "gibtEsNicht" unbekannt')
    expect(levelIssues).toContain('gehört nicht zu diesem Thema')
    expect(levelIssues).toContain('unbekannter Rang "gibtEsNicht"')
    expect(issues).toContain(`norms: key "${first.key}" doppelt`)
    expect(issues).toContain(`norms: name "${first.name}" doppelt`)
    expect(issues).toContain('unbekannter Themenbereich "gibtEsNicht"')
    expect(issues).toContain('Themenbereich "gibtEsNicht" doppelt')
    expect(issues).toContain('topics (Leer): kein Regelwerk zugeordnet')
    expect(normFinderToolSchema.safeParse({ ...tool, norms: [{ ...first, url: 'http://example.org' }] }).success).toBe(false)
    expect(normFinderToolSchema.safeParse({ ...tool, norms: [{ ...first, type: 'gibtEsNicht' }] }).success).toBe(false)
    expect(normFinderToolSchema.safeParse({ ...tool, topics: [] }).success).toBe(false)
  })

  it('zeigt Quelle und Prüfstand auf der Tool-Seite', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/tools/normenfinder']}>
        <Routes>
          <Route path="/tools/:slug" element={<ToolPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(html).toContain('Regelwerk-Finder')
    expect(html).toContain('Ungeprüft')
    expect(html).toContain('noch nicht geprüft')
    expect(html).toContain('DIN Media')
  })

  it('ist über die globale Suche auffindbar', () => {
    const doc = toolSearchDocuments().find((item) => item.id === 'tool.normenfinder')!
    for (const keyword of ['Heizöl', 'TRÖl', 'TRGI', 'TRF', 'GEG', 'DIN EN 806', 'Gewerbeküche']) {
      expect(doc.keywords).toContain(keyword)
    }
  })
})
