import { sortTopicTags, topicTagLabel, type TopicTag } from '../content/schema/topicTags'

// Eigene Farbe je Fachgebiet; hell: zarter Grund mit dunkler Schrift, dunkel umgekehrt (Kontrast > 7:1).
// Klassen ausgeschrieben, damit Tailwind sie findet.
const TAG_COLORS: Record<TopicTag, string> = {
  heizung: 'border-red-300 bg-red-100 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200',
  sanitaer: 'border-blue-300 bg-blue-100 text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200',
  trinkwasser: 'border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200',
  abwasser: 'border-amber-900 bg-amber-800 text-white dark:border-amber-700 dark:bg-amber-900 dark:text-amber-50',
  lueftung: 'border-green-300 bg-green-100 text-green-900 dark:border-green-700 dark:bg-green-950 dark:text-green-200',
  klima: 'border-teal-300 bg-teal-100 text-teal-900 dark:border-teal-700 dark:bg-teal-950 dark:text-teal-200',
  kaelte: 'border-cyan-300 bg-cyan-100 text-cyan-900 dark:border-cyan-700 dark:bg-cyan-950 dark:text-cyan-200',
  solar: 'border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-200',
  strom: 'border-yellow-400 bg-yellow-100 text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200',
  kundendienst:
    'border-purple-300 bg-purple-100 text-purple-900 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-200',
  planung: 'border-pink-300 bg-pink-100 text-pink-900 dark:border-pink-700 dark:bg-pink-950 dark:text-pink-200',
  // Neutrales Grau: tritt hinter die Fachgebiete zurück
  allgemein: 'border-zinc-400 bg-zinc-200 text-zinc-900 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100',
}

/** Farbklassen eines Tags, z. B. für den gewählten Themen-Filter der Suche */
export const topicTagColor = (tag: TopicTag): string => TAG_COLORS[tag]

/**
 * Farbige Themen-Tags eines Tools oder Lexikon-Begriffs, z. B. „Heizung“ und „Kundendienst“.
 * Nur span-Elemente: steht in der Liste innerhalb eines Links.
 */
export function TopicTags({ tags, stacked = false }: { tags: readonly TopicTag[]; /** untereinander, rechtsbündig */ stacked?: boolean }) {
  return (
    <span className={stacked ? 'flex flex-col items-end gap-1.5' : 'flex flex-wrap gap-1.5'}>
      <span className="sr-only">Themen:</span>
      {sortTopicTags(tags).map((tag) => (
        <span key={tag} className={`rounded-full border px-2.5 py-0.5 text-sm font-semibold ${TAG_COLORS[tag]}`}>
          {topicTagLabel(tag)}
        </span>
      ))}
    </span>
  )
}
