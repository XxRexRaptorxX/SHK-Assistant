import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { parseEdition } from './src/config/editions.ts'
import { parseSiteUrl, SEO_ROOT_FILES, SEO_SECTIONS } from './src/config/seo.ts'
import { collections } from './src/content/collections.ts'
import { contentPlugin } from './tools/vite-plugin-content.ts'
import { seoPlugin } from './tools/vite-plugin-seo.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const edition = parseEdition(env.VITE_EDITION)
  const contentDir = fileURLToPath(new URL('./content', import.meta.url))
  const seoDirs = SEO_SECTIONS.map((section) => section.dir)

  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    version: string
  }

  return {
    // Relative Pfade: läuft auf jedem Hoster, auch in Unterverzeichnissen
    base: './',
    // Versionsnummer für "Über die App" in den Einstellungen
    define: { __APP_VERSION__: JSON.stringify(version) },
    plugins: [
      react(),
      tailwindcss(),
      contentPlugin({ contentDir, edition, collections }),
      seoPlugin({ contentDir, edition, collections, siteUrl: parseSiteUrl(env.VITE_SITE_URL) }),
      VitePWA({
        // Registrierung in src/main.tsx (virtual:pwa-register). Nur so setzt das Plugin
        // skipWaiting/clientsClaim; sonst bleibt ein Update wartend, bis alle Tabs zu sind.
        registerType: 'autoUpdate',
        // Icons und Assets erfasst bereits workbox.globPatterns (sonst doppelte Precache-Einträge)
        includeManifestIcons: false,
        manifest: {
          id: './',
          name: 'SHK-Assistant',
          short_name: 'SHK-Assistant',
          description: 'Werkzeugkasten für Heizungsbauer – von Heizungsbauern, für Heizungsbauern!',
          lang: 'de',
          start_url: './',
          scope: './',
          display: 'standalone',
          theme_color: '#e9edf3',
          background_color: '#0b0f17',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Offline-first: alles, was der Build erzeugt, wird vorgecacht
          // (manifest.webmanifest trägt das Plugin selbst ein)
          globPatterns: ['**/*.{html,js,css,svg,png,webp,ico,json,woff2}'],
          // Die Suchmaschinen-Seiten braucht die App nicht (sie zeigt dieselben Inhalte selbst):
          // nicht vorcachen und nicht auf die App umleiten, sonst sehen Besucher mit installiertem
          // Service Worker dort eine kaputte Seite.
          globIgnores: seoDirs.map((dir) => `${dir}/**`),
          navigateFallbackDenylist: [
            new RegExp(`/(?:${seoDirs.join('|')})/`),
            new RegExp(`/(?:${SEO_ROOT_FILES.join('|').replaceAll('.', '\\.')})$`),
          ],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    test: {
      include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
    },
  }
})
