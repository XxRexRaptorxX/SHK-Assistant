import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { primaryButton, secondaryButton } from '../components/buttons'
import { useSettings } from '../settings/settings'
import { currentBugReportUrl } from './bugReport'
import { createShakeDetector, motionMagnitude, needsMotionPermission, requestMotionPermission, supportsMotion } from './shake'

/** Hört aufs Schütteln (wenn eingeschaltet) und fragt dann, ob ein Fehler gemeldet werden soll. */
export function ShakeToReport() {
  const { shakeToReport } = useSettings()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!shakeToReport || !supportsMotion()) return
    const detect = createShakeDetector()
    const onMotion = (event: DeviceMotionEvent) => {
      if (detect(motionMagnitude(event), event.timeStamp)) setOpen(true)
    }
    window.addEventListener('devicemotion', onMotion)
    // iPhone/iPad liefern Bewegungsdaten erst nach Freigabe, die nur aus einem Antippen heraus geht
    const onFirstTap = () => void requestMotionPermission()
    if (needsMotionPermission()) document.addEventListener('click', onFirstTap, { once: true })
    return () => {
      window.removeEventListener('devicemotion', onMotion)
      document.removeEventListener('click', onFirstTap)
    }
  }, [shakeToReport])

  return open ? <BugReportDialog page={pathname} onClose={() => setOpen(false)} /> : null
}

/** Rückfrage nach dem Schütteln; der Link öffnet das vorausgefüllte GitHub-Issue */
export function BugReportDialog({ page, onClose }: { page: string; onClose: () => void }) {
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
      aria-labelledby="bug-report-title"
      className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-edge bg-surface p-5 text-ink shadow-2xl backdrop:bg-black/60"
    >
      <h2 id="bug-report-title" className="text-xl font-bold">
        Fehler melden?
      </h2>
      <p className="mt-2">Du hast das Handy geschüttelt. Möchtest du einen Fehler in der App melden?</p>
      <p className="mt-2 text-base text-muted">
        Die Meldung wird auf GitHub erstellt (kostenloses Konto nötig). Das Schütteln lässt sich in den
        Einstellungen abschalten.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={currentBugReportUrl(page)}
          target="_blank"
          rel="noopener noreferrer"
          className={primaryButton}
          onClick={close}
        >
          Fehler melden
        </a>
        <button type="button" className={secondaryButton} onClick={close}>
          Abbrechen
        </button>
      </div>
    </dialog>
  )
}
