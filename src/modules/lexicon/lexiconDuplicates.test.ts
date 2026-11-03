import { describe, expect, it } from 'vitest'
import { lexiconEntries } from './lexicon'

describe('Lexikon-Begriffe', () => {
  it('führt jeden Begriff nur einmal, auch bei anderer Schreibweise', () => {
    const normalize = (term: string) => term.toLocaleLowerCase('de').replace(/[\s-]/g, '')
    const ids = new Map<string, string[]>()
    for (const entry of lexiconEntries) {
      const key = normalize(entry.term)
      ids.set(key, [...(ids.get(key) ?? []), entry.id])
    }
    expect([...ids.values()].filter((group) => group.length > 1)).toEqual([])
  })
})
