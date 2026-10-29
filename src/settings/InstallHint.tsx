import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { primaryButton, secondaryButton } from '../components/buttons'
import { useDisclaimerAccepted } from '../modules/legal/DisclaimerDialog'
import { promptInstall, useInstallState, type Platform } from './install'
import { currentPlatform, INSTALL_GUIDES, InstallGuide } from './InstallGuide'

// Einmaliger Hinweis „App installieren“: nicht gleich beim Start, sondern wenn jemand die App
// eine Weile nutzt – nach 12 Seitenwechseln (auch über mehrere Besuche) oder nach 5 Minuten
// Nutzung. Danach nie wieder; die Anleitung bleibt in den Einstellungen.

/** localStorage: Hinweis wurde gezeigt */
export const INSTALL_HINT_KEY = 'shk-install-hint-shown'
/** localStorage: bisher aufgerufene Seiten (Seitenwechsel), über Besuche hinweg */
const PAGES_KEY = 'shk-install-hint-pages'
export const HINT_AFTER_PAGES = 12
export const HINT_AFTER_SECONDS = 5 * 60
const TICK_SECONDS = 5

/** Genug genutzt, um den Hinweis zu zeigen? */
export function hintDue(pages: number, seconds: number): boolean {
  return pages >= HINT_AFTER_PAGES || seconds >= HINT_AFTER_SECONDS
}

function read(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    // ohne Speicher erscheint der Hinweis höchstens einmal pro Besuch
  }
}

/** Zeigt den Hinweis einmal, sobald die App eine Weile genutzt wurde */
export function InstallHint() {
  const { installed, canPrompt } = useInstallState()
  const disclaimerAccepted = useDisclaimerAccepted()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(() => read(INSTALL_HINT_KEY) === '1')
  const [pages, setPages] = useState(() => Number(read(PAGES_KEY)) || 0)
  const [seconds, setSeconds] = useState(0)
  const lastPage = useRef(pathname)
  // Erst nach dem Haftungshinweis, nie in der installierten App
  const waiting = !installed && !shown && disclaimerAccepted

  // Seitenwechsel zählen (die erste Seite eines Besuchs zählt nicht)
  useEffect(() => {
    if (pathname === lastPage.current) return
    lastPage.current = pathname
    if (!waiting) return
    setPages((count) => {
      write(PAGES_KEY, String(count + 1))
      return count + 1
    })
  }, [pathname, waiting])

  // Nutzungszeit zählen, nur solange die App sichtbar ist
  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setSeconds((value) => value + TICK_SECONDS)
    }, TICK_SECONDS * 1000)
    return () => clearInterval(timer)
  }, [waiting])

  useEffect(() => {
    // Nicht über ein anderes offenes Fenster legen; dann beim nächsten Seitenwechsel bzw. Zeittakt
    if (!waiting || !hintDue(pages, seconds) || document.querySelector('dialog[open]')) return
    write(INSTALL_HINT_KEY, '1')
    setShown(true)
    setOpen(true)
  }, [waiting, pages, seconds])

  return open ? <InstallHintDialog platform={currentPlatform()} canPrompt={canPrompt} onClose={() => setOpen(false)} /> : null
}

export function InstallHintDialog({
  platform,
  canPrompt,
  onClose,
}: {
  platform: Platform
  /** Browser bietet einen eigenen Installations-Dialog an (Chrome, Edge, Android) */
  canPrompt: boolean
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])
  const close = () => ref.current?.close()

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="install-hint-title"
      className="m-auto max-h-[90dvh] w-[min(92vw,28rem)] overflow-y-auto rounded-2xl border border-edge bg-surface p-5 text-ink shadow-2xl backdrop:bg-black/60"
    >
      <h2 id="install-hint-title" className="text-xl font-bold">
        App installieren
      </h2>
      <p className="mt-2">
        Installiert startet der SHK-Assistant wie eine normale App vom Startbildschirm, ohne Browserleiste,
        und funktioniert auch ohne Internet – etwa im Keller ohne Empfang.
      </p>
      {canPrompt ? (
        <button
          type="button"
          className={`${primaryButton} mt-4 w-full`}
          onClick={() => void promptInstall().finally(close)}
        >
          Jetzt installieren
        </button>
      ) : (
        <>
          <h3 className="mt-4 font-semibold">So geht’s: {INSTALL_GUIDES[platform].title}</h3>
          <InstallGuide platform={platform} />
        </>
      )}
      <p className="mt-4 text-base text-muted">
        Die Anleitung findest du jederzeit unter Einstellungen → App auf den Startbildschirm.
      </p>
      <button type="button" className={`${secondaryButton} mt-4 w-full`} onClick={close}>
        {canPrompt ? 'Später' : 'Verstanden'}
      </button>
    </dialog>
  )
}
