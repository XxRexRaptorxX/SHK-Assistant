import type { HtmlTagDescriptor, Plugin } from 'vite'
import { loadContent, type LoadContentOptions } from './content-loader.ts'
import {
  APP_NAME,
  appJsonLd,
  buildRobots,
  buildSeoPages,
  buildSitemap,
  escapeHtml,
  linkedSections,
  SITE_DESCRIPTION,
  SOCIAL_IMAGE,
  type SeoPage,
} from './seo-pages.ts'

export interface SeoPluginOptions extends LoadContentOptions {
  /** Öffentliche Adresse der App mit "/" am Ende */
  siteUrl: string
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

    transformIndexHtml() {
      const links = linkedSections(pages)
        .map((section) => `<li><a href="./${section.dir}/">${escapeHtml(section.heading)}</a></li>`)
        .join('')
      return [
        { tag: 'link', attrs: { rel: 'canonical', href: siteUrl }, injectTo: 'head' },
        meta({ property: 'og:type', content: 'website' }),
        meta({ property: 'og:site_name', content: APP_NAME }),
        meta({ property: 'og:locale', content: 'de_DE' }),
        meta({ property: 'og:title', content: APP_NAME }),
        meta({ property: 'og:description', content: SITE_DESCRIPTION }),
        meta({ property: 'og:url', content: siteUrl }),
        meta({ property: 'og:image', content: `${siteUrl}${SOCIAL_IMAGE}` }),
        meta({ name: 'twitter:card', content: 'summary' }),
        {
          tag: 'script',
          attrs: { type: 'application/ld+json' },
          children: JSON.stringify(appJsonLd(siteUrl)).replace(/</g, '\\u003c'),
          injectTo: 'head',
        },
        // Ohne JavaScript und für Crawler, die es nicht ausführen
        {
          tag: 'noscript',
          children: `<h1>${APP_NAME}</h1><p>${escapeHtml(SITE_DESCRIPTION)}</p><ul>${links}</ul>`,
          injectTo: 'body-prepend',
        },
      ]
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
