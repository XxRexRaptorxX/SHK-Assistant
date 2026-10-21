import { describe, expect, it } from 'vitest'
import { parseEdition } from './editions'

describe('parseEdition', () => {
  it('akzeptiert internal und public', () => {
    expect(parseEdition('internal')).toBe('internal')
    expect(parseEdition('public')).toBe('public')
  })

  it('lehnt fehlende oder unbekannte Werte ab', () => {
    expect(() => parseEdition(undefined)).toThrow(/Ungültige Edition/)
    expect(() => parseEdition('intern')).toThrow(/Ungültige Edition/)
  })
})
