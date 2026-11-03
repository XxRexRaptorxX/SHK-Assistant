import type { ContentData } from '../src/content/collections.ts'
import type { BaseEntry } from '../src/content/schema/base.ts'
import { SEO_SECTIONS, type SeoSection } from '../src/config/seo.ts'
import { formatIsoDate } from '../src/lib/format.ts'
import { splitLinks } from '../src/lib/links.ts'
import { splitSources } from '../src/lib/sources.ts'
import { splitParagraphs, stripEmphasis } from '../src/lib/text.ts'
import { formatUnit } from '../src/lib/units.ts'
import type { ChecklistEntry } from '../src/modules/checklists/schema.ts'
import type { ConverterEntry } from '../src/modules/converter/schema.ts'
import { formatExpression } from '../src/modules/formulas/engine.ts'
import type { FormulaEntry } from '../src/modules/formulas/schema.ts'
import { LEXICON_CATEGORIES } from '../src/modules/lexicon/constants.ts'
import type { LexiconEntry } from '../src/modules/lexicon/schema.ts'
import type { ToolEntry } from '../src/modules/tools/schema.ts'

// Die App läuft über Hash-Adressen (#/lexikon/…), die Suchmaschinen nicht als eigene Seiten
// erfassen. Deshalb entsteht beim Build je geprüftem Eintrag eine kleine statische Seite mit
// eigener Adresse. Alle Texte kommen aus content/; Entwürfe werden nicht veröffentlicht.

export const APP_NAME = 'SHK-Assistant'
export const SITE_DESCRIPTION =
  'Werkzeugkasten für Heizungsbauer: Formeln mit Rechner, Umrechner, Checklisten und Lexikon. Läuft auch offline und lässt sich auf dem Handy installieren.'
export const SOCIAL_IMAGE = 'pwa-512x512.png'
const DESCRIPTION_LENGTH = 155

export interface SeoPage {
  /** Adresse relativ zur App, z. B. "lexikon/abgas/" */
  path: string
  title: string
  description: string
  lastmod?: string
  html: string
}

type SeoContent = Pick<ContentData, SeoSection['collection']>

/** Ein Eintrag in der Form, die alle Seiten gemeinsam haben */
interface SeoItem {
  entry: BaseEntry
  name: string
  title: string
  description: string
  /** Gruppe in der Übersicht des Bereichs */
  group: string
  body: (links: LinkResolver) => string
  jsonLd?: (url: string) => object
}

/** Liefert die relative Adresse eines anderen Eintrags, falls er eine eigene Seite hat */
type LinkResolver = (id: string) => string | undefined

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!)
}

/** Wie src/components/RichText.tsx: Absätze und **fett**, HTML in Inhalten wird nie ausgeführt. */
function richText(text: string): string {
  return splitParagraphs(text)
    .map((paragraph) => {
      const inline = escapeHtml(paragraph)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
      return `<p>${inline}</p>`
    })
    .join('')
}

