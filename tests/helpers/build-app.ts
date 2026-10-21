import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import type { Edition } from '../../src/config/editions'

export const projectRoot = fileURLToPath(new URL('../..', import.meta.url))

/** Baut die echte App mit vite.config.ts in outDir. */
export async function buildApp(edition: Edition, outDir: string): Promise<void> {
  // process.env hat Vorrang vor .env-Dateien; die Edition daher explizit setzen.
  const previous = process.env.VITE_EDITION
  process.env.VITE_EDITION = edition
  try {
    await build({
      root: projectRoot,
      mode: edition === 'public' ? 'public' : 'production',
      logLevel: 'silent',
      build: { outDir, emptyOutDir: true },
    })
  } finally {
    if (previous === undefined) delete process.env.VITE_EDITION
    else process.env.VITE_EDITION = previous
  }
}

/** Alle Dateien unterhalb von dir als relative Pfade mit "/" */
export function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((dirent) => dirent.isFile())
    .map((dirent) => path.relative(dir, path.join(dirent.parentPath, dirent.name)).split(path.sep).join('/'))
    .sort()
}
