import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import { parseEdition } from './src/config/editions.ts'
import { collections } from './src/content/collections.ts'
import { contentPlugin } from './tools/vite-plugin-content.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const edition = parseEdition(env.VITE_EDITION)

  return {
    plugins: [
      react(),
      tailwindcss(),
      contentPlugin({
        contentDir: fileURLToPath(new URL('./content', import.meta.url)),
        edition,
        collections,
      }),
    ],
    test: {
      include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
    },
  }
})
