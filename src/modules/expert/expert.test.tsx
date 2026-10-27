import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSearch } from '../../search/search'
import { ExpertPage } from './ExpertPage'
import { expertCodeEntries, filterExpertCodes, plainText, sortExpertCodes, splitShades } from './expertCodes'
import { checkExpertCode, type ExpertCodeEntry } from './schema'
import { expertCodeSearchDocuments } from './search'
import { EXPERT_UNLOCK_KEY } from './constants'
import { tryUnlockExpert } from './unlock'

const fixture: ExpertCodeEntry = {
  id: 'expert-code.test-regler',
  visibility: 'internal',
  status: 'draft',
  source: 'Test',
  verifiedBy: '',
  verifiedAt: '',
  name: 'Testregler (x1)',
  code: '00 (service), [17] (admin)',
}

const render = (unlocked: boolean, entries: ExpertCodeEntry[] = [fixture]) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <ExpertPage entries={entries} unlocked={unlocked} />
    </MemoryRouter>,
  )

describe('Fachmann-Codes: Daten', () => {
  it('enthält die 21 Codes des Inhabers, alle öffentlich und gültig', () => {
    expect(expertCodeEntries.every((entry) => entry.visibility === 'public')).toBe(true)
    expect(expertCodeEntries).toHaveLength(21)
    expect(expertCodeEntries.some((entry) => entry.id === 'expert-code.lvr')).toBe(false)
    const uvr = expertCodeEntries.find((entry) => entry.id === 'expert-code.uvr65-67')
    expect(uvr?.name).toBe('UVR65(/)67')
    expect(uvr?.code).toBe('32 (service)  |  64 (admin)')
    expect(expertCodeEntries.find((entry) => entry.id === 'expert-code.uvr16x2')?.code).toBe('64 (service)  |  128 (admin)')
    expect(expertCodeEntries.every((entry) => checkExpertCode(entry).length === 0)).toBe(true)
    const vaillant = expertCodeEntries.find((entry) => entry.id === 'expert-code.vaillant')
    expect(vaillant?.code).toBe('00 (service)  |  17 (admin)')
    const idm = expertCodeEntries.find((entry) => entry.id === 'expert-code.idm-2-0')
    expect(idm?.code).toBe('[Bsp.:] (1)[9](.0)[1](.2)[3] [08](:50) → 80319')
  })

  it('lehnt unpassende Klammern ab, erlaubt öffentliche Codes', () => {
    expect(checkExpertCode({ ...fixture, visibility: 'public' })).toEqual([])
    expect(checkExpertCode({ ...fixture, code: '1(9' })).toEqual(['code: Klammer nicht geschlossen'])
    expect(checkExpertCode({ ...fixture, name: 'a)' })).toEqual(['name: schließende Klammer ohne öffnende'])
    expect(checkExpertCode({ ...fixture, code: '((1))' })).toEqual(['code: verschachtelte Klammer'])
    expect(checkExpertCode({ ...fixture, code: '[1)' })).toEqual(['code: Klammer [ mit ) geschlossen'])
  })

  it('zerlegt Text in normale, dunkel- und hellgraue Stellen, ohne Klammern', () => {
    expect(splitShades('[Bsp.:] (1)[9](.0) [=>] 80319')).toEqual([
      { text: 'Bsp.:', shade: 'dark' },
      { text: ' ', shade: 'normal' },
      { text: '1', shade: 'light' },
      { text: '9', shade: 'dark' },
      { text: '.0', shade: 'light' },
      { text: ' ', shade: 'normal' },
      { text: '=>', shade: 'dark' },
      { text: ' 80319', shade: 'normal' },
    ])
    expect(plainText('Danfoss WR TLX (x2013)')).toBe('Danfoss WR TLX x2013')
    expect(plainText('[Bsp.:] (1)[9]')).toBe('Bsp.: 19')
  })

  it('sortiert alphabetisch und filtert nach Namen ohne Umlaut-Probleme', () => {
    const b = { ...fixture, id: 'expert-code.b', name: 'Ökofen' }
    const a = { ...fixture, id: 'expert-code.a', name: 'ETA' }
    expect(sortExpertCodes([b, a]).map((e) => e.name)).toEqual(['ETA', 'Ökofen'])
    expect(filterExpertCodes([a, b], 'oeko').map((e) => e.name)).toEqual(['Ökofen'])
  })

  it('macht nur den Namen durchsuchbar, nie den Code', () => {
    const docs = expertCodeSearchDocuments([fixture])
    expect(docs).toEqual([expect.objectContaining({ title: 'Testregler x1', path: '/fachmann', text: '' })])
    expect(JSON.stringify(docs)).not.toContain('17')
    expect(createSearch(docs).search('Testregler')).toHaveLength(1)
  })
})

describe('Fachmann-Seite', () => {
  it('fragt ohne Freischaltung nur die PIN ab und zeigt keine Codes', () => {
    const html = render(false)
    expect(html).toContain('Fachmann</h1>')
    expect(html).toContain('>PIN eingeben</label>')
    expect(html).toContain('inputMode="numeric"')
    expect(html).not.toContain('Testregler')
    expect(html).not.toContain('admin')
  })

  it('zeigt freigeschaltet die Codes mit dunkel- und hellgrauen Stellen ohne Klammern', () => {
    const html = render(true)
    expect(html).not.toContain('PIN eingeben')
    expect(html).toContain('<span class="font-normal text-faint">service</span>')
    expect(html).toContain('<span class="font-normal text-faint">x1</span>')
    expect(html).toContain('<span class="font-normal text-muted">17</span>')
    // nur sichtbarer Text; Klassennamen enthalten selbst eckige Klammern
    expect(html.match(/>[^<]*</g)?.join('')).not.toMatch(/[()[\]]/)
    expect(html).toContain('Ungeprüft')
    expect(html).toContain('Quelle')
  })
})

describe('PIN', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('schaltet nur mit 0815 frei und merkt sich das', () => {
    const stored = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    })
    expect(tryUnlockExpert('1234')).toBe(false)
    expect(stored.has(EXPERT_UNLOCK_KEY)).toBe(false)
    expect(tryUnlockExpert('0815')).toBe(true)
    expect(stored.get(EXPERT_UNLOCK_KEY)).toBe('1')
  })
})
