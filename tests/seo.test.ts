import { readFileSync } from 'node:fs'
import path from 'node:path'
import { build, type Rollup } from 'vite'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { isSeoFile, parseSiteUrl, SEO_SECTIONS } from '../src/config/seo'
import { collections } from '../src/content/collections'
import { loadContent } from '../tools/content-loader'
import { escapeHtml, metaDescription } from '../tools/seo-pages'
import { seoPlugin } from '../tools/vite-plugin-seo'
import { buildApp, listFiles, projectRoot } from './helpers/build-app'
import { createTempDir } from './helpers/temp-content'

const SITE_URL = parseSiteUrl(readFileSync(path.join(projectRoot, '.env'), 'utf8').match(/^VITE_SITE_URL=(.*)$/m)?.[1]?.trim())

describe('Suchmaschinen-Seiten im Build der App', () => {
  const outDir = createTempDir({})
  const read = (file: string) => readFileSync(path.join(outDir.root, file), 'utf8')
  const { allEntries } = loadContent({ contentDir: path.join(projectRoot, 'content'), edition: 'internal', collections })
  const sectionOf = (id: string) => SEO_SECTIONS.find((s) => collections[s.collection].idPrefix === id.split('.')[0])
  const pageOf = (id: string) => `${sectionOf(id)?.dir}/${id.slice(id.indexOf('.') + 1)}/index.html`

  beforeAll(() => buildApp('internal', outDir.root), 120_000)
  afterAll(() => outDir.cleanup())

  it('erzeugt je geprüftem Eintrag eine Seite mit eigener Adresse, Quelle und Prüfdatum', () => {
    const files = new Set(listFiles(outDir.root))
    const verified = allEntries.filter((entry) => entry.status === 'verified' && sectionOf(entry.id))
    expect(verified.length).toBeGreaterThan(0)
    expect(verified.map((entry) => pageOf(entry.id)).filter((file) => !files.has(file))).toEqual([])

    const html = read('lexikon/abgas/index.html')
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}lexikon/abgas/">`)
    expect(html).toContain('<h1>Abgas</h1>')
    expect(html).toContain('<strong>Quelle:</strong>')
    expect(html).toContain('<strong>Geprüft:</strong>')
    expect(html).toContain('"@type":"DefinedTerm"')
    expect(html).toContain('href="../../#/lexikon/abgas"')
    expect(html).toContain('href="../../#/impressum"')
    expect(html).not.toMatch(/(?:src|href)="\/(?!\/)/)
  })

  it('zeigt Formeln lesbar wie in der App, mit Konstanten und Ergebnis', () => {
    const html = read('formeln/elektrotechnik.drehstrom-wirkleistung/index.html')
    expect(html).toContain('<code>P = √3 · U · I · cos φ</code>')
    expect(html).toContain('√3: Verkettungsfaktor</li>')
    expect(html).toContain('P: Wirkleistung (W)</li>')
    expect(read('formeln/hydraulik.dynamischer-druck/index.html')).toContain('<code>pdy = ρ · v² / 2</code>')
    expect(read('formeln/hydraulik.hydrostatischer-druck/index.html')).toContain('g: Normfallbeschleunigung (9,80665 m/s²)</li>')
    expect(read('formeln/hydraulik.rohrinhalt/index.html')).toContain('d: Innendurchmesser (mm)</li>')
  })

  it('veröffentlicht keine Entwürfe', () => {
    const files = new Set(listFiles(outDir.root))
    const drafts = allEntries.filter((entry) => entry.status === 'draft' && sectionOf(entry.id))
    expect(drafts.length).toBeGreaterThan(0)
    expect(drafts.map((entry) => pageOf(entry.id)).filter((file) => files.has(file))).toEqual([])
  })

  it('erzeugt keine Seiten für Fachmann-Codes', () => {
    expect(listFiles(outDir.root).filter((file) => file.startsWith('fachmann/'))).toEqual([])
    expect(read('sitemap.xml')).not.toContain('fachmann')
  })

  it('listet alle Seiten in der Sitemap und keine Adresse doppelt', () => {
    const urls = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!)
    expect(new Set(urls).size).toBe(urls.length)
    const expected = listFiles(outDir.root)
      .filter((file) => isSeoFile(file) && file.endsWith('/index.html'))
      .map((file) => `${SITE_URL}${file.slice(0, -'index.html'.length)}`)
    expect(urls.sort()).toEqual([SITE_URL, ...expected].sort())
  })

  it('nennt die Sitemap in robots.txt', () => {
    expect(read('robots.txt')).toContain(`Sitemap: ${SITE_URL}sitemap.xml`)
  })

  it('ergänzt die Startseite um Metadaten und Links ohne JavaScript', () => {
    const html = read('index.html')
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}">`)
    expect(html).toContain('property="og:image"')
    expect(html).toContain('"@type":"WebApplication"')
    expect(html).toContain('<noscript>')
    expect(html).toContain('href="./lexikon/"')
  })

  it('hält die Seiten aus dem Offline-Cache heraus und leitet sie nicht auf die App um', () => {
    const serviceWorker = read('sw.js')
    expect(serviceWorker).not.toContain('lexikon/abgas')
    expect(serviceWorker).not.toContain('sitemap.xml"')
    expect(serviceWorker).toContain('lexikon|checklisten')
  })
})

