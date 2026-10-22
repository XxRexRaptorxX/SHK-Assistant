import { useRef, useState, type ChangeEvent } from 'react'
import { primaryButton, secondaryButton, dangerButton } from '../components/buttons'
import { EntryRows, groupByModule, groupInOrder } from '../components/EntryList'
import { categoryHeading, subcategoryHeading } from '../components/headings'
import { downloadTextFile } from '../lib/download'
import { usePageTitle } from '../lib/usePageTitle'
import type { SearchDocument } from '../search/search'
import { getContentIndex } from '../search/sources'
import {
  backupFileName,
  BackupImportError,
  createBackup,
  parseBackup,
  serializeBackup,
  type Backup,
  type ImportMode,
} from '../storage/backup'
import type { FavoriteRecord } from '../storage/db'
import { FavoriteButton } from './FavoriteButton'
import { importBackupIntoStore, removeFavoritesFromStore, useFavorites } from './favoritesStore'

export function FavoritesPage() {
  usePageTitle('Favoriten')
  const state = useFavorites()

  return (
    <>
      <h1 className="text-2xl font-bold">Favoriten</h1>
      {state.status === 'loading' && <p className="mt-2 text-muted">Favoriten werden geladen …</p>}
      {state.status === 'unavailable' && (
        <p role="alert" className="mt-2">
          Favoriten können auf diesem Gerät nicht gespeichert werden, z. B. im privaten Modus des
          Browsers.
        </p>
      )}
      {state.status === 'ready' && (
        <>
          <FavoritesList favorites={state.favorites} index={getContentIndex()} />
          <BackupSection hasFavorites={state.favorites.length > 0} />
        </>
      )}
    </>
  )
}

interface FavoritesListProps {
  favorites: readonly FavoriteRecord[]
  index: ReadonlyMap<string, SearchDocument>
}

export function FavoritesList({ favorites, index }: FavoritesListProps) {
  if (favorites.length === 0) {
    return (
      <p className="mt-2 text-muted">
        Noch keine Favoriten. Einträge lassen sich über den Stern auf ihrer Seite merken.
      </p>
    )
  }

  const ids = new Set(favorites.map((f) => f.id))
  // Reihenfolge wie in den Modulen: Modul, dann Unterüberschrift (z. B. Kategorie), dann Eintrag
  // Zusatzzeile weglassen, wenn sie nur die Unterüberschrift wiederholt (Kategorie bei Formeln)
  const known = [...index.values()]
    .filter((entry) => ids.has(entry.id))
    .map((entry) => (entry.subtitle === entry.group ? { ...entry, subtitle: undefined } : entry))
  // Inhalte, die gelöscht wurden oder in dieser Edition fehlen
  const missingIds = favorites.filter((f) => !index.has(f.id)).map((f) => f.id)
  const star = (entry: SearchDocument) => <FavoriteButton id={entry.id} title={entry.title} />

  return (
    <>
      {groupByModule(known).map((module) => (
        <section key={module.moduleTitle} className="mt-5">
          <h2 className={categoryHeading}>{module.moduleTitle}</h2>
          {groupInOrder(module.results, (entry) => entry.group ?? '').map((group) =>
            group.key === '' ? (
              <EntryRows key="" entries={group.items} action={star} />
            ) : (
              <div key={group.key} className="mt-3">
                <h3 className={subcategoryHeading}>{group.key}</h3>
                <EntryRows entries={group.items} action={star} />
              </div>
            ),
          )}
        </section>
      ))}
      {missingIds.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-base text-muted">
          <p>
            {missingIds.length === 1
              ? '1 gemerkter Eintrag ist in dieser Version nicht mehr vorhanden.'
              : `${missingIds.length} gemerkte Einträge sind in dieser Version nicht mehr vorhanden.`}
          </p>
          <button type="button" className={secondaryButton} onClick={() => void removeFavoritesFromStore(missingIds)}>
            Aufräumen
          </button>
        </div>
      )}
    </>
  )
}

type Message = { kind: 'info' | 'error'; text: string }

function BackupSection({ hasFavorites }: { hasFavorites: boolean }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Backup>()
  const [message, setMessage] = useState<Message>()

  const exportFavorites = async () => {
    try {
      const backup = await createBackup()
      downloadTextFile(backupFileName(), serializeBackup(backup), 'application/json')
      setMessage({ kind: 'info', text: `${backup.favorites.length} Favoriten exportiert.` })
    } catch {
      setMessage({ kind: 'error', text: 'Der Export ist fehlgeschlagen.' })
    }
  }

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = '' // dieselbe Datei erneut wählbar
    if (!file) return
    setPending(undefined)
    try {
      setPending(parseBackup(await file.text()))
      setMessage(undefined)
    } catch (error) {
      const text = error instanceof BackupImportError ? error.message : 'Die Datei konnte nicht gelesen werden.'
      setMessage({ kind: 'error', text })
    }
  }

  const applyImport = async (backup: Backup, mode: ImportMode) => {
    setPending(undefined)
    try {
      const added = await importBackupIntoStore(backup, mode)
      setMessage({
        kind: 'info',
        text:
          mode === 'merge'
            ? `${added} Favoriten hinzugefügt.`
            : `Favoriten ersetzt: jetzt ${backup.favorites.length} Einträge.`,
      })
    } catch {
      setMessage({ kind: 'error', text: 'Der Import ist fehlgeschlagen. Es wurde nichts geändert.' })
    }
  }

  return (
    <section className="mt-8 border-t-2 border-line pt-4">
      <h2 className="text-xl font-bold">Sichern und übertragen</h2>
      <p className="mt-1 text-base text-muted">
        Favoriten werden nur auf diesem Gerät gespeichert. Über Export und Import lassen sie sich
        sichern oder auf ein anderes Gerät übertragen.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={primaryButton} disabled={!hasFavorites} onClick={() => void exportFavorites()}>
          Exportieren
        </button>
        <button type="button" className={secondaryButton} onClick={() => fileInput.current?.click()}>
          Importieren
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => void readFile(event)}
        />
      </div>

      {pending && (
        <div className="mt-4 rounded-lg border-2 border-line bg-surface p-3">
          <p>
            Backup vom {new Date(pending.exportedAt).toLocaleDateString('de-DE')} mit{' '}
            {pending.favorites.length} Favoriten.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={primaryButton} onClick={() => void applyImport(pending, 'merge')}>
              Ergänzen
            </button>
            <button type="button" className={dangerButton} onClick={() => void applyImport(pending, 'replace')}>
              Ersetzen
            </button>
            <button type="button" className={secondaryButton} onClick={() => setPending(undefined)}>
              Abbrechen
            </button>
          </div>
          <p className="mt-2 text-base text-muted">
            „Ergänzen“ behält die bisherigen Favoriten. „Ersetzen“ löscht sie auf diesem Gerät.
          </p>
        </div>
      )}

      {message && (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={`mt-3 font-semibold ${message.kind === 'error' ? 'rounded-lg bg-warn p-2 text-warn-ink' : ''}`}
        >
          {message.text}
        </p>
      )}
    </section>
  )
}
