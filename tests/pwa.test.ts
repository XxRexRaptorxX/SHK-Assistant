import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp, listFiles } from './helpers/build-app'
import { createTempDir } from './helpers/temp-content'

interface ManifestIcon {
  src: string
  sizes: string
  purpose?: string
}

describe('PWA-Build', () => {
  const outDir = createTempDir({})
  const read = (file: string) => readFileSync(path.join(outDir.root, file), 'utf8')

  beforeAll(() => buildApp('internal', outDir.root), 120_000)
  afterAll(() => outDir.cleanup())

  it('erzeugt ein installierbares Manifest', () => {
    const manifest = JSON.parse(read('manifest.webmanifest')) as {
      name: string
      short_name: string
      start_url: string
      display: string
      icons: ManifestIcon[]
    }
    expect(manifest.name).toBe('SHK-Assistant')
    expect(manifest.short_name).toBe('SHK-Assistant')
    expect(manifest.start_url).toBe('./')
    expect(manifest.display).toBe('standalone')
    expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true)
    for (const icon of manifest.icons) {
      expect(listFiles(outDir.root)).toContain(icon.src)
    }
  })

  it('cacht alle ausgelieferten Dateien vor (offline-first)', () => {
    const serviceWorker = read('sw.js')
    // sw.js selbst und die Workbox-Laufzeit gehören nicht in den Precache
    const deliverables = listFiles(outDir.root).filter(
      (file) => file !== 'sw.js' && !/^workbox-[\w-]+\.js$/.test(file),
    )
    expect(deliverables).toContain('index.html')
    const missing = deliverables.filter((file) => !serviceWorker.includes(`"${file}"`))
    expect(missing).toEqual([])
  })

  it('führt jede Datei nur einmal im Precache', () => {
    // sw.js ist je nach NODE_ENV minifiziert (url:"…") oder formatiert ("url": "…")
    const urls = [...read('sw.js').matchAll(/"?url"?\s*:\s*"([^"]+)"/g)].map((m) => m[1])
    expect(urls.length).toBeGreaterThan(0)
    expect(urls.filter((url, i) => urls.indexOf(url) !== i)).toEqual([])
  })

  it('nutzt nur relative Pfade (läuft auch in Unterverzeichnissen)', () => {
    const html = read('index.html')
    expect(html).not.toMatch(/(?:src|href)="\/(?!\/)/)
    expect(html).toContain('manifest.webmanifest')
  })

  it('übernimmt Updates sofort (sonst wartet ein Update, bis alle Tabs geschlossen sind)', () => {
    const serviceWorker = read('sw.js')
    expect(serviceWorker).toMatch(/self\.skipWaiting\(\)/)
    expect(serviceWorker).toMatch(/clientsClaim\(\)/)
    // Registrierung steckt im App-Bundle (virtual:pwa-register)
    const appCode = listFiles(outDir.root)
      .filter((file) => file.endsWith('.js') && file.startsWith('assets/'))
      .map(read)
      .join('\n')
    expect(appCode).toContain('sw.js')
  })
})
