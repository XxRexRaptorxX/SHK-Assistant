import { Link } from 'react-router'
import { sortTopicTags, topicTagLabel, type TopicTag } from '../content/schema/topicTags'

// Eigene Farbe je Fachgebiet; hell: zarter Grund mit dunkler Schrift, dunkel umgekehrt (Kontrast > 7:1).
// Klassen ausgeschrieben, damit Tailwind sie findet.
const TAG_COLORS: Record<TopicTag, string> = {
  // Heizung, Solar und Planung kräftig und in beiden Modi gleich, damit Rot, Orange und Magenta
  // klar auseinanderzuhalten sind (Kontrast > 7:1). Rahmen deutlich von der Fläche abgesetzt.
  heizung: 'border-red-500 bg-red-800 text-white',
  sanitaer: 'border-blue-300 bg-blue-100 text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200',
  trinkwasser: 'border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200',
  abwasser: 'border-amber-900 bg-amber-800 text-white dark:border-amber-700 dark:bg-amber-900 dark:text-amber-50',
  lueftung: 'border-green-300 bg-green-100 text-green-900 dark:border-green-700 dark:bg-green-950 dark:text-green-200',
  klima: 'border-teal-300 bg-teal-100 text-teal-900 dark:border-teal-700 dark:bg-teal-950 dark:text-teal-200',
  kaelte: 'border-cyan-300 bg-cyan-100 text-cyan-900 dark:border-cyan-700 dark:bg-cyan-950 dark:text-cyan-200',
  // Fläche schon hell: Rahmen dunkler im selben Farbton (heller wirkt er blass und gelblich)
  solar: 'border-orange-900 bg-orange-500 text-black',
  // Kräftiges Gelb in beiden Modi, dunkle Schrift
  strom: 'border-yellow-500 bg-yellow-300 text-yellow-950 dark:border-yellow-300 dark:bg-yellow-400 dark:text-yellow-950',
  kundendienst:
    'border-purple-300 bg-purple-100 text-purple-900 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-200',
  planung: 'border-fuchsia-500 bg-fuchsia-800 text-white',
  // Neutrales Grau: tritt hinter die Fachgebiete zurück
  allgemein: 'border-zinc-400 bg-zinc-200 text-zinc-900 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100',
}

/** Farbklassen eines Tags, z. B. für den gewählten Themen-Filter der Suche */
export const topicTagColor = (tag: TopicTag): string => TAG_COLORS[tag]

/** Übersichtsseite eines Themas mit allen Einträgen, die diesen Tag tragen */
export const TOPIC_PAGE_PATH = '/thema/:tag'
export const topicPath = (tag: TopicTag): string => `/thema/${tag}`

/**
 * Farbige Themen-Tags eines Tools oder Lexikon-Begriffs, z. B. „Heizung“ und „Kundendienst“.
 * Ohne `linked` nur span-Elemente (dürfen innerhalb eines Links stehen). Mit `linked` führt jeder Tag
 * zur Themen-Übersicht – dann nicht in einen anderen Link setzen.
 */
export function TopicTags({
  tags,
  stacked = false,
  linked = false,
  current,
}: {
  tags: readonly TopicTag[]
  /** untereinander, rechtsbündig */
  stacked?: boolean
  /** jeder Tag ist ein Link zur Themen-Übersicht */
  linked?: boolean
  /** gerade geöffnetes Thema (Themen-Übersicht), wird hervorgehoben */
  current?: TopicTag
}) {
  const layout = stacked ? 'flex flex-col items-end' : 'flex flex-wrap'
  return (
    <span className={`${layout} ${linked ? 'gap-2' : 'gap-1.5'}`}>
      <span className="sr-only">Themen:</span>
      {sortTopicTags(tags).map((tag) =>
        linked ? (
          <Link
            key={tag}
            to={topicPath(tag)}
            aria-current={tag === current ? 'page' : undefined}
            className={`rounded-full border px-3 py-1 text-sm font-semibold ${TAG_COLORS[tag]} underline-offset-2 hover:underline${
              tag === current ? ' ring-2 ring-accent ring-offset-2 ring-offset-page' : ''
            }`}
          >
            {topicTagLabel(tag)}
          </Link>
        ) : (
          <span key={tag} className={`rounded-full border px-2.5 py-0.5 text-sm font-semibold ${TAG_COLORS[tag]}`}>
            {topicTagLabel(tag)}
          </span>
        ),
      )}
    </span>
  )
}
