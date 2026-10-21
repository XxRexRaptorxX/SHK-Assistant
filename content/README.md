# Inhalte

Alle Fachinhalte liegen hier, ein Eintrag pro JSON-Datei, in einem Unterordner je Modul.
Jeder Unterordner muss in `src/content/collections.ts` registriert sein.

Pflichtfelder jedes Eintrags:

| Feld         | Werte                                   | Hinweis                                   |
|--------------|-----------------------------------------|-------------------------------------------|
| `id`         | z. B. `lexicon.ausdehnungsgefaess`      | stabil, eindeutig, beginnt mit Modul-Präfix |
| `visibility` | `internal` \| `public`                  | `internal` fehlt im public-Build komplett |
| `status`     | `draft` \| `verified`                   | `draft` wird in der App als ungeprüft markiert |
| `source`     | Dokument, Seite, Link                   | bei `verified` Pflicht                    |
| `verifiedBy` | Kürzel                                  | bei `verified` Pflicht                    |
| `verifiedAt` | `YYYY-MM-DD`                            | bei `verified` Pflicht                    |

Der Build bricht ab bei fehlenden oder unbekannten Feldern, doppelten IDs,
falschem Präfix und unregistrierten Ordnern.
