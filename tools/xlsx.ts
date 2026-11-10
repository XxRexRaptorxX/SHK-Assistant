// Liest ein Tabellenblatt aus einer .xlsx-Datei als Zeilen mit Zelltexten. Bewusst klein gehalten (nur node:zlib,
// keine Abhängigkeit): genug für einfache Datenblätter wie das Weekly Oil Bulletin, keine Formeln oder Formate.

import { inflateRawSync } from 'node:zlib'

/** Dateien eines ZIP-Archivs (über das zentrale Verzeichnis), entpackt als Text */
function unzipText(data: Uint8Array): Map<string, string> {
  const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (end === -1) throw new Error('Keine ZIP-Datei')
  const count = buffer.readUInt16LE(end + 10)
  let offset = buffer.readUInt32LE(end + 16)
  const files = new Map<string, string>()
  for (let index = 0; index < count; index++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('ZIP-Verzeichnis beschädigt')
    const method = buffer.readUInt16LE(offset + 10)
    const size = buffer.readUInt32LE(offset + 20)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const local = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28)
    const raw = buffer.subarray(start, start + size)
    if (method === 0 || method === 8) files.set(name, (method === 8 ? inflateRawSync(raw) : raw).toString('utf8'))
    offset += 46 + nameLength + extraLength + commentLength
  }
  return files
}

const decodeXml = (value: string) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&')

/** Spaltenbuchstaben → Index, z. B. A → 0, AB → 27 */
const columnIndex = (letters: string) => [...letters].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1

/** Zeilen des n-ten Tabellenblatts (1 = erstes); leere Zellen sind leere Texte */
export function readXlsxRows(data: Uint8Array, sheet = 1): string[][] {
  const files = unzipText(data)
  const sheetXml = files.get(`xl/worksheets/sheet${sheet}.xml`)
  if (!sheetXml) throw new Error(`Tabellenblatt ${sheet} fehlt`)
  const shared = [...(files.get('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((item) =>
    [...item[1]!.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1]!)).join(''),
  )
  return [...sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((row) => {
    const cells: string[] = []
    for (const cell of row[1]!.matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, letters, attributes, inner = ''] = cell
      const type = /t="(\w+)"/.exec(attributes!)?.[1]
      const value = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1]
      const inline = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner)?.[1]
      const text = type === 's' && value !== undefined ? (shared[Number(value)] ?? '') : decodeXml(value ?? inline ?? '')
      cells[columnIndex(letters!)] = text
    }
    return Array.from(cells, (cell) => cell ?? '')
  })
}
