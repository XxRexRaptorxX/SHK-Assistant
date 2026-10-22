// Erzeugt Logo und App-Icons aus einer SVG-Vorlage (nachgezeichnet nach dem Style-Guide des Inhabers):
// Dach über drei glänzenden Säulen – Sanitär (Tropfen), Heizung (Flamme), Klima (Schneeflocke) –
// auf dunkelblauer Kachel mit Rand im Verlauf Blau → Gelb.
// PNGs rendert ein vorhandener Chromium-Browser (Edge/Chrome) im Headless-Modus, ohne Zusatzpakete.
// Aufruf: npm run icons   (Browserpfad notfalls per Umgebungsvariable CHROME_PATH)

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

function snowflake(cx: number, cy: number, r: number): string {
  const lines: string[] = []
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    lines.push(`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`)
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2
    const [ex, ey] = [cx + r * Math.cos(a), cy + r * Math.sin(a)]
    line(cx, cy, ex, ey)
    // Seitenäste
    const [bx, by] = [cx + r * 0.58 * Math.cos(a), cy + r * 0.58 * Math.sin(a)]
    for (const side of [-1, 1]) {
      const b = a + (side * Math.PI) / 4
      line(bx, by, bx + r * 0.36 * Math.cos(b), by + r * 0.36 * Math.sin(b))
    }
  }
  return `<path d="${lines.join('')}" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`
}

const PILLARS = {
  blue: 'M118 256L186 206V400H146Q118 400 118 372Z',
  orange: 'M216 190L256 160L296 190V400H216Z',
  teal: 'M326 206L394 256V372Q394 400 366 400H326Z',
}

/** Bildmarke im 512er-Raster, Mittelpunkt etwa (256, 252) */
const mark = `
  <defs>
    <linearGradient id="blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a9bff"/><stop offset="1" stop-color="#0f5bd6"/></linearGradient>
    <linearGradient id="orange" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd21a"/><stop offset="0.45" stop-color="#ff9500"/><stop offset="1" stop-color="#ff5a0a"/></linearGradient>
    <linearGradient id="teal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2fd0cf"/><stop offset="1" stop-color="#0b8592"/></linearGradient>
    <linearGradient id="roof" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1f6fe8"/><stop offset="0.5" stop-color="#3d8cff"/><stop offset="1" stop-color="#1f6fe8"/></linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.45"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="drop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#cfe6ff"/></linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="9" result="blur"/>
      <feFlood flood-color="#2f7bff" flood-opacity="0.75"/>
      <feComposite in2="blur" operator="in" result="halo"/>
      <feMerge><feMergeNode in="halo"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g filter="url(#glow)">
    <path d="M88 232L256 108L424 232" fill="none" stroke="url(#roof)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M100 222L256 106L412 222" fill="none" stroke="#9cc6ff" stroke-opacity="0.5" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <g stroke-width="16" stroke-linejoin="round">
      <path d="${PILLARS.blue}" fill="url(#blue)" stroke="url(#blue)"/>
      <path d="${PILLARS.orange}" fill="url(#orange)" stroke="url(#orange)"/>
      <path d="${PILLARS.teal}" fill="url(#teal)" stroke="url(#teal)"/>
    </g>
  </g>
  <g fill="url(#gloss)">
    <path d="${PILLARS.blue}"/><path d="${PILLARS.orange}"/><path d="${PILLARS.teal}"/>
  </g>
  <path d="M152 284C152 284 127 316 127 336A25 25 0 0 0 177 336C177 316 152 284 152 284Z" fill="url(#drop)"/>
  <path d="M256 236C262 262 292 276 292 316C292 346 276 366 256 366C236 366 220 346 220 318C220 296 232 284 238 266C246 280 248 292 256 298C262 280 258 258 256 236Z" fill="#fff6e0"/>
  <path d="M256 314C262 326 273 332 273 345C273 357 265 364 256 364C247 364 239 357 239 345C239 332 250 326 256 314Z" fill="#ff7a12"/>
  ${snowflake(360, 322, 30)}
`

const tileDefs = `
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#132552"/><stop offset="1" stop-color="#081128"/></linearGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f7bff"/><stop offset="0.45" stop-color="#2f7bff"/><stop offset="0.85" stop-color="#ffc400"/></linearGradient>
    <radialGradient id="halo" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stop-color="#2f7bff" stop-opacity="0.35"/><stop offset="1" stop-color="#2f7bff" stop-opacity="0"/></radialGradient>
  </defs>`

/**
 * Icon auf dunkelblauer Kachel.
 * rounded: abgerundete Kachel mit Rand Blau → Gelb (Favicon, PWA); sonst vollflächig ohne Rand
 * (maskierbar/iOS, dort rundet das System selbst ab).
 */
function iconSvg({ rounded, scale }: { rounded: boolean; scale: number }): string {
  const background = rounded
    ? '<rect width="512" height="512" rx="112" fill="url(#tile)"/><rect width="512" height="512" rx="112" fill="url(#halo)"/>' +
      '<rect x="8" y="8" width="496" height="496" rx="104" fill="none" stroke="url(#rim)" stroke-width="14"/>'
    : '<rect width="512" height="512" fill="url(#tile)"/><rect width="512" height="512" fill="url(#halo)"/>'
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${tileDefs}${background}` +
    `<g transform="translate(256 262) scale(${scale}) translate(-256 -252)">${mark}</g></svg>\n`
  )
}

function findBrowser(): string {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ]
  const found = candidates.find((candidate) => candidate && existsSync(candidate))
  if (!found) throw new Error('Kein Chromium-Browser gefunden. Pfad per CHROME_PATH angeben.')
  return found
}

function renderPng(browser: string, svg: string, size: number, target: string, transparent: boolean) {
  const dir = mkdtempSync(path.join(tmpdir(), 'shk-icon-'))
  try {
    const html = path.join(dir, 'icon.html')
    writeFileSync(
      html,
      `<!doctype html><html><body style="margin:0;background:transparent">` +
        svg.replace('<svg ', `<svg width="${size}" height="${size}" style="display:block" `) +
        `</body></html>`,
    )
    execFileSync(browser, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--user-data-dir=${path.join(dir, 'profile')}`,
      `--window-size=${size},${size}`,
      ...(transparent ? ['--default-background-color=00000000'] : []),
      `--screenshot=${target}`,
      pathToFileURL(html).href,
    ], { stdio: 'ignore' })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const publicDir = fileURLToPath(new URL('../public/', import.meta.url))
const tile = iconSvg({ rounded: true, scale: 0.88 })
// Maskierbar: Motiv innerhalb der Safe Zone (Kreis mit 80 % Durchmesser)
const maskable = iconSvg({ rounded: false, scale: 0.66 })
// iOS füllt Transparenz schwarz: vollflächig dunkelblau
const apple = iconSvg({ rounded: false, scale: 0.8 })

writeFileSync(path.join(publicDir, 'favicon.svg'), tile)
const browser = findBrowser()
renderPng(browser, tile, 192, path.join(publicDir, 'pwa-192x192.png'), true)
renderPng(browser, tile, 512, path.join(publicDir, 'pwa-512x512.png'), true)
renderPng(browser, maskable, 512, path.join(publicDir, 'maskable-512x512.png'), false)
renderPng(browser, apple, 180, path.join(publicDir, 'apple-touch-icon.png'), false)
console.log(`Icons erzeugt in public/ (gerendert mit ${path.basename(browser)})`)
