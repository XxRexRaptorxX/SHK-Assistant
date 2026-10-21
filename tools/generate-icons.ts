// Erzeugt Logo und App-Icons aus einer SVG-Vorlage (nachgezeichnet nach dem Logo-Entwurf):
// Dach über drei Säulen – Sanitär (Tropfen), Heizung (Flamme), Klima (Schneeflocke).
// PNGs rendert ein vorhandener Chromium-Browser (Edge/Chrome) im Headless-Modus, ohne Zusatzpakete.
// Aufruf: npm run icons   (Browserpfad notfalls per Umgebungsvariable CHROME_PATH)

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const NAVY = '#14335c'

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

/** Bildmarke im 512er-Raster, Mittelpunkt etwa (256, 252) */
const mark = `
  <defs>
    <linearGradient id="blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b8ef2"/><stop offset="1" stop-color="#1462c4"/></linearGradient>
    <linearGradient id="orange" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9b20"/><stop offset="1" stop-color="#ef461c"/></linearGradient>
    <linearGradient id="teal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#24b5b9"/><stop offset="1" stop-color="#0e8592"/></linearGradient>
  </defs>
  <path d="M88 232L256 108L424 232" fill="none" stroke="${NAVY}" stroke-width="38" stroke-linecap="round" stroke-linejoin="round"/>
  <g stroke-width="16" stroke-linejoin="round">
    <path d="M118 256L186 206V400H146Q118 400 118 372Z" fill="url(#blue)" stroke="url(#blue)"/>
    <path d="M216 190L256 160L296 190V400H216Z" fill="url(#orange)" stroke="url(#orange)"/>
    <path d="M326 206L394 256V372Q394 400 366 400H326Z" fill="url(#teal)" stroke="url(#teal)"/>
  </g>
  <path d="M152 284C152 284 127 316 127 336A25 25 0 0 0 177 336C177 316 152 284 152 284Z" fill="#fff"/>
  <path d="M256 236C262 262 292 276 292 316C292 346 276 366 256 366C236 366 220 346 220 318C220 296 232 284 238 266C246 280 248 292 256 298C262 280 258 258 256 236Z" fill="#fff"/>
  <path d="M256 314C262 326 273 332 273 345C273 357 265 364 256 364C247 364 239 357 239 345C239 332 250 326 256 314Z" fill="#f26a1b"/>
  ${snowflake(360, 322, 30)}
`

/** Icon mit weißem Hintergrund; rounded = abgerundete Kachel, sonst vollflächig (maskierbar/iOS) */
function iconSvg({ rounded, scale }: { rounded: boolean; scale: number }): string {
  const background = rounded
    ? '<rect width="512" height="512" rx="112" fill="#fff"/>'
    : '<rect width="512" height="512" fill="#fff"/>'
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${background}` +
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
const tile = iconSvg({ rounded: true, scale: 0.86 })
// Maskierbar: Motiv innerhalb der Safe Zone (Kreis mit 80 % Durchmesser)
const maskable = iconSvg({ rounded: false, scale: 0.66 })
// iOS füllt Transparenz schwarz: vollflächig weiß
const apple = iconSvg({ rounded: false, scale: 0.8 })

writeFileSync(path.join(publicDir, 'favicon.svg'), tile)
const browser = findBrowser()
renderPng(browser, tile, 192, path.join(publicDir, 'pwa-192x192.png'), true)
renderPng(browser, tile, 512, path.join(publicDir, 'pwa-512x512.png'), true)
renderPng(browser, maskable, 512, path.join(publicDir, 'maskable-512x512.png'), false)
renderPng(browser, apple, 180, path.join(publicDir, 'apple-touch-icon.png'), false)
console.log(`Icons erzeugt in public/ (gerendert mit ${path.basename(browser)})`)
