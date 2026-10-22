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

Im Rechner lassen sich Einheiten antippen und umstellen. Angeboten werden automatisch alle
gleichartigen Einheiten aus dem Umrechner (z. B. für `m^2` auch `cm^2`, `ha`) plus die in `units`
genannten. **Ausnahme Temperatur:** Hier gibt es keine automatischen Alternativen, weil bei einer
Differenz 10 K nicht 10 °C sind. Ist eine Variable eine absolute Temperatur, kann `units: ["degC"]`
gesetzt werden. Ein Test prüft, dass jede angebotene Einheit dasselbe Ergebnis liefert.

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
| `offerInFormulas` | `false` = in Formeln nicht automatisch anbieten (z. B. PS: nur mechanische Leistung, kcal: nur Wärme); Formeln können sie über `units` gezielt anbieten |
| `examples`   | Testbeispiele: `value` und `expected` jeweils mit Einheit, z. B. `"1 mWS"` → `"98.0665 hPa"` |

Bei `verified` sind `definition` und ein Testbeispiel Pflicht. Achtung: mathjs kennt viele Kürzel
anders als im Handwerk üblich, z. B. ist `PS` dort Petasiemens und `hp` die mechanische Pferdestärke.
Eine Zusatzeinheit mit einem bereits vorhandenen mathjs-Namen lässt den Build fehlschlagen.

## Umrechner (`converter/`, Präfix `converter.`)

Eine Datei je Größe (Druck, Leistung …). `kind` legt die Art fest:

| `kind`  | Wofür                                   | Felder                                   |
|---------|-----------------------------------------|------------------------------------------|
| `units` (Standard) | Einheiten einer Größe über mathjs | `units` (alle umrechenbar), `from`, `to` (Voreinstellung) |
| `factors` | Richtwerte ohne festes Einheiten-Verhältnis, z. B. Holzmaße | `factors` (je Größe `key`, `label`, `value` = Menge je gemeinsamer Bezugsmenge, z. B. fm: 1, rm: 1.4), `from`, `to` |
| `slope` | Steigung in %, ‰, Grad, 1 : x           | keine weiteren                           |
| `ratio` | Prozent, Promille, Dezimalzahl, Bruch   | keine weiteren                           |
| `fractions` | Ein Bruch in verschiedenen Nennern (Halbe bis Hundertstel), sonst nächster Bruch mit „≈“ | keine weiteren |
| `numeral` | Ganze Zahlen in Zahlensystemen (dual, ternär, oktal, dezimal, duodezimal, hexadezimal) | keine weiteren |
| `table` | Nachschlagetabelle, z. B. Rohrdimensionen | `columns` (Überschriften), `rows` (je Zeile eine Liste von Texten) |

Dazu immer `title` und optional `description`, `symbol` (Formelzeichen, grau hinter dem Namen angezeigt, z. B. „Fläche A“)
und `category` (Gruppe in der Liste, z. B. „Hydraulik“; leer = „Allgemein“). Bei `factors` legt
`approximate` fest, ob es Richtwerte sind (`true`, Standard: mit „≈“ und 3 Stellen) oder exakte
Verhältnisse (`false`, z. B. Stückmaß).

`rare` listet unübliche Einheiten (bei `units`), Größen-Schlüssel (bei `factors`) bzw. Formen (bei
`ratio`: `percent`, `permille`, `permyriad`, `ppm`, `ppb`, `decimal`, `fraction`; bei `fractions`: die Nenner `2`, `3`, `4`, `5`, `6`, `8`, `10`, `12`, `16`, `32`, `64`, `100`; bei `numeral`: `bin`, `ter`, `oct`, `dec`, `duo`, `hex`). Sie fallen weg, wenn
in den Einstellungen „Unübliche Einheiten ausblenden“ eingeschaltet ist (Standard: aus). Mindestens
zwei Einheiten müssen übrig bleiben.

`names` (bei `units` und `factors` Pflicht) nennt je Einheit bzw. Größen-Schlüssel den ausgeschriebenen
Namen, z. B. `{ "hl": "Hektoliter" }`. Die App zeigt ihn grau hinter der Einheit (abschaltbar in den
Einstellungen). Der Build bricht ab, wenn ein Name fehlt oder zu keiner Einheit gehört.

Für Temperaturen `degC`, `K`, `degF` verwenden; die Nullpunkt-Verschiebung rechnet mathjs selbst.
In `units` dürfen Zusatzeinheiten stehen, die in `content/units` noch ohne Definition angekündigt
sind (z. B. `kcal/h`, `gradDH`). Die App zeigt sie dann als „noch ohne Definition“, bis die
Definition eingetragen ist.

## Checklisten (`checklists/`, Präfix `checklist.`)

| Feld          | Inhalt                                                           |
|---------------|------------------------------------------------------------------|
| `title`       | Name der Checkliste                                              |
| `description` | Optionaler Text oberhalb der Punkte                              |
| `category`    | Gruppe in der Liste, z. B. „Wartung“ (leer = „Allgemein“)        |
| `sections`    | Abschnitte: `title` und `items` (je Punkt `id`, `text`, optional `note`) |

Die `id` eines Punkts (z. B. `abgasweg-pruefen`) muss innerhalb der Checkliste eindeutig sein und
**stabil bleiben**: Der gespeicherte Fortschritt auf den Geräten hängt daran. Wird ein Punkt nur
umformuliert, `id` beibehalten. Bei `verified` ist mindestens ein Abschnitt Pflicht.

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