/** Kurztext für die Trefferliste: reiner Text, an einer Wortgrenze gekürzt. */
export function metaDescription(text: string): string {
  const plain = stripEmphasis(text).replace(/\s+/g, ' ').trim()
  if (plain.length <= DESCRIPTION_LENGTH) return plain
  const cut = plain.slice(0, DESCRIPTION_LENGTH - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:–-]+$/, '')} …`
}

function slugOf(entry: BaseEntry): string {
  return entry.id.slice(entry.id.indexOf('.') + 1)
}

function sourceHtml(source: string): string {
  const items = splitSources(source).map((item) =>
    splitLinks(item)
      .map((part) =>
        part.href
          ? `<a href="${escapeHtml(part.href)}" rel="nofollow noopener">${escapeHtml(part.text)}</a>`
          : escapeHtml(part.text),
      )
      .join(''),
  )
  return items.length > 1 ? `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>` : (items[0] ?? '')
}

function list(items: string[]): string {
  return items.length > 0 ? `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>` : ''
}

function lexiconItem(entry: LexiconEntry, all: readonly LexiconEntry[]): SeoItem {
  const categories = entry.categories.map((key) => LEXICON_CATEGORIES.find((item) => item.key === key)?.label ?? key)
  const initial = entry.term.normalize('NFD').charAt(0).toLocaleUpperCase('de')
  return {
    entry,
    name: entry.term,
    title: `${entry.term} – Erklärung im SHK-Lexikon`,
    description: metaDescription(entry.definition),
    group: /[A-Z]/.test(initial) ? initial : '0–9',
    body: (links) => {
      const related = entry.related.flatMap((id) => {
        const target = all.find((candidate) => candidate.id === id)
        const href = target && links(id)
        return href ? [`<a href="${href}">${escapeHtml(target.term)}</a>`] : []
      })
      return [
        entry.synonyms.length > 0 ? `<p class="muted"><strong>Auch:</strong> ${escapeHtml(entry.synonyms.join(', '))}</p>` : '',
        richText(entry.definition),
        `<p class="muted"><strong>Kategorie:</strong> ${escapeHtml(categories.join(', '))}</p>`,
        related.length > 0 ? `<h2>Siehe auch</h2>${list(related)}` : '',
      ].join('')
    },
    jsonLd: (url) => ({
      '@context': 'https://schema.org',
      '@type': 'DefinedTerm',
      name: entry.term,
      ...(entry.synonyms.length > 0 ? { alternateName: entry.synonyms } : {}),
      description: stripEmphasis(entry.definition),
      inLanguage: 'de',
      url,
    }),
  }
}

function checklistItem(entry: ChecklistEntry): SeoItem {
  const firstPoints = entry.sections.flatMap((section) => section.items).map((item) => item.text)
  return {
    entry,
    name: entry.title,
    title: `Checkliste ${entry.title}`,
    description: metaDescription(entry.description || `Checkliste ${entry.title}: ${firstPoints.join(', ')}`),
    group: entry.category,
    body: () =>
      [
        entry.description ? richText(entry.description) : '',
        ...entry.sections.map(
          (section) =>
            `${section.title ? `<h2>${escapeHtml(section.title)}</h2>` : ''}` +
            list(
              section.items.map(
                (item) =>
                  `${escapeHtml(item.text)}${item.note ? `<br><span class="muted">${escapeHtml(item.note)}</span>` : ''}`,
              ),
            ),
        ),
      ].join(''),
  }
}

function converterItem(entry: ConverterEntry): SeoItem {
  const names = Object.values(entry.names)
  const isTable = entry.kind === 'table'
  return {
    entry,
    name: entry.title,
    title: isTable ? `${entry.title} – Tabelle` : `${entry.title} umrechnen`,
    description: metaDescription(
      [
        isTable ? `${entry.title}: Tabelle zum Nachschlagen.` : `${entry.title} umrechnen${names.length > 0 ? `: ${names.join(', ')}` : ''}.`,
        entry.description,
      ].join(' '),
    ),
    group: entry.category || 'Allgemein',
    body: () =>
      [
        entry.description ? richText(entry.description) : '',
        names.length > 0 ? `<h2>Enthaltene Einheiten</h2>${list(names.map(escapeHtml))}` : '',
        isTable
          ? `<div class="scroll"><table><thead><tr>${entry.columns.map((column) => `<th scope="col">${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${entry.rows
              .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
              .join('')}</tbody></table></div>`
          : '',
      ].join(''),
  }
}

