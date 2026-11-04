import { describe, expect, it, vi } from 'vitest'
import { currentPosition, formatAddress, formatCoordinates, LocationError, reverseGeocode } from './location'

const POSITION = { latitude: 48.137431, longitude: 11.575491 }

function geolocationWith(behaviour: (success: PositionCallback, failure: PositionErrorCallback) => void): Geolocation {
  return { getCurrentPosition: behaviour } as unknown as Geolocation
}

describe('Adresse aus der Antwort', () => {
  it('baut Straße, Hausnummer, Postleitzahl und Ort zusammen', () => {
    expect(formatAddress({ address: { road: 'Hauptstraße', house_number: '5', postcode: '80331', city: 'München', country: 'Deutschland' } })).toBe(
      'Hauptstraße 5, 80331 München',
    )
  })

  it('nimmt den Ort aus town oder village und kommt ohne Hausnummer aus', () => {
    expect(formatAddress({ address: { road: 'Dorfweg', postcode: '83024', village: 'Kleinhausen' } })).toBe('Dorfweg, 83024 Kleinhausen')
    expect(formatAddress({ address: { postcode: '83024', town: 'Rosenheim' } })).toBe('83024 Rosenheim')
  })

  it.each([[{ address: {} }], [{ error: 'Unable to geocode' }], [null], ['Text']])('liefert nichts bei %j', (response) => {
    expect(formatAddress(response)).toBeUndefined()
  })
})

describe('Adresse abfragen', () => {
  const fetcherWith = (response: Partial<Response>) => vi.fn(async () => response as Response) as unknown as typeof fetch

  it('fragt mit gerundetem Standort auf Deutsch an', async () => {
    const fetcher = fetcherWith({ ok: true, json: async () => ({ address: { road: 'Marienplatz', city: 'München' } }) })
    expect(await reverseGeocode(POSITION, fetcher)).toBe('Marienplatz, München')
    const url = new URL(vi.mocked(fetcher).mock.calls[0]![0] as string)
    expect(url.origin).toBe('https://nominatim.openstreetmap.org')
    expect(url.searchParams.get('lat')).toBe('48.13743')
    expect(url.searchParams.get('lon')).toBe('11.57549')
    expect(url.searchParams.get('accept-language')).toBe('de')
  })

  it('liefert nichts bei Fehlerantwort oder ohne Internet', async () => {
    expect(await reverseGeocode(POSITION, fetcherWith({ ok: false }))).toBeUndefined()
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    expect(await reverseGeocode(POSITION, offline)).toBeUndefined()
  })

  it('zeigt Koordinaten als Ersatz', () => {
    expect(formatCoordinates(POSITION)).toBe('48.13743, 11.57549')
  })
})

describe('Standort', () => {
  it('liefert die Koordinaten des Geräts', async () => {
    const geolocation = geolocationWith((success) => success({ coords: POSITION } as GeolocationPosition))
    await expect(currentPosition(geolocation)).resolves.toEqual(POSITION)
  })

  it('unterscheidet verweigert und nicht verfügbar', async () => {
    const failing = (code: number) =>
      geolocationWith((_, failure) =>
        failure!({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: '' } as GeolocationPositionError),
      )
    await expect(currentPosition(failing(1))).rejects.toMatchObject({ reason: 'denied' })
    await expect(currentPosition(failing(3))).rejects.toMatchObject({ reason: 'unavailable' })
  })

  it('meldet Geräte ohne GPS', async () => {
    await expect(currentPosition(undefined)).rejects.toBeInstanceOf(LocationError)
  })
})
