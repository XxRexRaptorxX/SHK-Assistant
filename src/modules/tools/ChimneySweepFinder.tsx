import { useId, useState, type FormEvent } from 'react'
import { primaryButton, secondaryButton } from '../../components/buttons'
import { InfoIcon, LocationIcon, SearchIcon, WarningIcon } from '../../components/icons'
import { RichText } from '../../components/RichText'
import { fieldBase } from '../../components/surfaces'
import {
  copyText,
  EMPTY_ADDRESS,
  findState,
  formatAddress,
  parseGeocode,
  portalLink,
  portalsFor,
  reverseGeocodeUrl,
  searchGeocodeUrl,
  type Address,
  type AddressField,
  type ChimneySweepTool,
  type GeocodedPlace,
  type SweepPortal,
  type SweepState,
} from './chimneySweepTool'

const card = 'mt-4 rounded-2xl border-2 border-line bg-surface p-4'

type Busy = 'gps' | 'search' | undefined

async function geocode(url: string): Promise<GeocodedPlace | undefined> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return parseGeocode(await response.json())
}

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }),
  )
}

function gpsError(error: unknown): string {
  if (typeof GeolocationPositionError !== 'undefined' && error instanceof GeolocationPositionError) {
    if (error.code === error.PERMISSION_DENIED) return 'Standortzugriff wurde nicht erlaubt.'
    return 'Der Standort ließ sich nicht bestimmen.'
  }
  return 'Die Adresse zum Standort ließ sich nicht abrufen. Ohne Internet bitte die Adresse und das Bundesland eintippen.'
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className={secondaryButton}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
        } catch {
          setCopied(false)
        }
      }}
    >
      {copied ? 'Kopiert' : 'Kopieren'}
    </button>
  )
}

