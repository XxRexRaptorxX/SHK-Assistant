/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Versionsnummer aus package.json (vite.config.ts, define) */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_EDITION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
