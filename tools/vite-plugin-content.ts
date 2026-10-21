import path from 'node:path'
import type { Plugin } from 'vite'
import { loadContent, type LoadContentOptions, type LoadedContent } from './content-loader.ts'

const VIRTUAL_ID = 'virtual:content'
const RESOLVED_ID = '\0virtual:content'

/**
 * Stellt die validierten, nach Edition gefilterten Inhalte als Modul "virtual:content" bereit.
 * Interne Einträge werden im public-Build gar nicht erst ins Bundle geschrieben.
 */
export function contentPlugin(options: LoadContentOptions): Plugin {
  let isBuild = false
  let cached: LoadedContent | undefined

  return {
    name: 'shk-content',

    configResolved(config) {
      isBuild = config.command === 'build'
    },

    // Im Build immer validieren, auch wenn (noch) kein Code die Inhalte importiert.
    buildStart() {
      if (isBuild) cached = loadContent(options)
    },

    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined
    },

    load(id) {
      if (id !== RESOLVED_ID) return undefined
      const { data } = isBuild && cached ? cached : loadContent(options)
      return `export default ${JSON.stringify(data)};`
    },

    // Dev-Server: bei Änderungen in content/ neu laden (auch neue/gelöschte Dateien).
    configureServer(server) {
      const contentDir = path.resolve(options.contentDir)
      server.watcher.add(contentDir)
      const onFileEvent = (file: string) => {
        if (!path.resolve(file).startsWith(contentDir + path.sep)) return
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', onFileEvent)
      server.watcher.on('change', onFileEvent)
      server.watcher.on('unlink', onFileEvent)
    },
  }
}
