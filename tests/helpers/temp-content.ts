import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import {
  defineCollection,
  defineEntrySchema,
  type CollectionDefinition,
} from '../../src/content/schema/base'

/** Test-Sammlungen, unabhängig von den echten Modulen */
export const testCollections = {
  items: defineCollection({
    dir: 'items',
    idPrefix: 'item',
    schema: defineEntrySchema({ title: z.string(), related: z.array(z.string()).default([]) }),
    references: (entry) => entry.related,
    check: (entry) => (entry.title === 'FALSCH' ? ['Titel ist fachlich falsch'] : []),
  }),
  others: { dir: 'others', idPrefix: 'other', schema: defineEntrySchema({ title: z.string() }) },
} satisfies Record<string, CollectionDefinition>

export function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'item.beispiel',
    visibility: 'public',
    status: 'verified',
    source: 'Testquelle S. 1',
    verifiedBy: 'TS',
    verifiedAt: '2026-01-15',
    title: 'Beispiel',
    ...overrides,
  }
}

/**
 * Legt ein temporäres Verzeichnis an. Werte sind JSON-Objekte oder Rohtext.
 * Rückgabe: Pfad und Aufräumfunktion.
 */
export function createTempDir(files: Record<string, unknown>) {
  const root = mkdtempSync(path.join(tmpdir(), 'shk-content-'))
  for (const [relPath, value] of Object.entries(files)) {
    const fullPath = path.join(root, relPath)
    mkdirSync(path.dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, typeof value === 'string' ? value : JSON.stringify(value, null, 2))
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}
