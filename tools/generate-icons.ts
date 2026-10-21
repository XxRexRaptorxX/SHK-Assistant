// Erzeugt die Platzhalter-Icons (stilisierter Heizkörper) als SVG und PNG in public/.
// Ohne Zusatzpakete: einfache Rechtecke, Kantenglättung per Supersampling, PNG über node:zlib.
// Aufruf: node tools/generate-icons.ts
// Ein eigenes Logo ersetzt später einfach die Dateien in public/.

import { mkdirSync, writeFileSync } from 'node:fs'
import { crc32, deflateSync } from 'node:zlib'

const BACKGROUND = [0x0a, 0x4f, 0x9c] as const
const FOREGROUND = [0xff, 0xff, 0xff] as const

interface RoundedRect {
  x: number
  y: number
  w: number
  h: number
  r: number
}

// Motiv im 512er-Raster, mittig und innerhalb der Safe Zone für maskierbare Icons (Radius 40 %)
const SCALE = 0.86
function scaled(rect: RoundedRect): RoundedRect {
  const c = 256
  return {
    x: c + (rect.x - c) * SCALE,
    y: c + (rect.y - c) * SCALE,
    w: rect.w * SCALE,
    h: rect.h * SCALE,
    r: rect.r * SCALE,
  }
}

const shapes: RoundedRect[] = [
  // vier Glieder
  ...[0, 1, 2, 3].map((i) => ({ x: 102 + i * 84, y: 140, w: 56, h: 252, r: 28 })),
  // Sammler oben und unten
  { x: 102, y: 176, w: 308, h: 30, r: 8 },
  { x: 102, y: 326, w: 308, h: 30, r: 8 },
  // Anschlussstutzen
  { x: 62, y: 326, w: 48, h: 30, r: 6 },
  { x: 402, y: 176, w: 48, h: 30, r: 6 },
].map(scaled)

function insideRoundedRect(px: number, py: number, { x, y, w, h, r }: RoundedRect): boolean {
  if (px < x || px > x + w || py < y || py > y + h) return false
  const cx = Math.min(Math.max(px, x + r), x + w - r)
  const cy = Math.min(Math.max(py, y + r), y + h - r)
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r
}

function coverage(px: number, py: number, unit: number): number {
  const samples = 4
  let hits = 0
  for (let sy = 0; sy < samples; sy++) {
    for (let sx = 0; sx < samples; sx++) {
      const x = (px + (sx + 0.5) / samples) * unit
      const y = (py + (sy + 0.5) / samples) * unit
      if (shapes.some((shape) => insideRoundedRect(x, y, shape))) hits++
    }
  }
  return hits / (samples * samples)
}

function renderPng(size: number): Buffer {
  const unit = 512 / size
  const rowLength = size * 4 + 1
  const raw = Buffer.alloc(rowLength * size)
  for (let y = 0; y < size; y++) {
    raw[y * rowLength] = 0 // Filter: none
    for (let x = 0; x < size; x++) {
      const a = coverage(x, y, unit)
      const offset = y * rowLength + 1 + x * 4
      for (let c = 0; c < 3; c++) {
        raw[offset + c] = Math.round(BACKGROUND[c]! * (1 - a) + FOREGROUND[c]! * a)
      }
      raw[offset + 3] = 255
    }
  }

  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([length, body, crc])
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // Bittiefe
  header[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function renderSvg(): string {
  const hex = (rgb: readonly number[]) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`
  const round = (v: number) => Math.round(v * 100) / 100
  const rects = shapes
    .map((s) => `<rect x="${round(s.x)}" y="${round(s.y)}" width="${round(s.w)}" height="${round(s.h)}" rx="${round(s.r)}"/>`)
    .join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
    `<rect width="512" height="512" rx="96" fill="${hex(BACKGROUND)}"/>` +
    `<g fill="${hex(FOREGROUND)}">${rects}</g></svg>\n`
  )
}

const outDir = new URL('../public/', import.meta.url)
mkdirSync(outDir, { recursive: true })
writeFileSync(new URL('favicon.svg', outDir), renderSvg())
for (const [name, size] of [
  ['pwa-192x192.png', 192],
  ['pwa-512x512.png', 512],
  ['apple-touch-icon.png', 180],
] as const) {
  writeFileSync(new URL(name, outDir), renderPng(size))
}
console.log('Icons erzeugt in public/')
