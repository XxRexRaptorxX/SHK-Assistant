import { useState } from 'react'
import { secondaryButton } from '../../components/buttons'
import { LocationIcon } from '../../components/icons'
import { currentAltitude, LocationError, type Altitude } from '../../lib/location'
import { math } from '../../lib/math'

// Knopf „GPS“ an Eingabefeldern mit "locate": "altitude": übernimmt die Höhe, die das Gerät meldet.
// Alles bleibt auf dem Gerät, es wird nichts ins Internet geschickt.

export interface AltitudeMessage {
  kind: 'info' | 'error'
  text: string
}

const integerFormat = new Intl.NumberFormat('de-DE', { useGrouping: false, maximumFractionDigits: 0 })
const valueFormat = new Intl.NumberFormat('de-DE', { useGrouping: false, maximumSignificantDigits: 10 })

/** Eingabetext in der Haupteinheit des Feldes; auf ganze Meter gerundet, genauer ist GPS nicht */
export function altitudeText({ meters }: Altitude, unit: string): string {
  const rounded = Math.round(meters)
  return unit === 'm' ? integerFormat.format(rounded) : valueFormat.format(math.unit(rounded, 'm').toNumber(unit))
}

/** Hinweis nach einer Messung; undefined = Gerät liefert keine Höhe */
export function altitudeMessage(altitude: Altitude | undefined): AltitudeMessage {
  if (!altitude) {
    return { kind: 'error', text: 'Dieses Gerät liefert keine GPS-Höhe. Bitte die Höhe eintippen, z. B. aus einer Karte.' }
  }
  const accuracy = altitude.accuracy === undefined ? '' : ` (± ${integerFormat.format(Math.max(1, Math.round(altitude.accuracy)))} m laut Gerät)`
  return {
    kind: 'info',
    text: `Höhe vom GPS übernommen${accuracy}. Die GPS-Höhe kann deutlich von der Höhe über dem Meer abweichen, wenn möglich mit einem bekannten Wert vergleichen, z. B. aus einer Karte.`,
  }
}

export function locationErrorMessage(error: unknown): AltitudeMessage {
  return {
    kind: 'error',
    text:
      error instanceof LocationError && error.reason === 'denied'
        ? 'Der Standort ist nicht freigegeben. Bitte im Browser oder in der App-Berechtigung erlauben.'
        : 'Der Standort konnte nicht bestimmt werden.',
  }
}

/** Knopf neben dem Eingabefeld; meldet die Höhe als Text in `unit` */
export function AltitudeButton({
  fieldName,
  unit,
  onAltitude,
  onMessage,
}: {
  fieldName: string
  unit: string
  onAltitude: (text: string) => void
  onMessage: (message: AltitudeMessage | undefined) => void
}) {
  const [locating, setLocating] = useState(false)
  const locate = async () => {
    setLocating(true)
    onMessage(undefined)
    try {
      const altitude = await currentAltitude()
      if (altitude) onAltitude(altitudeText(altitude, unit))
      onMessage(altitudeMessage(altitude))
    } catch (error) {
      onMessage(locationErrorMessage(error))
    } finally {
      setLocating(false)
    }
  }
  return (
    <button
      type="button"
      className={`${secondaryButton} shrink-0 px-3 print:hidden`}
      aria-label={`${fieldName} per GPS übernehmen`}
      disabled={locating}
      onClick={() => void locate()}
    >
      <LocationIcon className="size-5" />
      {locating ? 'Sucht …' : 'GPS'}
    </button>
  )
}
