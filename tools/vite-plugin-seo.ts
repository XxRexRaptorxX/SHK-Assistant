import type { HtmlTagDescriptor, IndexHtmlTransformResult, Plugin } from 'vite'
import { HOME_HEADING } from '../src/config/seo.ts'
import { loadContent, type LoadContentOptions } from './content-loader.ts'
import {
  APP_NAME,
  appJsonLd,
  buildRobots,
  buildSeoPages,
  buildSitemap,
  escapeHtml,
  HOME_TITLE,
  linkedSections,
  SITE_DESCRIPTION,
  SOCIAL_IMAGE,
  type SeoPage,
} from './seo-pages.ts'

export interface SeoPluginOptions extends LoadContentOptions {
  /** Öffentliche Adresse der App mit "/" am Ende */
  siteUrl: string
}

/** Ersetzt genau eine Stelle in index.html und bricht den Build ab, wenn sie fehlt. */
function replaceOnce(html: string, pattern: RegExp, replacement: string): string {
  if (!pattern.test(html)) throw new Error(`index.html: ${pattern} nicht gefunden`)
  return html.replace(pattern, replacement)
}

/**
 * Macht die App für Suchmaschinen auffindbar: Metadaten der Startseite, statische Seiten
 * je geprüftem Eintrag (nur Einträge der Edition), sitemap.xml und robots.txt.
 */
export function seoPlugin({ siteUrl, ...contentOptions }: SeoPluginOptions): Plugin {
  let pages: SeoPage[] = []

  const meta = (attrs: Record<string, string>): HtmlTagDescriptor => ({ tag: 'meta', attrs, injectTo: 'head' })

  return {
    name: 'shk-seo',
    apply: 'build',

    buildStart() {
      const { data } = loadContent(contentOptions)
      pages = buildSeoPages(data as unknown as Parameters<typeof buildSeoPages>[0], siteUrl)
    },

    transformIndexHtml(source): IndexHtmlTransformResult {
      const sections = linkedSections(pages)
      const links = sections
        .map((section) => `<li><a href="./${section.dir}/">${escapeHtml(section.heading)}</a></li>`)
        .join('')
      // Titel und Beschreibung immer aus src/config/seo.ts, damit index.html nicht davon abweicht
      let html = replaceOnce(source, /<title>[^<]*<\/title>/, `<title>${escapeHtml(HOME_TITLE)}</title>`)
      html = replaceOnce(
        html,
        /<meta name="description" content="[^"]*"\s*\/?>/,
        `<meta name="description" content="${escapeHtml(SITE_DESCRIPTION)}" />`,
      )
      const heading = `${HOME_HEADING.name} – ${HOME_HEADING.tagline}`
      return {
        html,
        tags: [
          { tag: 'link', attrs: { rel: 'canonical', href: siteUrl }, injectTo: 'head' },
          meta({ name: 'application-name', content: APP_NAME }),
          meta({ name: 'apple-mobile-web-app-title', content: APP_NAME }),
          meta({ property: 'og:type', content: 'website' }),
          meta({ property: 'og:site_name', content: APP_NAME }),
          meta({ property: 'og:locale', content: 'de_DE' }),
          meta({ property: 'og:title', content: HOME_TITLE }),
          meta({ property: 'og:description', content: SITE_DESCRIPTION }),
          meta({ property: 'og:url', content: siteUrl }),
          meta({ property: 'og:image', content: `${siteUrl}${SOCIAL_IMAGE}` }),
          meta({ property: 'og:image:alt', content: `Logo ${APP_NAME}` }),
          meta({ name: 'twitter:card', content: 'summary' }),
          meta({ name: 'twitter:title', content: HOME_TITLE }),
          meta({ name: 'twitter:description', content: SITE_DESCRIPTION }),
          {
            tag: 'script',
            attrs: { type: 'application/ld+json' },
            children: JSON.stringify(appJsonLd(siteUrl, sections)).replace(/</g, '\u003c'),
            injectTo: 'head',
          },
          // Ohne JavaScript und für Crawler, die es nicht ausführen
          {
            tag: 'noscript',
            children: `<h1>${escapeHtml(heading)}</h1><p>${escapeHtml(SITE_DESCRIPTION)}</p><ul>${links}</ul>`,
            injectTo: 'body-prepend',
          },
        ],
      }
    },

    generateBundle() {
      for (const page of pages) {
        this.emitFile({ type: 'asset', fileName: `${page.path}index.html`, source: page.html })
      }
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: buildSitemap(pages, siteUrl) })
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: buildRobots(siteUrl) })
    },
  }
}
