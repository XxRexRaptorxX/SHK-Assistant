import { parseEdition } from './editions'

export const edition = parseEdition(import.meta.env.VITE_EDITION)

// Module, die nur in der internen Edition existieren, werden hier geschaltet.
// Der Vergleich direkt auf import.meta.env wird beim Build zur Konstante,
// damit der Bundler abgeschaltete Module entfernen kann.
export const isInternalEdition = import.meta.env.VITE_EDITION === 'internal'
