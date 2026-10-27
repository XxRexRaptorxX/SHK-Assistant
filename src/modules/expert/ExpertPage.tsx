import { useState, type FormEvent } from 'react'
import { modules } from '../../app/modules'
import { primaryButton } from '../../components/buttons'
import { DraftBadge } from '../../components/DraftBadge'
import { categoryHeading, pageTitle } from '../../components/headings'
import { SearchInput } from '../../components/SearchInput'
import { SourceInfo } from '../../components/SourceInfo'
import { fieldBase, listCard } from '../../components/surfaces'
import { FavoriteButton } from '../../favorites/FavoriteButton'
import { useFavoriteIds } from '../../favorites/favoritesStore'
import { usePageTitle } from '../../lib/usePageTitle'
import { expertCodeEntries, filterExpertCodes, plainText, splitShades, type Shade } from './expertCodes'
import type { ExpertCodeEntry } from './schema'
import { EXPERT_PIN, tryUnlockExpert, useExpertUnlocked } from './unlock'

interface ExpertPageProps {
  /** Für Tests überschreibbar */
  entries?: ExpertCodeEntry[]
  unlocked?: boolean
}

export function ExpertPage({ entries = expertCodeEntries, unlocked }: ExpertPageProps) {
  usePageTitle(modules.expert.title)
  const stored = useExpertUnlocked()
  return (
    <>
      <h1 className={pageTitle}>{modules.expert.title}</h1>
      {(unlocked ?? stored) ? <ExpertCodeList entries={entries} /> : <PinForm />}
    </>
  )
}

export default ExpertPage

/** PIN-Abfrage; prüft automatisch, sobald genug Ziffern eingegeben sind */
export function PinForm() {
  const [pin, setPin] = useState('')
  const [wrong, setWrong] = useState(false)

  const check = (value: string) => {
    if (tryUnlockExpert(value)) return
    setWrong(true)
    setPin('')
  }

  const change = (value: string) => {
    setPin(value)
    setWrong(false)
    if (value.length === EXPERT_PIN.length) check(value)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    check(pin)
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-6 max-w-xs">
      <label htmlFor="expert-pin" className="block text-center font-semibold">
        PIN eingeben
      </label>
      <input
        id="expert-pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={EXPERT_PIN.length}
        value={pin}
        onChange={(event) => change(event.target.value)}
        aria-invalid={wrong}
        aria-describedby={wrong ? 'expert-pin-error' : undefined}
        className={`${fieldBase} mt-2 block min-h-14 w-full text-center text-2xl tracking-[0.5em]`}
      />
      {wrong && (
        <p id="expert-pin-error" role="alert" className="mt-2 rounded-xl bg-warn p-2 text-center font-semibold text-warn-ink">
          PIN falsch. Bitte erneut eingeben.
        </p>
      )}
      <button type="submit" className={`${primaryButton} mt-3 w-full`}>
        Entsperren
      </button>
    </form>
  )
}

const SHADE_CLASS: Record<Shade, string> = {
  normal: '',
  dark: 'font-normal text-muted',
  light: 'font-normal text-faint',
}

/** Text mit grauen Stellen (im Inhalt in eckigen bzw. runden Klammern) */
function ShadedText({ text }: { text: string }) {
  return splitShades(text).map((part, index) => (
    <span key={index} className={SHADE_CLASS[part.shade] || undefined}>
      {part.text}
    </span>
  ))
}

function CodeRows({ entries, showDraft }: { entries: readonly ExpertCodeEntry[]; showDraft: boolean }) {
  return (
    <ul className={`mt-2 ${listCard}`}>
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-center gap-1">
          <div className="flex min-h-14 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 pl-4">
            <span className="font-semibold">
              <ShadedText text={entry.name} />
              {/* Hinweis neben dem Namen, damit die Zeile so hoch bleibt wie die anderen */}
              {showDraft && entry.status === 'draft' && (
                <span className="ml-2 inline-block align-middle">
                  <DraftBadge variant="inline" />
                </span>
              )}
            </span>
            <span className="text-xl font-bold tabular-nums whitespace-pre-wrap">
              <ShadedText text={entry.code} />
            </span>
          </div>
          <FavoriteButton id={entry.id} title={plainText(entry.name)} />
        </li>
      ))}
    </ul>
  )
}

/** Quellen ohne Wiederholung: Einträge mit gleicher Quelle und gleichem Prüfstand zusammen */
function distinctSources(entries: readonly ExpertCodeEntry[]): ExpertCodeEntry[] {
  const seen = new Map<string, ExpertCodeEntry>()
  for (const entry of entries) {
    const key = [entry.source, entry.status, entry.verifiedBy, entry.verifiedAt].join('|')
    if (!seen.has(key)) seen.set(key, entry)
  }
  return [...seen.values()]
}

export function ExpertCodeList({ entries }: { entries: readonly ExpertCodeEntry[] }) {
  const [query, setQuery] = useState('')
  const favoriteIds = useFavoriteIds()
  const visible = filterExpertCodes(entries, query)
  const favorites = entries.filter((entry) => favoriteIds.has(entry.id))
  const allDraft = entries.length > 0 && entries.every((entry) => entry.status === 'draft')

  if (entries.length === 0) return <p className="mt-2 text-muted">Noch keine Codes vorhanden.</p>

  return (
    <>
      {allDraft && (
        <div className="mt-4">
          <DraftBadge />
        </div>
      )}
      {query.trim() === '' && favorites.length > 0 && (
        <section className="mt-5" aria-label="Favoriten">
          <h2 className={categoryHeading}>Favoriten</h2>
          <CodeRows entries={favorites} showDraft={!allDraft} />
        </section>
      )}

      <div className="mt-5">
        <SearchInput
          id="expert-filter"
          label="Hersteller filtern"
          value={query}
          onChange={setQuery}
          placeholder="Hersteller filtern …"
        />
      </div>
      {visible.length === 0 ? (
        <p className="mt-4">Keine Codes gefunden.</p>
      ) : (
        <CodeRows entries={visible} showDraft={!allDraft} />
      )}

      {distinctSources(entries).map((entry) => (
        <SourceInfo key={entry.id} entry={entry} />
      ))}
    </>
  )
}
