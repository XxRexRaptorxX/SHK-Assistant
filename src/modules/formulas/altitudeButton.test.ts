import { describe, expect, it } from 'vitest'
import { LocationError } from '../../lib/location'
import { altitudeMessage, altitudeText, locationErrorMessage } from './AltitudeButton'

describe('Höhe per GPS', () => {
  it('trägt ganze Meter ein, auch bei negativen Höhen', () => {
    expect(altitudeText({ meters: 562.4 }, 'm')).toBe('562')
    expect(altitudeText({ meters: 562.6 }, 'm')).toBe('563')
    expect(altitudeText({ meters: -3.2 }, 'm')).toBe('-3')
  })

  it('rechnet in die Haupteinheit des Feldes um', () => {
    expect(altitudeText({ meters: 562.4 }, 'cm')).toBe('56200')
    expect(altitudeText({ meters: 1500 }, 'km')).toBe('1,5')
  })

  it('nennt die Genauigkeit laut Gerät und weist auf mögliche Abweichungen hin', () => {
    const message = altitudeMessage({ meters: 562, accuracy: 7.6 })
    expect(message.kind).toBe('info')
    expect(message.text).toContain('(± 8 m laut Gerät)')
    expect(message.text).toContain('kann deutlich von der Höhe über dem Meer abweichen')
    expect(altitudeMessage({ meters: 562 }).text).not.toContain('laut Gerät')
    expect(altitudeMessage({ meters: 562, accuracy: 0.3 }).text).toContain('(± 1 m laut Gerät)')
  })

  it('meldet Geräte ohne GPS-Höhe', () => {
    expect(altitudeMessage(undefined)).toEqual({ kind: 'error', text: expect.stringContaining('keine GPS-Höhe') })
  })

  it('unterscheidet fehlende Freigabe und andere Fehler', () => {
    expect(locationErrorMessage(new LocationError('denied')).text).toContain('nicht freigegeben')
    expect(locationErrorMessage(new LocationError('unavailable')).text).toBe('Der Standort konnte nicht bestimmt werden.')
    expect(locationErrorMessage(new Error('x')).text).toBe('Der Standort konnte nicht bestimmt werden.')
  })
})
