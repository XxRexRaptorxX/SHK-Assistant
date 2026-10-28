import { useEffect, useRef } from 'react'
import { primaryButton } from '../../components/buttons'
import { createStoredState } from '../../lib/storedState'
import { DISCLAIMER_PAGE, findLegalEntry, legalEntries } from './legal'
import { LegalText } from './LegalPage'

/** localStorage-Schlüssel der Bestätigung */
export const DISCLAIMER_KEY = 'shk-disclaimer-accepted'
/** Erhöhen, wenn sich der Hinweis wesentlich ändert: dann muss er erneut bestätigt werden */
export const DISCLAIMER_VERSION = '1'

const acceptedState = createStoredState<boolean>({
  key: DISCLAIMER_KEY,
  read: () => {
    try {
      return globalThis.localStorage?.getItem(DISCLAIMER_KEY) === DISCLAIMER_VERSION
    } catch {
      return false
    }
  },
  write: (value) => {
    try {
      if (value) globalThis.localStorage?.setItem(DISCLAIMER_KEY, DISCLAIMER_VERSION)
      else globalThis.localStorage?.removeItem(DISCLAIMER_KEY)
    } catch {
      // ohne Speicher gilt die Bestätigung bis zum Neuladen
    }
  },
  // Ohne Browser (Tests) nicht anzeigen, damit jede Seite für sich geprüft werden kann
  fallback: true,
})

export const useDisclaimerAccepted = acceptedState.useValue
export const acceptDisclaimer = () => acceptedState.set(true)

/** Zeigt den Haftungshinweis, bis er auf diesem Gerät einmal bestätigt wurde */
export function DisclaimerGate() {
  const accepted = useDisclaimerAccepted()
  return accepted ? null : <DisclaimerDialog onAccept={acceptDisclaimer} />
}

/** Nicht wegklickbar: schließt nur über „Verstanden“ */
export function DisclaimerDialog({ onAccept }: { onAccept: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const entry = findLegalEntry(legalEntries, DISCLAIMER_PAGE.id)
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])
  // Escape bricht nicht ab; schließt der Browser trotzdem (z. B. zweimal Escape), gleich wieder öffnen
  const reopen = () => {
    const dialog = ref.current
    if (dialog && !dialog.open && !acceptedState.get()) dialog.showModal()
  }

  return (
    <dialog
      ref={ref}
      onCancel={(event) => event.preventDefault()}
      onClose={reopen}
      aria-labelledby="disclaimer-title"
      className="m-auto max-h-[90dvh] w-[min(92vw,30rem)] overflow-y-auto rounded-2xl border border-edge bg-surface p-5 text-ink shadow-2xl backdrop:bg-black/70"
    >
      <h2 id="disclaimer-title" className="text-xl font-bold">
        {entry?.title ?? DISCLAIMER_PAGE.title}
      </h2>
      <div className="mt-3">
        {entry ? (
          entry.sections.map((section, index) => <LegalText key={index} text={section.text} />)
        ) : (
          <p className="font-semibold">TODO: Inhalt fehlt</p>
        )}
      </div>
      <p className="mt-3 text-base text-muted">Den Hinweis findest du jederzeit unter Einstellungen → Rechtliches.</p>
      <button type="button" className={`${primaryButton} mt-4 w-full`} onClick={onAccept}>
        Verstanden
      </button>
    </dialog>
  )
}
