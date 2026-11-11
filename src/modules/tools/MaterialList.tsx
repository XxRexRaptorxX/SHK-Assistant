import { useEffect, useId, useState, type FormEvent } from 'react'
import { primaryButton, secondaryButton } from '../../components/buttons'
import { PencilIcon } from '../../components/icons'
import { SuggestInput } from '../../components/SuggestInput'
import { card, fieldBase } from '../../components/surfaces'
import type { MaterialItem, MaterialList as List, MaterialMemoryRecord } from '../../storage/db'
import {
  deleteMaterialList,
  deleteMaterialMemory,
  listMaterialLists,
  listMaterialMemory,
  saveMaterialList,
  saveMaterialMemory,
} from '../../storage/materialLists'
import {
  addItem,
  cleanDraft,
  createList,
  doneItems,
  draftFromItem,
  EMPTY_ITEM_DRAFT,
  isEmptyList,
  itemLine,
  LIST_DATE_LABEL,
  listCsv,
  listMailto,
  listStatus,
  listText,
  MAX_QUANTITY,
  memoryKey,
  memoryRecords,
  mergeMemory,
  openItems,
  quantityText,
  rememberedUnit,
  removeDoneItems,
  removeItem,
  replaceItem,
  setItemDone,
  suggestionsFor,
  type ItemDraft,
} from './materialListCalc'
import type { MaterialListTool } from './materialListTool'
import { formatSurveyDate, projectLabel, setProject, surveyFileName } from './surveyCommon'
import { ConfirmDelete, Counter, iconButton, PrintHeader, SAVE_FAILED, SharePanel, useSurveys, WarnText } from './SurveyParts'

const store = { list: listMaterialLists, save: saveMaterialList, remove: deleteMaterialList }

/** Gemerkte Bauvorhaben und Artikel aus dem Gerätespeicher; schlägt das Speichern fehl, gelten sie bis zum Schließen */
function useMemory(initial?: MaterialMemoryRecord[]) {
  const [records, setRecords] = useState(initial)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (initial) return
    let active = true
    listMaterialMemory()
      .then((stored) => {
        if (active) setRecords(stored)
      })
      .catch(() => {
        if (!active) return
        setRecords([])
        setFailed(true)
      })
    return () => {
      active = false
    }
  }, [initial])

  const remember = (next: MaterialMemoryRecord[]) => {
    if (next.length === 0) return
    setRecords((current) => mergeMemory(current ?? [], next))
    saveMaterialMemory(next).catch(() => setFailed(true))
  }
  const forget = (key: string) => {
    setRecords((current) => (current ?? []).filter((record) => record.key !== key))
    deleteMaterialMemory(key).catch(() => setFailed(true))
  }
  return { records, failed, remember, forget }
}