function PortalCard({ portal, address, primary }: { portal: SweepPortal; address: Address; primary: boolean }) {
  const { href, prefilled } = portalLink(portal, address)
  const toType = copyText(portal, address)
  return (
    <li className={card}>
      <h3 className="text-xl font-bold">{portal.label}</h3>
      {portal.cities.length > 0 && <p className="mt-1 text-sm font-semibold text-muted">Nur für {portal.cities.join(', ')}</p>}
      {prefilled ? (
        <p className="mt-2 text-base">Die Adresse wird an die Suche übergeben.</p>
      ) : (
        toType && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-base">Im Portal eingeben:</span>
            <span className="rounded-md bg-raised px-2 py-1 text-lg font-bold">{toType}</span>
            <CopyButton text={toType} />
          </div>
        )
      )}
      {portal.note && <p className="mt-2 text-base">{portal.note}</p>}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${primary ? primaryButton : secondaryButton} mt-3 w-full text-center [overflow-wrap:anywhere]`}
      >
        {/* ︎: als Textzeichen, sonst macht Windows daraus ein farbiges Emoji */}
        {portal.label} öffnen <span aria-hidden="true">{'↗︎'}</span>
      </a>
    </li>
  )
}

function Results({ state, address, district }: { state: SweepState; address: Address; district: string }) {
  const { matching, others } = portalsFor(state, address.city)
  return (
    <section aria-label="Ergebnis" className="mt-6">
      <h2 className="text-2xl font-bold">{state.name}</h2>
      {formatAddress(address) && <p className="mt-1 text-base text-muted">Adresse: {formatAddress(address)}</p>}
      {matching.length > 0 ? (
        <ul>
          {matching.map((portal, index) => (
            <PortalCard key={portal.key} portal={portal} address={address} primary={index === 0} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-base">Für {state.name} ist keine Online-Suche erfasst.</p>
      )}
      {(state.authority || (district && matching.length === 0)) && (
        <div className={card}>
          <p className="flex items-center gap-2 font-bold">
            <InfoIcon className="size-5 shrink-0" aria-hidden="true" />
            Bei der Behörde nachfragen
          </p>
          {state.authority && <p className="mt-1 text-base">{state.authority}</p>}
          {district && <p className="mt-1 text-base">Laut Adresse: {district}</p>}
        </div>
      )}
      {state.todo && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border-2 border-dashed border-line p-3 text-base">
          <WarningIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          {state.todo}
        </p>
      )}
      {others.length > 0 && (
        <details className="mt-4">
          <summary className="min-h-12 cursor-pointer py-3 font-semibold text-accent">Suchen anderer Städte in {state.name}</summary>
          <ul>
            {others.map((portal) => (
              <PortalCard key={portal.key} portal={portal} address={address} primary={false} />
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

const FIELDS: { field: AddressField; label: string; autoComplete: string; inputMode?: 'numeric'; wide: boolean }[] = [
  { field: 'street', label: 'Straße', autoComplete: 'address-line1', wide: true },
  { field: 'houseNumber', label: 'Hausnummer', autoComplete: 'off', wide: false },
  { field: 'postcode', label: 'PLZ', autoComplete: 'postal-code', inputMode: 'numeric', wide: false },
  { field: 'city', label: 'Ort', autoComplete: 'address-level2', wide: true },
]

/** Adresse eingeben oder per GPS holen, dann die Suchportale des Bundeslands mit übergebener Adresse */
export function ChimneySweepFinder({
  tool,
  initialAddress = EMPTY_ADDRESS,
  initialState = '',
  initialShown = false,
}: {
  tool: ChimneySweepTool
  initialAddress?: Address
  initialState?: string
  /** Ergebnis gleich anzeigen (für Tests) */
  initialShown?: boolean
}) {
  const id = useId()
  const [address, setAddress] = useState<Address>(initialAddress)
  const [stateCode, setStateCode] = useState(initialState)
  const [district, setDistrict] = useState('')
  const [shown, setShown] = useState(initialShown)
  const [busy, setBusy] = useState<Busy>()
  const [message, setMessage] = useState('')

  const state = findState(tool, stateCode)
  const change = (field: AddressField, value: string) => {
    setAddress((current) => ({ ...current, [field]: value }))
    setDistrict('')
  }

  const useLocation = async () => {
    setMessage('')
    if (!('geolocation' in navigator)) {
      setMessage('Dieses Gerät kann den Standort nicht bestimmen.')
      return
    }
    setBusy('gps')
    try {
      const position = await currentPosition()
      const place = await geocode(reverseGeocodeUrl(position.coords.latitude, position.coords.longitude))
      if (!place) throw new Error('keine Adresse')
      setAddress(place.address)
      setDistrict(place.district)
      if (place.stateCode) setStateCode(place.stateCode)
      else setMessage('Der Standort liegt nicht in Deutschland oder das Bundesland ist unbekannt.')
      setShown(place.stateCode !== undefined)
    } catch (error) {
      setMessage(gpsError(error))
    } finally {
      setBusy(undefined)
    }
  }

  const search = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    // Bundesland gewählt: sofort anzeigen, der Abgleich ergänzt nur den Landkreis
    if (stateCode) setShown(true)
    if (formatAddress(address) === '') {
      if (!stateCode) setMessage('Bitte eine Adresse eingeben, den Standort verwenden oder das Bundesland wählen.')
      return
    }
    if (stateCode && district) return
    setBusy('search')
    try {
      const place = await geocode(searchGeocodeUrl(address))
      if (place) setDistrict(place.district)
      if (!stateCode) {
        if (place?.stateCode) {
          setStateCode(place.stateCode)
          setShown(true)
        } else setMessage('Die Adresse wurde nicht gefunden. Bitte prüfen oder das Bundesland wählen.')
      }
    } catch {
      if (!stateCode) setMessage('Das Bundesland ließ sich ohne Internet nicht erkennen. Bitte selbst wählen.')
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <>
      <form onSubmit={search} className="mt-4">
        <button type="button" onClick={useLocation} disabled={busy !== undefined} className={`${secondaryButton} w-full`}>
          <LocationIcon className="size-6 shrink-0" aria-hidden="true" />
          {busy === 'gps' ? 'Standort wird bestimmt …' : 'Standort verwenden (GPS)'}
        </button>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {FIELDS.map(({ field, label, autoComplete, inputMode, wide }) => (
            <label key={field} className={wide ? 'col-span-2 block' : 'col-span-1 block'}>
              <span className="font-semibold">{label}</span>
              <input
                id={`${id}-${field}`}
                value={address[field]}
                onChange={(event) => change(field, event.target.value)}
                autoComplete={autoComplete}
                inputMode={inputMode}
                className={`${fieldBase} mt-1 w-full`}
              />
            </label>
          ))}
        </div>
        <label className="mt-3 block">
          <span className="font-semibold">Bundesland</span>
          <select
            value={stateCode}
            onChange={(event) => {
              setStateCode(event.target.value)
              setShown(event.target.value !== '' && shown)
            }}
            className={`${fieldBase} mt-1 w-full`}
          >
            <option value="">Aus der Adresse erkennen</option>
            {[...tool.states]
              .sort((a, b) => a.name.localeCompare(b.name, 'de'))
              .map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
          </select>
        </label>
        <button type="submit" disabled={busy !== undefined} className={`${primaryButton} mt-4 w-full`}>
          <SearchIcon className="size-6 shrink-0" aria-hidden="true" />
          {busy === 'search' ? 'Adresse wird geprüft …' : 'Zuständigen Schornsteinfeger suchen'}
        </button>
        <p className="mt-2 text-sm text-muted">{tool.geocoderNote}</p>
        {message && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-warn p-3 text-base text-warn-ink">
            <WarningIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            {message}
          </p>
        )}
      </form>
      {shown && state && <Results state={state} address={address} district={district} />}
      <div className="mt-6 text-base">
        <RichText text={tool.closingNote} />
      </div>
    </>
  )
}
