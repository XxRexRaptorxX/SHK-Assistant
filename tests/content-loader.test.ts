import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { collections } from '../src/content/collections'
import { ContentValidationError, loadContent } from '../tools/content-loader'
import { createTempDir, entry, testCollections } from './helpers/temp-content'

let cleanup: (() => void) | undefined
afterEach(() => cleanup?.())

function load(files: Record<string, unknown>, edition: 'internal' | 'public' = 'internal') {
  const dir = createTempDir(files)
  cleanup = dir.cleanup
  return loadContent({ contentDir: dir.root, edition, collections: testCollections })
}

function expectIssues(files: Record<string, unknown>): string[] {
  try {
    load(files)
  } catch (error) {
    expect(error).toBeInstanceOf(ContentValidationError)
    return (error as ContentValidationError).issues
  }
  throw new Error('Erwartete ContentValidationError, aber Laden war erfolgreich')
}

describe('loadContent', () => {
  const files = {
    'items/public.json': entry({ id: 'item.oeffentlich' }),
    'items/internal.json': entry({ id: 'item.intern', visibility: 'internal' }),
  }

  it('lädt in der internen Edition alle Einträge', () => {
    const { data } = load(files, 'internal')
    expect(data.items?.map((e) => e.id)).toEqual(['item.intern', 'item.oeffentlich'])
  })

  it('entfernt in der public-Edition interne Einträge', () => {
    const { data, allEntries } = load(files, 'public')
    expect(data.items?.map((e) => e.id)).toEqual(['item.oeffentlich'])
    expect(allEntries).toHaveLength(2)
  })

  it('liest Unterordner rekursiv', () => {
    const { data } = load({ 'items/gruppe/a.json': entry({ id: 'item.a' }) })
    expect(data.items?.map((e) => e.id)).toEqual(['item.a'])
  })

  it('erlaubt leere Prüf-Metadaten bei draft', () => {
    const { data } = load({
      'items/a.json': entry({ status: 'draft', source: '', verifiedBy: '', verifiedAt: '' }),
    })
    expect(data.items).toHaveLength(1)
  })

  it('meldet fehlende Pflichtfelder mit Datei und Feld', () => {
    const { source: _source, ...withoutSource } = entry()
    const issues = expectIssues({ 'items/a.json': withoutSource })
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatch(/^items\/a\.json: source: /)
  })

  it('verlangt Prüf-Metadaten bei verified', () => {
    const issues = expectIssues({ 'items/a.json': entry({ verifiedBy: '', verifiedAt: '' }) })
    expect(issues).toEqual([
      expect.stringMatching(/^items\/a\.json: verifiedBy: /),
      expect.stringMatching(/^items\/a\.json: verifiedAt: /),
    ])
  })

  it('lehnt ungültiges Datum ab', () => {
    const issues = expectIssues({ 'items/a.json': entry({ verifiedAt: '15.01.2026' }) })
    expect(issues[0]).toMatch(/verifiedAt/)
  })

  it('lehnt ungültige Werte für visibility und status ab', () => {
    const issues = expectIssues({ 'items/a.json': entry({ visibility: 'intern', status: 'ok' }) })
    expect(issues).toHaveLength(2)
  })

  it('lehnt unbekannte Felder ab (Tippfehler)', () => {
    const issues = expectIssues({ 'items/a.json': entry({ verifedBy: 'TS' }) })
    expect(issues[0]).toMatch(/verifedBy/)
  })

  it('lehnt ungültige id-Formate ab', () => {
    const issues = expectIssues({ 'items/a.json': entry({ id: 'item.Ausdehnungsgefäß' }) })
    expect(issues[0]).toMatch(/^items\/a\.json: id: /)
  })

  it('verlangt das Modul-Präfix in der id', () => {
    const issues = expectIssues({ 'items/a.json': entry({ id: 'other.a' }) })
    expect(issues).toEqual(['items/a.json: id "other.a" muss mit "item." beginnen'])
  })

  it('erkennt doppelte ids über Sammlungen hinweg', () => {
    const issues = expectIssues({
      'items/a.json': entry({ id: 'item.a' }),
      'others/b.json': entry({ id: 'item.a' }),
    })
    expect(issues).toContain('others/b.json: id "item.a" ist bereits in items/a.json vergeben')
  })

  it('meldet ungültiges JSON', () => {
    const issues = expectIssues({ 'items/a.json': '{ "id": "item.a", }' })
    expect(issues[0]).toMatch(/^items\/a\.json: ungültiges JSON/)
  })

  it('meldet unregistrierte Ordner und Nicht-JSON-Dateien', () => {
    const issues = expectIssues({
      'itemz/a.json': entry(),
      'items/notiz.txt': 'x',
    })
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^itemz\/: unbekannter Inhaltsordner/),
        'items/notiz.txt: nur .json-Dateien erlaubt',
      ]),
    )
  })

  it('sammelt alle Fehler statt beim ersten abzubrechen', () => {
    const issues = expectIssues({
      'items/a.json': entry({ id: 'item.a', status: 'x' }),
      'items/b.json': entry({ id: 'item.b', visibility: 'x' }),
    })
    expect(issues).toHaveLength(2)
  })
})

describe('echte Inhalte in content/', () => {
  it('sind gültig', () => {
    const contentDir = fileURLToPath(new URL('../content', import.meta.url))
    expect(() => loadContent({ contentDir, edition: 'internal', collections })).not.toThrow()
  })
})
