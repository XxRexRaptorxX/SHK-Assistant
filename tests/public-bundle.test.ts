import { readFileSync } from 'node:fs'
import path from 'node:path'
import { build, type Rollup } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { collections } from '../src/content/collections'
import { loadContent } from '../tools/content-loader'
import { contentPlugin } from '../tools/vite-plugin-content'
import { buildApp, listFiles, projectRoot } from './helpers/build-app'
import { createTempDir, entry, testCollections } from './helpers/temp-content'

function readAllFiles(dir: string): string {
  return listFiles(dir)
    .map((file) => readFileSync(path.join(dir, file), 'utf8'))
    .join('\n')
}

let cleanup: (() => void) | undefined
afterEach(() => cleanup?.())

describe('Content-Plugin im Bundle', () => {
  // Kontrolle, dass der Mechanismus greift: kleines Bundle mit Testinhalten.
  async function bundle(edition: 'internal' | 'public'): Promise<string> {
    const dir = createTempDir({
      'content/items/public.json': entry({ id: 'item.oeffentlich-marker' }),
      'content/items/internal.json': entry({ id: 'item.intern-marker', visibility: 'internal' }),
      'entry.js': "import content from 'virtual:content'; console.log(content);",
    })
    cleanup = dir.cleanup
    const output = (await build({
      configFile: false,
      root: dir.root,
      logLevel: 'silent',
      plugins: [
        contentPlugin({
          contentDir: path.join(dir.root, 'content'),
          edition,
          collections: testCollections,
        }),
      ],
      build: { write: false, minify: false, rolldownOptions: { input: path.join(dir.root, 'entry.js') } },
    })) as Rollup.RollupOutput
    return output.output.map((chunk) => (chunk.type === 'chunk' ? chunk.code : '')).join('\n')
  }

  it('enthält im internen Bundle beide Einträge', async () => {
    const code = await bundle('internal')
    expect(code).toContain('item.oeffentlich-marker')
    expect(code).toContain('item.intern-marker')
  })

  it('enthält im public-Bundle keine internen Einträge', async () => {
    const code = await bundle('public')
    expect(code).toContain('item.oeffentlich-marker')
    expect(code).not.toContain('item.intern-marker')
  })
})

describe('public-Build der App', () => {
  it('enthält keine IDs interner Inhalte', { timeout: 120_000 }, async () => {
    const outDir = createTempDir({})
    cleanup = outDir.cleanup
    await buildApp('public', outDir.root)

    const bundleText = readAllFiles(outDir.root)
    expect(bundleText.length).toBeGreaterThan(0)

    const { allEntries } = loadContent({
      contentDir: path.join(projectRoot, 'content'),
      edition: 'internal',
      collections,
    })
    const leakedIds = allEntries
      .filter((e) => e.visibility === 'internal')
      .map((e) => e.id)
      .filter((id) => bundleText.includes(id))
    expect(leakedIds).toEqual([])

    // Gegenprobe: öffentliche Inhalte sind im Bundle, der Test durchsucht also das Richtige
    const publicIds = allEntries.filter((e) => e.visibility === 'public').map((e) => e.id)
    expect(publicIds.length).toBeGreaterThan(0)
    expect(publicIds.filter((id) => !bundleText.includes(id))).toEqual([])
  })
})
