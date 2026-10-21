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

## Zusatzeinheiten (`units/`, Präfix `unit.`)

Einheiten, die mathjs nicht kennt (z. B. mWS, kcal). Sie gelten danach überall: in Formeln und im Umrechner.

| Feld         | Inhalt                                                                  |
|--------------|-------------------------------------------------------------------------|
| `symbol`     | Name in Formeln und Umrechner, z. B. `mWS` (nur Buchstaben, Ziffern, `_`) |
| `name`       | Ausgeschrieben, z. B. „Meter Wassersäule“                               |
| `definition` | Über vorhandene Einheiten, z. B. `"1000 mmH2O"`; leer = noch nicht nutzbar |
| `aliases`    | Weitere Namen                                                           |
| `examples`   | Testbeispiele: `value` und `expected` jeweils mit Einheit, z. B. `"1 mWS"` → `"98.0665 hPa"` |

Bei `verified` sind `definition` und ein Testbeispiel Pflicht. Achtung: mathjs kennt viele Kürzel
anders als im Handwerk üblich, z. B. ist `PS` dort Petasiemens und `hp` die mechanische Pferdestärke.
Eine Zusatzeinheit mit einem bereits vorhandenen mathjs-Namen lässt den Build fehlschlagen.

## Umrechner (`converter/`, Präfix `converter.`)

Eine Datei je Größe (Druck, Leistung …).

| Feld          | Inhalt                                                          |
|---------------|-----------------------------------------------------------------|
| `title`       | Name der Größe                                                  |
| `description` | Optionaler Hinweis                                              |
| `units`       | Angebotene Einheiten (mathjs oder Zusatzeinheiten), alle umrechenbar |
| `from`, `to`  | Voreinstellung beim Öffnen                                      |

Für Temperaturen `degC`, `K`, `degF` verwenden; die Nullpunkt-Verschiebung rechnet mathjs selbst.

## Lexikon (`lexicon/`, Präfix `lexicon.`)

| Feld         | Inhalt                                                        |
|--------------|---------------------------------------------------------------|
| `term`       | Begriff, wie er in der Liste erscheint                        |
| `synonyms`   | andere Bezeichnungen, Abkürzungen (werden mit durchsucht)     |
| `definition` | Erklärung als Text; eine Leerzeile (`\n\n`) beginnt einen neuen Absatz, `**Wort**` wird fett |
| `related`    | IDs verwandter Lexikon-Einträge („Siehe auch“)                |

Datenbestand: Der erste Bestand (724 Einträge) ist `internal` und `draft`. Die Erklärungen sind
eigenständig formulierte Kurzbeschreibungen, Wikipedia diente als Recherche-Einstieg. Das ist keine
fachliche Freigabe: Sicherheits-, Normen-, Rechts- und herstellerspezifische Aussagen vor dem Setzen
auf `verified` gegen Normen, Regeln und Herstellerunterlagen prüfen.