/** Formel als lesbarer Text wie in der App: ΔT statt dT, π statt pi, d² statt d ^ 2 */
function formulaText(entry: FormulaEntry): string {
  return formatExpression(entry)
    .replace(/ \^ 2\b/g, '²')
    .replace(/ \^ 3\b/g, '³')
    .replace(/\bsqrt\(/g, '√(')
}

/** Konstante wie "9.80665 m/s^2" lesbar; Ausdrücke wie sqrt(3) stehen schon im Formelzeichen (√3) */
function constantText(value: string): string {
  const match = /^([\d.]+)\s*(.*)$/.exec(value)
  return match ? `${match[1]!.replace('.', ',')} ${formatUnit(match[2]!)}`.trim() : ''
}

function formulaItem(entry: FormulaEntry): SeoItem {
  const quantity = (item: { symbol: string; label?: string; name: string }, value: string) =>
    `${escapeHtml(item.label ?? item.symbol)}: ${escapeHtml(item.name)}${value ? ` (${escapeHtml(value)})` : ''}`
  return {
    entry,
    name: entry.title,
    title: `${entry.title} – Formel und Rechner`,
    description: metaDescription(entry.description),
    group: entry.category || 'Allgemein',
    body: () =>
      [
        richText(entry.description),
        entry.result && entry.expression && !entry.hideFormula
          ? `<h2>Formel</h2><p><code>${escapeHtml(entry.result.label ?? entry.result.symbol)} = ${escapeHtml(formulaText(entry))}</code></p>`
          : '',
        entry.variables.length > 0 || entry.constants.length > 0
          ? `<h2>Größen</h2>${list([
              ...entry.variables.map((variable) => quantity(variable, formatUnit(variable.unit))),
              ...entry.constants.map((constant) => quantity(constant, constantText(constant.value))),
              ...(entry.result ? [quantity(entry.result, formatUnit(entry.result.unit))] : []),
            ])}`
          : '',
      ].join(''),
  }
}

function toolItem(entry: ToolEntry): SeoItem {
  return {
    entry,
    name: entry.title,
    title: `${entry.title} – Tool für Heizungsbauer`,
    description: metaDescription(entry.summary),
    group: entry.category || 'Allgemein',
    body: () => `<p>${escapeHtml(entry.summary)}</p>${entry.description ? richText(entry.description) : ''}`,
  }
}

function sectionItems(section: SeoSection, data: SeoContent): SeoItem[] {
  switch (section.collection) {
    case 'lexicon':
      return data.lexicon.map((entry) => lexiconItem(entry, data.lexicon))
    case 'checklists':
      return data.checklists.map(checklistItem)
    case 'converter':
      return data.converter.map(converterItem)
    case 'formulas':
      return data.formulas.map(formulaItem)
    case 'tools':
      return data.tools.map(toolItem)
  }
}

function jsonLdScript(data: object): string {
  // "<" maskieren, damit Inhalte das script-Element nicht beenden können
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
}

const STYLES = `:root{color-scheme:light dark;--page:#eef2f8;--surface:#fff;--ink:#0b1220;--muted:#3c4659;--edge:#d3dae6;--accent:#0047c2;--accent-ink:#fff}
@media (prefers-color-scheme:dark){:root{--page:#0b0f17;--surface:#151b26;--ink:#f4f6fb;--muted:#b8c1d1;--edge:#273145;--accent:#ffd400;--accent-ink:#0b0f17}}
*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--ink);font:1.125rem/1.6 system-ui,sans-serif;overflow-wrap:anywhere}
a{color:var(--accent)}.wrap{max-width:48rem;margin:0 auto;padding:0 1rem}
header{background:var(--surface);border-bottom:3px solid var(--accent)}header a{display:flex;align-items:center;gap:.5rem;min-height:4rem;color:var(--ink);font-weight:800;text-decoration:none}header img{width:2.25rem;height:2.25rem}
nav.crumbs{margin:1rem 0;color:var(--muted);font-size:1rem}nav.crumbs a{display:inline-block;padding:.5rem 0}
h1{font-size:1.75rem;line-height:1.25;margin:.5rem 0 1rem}h2{font-size:1.3rem;margin:2rem 0 .5rem}
.muted{color:var(--muted)}li{margin:.6rem 0}li a{padding:.5rem 0}
.groups a{margin-right:.75rem;display:inline-block;padding:.5rem .25rem}
.cta{display:inline-flex;align-items:center;min-height:3rem;margin:1.5rem 0;padding:.5rem 1.25rem;border-radius:.75rem;background:var(--accent);color:var(--accent-ink);font-weight:700;text-decoration:none}
.source{margin-top:2.5rem;padding-top:1rem;border-top:2px solid var(--edge);color:var(--muted);font-size:1rem}.source ul{margin:.25rem 0;padding-left:1.25rem}
.scroll{overflow-x:auto}table{border-collapse:collapse;background:var(--surface)}th,td{border:1px solid var(--edge);padding:.5rem .75rem;text-align:left;overflow-wrap:normal}
footer{margin:3rem 0 2rem;padding-top:1rem;border-top:1px solid var(--edge);font-size:1rem}footer a{display:inline-block;margin-right:1rem;padding:.5rem 0}`

interface PageFrame {
  path: string
  /** Überschrift der Seite */
  heading: string
  title: string
  description: string
  /** Pfad von der Startseite bis zur Seite selbst (ohne Link) */
  crumbs: { name: string; path?: string }[]
  /** Route in der App, z. B. "/lexikon/abgas" */
  appRoute: string
  body: string
  jsonLd?: object
  siteUrl: string
}

function renderPage(frame: PageFrame): string {
  const { path, heading, title, description, crumbs, appRoute, body, jsonLd, siteUrl } = frame
  const up = '../'.repeat(path.split('/').filter(Boolean).length)
  const url = `${siteUrl}${path}`
  const fullTitle = `${title} | ${APP_NAME}`
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      ...(crumb.path !== undefined ? { item: `${siteUrl}${crumb.path}` } : {}),
    })),
  }
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(fullTitle)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(url)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${APP_NAME}">
<meta property="og:locale" content="de_DE">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:image" content="${escapeHtml(siteUrl + SOCIAL_IMAGE)}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="${up}favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${up}apple-touch-icon.png">
<style>${STYLES}</style>
${jsonLdScript(breadcrumbs)}${jsonLd ? `\n${jsonLdScript(jsonLd)}` : ''}
</head>
<body>
<header><div class="wrap"><a href="${up}"><img src="${up}favicon.svg" alt="" width="36" height="36">${APP_NAME}</a></div></header>
<div class="wrap">
<nav class="crumbs" aria-label="Brotkrumen">${crumbs
    .map((crumb) =>
      crumb.path !== undefined ? `<a href="${up}${crumb.path}">${escapeHtml(crumb.name)}</a>` : escapeHtml(crumb.name),
    )
    .join(' › ')}</nav>
