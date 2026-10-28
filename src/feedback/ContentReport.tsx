import { useEffect, useId, useRef, useState } from 'react'
import { primaryButton, secondaryButton } from '../components/buttons'
import { MailIcon, WarningIcon } from '../components/icons'
import { isInternalEdition } from '../config/edition'
import { CONTACT_EMAIL } from '../config/links'
import type { BaseEntry } from '../content/schema/base'
import { formatIsoDate } from '../lib/format'
import {
  contentReportMailto,
  loadReportTimes,
  messageIssue,
  nextReportAllowedAt,
  recordReport,
  REPORT_LIMIT,
  REPORT_MAX_LENGTH,
} from './reportMail'

type ReportEntry = Pick<BaseEntry, 'id' | 'status' | 'verifiedBy' | 'verifiedAt'>

const timeFormat = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })

/** Knopf unter Quelle und Prüfdatum: öffnet das Fenster zum Melden eines Fehlers in diesem Eintrag */
export function ContentReportButton({ entry, title }: { entry: ReportEntry; title: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-4 print:hidden">
      <button type="button" className={`${secondaryButton} w-full`} onClick={() => setOpen(true)}>
        <WarningIcon className="size-6 text-accent" />
        Fehler im Inhalt melden
      </button>
      {open && <ContentReportDialog entry={entry} title={title} onClose={() => setOpen(false)} />}
    </div>
  )
}

export function ContentReportDialog({
  entry,
  title,
  onClose,
  now = Date.now(),
}: {
  entry: ReportEntry
  title: string
  onClose: () => void
  /** Für Tests */
  now?: number
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const ids = useId()
  const [message, setMessage] = useState('')
  const [touched, setTouched] = useState(false)
  // Beim Öffnen einmal lesen; die Sperre gilt dann für dieses Fenster
  const [blockedUntil] = useState(() => nextReportAllowedAt(loadReportTimes(), now))
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const issue = messageIssue(message)
  const href = contentReportMailto({
    to: CONTACT_EMAIL,
    id: entry.id,
    title,
    url: typeof window === 'undefined' ? '' : window.location.href,
    version: __APP_VERSION__,
    edition: isInternalEdition ? 'intern' : 'öffentlich',
    state: entry.status === 'verified' ? `geprüft am ${formatIsoDate(entry.verifiedAt)} (${entry.verifiedBy})` : 'ungeprüft',
    message,
  })
  // Das Fenster schließt über das close-Ereignis erst nach dem Klick, damit der Link noch öffnet
  const send = () => {
    recordReport(Date.now())
    ref.current?.close()
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={`${ids}-title`}
      className="m-auto max-h-[90dvh] w-[min(92vw,30rem)] overflow-y-auto rounded-2xl border border-edge bg-surface p-5 text-ink shadow-2xl backdrop:bg-black/60"
    >
      <h2 id={`${ids}-title`} className="text-xl font-bold">
        Fehler im Inhalt melden
      </h2>
      <p className="mt-1 text-base text-muted">
        Eintrag: <span className="font-semibold text-ink">{title}</span>
      </p>
      {blockedUntil === undefined ? (
        <>
          <label htmlFor={`${ids}-message`} className="mt-4 block font-semibold">
            Was ist falsch oder veraltet?
          </label>
          <textarea
            id={`${ids}-message`}
            value={message}
            maxLength={REPORT_MAX_LENGTH}
            rows={5}
            onChange={(event) => setMessage(event.target.value)}
            onBlur={() => setTouched(true)}
            aria-describedby={`${ids}-hint`}
            className="mt-2 w-full rounded-xl border-2 border-line bg-page p-3 text-ink"
          />
          <p id={`${ids}-hint`} className="mt-1 flex justify-between gap-3 text-base text-muted">
            <span>{touched && issue ? issue : 'Am besten mit Quelle oder richtigem Wert.'}</span>
            <span className="shrink-0 tabular-nums">
              {message.trim().length}/{REPORT_MAX_LENGTH}
            </span>
          </p>
          <p className="mt-3 text-base text-muted">
            Öffnet dein E-Mail-Programm. Mitgeschickt werden Titel, Kennung und Link des Eintrags sowie die
            App-Version.
          </p>
        </>
      ) : (
        <p className="mt-4 font-semibold" role="status">
          Du hast in der letzten Stunde schon {REPORT_LIMIT} Meldungen geöffnet. Weitere Meldungen sind ab{' '}
          {timeFormat.format(blockedUntil)} Uhr möglich.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {blockedUntil === undefined &&
          (issue ? (
            <button type="button" className={primaryButton} disabled>
              <MailIcon className="size-6" />
              E-Mail öffnen
            </button>
          ) : (
            <a href={href} className={primaryButton} onClick={send}>
              <MailIcon className="size-6" />
              E-Mail öffnen
            </a>
          ))}
        <button type="button" className={secondaryButton} onClick={() => ref.current?.close()}>
          Abbrechen
        </button>
      </div>
    </dialog>
  )
}
