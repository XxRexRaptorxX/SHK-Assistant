import { z } from 'zod'

// Standort über das GPS des Geräts und Adresse dazu über Nominatim (OpenStreetMap).
// Der Standort verlässt das Gerät nur, wenn der Nutzer den Knopf drückt. Nominatim verlangt die Quellenangabe,
// sie steht in der Quelle des Tools.

const REVERSE_GEOCODE_URL = 'https://nominatim.openstreetmap.org/reverse'
const REQUEST_TIMEOUT_MS = 10_000
const GPS_TIMEOUT_MS = 20_000

export interface Coordinates {
  latitude: number
  longitude: number
}

export type LocationFailure = 'denied' | 'unavailable'

export class LocationError extends Error {
  readonly reason: LocationFailure
  constructor(reason: LocationFailure) {
    super(reason)
    this.name = 'LocationError'
    this.reason = reason
  }
}

/** Messwerte des GPS; wirft LocationError */
function readPosition(geolocation: Geolocation | undefined, maximumAge: number): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!geolocation) {
      reject(new LocationError('unavailable'))
      return
    }
    geolocation.getCurrentPosition(
      ({ coords }) => resolve(coords),
      (error) => reject(new LocationError(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable')),
      { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS, maximumAge },
    )
  })
}

/** Aktueller Standort des Geräts; wirft LocationError */
export async function currentPosition(geolocation: Geolocation | undefined = globalThis.navigator?.geolocation): Promise<Coordinates> {
  const { latitude, longitude } = await readPosition(geolocation, 60_000)
  return { latitude, longitude }
}

export interface Altitude {
  /** Höhe in m, wie das Gerät sie meldet */
  meters: number
  /** Genauigkeit in m laut Gerät; fehlt, wenn es keine angibt */
  accuracy?: number
}

/**
 * Höhe des Standorts aus dem GPS des Geräts, ohne Internet; undefined, wenn das Gerät keine Höhe liefert
 * (z. B. viele PCs und Laptops). Wirft LocationError.
 */
export async function currentAltitude(
  geolocation: Geolocation | undefined = globalThis.navigator?.geolocation,
): Promise<Altitude | undefined> {
  // Frische Messung: Eine zwischengespeicherte Position stammt oft aus WLAN oder Mobilfunk und hat keine Höhe
  const { altitude, altitudeAccuracy } = await readPosition(geolocation, 0)
  if (altitude === null || !Number.isFinite(altitude)) return undefined
  return altitudeAccuracy !== null && Number.isFinite(altitudeAccuracy) && altitudeAccuracy > 0
    ? { meters: altitude, accuracy: altitudeAccuracy }
    : { meters: altitude }
}

const addressSchema = z.object({
  address: z.object({
    road: z.string().optional(),
    pedestrian: z.string().optional(),
    house_number: z.string().optional(),
    postcode: z.string().optional(),
    city: z.string().optional(),
    town: z.string().optional(),
    village: z.string().optional(),
    municipality: z.string().optional(),
  }),
})

/** Antwort von Nominatim als „Hauptstraße 5, 80331 München“; undefined, wenn sie nichts Brauchbares enthält */
export function formatAddress(response: unknown): string | undefined {
  const parsed = addressSchema.safeParse(response)
  if (!parsed.success) return undefined
  const { road, pedestrian, house_number, postcode, city, town, village, municipality } = parsed.data.address
  const street = [road ?? pedestrian, house_number].filter(Boolean).join(' ')
  const place = [postcode, city ?? town ?? village ?? municipality].filter(Boolean).join(' ')
  return [street, place].filter(Boolean).join(', ') || undefined
}

/** Fragt die Adresse zum Standort ab; undefined ohne Internet oder ohne Treffer */
export async function reverseGeocode(position: Coordinates, fetcher: typeof fetch = fetch): Promise<string | undefined> {
  const query = new URLSearchParams({
    format: 'jsonv2',
    lat: position.latitude.toFixed(5),
    lon: position.longitude.toFixed(5),
    addressdetails: '1',
    'accept-language': 'de',
  })
  try {
    const response = await fetcher(`${REVERSE_GEOCODE_URL}?${query}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    return response.ok ? formatAddress(await response.json()) : undefined
  } catch {
    return undefined
  }
}

/** Standort als Text, wenn es keine Adresse gibt, z. B. „48.13743, 11.57549“ */
export const formatCoordinates = ({ latitude, longitude }: Coordinates) => `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