/** Artikel mit Menge und Einheit eingeben; ein früherer Artikel bringt seine zuletzt genutzte Einheit mit */
function ItemForm({
  initial,
  editing,
  memory,
  onForget,
  onSubmit,
  onCancel,
}: {
  initial: ItemDraft
  editing: boolean
  memory: readonly MaterialMemoryRecord[]
  onForget: (name: string) => void
  onSubmit: (draft: ItemDraft) => void
  onCancel?: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const [missingName, setMissingName] = useState(false)
  const id = useId()
  const change = (next: Partial<ItemDraft>) => {
    setDraft((current) => ({ ...current, ...next }))
    setMissingName(false)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const clean = cleanDraft(draft)
    if (!clean) return setMissingName(true)
    onSubmit(clean)
    if (!editing) setDraft(EMPTY_ITEM_DRAFT)
  }

  return (
    <form onSubmit={submit} noValidate className={editing ? 'w-full py-3' : 'mt-4 border-t border-edge pt-3'}>
      <h3 className="text-lg font-bold">{editing ? 'Artikel ändern' : 'Artikel hinzufügen'}</h3>

      <label htmlFor={`${id}-name`} className="mt-2 block font-semibold">
        Artikel
      </label>
      <SuggestInput
        id={`${id}-name`}
        value={draft.name}
        placeholder={'z. B. Kugelhahn 1/2"'}
        onChange={(name) => change({ name })}
        onPick={(name) => change({ name, unit: rememberedUnit(memory, name) ?? draft.unit })}
        suggestions={suggestionsFor(memory, 'article', draft.name)}
        listLabel="Frühere Artikel"
        onForget={onForget}
      />

      <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3">
        <div>
          <label htmlFor={`${id}-quantity`} className="block font-semibold">
            Menge
          </label>
          <div className="mt-1">
            <Counter
              id={`${id}-quantity`}
              label="Menge"
              value={draft.quantity}
              min={1}
              max={MAX_QUANTITY}
              onChange={(quantity) => change({ quantity })}
            />
          </div>
        </div>
        <div className="min-w-24 flex-1">
          <label htmlFor={`${id}-unit`} className="block font-semibold">
            Einheit <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id={`${id}-unit`}
            type="text"
            value={draft.unit}
            placeholder="Stück"
            onChange={(event) => change({ unit: event.target.value })}
            autoComplete="off"
            className={`${fieldBase} mt-1 w-full`}
          />
        </div>
      </div>

      <div aria-live="polite">{missingName && <WarnText text="Bitte einen Artikel eintragen." />}</div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" className={`${primaryButton} flex-1`}>
          {editing ? 'Speichern' : 'Hinzufügen'}
        </button>
        {onCancel && (
          <button type="button" className={secondaryButton} onClick={onCancel}>
            Abbrechen
          </button>
        )}
      </div>
    </form>
  )
}

/** Ein Artikel zum Abhaken; Ändern und Löschen erscheinen nicht auf dem Ausdruck */
function ItemRow({
  item,
  onToggle,
  onEdit,
  onRemove,
}: {
  item: MaterialItem
  onToggle: (done: boolean) => void
  onEdit: () => void
  onRemove: () => void
}) {
  const done = item.doneAt !== undefined
  return (
    <li className="flex flex-wrap items-center gap-2 break-inside-avoid">
      <label className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 py-2">
        <input type="checkbox" className="check shrink-0" checked={done} onChange={(event) => onToggle(event.target.checked)} />
        <span className={`min-w-0 [overflow-wrap:anywhere] ${done ? 'done-text' : ''}`}>
          <span className="font-bold tabular-nums">{quantityText(item)}</span> {item.name}
        </span>
      </label>
      <div className="contents print:hidden">
        <button type="button" className={iconButton} aria-label={`${item.name} ändern`} title="Artikel ändern" onClick={onEdit}>
          <PencilIcon className="size-6" />
        </button>
        <ConfirmDelete label={`${item.name} entfernen`} question={`${itemLine(item)} von der Liste entfernen?`} onConfirm={onRemove} />
      </div>
    </li>
  )
}

export function MaterialList({
  tool,
  initialLists,
  initialMemory,
  now: fixedNow,
}: {
  tool: MaterialListTool
  /** Statt des Gerätespeichers (Tests) */
  initialLists?: List[]
  initialMemory?: MaterialMemoryRecord[]
  now?: Date
}) {
  const clock = () => fixedNow ?? new Date()
  const { surveys: lists, saveFailed, update, add, remove } = useSurveys({
    toolId: tool.id,
    store,
    create: createList,
    isEmpty: isEmptyList,
    now: clock,
    initialSurveys: initialLists,
  })
  const memory = useMemory(initialMemory)
  const [chosenId, setChosenId] = useState<string>()
  const [editingId, setEditingId] = useState<string>()
  const [message, setMessage] = useState<string>()
  const id = useId()

  if (lists === undefined || memory.records === undefined) return <p className="mt-6 text-muted">Wird geladen …</p>

  const records = memory.records
  const list = lists.find((candidate) => candidate.id === chosenId) ?? lists[0]!
  const saved = lists.filter((candidate) => !isEmptyList(candidate))
  const open = openItems(list)
  const done = doneItems(list)

  const choose = (listId: string | undefined) => {
    // Ein umbenanntes Bauvorhaben wird beim Verlassen der Liste gemerkt
    if (list.items.length > 0) memory.remember(memoryRecords(list.project, undefined, clock()))
    setChosenId(listId)
    setEditingId(undefined)
    setMessage(undefined)
  }

  const startNew = () => {
    // Eine noch leere Liste wird weiterverwendet statt eine zweite anzulegen
    const blank = lists.find(isEmptyList)
    const next = blank ?? createList(tool.id, clock())
    if (!blank) add(next)
    choose(next.id)
  }

  const addDraft = (draft: ItemDraft) => {
    const result = addItem(list, draft, clock())
    update(result.list)
    memory.remember(memoryRecords(list.project, draft, clock()))
    setMessage(`${result.merged ? 'Stand schon auf der Liste, Menge erhöht' : 'Hinzugefügt'}: ${itemLine(result.item)}`)
  }

  const forget = (kind: MaterialMemoryRecord['kind']) => (text: string) => memory.forget(memoryKey(kind, text))

  const row = (item: MaterialItem) =>
    item.id === editingId ? (
      <li key={item.id}>
        <ItemForm
          initial={draftFromItem(item)}
          editing
          memory={records}
          onForget={forget('article')}
          onSubmit={(draft) => {
            update(replaceItem(list, item.id, draft, clock()))
            memory.remember(memoryRecords(list.project, draft, clock()))
            setEditingId(undefined)
          }}
          onCancel={() => setEditingId(undefined)}
        />
      </li>
    ) : (
      <ItemRow
        key={item.id}
        item={item}
        onToggle={(checked) => update(setItemDone(list, item.id, checked, clock()))}
        onEdit={() => {
          setEditingId(item.id)
          setMessage(undefined)
        }}
        onRemove={() => update(removeItem(list, item.id, clock()))}
      />
    )

  return (
    <section className="mt-6">
      <div className={`p-4 print:hidden ${card}`}>
        <h2 className="text-xl font-bold">Gespeicherte Listen</h2>
        {saved.length === 0 ? (
          <p className="mt-1 text-base text-muted">Noch keine. Eine Liste wird gespeichert, sobald etwas eingetragen ist.</p>
        ) : (
          <ul className="mt-2 divide-y divide-edge">
            {saved.map((candidate) => {
              const selected = candidate.id === list.id
              const label = projectLabel(candidate)
              const date = formatSurveyDate(candidate.createdAt)
              return (
                <li key={candidate.id} className="flex flex-wrap items-center gap-2 py-2">
                  <button
                    type="button"
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => choose(candidate.id)}
                    className={`min-h-12 min-w-0 flex-1 rounded-xl border-2 px-3 py-1 text-left ${selected ? 'border-accent' : 'border-transparent'}`}
                  >
                    <span className="block font-semibold [overflow-wrap:anywhere]">{label}</span>
                    <span className="block text-base text-muted">
                      vom {date} · {listStatus(candidate)}
                    </span>
                  </button>
                  <ConfirmDelete
                    label={`Liste ${label} löschen`}
                    question={`Liste „${label}“ vom ${date} löschen?`}
                    onConfirm={() => {
                      remove(candidate.id)
                      if (selected) {
                        setChosenId(undefined)
                        setEditingId(undefined)
                        setMessage(undefined)
                      }
                    }}
                  />
                </li>
              )
            })}
          </ul>
        )}
        <button type="button" className={`${secondaryButton} mt-3 w-full`} onClick={startNew}>
          Neue Liste
        </button>
      </div>

      {(saveFailed || memory.failed) && <WarnText text={SAVE_FAILED} />}

      <div className={`mt-4 p-4 print:hidden ${card}`}>
        <h2 className="text-xl font-bold">{isEmptyList(list) ? 'Neue Liste' : 'Liste bearbeiten'}</h2>
        <label htmlFor={`${id}-project`} className="mt-3 block font-semibold">
          Bauvorhaben
        </label>
        <SuggestInput
          id={`${id}-project`}
          value={list.project}
          placeholder="z. B. Müller, Hauptstraße 5"
          onChange={(project) => update(setProject(list, project, clock()))}
          suggestions={suggestionsFor(records, 'project', list.project)}
          listLabel="Frühere Bauvorhaben"
          onForget={forget('project')}
        />
        <p className="mt-1 text-base text-muted">Angelegt am {formatSurveyDate(list.createdAt)}.</p>

        <ItemForm
          key={list.id}
          initial={EMPTY_ITEM_DRAFT}
          editing={false}
          memory={records}
          onForget={forget('article')}
          onSubmit={addDraft}
        />
        <p className="mt-2 font-semibold [overflow-wrap:anywhere]" aria-live="polite">
          {message}
        </p>
      </div>

      <PrintHeader survey={list} dateLabel={LIST_DATE_LABEL} />

      <h2 className="mt-6 text-xl font-bold">
        Mitnehmen <span className="font-normal text-muted">({open.length})</span>
      </h2>
      {list.items.length === 0 ? (
        <p className="mt-3 text-muted">Noch keine Artikel auf der Liste.</p>
      ) : open.length === 0 ? (
        <p className="mt-3 font-semibold">Alles erledigt.</p>
      ) : (
        <ul aria-label="Fehlendes Material" className={`mt-3 divide-y divide-edge px-3 ${card}`}>
          {open.map(row)}
        </ul>
      )}

      {done.length > 0 && (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold">
              Erledigt <span className="font-normal text-muted">({done.length})</span>
            </h2>
            <button
              type="button"
              className={`${secondaryButton} print:hidden`}
              onClick={() => {
                if (done.some((item) => item.id === editingId)) setEditingId(undefined)
                update(removeDoneItems(list, clock()))
              }}
            >
              Erledigte entfernen
            </button>
          </div>
          <ul aria-label="Erledigtes Material" className={`mt-3 divide-y divide-edge px-3 ${card}`}>
            {done.map(row)}
          </ul>
        </>
      )}

      <SharePanel
        disabled={list.items.length === 0}
        title={`${tool.title}: ${projectLabel(list)}`}
        fileName={surveyFileName(tool.id, list)}
        csv={() => listCsv(tool, list)}
        text={() => listText(tool, list)}
        mailto={(recipients) => listMailto(tool, list, recipients)}
        mailContent="die Materialliste"
      />

      <p className="mt-8 text-base print:hidden">{tool.closingNote}</p>
    </section>
  )
}
