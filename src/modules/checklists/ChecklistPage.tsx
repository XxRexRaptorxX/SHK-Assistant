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
import { fieldBase, listCard } from '../../components/surfaces'

const BACK = { to: '/checklisten', label: 'Checklisten' }

export function ChecklistPage({ entries = checklistEntries }: { entries?: ChecklistEntry[] }) {
  const { slug } = useParams()
  const entry = findChecklist(entries, slug)
  if (!entry) return <ChecklistNotFound />
  return <ChecklistDetail key={entry.id} entry={entry} />
}

function ChecklistDetail({ entry }: { entry: ChecklistEntry }) {
  const { state, setChecked, setTitle, setNotes, reset } = useChecklistProgress(entry.id)
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
          <ChecklistTitle
            id={`${entry.id}-title`}
            value={state.status === 'loading' ? '' : state.title}
            disabled={state.status === 'loading'}
            onChange={setTitle}
          />
          <PrintHeader />
          {state.status === 'unavailable' && (
            <p role="alert" className="mt-4 rounded-xl bg-warn p-2 font-semibold text-warn-ink print:hidden">
              Der Fortschritt kann auf diesem Gerät nicht gespeichert werden.
            </p>
          )}
          <ChecklistView
            entry={entry}
            checked={checked}
            disabled={state.status === 'loading'}
            onToggle={(itemId, value) => void setChecked(itemId, value)}
          />
          {entry.notes && (
            <ChecklistNotes
              id={`${entry.id}-notes`}
              label={entry.notes.label}
              value={state.status === 'loading' ? '' : state.notes}
              disabled={state.status === 'loading'}
              onChange={setNotes}
            />
          )}

          <div className="mt-6 flex flex-wrap gap-2 print:hidden">
            <button type="button" className={primaryButton} onClick={() => window.print()}>
              Drucken
            </button>
            <button type="button" className={secondaryButton} onClick={() => setConfirmReset(true)}>
              Zurücksetzen
            </button>
          </div>
          {confirmReset && (
            <div className="mt-3 rounded-2xl border border-edge bg-surface p-3 print:hidden">
              <p>{entry.notes ? 'Titel, alle Haken und Notizen dieser Checkliste entfernen?' : 'Titel und alle Haken dieser Checkliste entfernen?'}</p>
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
          className="mt-1 h-3 overflow-hidden rounded-full border border-edge bg-raised"
        >
          <div className="h-full bg-accent" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </div>

      {entry.sections.map((section, index) => (
        <section key={index} className="mt-6">
          {section.title && <h2 className="text-xl font-bold">{section.title}</h2>}
          <ul className={`mt-2 ${listCard}`}>
            {section.items.map((item) => {
              const isDone = checked.has(item.id)
              return (
                <li key={item.id} className="break-inside-avoid">
                  <label className="flex min-h-14 cursor-pointer items-start gap-3 px-4 py-3">
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

/** Freitext-Titel über den Punkten (z. B. Kunde oder Anlage); im Ausdruck als Zeile */
export function ChecklistTitle({ id, value, disabled = false, onChange }: {
  id: string
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="mt-4">
      <label htmlFor={id} className="block text-base font-semibold print:hidden">
        Titel
      </label>
      <input
        id={id}
        type="text"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`${fieldBase} mt-1 block min-h-12 w-full print:hidden`}
      />
      <p className="hidden border-b-2 border-line pb-1 text-xl font-bold print:block">{value || ' '}</p>
    </div>
  )
}

/** Freitext unter den Punkten; im Ausdruck als Kasten */
export function ChecklistNotes({ id, label, value, disabled = false, onChange }: {
  id: string
  label: string
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <section className="mt-6 break-inside-avoid">
      <label htmlFor={id} className="block text-xl font-bold">
        {label}
      </label>
      <textarea
        id={id}
        rows={4}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`${fieldBase} mt-2 block w-full py-2 print:hidden`}
      />
      <div className="mt-2 hidden min-h-32 rounded-xl border-2 border-line p-3 whitespace-pre-wrap print:block">
        {value}
      </div>
    </section>
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
