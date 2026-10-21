import { splitParagraphs } from '../lib/text'

// Bewusst kein Markdown: nur Absätze (Leerzeile) und Fettdruck mit **…**.
// Alles andere erscheint als reiner Text, HTML in Inhalten wird nie ausgeführt.

function renderInline(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, index) =>
    index % 2 === 1 ? <strong key={index}>{part}</strong> : part,
  )
}

export function RichText({ text }: { text: string }) {
  return splitParagraphs(text).map((paragraph, index) => (
    <p key={index} className="mt-3 whitespace-pre-line first:mt-0">
      {renderInline(paragraph)}
    </p>
  ))
}
