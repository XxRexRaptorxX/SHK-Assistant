import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { isWorkSafetyTool } from './schema'
import { toolEntries, toolSearchDocuments } from './tools'
import { WorkSafetyLookup } from './WorkSafetyLookup'
import {
  checklist,
  checkWorkSafetyTool,
  combinedPpe,
  conditionLabel,
  conditionState,
  selectedActivities,
  visibleRules,
  workSafetyToolSchema,
  type WorkAnswers,
  type WorkSafetyTool,
} from './workSafetyTool'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.uvv-arbeiten')
if (!entry || !isWorkSafetyTool(entry)) throw new Error('UVV-Tool erwartet')
const tool: WorkSafetyTool = entry
const activity = (key: string) => tool.activities.find((candidate) => candidate.key === key)!

const render = (activities: string[] = [], answers: WorkAnswers = {}) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <WorkSafetyLookup tool={tool} initialActivities={activities} initialAnswers={answers} />
    </MemoryRouter>,
  )

describe('UVV-Helfer', () => {
  it('ist fehlerfrei, öffentlich und noch ungeprüft', () => {
    expect(checkWorkSafetyTool(tool)).toEqual([])
    expect(tool.status).toBe('draft')
    expect(tool.visibility).toBe('public')
  })

  it('wertet Bedingungen aus: offen, passend, widersprechend', () => {
    const when = [{ question: 'fireRisk', is: ['yes'] }]
    expect(conditionState([], {})).toBe('met')
    expect(conditionState(when, {})).toBe('open')
    expect(conditionState(when, { fireRisk: 'yes' })).toBe('met')
    expect(conditionState(when, { fireRisk: 'no' })).toBe('unmet')
    expect(conditionLabel(activity('hotWork'), when)).toBe('Brandgefahr im Umfeld: Ja')
  })

  it('blendet die Schweißerlaubnis je nach Brandgefahr ein oder aus', () => {
    const permit = (answers: Record<string, string>) =>
      visibleRules(activity('hotWork'), 'permit', answers).map(({ rule, open }) => ({ text: rule.text, open }))
    const isPermit = (text: string) => text.startsWith('Schriftliche Schweißerlaubnis')
    expect(permit({}).find((rule) => isPermit(rule.text))?.open).toBe(true)
    expect(permit({ fireRisk: 'yes' }).find((rule) => isPermit(rule.text))?.open).toBe(false)
    expect(permit({ fireRisk: 'no' }).some((rule) => isPermit(rule.text))).toBe(false)
  })

  it('fasst die Schutzausrüstung je Stück zusammen und beachtet die Antworten', () => {
    const activities = selectedActivities(tool, ['mineralWool', 'drilling'])
    const open = combinedPpe(tool, activities)
    const respirator = open.find((entry) => entry.item.key === 'respirator')!
    expect(respirator.uses.map((use) => use.activity.key)).toEqual(['drilling', 'mineralWool'])
    expect(respirator.uses.find((use) => use.activity.key === 'mineralWool')?.open).toBe(true)
    const e1 = combinedPpe(tool, activities, { mineralWool: { exposure: 'e1' } })
    expect(e1.find((entry) => entry.item.key === 'respirator')!.uses.map((use) => use.activity.key)).toEqual(['drilling'])
    expect(e1.some((entry) => entry.item.key === 'coverall')).toBe(false)
  })

  it('sammelt die Prüfliste über alle gewählten Tätigkeiten mit stabilen ids', () => {
    const items = checklist(selectedActivities(tool, ['gasLines', 'electrical']), { gasLines: { metalCut: 'no' } })
    expect(new Set(items.map((item) => item.activity.key))).toEqual(new Set(['gasLines', 'electrical']))
    expect(items.some((item) => item.rule.text.includes('Kupferseil'))).toBe(false)
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length)
  })

  it('kennzeichnet Tätigkeiten mit fehlenden Angaben und erlaubt dann kein verified', () => {
    expect(activity('pressureTest').todo).toMatch(/^TODO: Inhalt fehlt/)
    expect(activity('trenches').rules).toEqual([])
    const verified = workSafetyToolSchema.parse({ ...tool, status: 'verified', verifiedBy: 'XX', verifiedAt: '2026-11-26' })
    expect(checkWorkSafetyTool(verified)).toContain('activities (pressureTest): todo bei verified nicht erlaubt')
  })

  it('erkennt unbekannte Quellen, Fragen, Optionen und Tätigkeiten', () => {
    const broken = structuredClone(tool)
    const hotWork = broken.activities.find((candidate) => candidate.key === 'hotWork')!
    hotWork.rules[0]!.ref.source = 'fremd'
    hotWork.rules[0]!.when = [{ question: 'gibtsNicht', is: ['yes'] }]
    hotWork.ppe[2]!.when = [{ question: 'confined', is: ['vielleicht'] }]
    broken.jobs[0]!.activities.push('tanzen')
    const issues = checkWorkSafetyTool(broken)
    expect(issues).toContain('activities (hotWork), rules[0]: unbekannte Quelle "fremd"')
    expect(issues).toContain('activities (hotWork), rules[0]: unbekannte Frage "gibtsNicht"')
    expect(issues).toContain('activities (hotWork), ppe[2]: unbekannte Option "vielleicht" bei "confined"')
    expect(issues).toContain('jobs (boilerSwap): unbekannte Tätigkeit "tanzen"')
  })

  it('meldet ungenutzte Fragen und Quellen', () => {
    const broken = structuredClone(tool)
    broken.activities.find((candidate) => candidate.key === 'propane')!.questions.push({
      key: 'unused',
      text: 'Ungenutzt?',
      label: 'Ungenutzt',
      note: '',
      options: [
        { key: 'yes', label: 'Ja' },
        { key: 'no', label: 'Nein' },
      ],
    })
    broken.sources.push({ key: 'extra', name: 'Extra', source: 'nirgends zitiert' })
    const issues = checkWorkSafetyTool(broken)
    expect(issues).toContain('activities (propane): Frage "unused" wird nirgends verwendet')
    expect(issues).toContain('sources (extra): wird nirgends zitiert')
  })

  it('zeigt ohne Auswahl Tätigkeiten, Aufträge und Grundpflichten', () => {
    const html = render()
    expect(html).toContain('Welche Arbeiten stehen an?')
    expect(html).toContain('Gas-Kesseltausch')
    expect(html).toContain('Arbeiten wählen – mehrere sind möglich.')
    expect(html).toContain('Grundpflichten im Betrieb')
    expect(html).not.toContain('Vor Arbeitsbeginn prüfen')
  })

  it('zeigt beim Löten Schutzausrüstung, Prüfliste, Fundstellen und offene Bedingungen', () => {
    const html = render(['hotWork'])
    expect(html).toContain('Schutzbrille mit Schweißerschutzfilter')
    expect(html).toContain('Vor Arbeitsbeginn prüfen')
    expect(html).toContain('Schriftliche Schweißerlaubnis')
    expect(html).toContain('Gilt bei: Brandgefahr im Umfeld: Ja')
    expect(html).toContain('DGUV Regel 100-500, Kap. 2.26, Abschn. 3.8.3')
    expect(html).toContain('Brandwache')
    expect(html).toContain('Mehr dazu')
  })

  it('blendet bei „Nein“ die Vorgaben für brandgefährdete Bereiche aus', () => {
    const html = render(['hotWork'], { hotWork: { fireRisk: 'no', confined: 'no' } })
    expect(html).not.toContain('Schriftliche Schweißerlaubnis')
    expect(html).not.toContain('Gilt bei:')
    expect(html).toContain('Brennbare Stoffe aus dem Gefahrenbereich entfernen')
  })

  it('markiert unvollständige Tätigkeiten', () => {
    // Etikett in der Karte; der Schlusshinweis erwähnt das Wort ebenfalls
    expect(render(['gasLines'])).toContain('>unvollständig<')
    expect(render(['electrical'])).not.toContain('>unvollständig<')
  })

  it('ist über Begriffe aus der Praxis auffindbar', () => {
    const document = toolSearchDocuments().find((candidate) => candidate.id === tool.id)!
    for (const keyword of ['UVV', 'Schweißerlaubnis', 'Hebeanlage', 'R290', 'Asbest', 'Gehörschutz', 'Fünf Sicherheitsregeln']) {
      expect(document.keywords).toContain(keyword)
    }
  })
})