describe('Suchmaschinen-Seiten je Edition', () => {
  let cleanup: (() => void) | undefined
  afterEach(() => cleanup?.())

  const lexiconEntry = (overrides: Record<string, unknown>) => ({
    visibility: 'public',
    status: 'verified',
    source: 'Testquelle',
    verifiedBy: 'TS',
    verifiedAt: '2026-01-15',
    categories: ['heizung'],
    ...overrides,
  })

  async function emitted(edition: 'internal' | 'public'): Promise<Record<string, string>> {
    const dir = createTempDir({
      'content/lexicon/oeffentlich.json': lexiconEntry({
        id: 'lexicon.oeffentlich',
        term: 'Öffentlich <b>',
        definition: 'Text mit **fett** & <script>alert(1)</script>',
        related: ['lexicon.intern', 'lexicon.entwurf'],
      }),
      'content/lexicon/intern.json': lexiconEntry({
        id: 'lexicon.intern',
        term: 'Intern-Marker',
        definition: 'Nur intern',
        visibility: 'internal',
      }),
      'content/lexicon/entwurf.json': lexiconEntry({
        id: 'lexicon.entwurf',
        term: 'Entwurf-Marker',
        definition: 'Noch ungeprüft',
        status: 'draft',
      }),
      'entry.js': 'console.log(1)',
    })
    cleanup = dir.cleanup
    const output = (await build({
      configFile: false,
      root: dir.root,
      logLevel: 'silent',
      plugins: [
        seoPlugin({
          contentDir: path.join(dir.root, 'content'),
          edition,
          collections,
          siteUrl: 'https://example.org/app/',
        }),
      ],
      build: { write: false, rolldownOptions: { input: path.join(dir.root, 'entry.js') } },
    })) as Rollup.RollupOutput
    return Object.fromEntries(
      output.output.flatMap((file) => (file.type === 'asset' ? [[file.fileName, String(file.source)]] : [])),
    )
  }

  it('enthält im public-Build keine internen Einträge', { timeout: 30_000 }, async () => {
    const files = await emitted('public')
    expect(files['lexikon/oeffentlich/index.html']).toBeDefined()
    expect(files['lexikon/intern/index.html']).toBeUndefined()
    expect(Object.values(files).join('\n')).not.toContain('Intern-Marker')
  })

  it('enthält intern auch interne Einträge, aber nie Entwürfe', { timeout: 30_000 }, async () => {
    const files = await emitted('internal')
    expect(files['lexikon/intern/index.html']).toBeDefined()
    expect(files['lexikon/oeffentlich/index.html']).toContain('href="../intern/"')
    expect(files['lexikon/entwurf/index.html']).toBeUndefined()
    expect(Object.values(files).join('\n')).not.toContain('Entwurf-Marker')
  })

  it('führt HTML aus Inhalten nie aus', { timeout: 30_000 }, async () => {
    const html = (await emitted('public'))['lexikon/oeffentlich/index.html']!
    expect(html).toContain('<strong>fett</strong> &amp; &lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('<h1>Öffentlich &lt;b&gt;</h1>')
    expect(html).not.toContain('<script>alert')
  })
})

describe('Hilfsfunktionen', () => {
  it('kürzt Beschreibungen an einer Wortgrenze und entfernt Fettdruck', () => {
    const text = metaDescription(`**Abgas** ${'wort '.repeat(60)}`)
    expect(text.length).toBeLessThanOrEqual(156)
    expect(text.startsWith('Abgas wort')).toBe(true)
    expect(text.endsWith('wort …')).toBe(true)
    expect(metaDescription('Kurz.')).toBe('Kurz.')
  })

  it('maskiert HTML', () => {
    expect(escapeHtml('<a href="x">&')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;')
  })

  it('verlangt eine gültige Adresse und setzt den Schrägstrich am Ende', () => {
    expect(parseSiteUrl('https://example.org/app')).toBe('https://example.org/app/')
    expect(parseSiteUrl('https://example.org/app/')).toBe('https://example.org/app/')
    expect(() => parseSiteUrl(undefined)).toThrow('VITE_SITE_URL')
    expect(() => parseSiteUrl('example.org')).toThrow('VITE_SITE_URL')
  })
})