<main>
<h1>${escapeHtml(heading)}</h1>
${body}
<p><a class="cta" href="${up}#${appRoute}">In der App öffnen</a></p>
</main>
<footer><a href="${up}#/impressum">Impressum</a><a href="${up}#/datenschutz">Datenschutz</a><a href="${up}#/haftung">Haftungshinweis</a></footer>
</div>
</body>
</html>
`
}

function latest(dates: (string | undefined)[]): string | undefined {
  return dates.reduce<string | undefined>((max, date) => (date && (!max || date > max) ? date : max), undefined)
}

/** Erzeugt alle Seiten. data enthält die Einträge der Edition; hier fallen noch die Entwürfe weg. */
export function buildSeoPages(data: SeoContent, siteUrl: string): SeoPage[] {
  const verified: SeoContent = {
    lexicon: data.lexicon.filter((entry) => entry.status === 'verified'),
    checklists: data.checklists.filter((entry) => entry.status === 'verified'),
    converter: data.converter.filter((entry) => entry.status === 'verified'),
    formulas: data.formulas.filter((entry) => entry.status === 'verified'),
    tools: data.tools.filter((entry) => entry.status === 'verified'),
  }
  const start = { name: 'Start', path: '' }
  const pages: SeoPage[] = []

  for (const section of SEO_SECTIONS) {
    const items = sectionItems(section, verified).sort((a, b) => a.name.localeCompare(b.name, 'de'))
    if (items.length === 0) continue
    const hubPath = `${section.dir}/`

    const groups = new Map<string, SeoItem[]>()
    for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item])
    const groupNames = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'de'))
    const hasGroups = groupNames.some((name) => name !== '')
    const anchor = (name: string) => `g-${encodeURIComponent(name)}`
    const hubDescription = metaDescription(
      `${section.heading}: ${items.slice(0, 12).map((item) => item.name).join(', ')} …`,
    )
    const hubLastmod = latest(items.map((item) => item.entry.verifiedAt))
    const hubTitle = `${section.heading} (${items.length})`

    pages.push({
      path: hubPath,
      title: hubTitle,
      description: hubDescription,
      lastmod: hubLastmod,
      html: renderPage({
        path: hubPath,
        heading: section.heading,
        title: hubTitle,
        description: hubDescription,
        crumbs: [start, { name: section.title }],
        appRoute: `/${section.dir}`,
        siteUrl,
        body: [
          hasGroups
            ? `<nav class="groups" aria-label="Gruppen">${groupNames
                .map((name) => `<a href="#${anchor(name)}">${escapeHtml(name)}</a>`)
                .join('')}</nav>`
            : '',
          ...groupNames.map((name) => {
            const links = groups
              .get(name)!
              .map((item) => `<a href="${slugOf(item.entry)}/">${escapeHtml(item.name)}</a>`)
            return `${name ? `<h2 id="${anchor(name)}">${escapeHtml(name)}</h2>` : ''}${list(links)}`
          }),
        ].join(''),
      }),
    })

    const ids = new Set(items.map((item) => item.entry.id))
    const links: LinkResolver = (id) => (ids.has(id) ? `../${id.slice(id.indexOf('.') + 1)}/` : undefined)

    for (const item of items) {
      const slug = slugOf(item.entry)
      const path = `${hubPath}${slug}/`
      const { source, verifiedAt, verifiedBy } = item.entry
      pages.push({
        path,
        title: item.title,
        description: item.description,
        lastmod: verifiedAt,
        html: renderPage({
          path,
          heading: item.name,
          title: item.title,
          description: item.description,
          crumbs: [start, { name: section.title, path: hubPath }, { name: item.name }],
          appRoute: `/${section.dir}/${slug}`,
          siteUrl,
          jsonLd: item.jsonLd?.(`${siteUrl}${path}`),
          body:
            item.body(links) +
            `<div class="source"><strong>Quelle:</strong> ${sourceHtml(source)}<br>` +
            `<strong>Geprüft:</strong> ${escapeHtml(formatIsoDate(verifiedAt))} (${escapeHtml(verifiedBy)})</div>`,
        }),
      })
    }
  }
  return pages
}

/** Bereiche, die in dieser Edition eine Übersichtsseite haben */
export function linkedSections(pages: readonly SeoPage[]): SeoSection[] {
  return SEO_SECTIONS.filter((section) => pages.some((page) => page.path === `${section.dir}/`))
}

export function buildSitemap(pages: readonly SeoPage[], siteUrl: string): string {
  const urls = [
    `<url><loc>${escapeHtml(siteUrl)}</loc></url>`,
    ...pages.map(
      (page) =>
        `<url><loc>${escapeHtml(siteUrl + page.path)}</loc>${page.lastmod ? `<lastmod>${page.lastmod}</lastmod>` : ''}</url>`,
    ),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

export function buildRobots(siteUrl: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`
}

/** Strukturierte Daten der Startseite */
export function appJsonLd(siteUrl: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: APP_NAME,
    description: SITE_DESCRIPTION,
    url: siteUrl,
    inLanguage: 'de',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Alle (Webbrowser)',
    image: `${siteUrl}${SOCIAL_IMAGE}`,
  }
}
