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
falschem Präfix, Verweisen auf nicht vorhandene IDs und unregistrierten Ordnern.

## Formeln (`formulas/`, Präfix `formula.`)

| Feld          | Inhalt                                                                 |
|---------------|------------------------------------------------------------------------|
| `title`       | Name der Formel                                                        |
| `description` | Kurze eigene Erklärung, wann und wofür                                  |
| `category`    | Gruppe in der Liste, z. B. „Hydraulik“ (leer = „Allgemein“)            |
| `variables`   | Eingaben: `symbol`, `name`, `unit`, optional `label` (Anzeige, z. B. „ΔT“), `units` (weitere wählbare Einheiten), `description` |
| `constants`   | Feste Werte: `symbol`, `name`, `value` mit Einheit, z. B. `"4.19 kJ/(kg K)"` |
| `result`      | Ergebnis: `symbol`, `name`, `unit`, optional `label`, `units`, `decimals` (Nachkommastellen, Standard 2) |
| `expression`  | Formel als mathjs-Ausdruck mit den Symbolen, z. B. `Q / (c * dT)`      |
| `examples`    | Testbeispiele: `inputs` je Symbol (Zahl in der Haupteinheit oder Text mit Einheit, z. B. `"10 kW"`), `expected` (Referenzwert), optional `tolerance` (relativ, Standard 0.001 = 0,1 %) |

Einheiten in mathjs-Schreibweise, z. B. `kW`, `m^3/h`, `kg/h`, `K`, `bar`. Für Temperatur­differenzen
`K` verwenden, nicht `degC` (°C ist eine Skala mit Nullpunkt-Verschiebung).

Beim Build wird jede Formel geprüft: bekannte Einheiten, passende Alternativeinheiten, nur definierte
Symbole, jede Variable wird verwendet, und **jedes Testbeispiel muss den Referenzwert ergeben**.
Bei `verified` sind `expression`, `result` und mindestens ein Testbeispiel Pflicht.

## Lexikon (`lexicon/`, Präfix `lexicon.`)

| Feld         | Inhalt                                                        |
|--------------|---------------------------------------------------------------|
| `term`       | Begriff, wie er in der Liste erscheint                        |
| `synonyms`   | andere Bezeichnungen, Abkürzungen (werden mit durchsucht)     |
| `definition` | Erklärung als Text; eine Leerzeile (`\n\n`) beginnt einen neuen Absatz |
| `related`    | IDs verwandter Lexikon-Einträge („Siehe auch“)                |
