import { useState } from 'react'
import { useParams } from 'react-router'
import { dangerButton, primaryButton, secondaryButton } from '../../components/buttons'
import { BackLink, ContentPage } from '../../components/ContentPage'
import { RichText } from '../../components/RichText'
import { FavoriteButton } from '../../favorites/FavoriteButton'
import { usePageTitle } from '../../lib/usePageTitle'
import { checklistEntries, countDone, findChecklist } from './checklists'
import type { ChecklistEntry } from './schema'
import { useChecklistProgress } from './useChecklistProgress'

const BACK = { to: '/checklisten', label: 'Checklisten' }

/** Druckt die Seite; "blank" blendet die Haken für ein leeres Formular aus (siehe index.css). */
function printChecklist(blank: boolean) {
  const root = document.documentElement
  if (blank) root.dataset.printBlank = ''
  window.addEventListener('afterprint', () => delete root.dataset.printBlank, { once: true })
  window.print()
}

export function ChecklistPage({ entries = checklistEntries }: { entries?: ChecklistEntry[] }) {
  const { slug } = useParams()
  const entry = findChecklist(entries, slug)
  if (!entry) return <ChecklistNotFound />
  return <ChecklistDetail key={entry.id} entry={entry} />
}

function ChecklistDetail({ entry }: { entry: ChecklistEntry }) {
  const { state, setChecked, reset } = useChecklistProgress(entry.id)
  const [confirmReset, setConfirmReset] = useState(false)
  const checked: ReadonlySet<string> = state.status === 'loading' ? new Set() : state.checked

  return (
    <ContentPage
      entry={entry}
      title={entry.title}
      back={BACK}
      actions={<FavoriteButton id={entry.id} title={`Checkliste ${entry.title}`} />}
    >
      {entry.description && <RichText text={entry.description} />}
      {entry.sections.length === 0 ? (
        <p className="mt-4 font-semibold">TODO: Inhalt fehlt – die Prüfpunkte sind noch nicht hinterlegt.</p>
      ) : (
        <>
          <PrintHeader />
          {state.status === 'unavailable' && (
            <p role="alert" className="mt-4 rounded-lg bg-warn p-2 font-semibold text-warn-ink print:hidden">
              Der Fortschritt kann auf diesem Gerät nicht gespeichert werden.
            </p>
          )}
          <ChecklistView
            entry={entry}
            checked={checked}
            disabled={state.status === 'loading'}
            onToggle={(itemId, value) => void setChecked(itemId, value)}
          />

          <div className="mt-6 flex flex-wrap gap-2 print:hidden">
            <button type="button" className={primaryButton} onClick={() => printChecklist(false)}>
              Drucken
            </button>
            <button type="button" className={secondaryButton} onClick={() => printChecklist(true)}>
              Leer drucken
            </button>
            <button type="button" className={secondaryButton} onClick={() => setConfirmReset(true)}>
              Zurücksetzen
            </button>
          </div>
          {confirmReset && (
            <div className="mt-3 rounded-lg border-2 border-line bg-surface p-3 print:hidden">
              <p>Alle Haken dieser Checkliste entfernen?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={dangerButton}
                  onClick={() => {
                    setConfirmReset(false)
                    void reset()
                  }}
                >
                  Ja, zurücksetzen
                </button>
                <button type="button" className={secondaryButton} onClick={() => setConfirmReset(false)}>
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </ContentPage>
  )
}

interface ChecklistViewProps {
  entry: ChecklistEntry
  checked: ReadonlySet<string>
  disabled?: boolean
  onToggle: (itemId: string, checked: boolean) => void
}

/** Fortschritt und Prüfpunkte, nach Abschnitten gegliedert */
export function ChecklistView({ entry, checked, disabled = false, onToggle }: ChecklistViewProps) {
  const { done, total } = countDone(entry, checked)
  return (
    <>
      <div className="mt-4 print:hidden">
        <p className="font-semibold" aria-live="polite">
          {done} von {total} erledigt
        </p>
        <div
          role="progressbar"
          aria-label="Fortschritt"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          className="mt-1 h-3 overflow-hidden rounded-full border-2 border-line bg-page"
        >
          <div className="h-full bg-accent" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </div>

      {entry.sections.map((section) => (
        <section key={section.title} className="mt-6">
          <h2 className="text-xl font-bold">{section.title}</h2>
          <ul className="mt-1 divide-y-2 divide-line border-y-2 border-line">
            {section.items.map((item) => {
              const isDone = checked.has(item.id)
              return (
                <li key={item.id} className="break-inside-avoid">
                  <label className="flex min-h-14 cursor-pointer items-start gap-3 py-3">
                    <input
                      type="checkbox"
                      className="check mt-0.5"
                      checked={isDone}
                      disabled={disabled}
                      onChange={(event) => onToggle(item.id, event.target.checked)}
                    />
                    <span>
                      <span className={isDone ? 'done-text' : ''}>{item.text}</span>
                      {item.note && <span className="block text-base text-muted">{item.note}</span>}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}

/** Nur im Ausdruck: Felder zum Ausfüllen von Hand */
function PrintHeader() {
  const fields = ['Anlage / Kunde', 'Datum', 'Ausgeführt von', 'Unterschrift']
  return (
    <dl className="mt-4 hidden grid-cols-2 gap-x-6 gap-y-4 print:grid">
      {fields.map((field) => (
        <div key={field} className="border-b-2 border-line pb-6">
          <dt className="text-base">{field}</dt>
          <dd />
        </div>
      ))}
    </dl>
  )
}

function ChecklistNotFound() {
  usePageTitle('Checkliste nicht gefunden')
  return (
    <>
      <BackLink to={BACK.to} label={BACK.label} />
      <h1 className="text-2xl font-bold">Checkliste nicht gefunden</h1>
      <p className="mt-2 text-muted">Diese Checkliste gibt es nicht (mehr).</p>
    </>
  )
}
