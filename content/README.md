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
| `variables`   | Eingaben: `symbol`, `name`, `unit`, optional `label` (Anzeige, z. B. „ΔT“), `units` (weitere wählbare Einheiten), `description`, `term` (siehe unten), `min`/`max`, `default` (Vorbelegung im Rechner, z. B. ein Faustwert) |
| `constants`   | Feste Werte: `symbol`, `name`, `value` mit Einheit, z. B. `"4.19 kJ/(kg K)"` |
| `result`      | Ergebnis: `symbol`, `name`, `unit`, optional `label`, `units`, `decimals` (Nachkommastellen, Standard 2) |
| `expression`  | Formel als mathjs-Ausdruck mit den Symbolen, z. B. `Q / (c * dT)`      |
| `examples`    | Testbeispiele: `inputs` je Symbol (Zahl in der Haupteinheit oder Text mit Einheit, z. B. `"10 kW"`), `expected` (Referenzwert), optional `tolerance` (relativ, Standard 0.001 = 0,1 %) |
| `figure`      | Optional: Skizze aus `figures/`, z. B. `"figure.kreis"`; erscheint auf der Formelseite unter den Formelzeichen |

In der Legende einer Formel sind Name und Einheit mit dem Lexikon verlinkt, wenn es dort einen
Eintrag mit genau diesem Begriff oder Synonym gibt. Ist der Name genauer als der Lexikon-Begriff
(z. B. „Masse des kalten Stoffes“), verweist das optionale Feld `term` auf den Begriff (`"term": "Masse"`);
das geht bei Variablen, Konstanten und beim Ergebnis.

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

## Tools (`tools/`, Präfix `tool.`)

Praktische Rechenhelfer für die Baustelle, z. B. die Länge auf einer Rohrrolle. Aufbau und Prüfung
wie bei den Formeln (gleiche Felder, Testbeispiel Pflicht bei `verified`); sie erscheinen aber unter
„Tools“ statt in der Formelsammlung. `category` gliedert die Tool-Liste, derzeit „Aufmaß“
(Mengen auf der Baustelle ermitteln), „Auslegung“ (Bedarf vorab abschätzen), „Demonstration“
(Faustwerte zum Zeigen beim Kunden) und „Montage“ (Vorgaben für den Einbau, z. B. Rohrschellenabstände).

**Tabellen-Tools** (`"kind": "table"`) rechnen nicht, sondern schlagen zu einer Eingabe die passenden
Zeilen nach, z. B. Richtwerte zum Baujahr. Statt Variablen und Formel haben sie:

| Feld      | Inhalt                                                                                       |
|-----------|----------------------------------------------------------------------------------------------|
| `input`   | die Eingabe: `name` (z. B. „Baujahr“), optional `unit`, `min`, `max`                          |
| `columns` | Ergebnisspalten: `key`, `name`, optional `label` (Formelzeichen), `term` und `unit` (Anzeige, z. B. „W/m²“) |
| `rows`    | Zeilen: `label`, Bereich `from`/`to` (einschließlich, eine Grenze darf fehlen), `values` je `key` als Text (z. B. „ca. 105“), optional `note` (z. B. Baustandard) |

**Auswahl-Tools** (`"kind": "choice"`) lassen eine Option wählen statt eine Zahl einzugeben,
z. B. Thermostatstufen oder Raumarten. Sie haben `sections`, je Abschnitt: `title`, `inputName`
(z. B. „Einstellung“), `display` (`"scale"`: Stufen nebeneinander in einer Leiste mit Verlauf von
kalt nach warm, nur für kurze Beschriftungen; `"dropdown"`: Auswahlliste, Standard), `columns` wie
bei Tabellen-Tools und `options` mit `label`, optional `note` und `values` je Spalte. Fehlt eine
Spalte in `values`, wird sie bei dieser Option nicht angezeigt (z. B. Brausehöhen nur bei Wanne und
Dusche); für „gibt es hier nicht“ die Spalte also weglassen statt `"–"` einzutragen. In der Leiste steht die erste Spalte als
Kurzinfo unter jeder Stufe. Optional `group` je Spalte: Spalten mit gleicher Gruppe stehen im Ergebnis
in einem eigenen Block mit Überschrift (z. B. „Montagehöhen“, „Bewegungsflächen“); `groupNotes` je
Abschnitt (Gruppe → Text) setzt eine graue Legende rechts daneben, z. B. „(Breite × Tiefe)“; `subheading`
an einer Spalte setzt innerhalb des Blocks ab dieser Zeile eine Zwischenüberschrift. Optional `bars`:
Leisten ganz oben, untereinander (`key`, `name`, `options` mit `key`, `label`, kleiner zweiter Zeile
`note`); jeweils die erste Option ist vorausgewählt. Abschnitte mit `when` (Leisten-key → Options-key)
erscheinen nur bei dieser Stellung; jede Stellung braucht mindestens einen Abschnitt.

**Faktor-Tools** (`"kind": "factor"`) rechnen Richtwerte hoch, z. B. Kollektorfläche pro Person
oder Dämmdicke nach Rohrdurchmesser. Felder:

- `inputs`: Eingabefelder, je `symbol`, `name`, optional `label` (Formelzeichen), `unit`, `min`,
  `max`, `default` (Vorbelegung, z. B. ein Standardwert) und `whenEmpty` (Feld darf leer bleiben,
  dann wird mit diesem Wert gerechnet). Darf leer sein, wenn das Ergebnis nur von der Auswahl abhängt.
- `choices`: Varianten zum Antippen, je `key`, `name`, `options` (je `key`, `label`, optional `when`:
  Option nur anbieten, wenn eine andere Auswahl so steht), optional `default` (vorausgewählte Option)
  und `display` (`"bar"`: Knöpfe nebeneinander, Standard; `"dropdown"`: Auswahlliste).
- `results`: je `symbol`, `name`, `unit`, `decimals` und `cases`. Ein Fall nennt `when` (für welche
  Auswahl er gilt, fehlende Auswahl = alle) und genau eins von: `factor` mit `per` (Bezugsgröße: das
  Symbol einer Eingabe oder eines vorher stehenden Ergebnisses), festem `value`, `text` (z. B.
  „keine Anforderung“) oder `expression` (Rechenausdruck ohne Einheiten mit Eingaben und vorherigen
  Ergebnissen). Dazu `rule`: der Richtwert in Worten wie in der Quelle. Hängt ein Ergebnis von der
  Größe eines Werts ab (z. B. Dämmdicke vom Innendurchmesser), grenzen `above` (über,
  ausschließlich) und `upTo` (bis, einschließlich) den Bereich ein; `of` nennt den Wert (Standard:
  erste Eingabe). Die Bereiche müssen lückenlos aneinander anschließen.
- `examples`: Testbeispiele mit `inputs`, `choices` und `expected` je Ergebnis-Symbol.

Der Build prüft, dass für jede Kombination genau ein Fall passt, dass Ausdrücke nur bekannte Größen
nutzen, und rechnet die Beispiele nach. Lange Wörter in `label` dürfen eine weiche Trennstelle
(`\u00AD`, unsichtbar) enthalten (z. B. „Heizungs\u00ADunterstützung“), damit sie auf schmalen
Knöpfen umbrechen; die Suche ignoriert sie.

Passen bei Tabellen-Tools mehrere Zeilen zur Eingabe (z. B. Werte aus zwei Quellen), werden alle angezeigt. Quellen
einzelner Zeilen gehören in `source` des Eintrags. Der Build
prüft, dass jede Zeile einen Bereich und zu jeder Spalte einen Wert hat.

## Skizzen (`figures/`, Präfix `figure.`)

Maßskizzen zu Formeln, z. B. Kreis mit Durchmesser oder Rohr mit Querschnitt. Je Skizze zwei
Dateien mit gleichem Namen: `kreis.json` (Pflicht-Metadaten und `title` = kurze Beschreibung für
Screenreader) und `kreis.svg` (die Zeichnung). Mehrere Formeln dürfen dieselbe Skizze nutzen.

- **Nur eigene Zeichnungen**, keine Bilder aus Formelbüchern, Normen oder Herstellerunterlagen.
  In `source` steht, womit die Skizze fachlich abgeglichen wurde.
- Beschriftung mit denselben Formelzeichen wie im Rechner (`label` der Variablen).
- Farben nur über die CSS-Klassen aus `src/index.css` (Abschnitt „Skizzen“), z. B. `line`, `dim`,
  `water`, `area`, `flow`, `hot`, `sym`, `sub`. Dann passt die Skizze zu Hell, Dunkel und Druck.
  Inline-`style` nur, wo eine Klasse etwas überschreiben würde (z. B. Strichstärke).
- Der Build prüft: SVG beginnt mit `<svg` und hat eine `viewBox`; keine Skripte, `on…`-Attribute,
  `<foreignObject>` oder externen Verweise; jede Formel verweist nur auf vorhandene Skizzen.
- IDs von Pfeilspitzen (`<marker id="…">`) mit dem Dateinamen beginnen lassen, z. B. `kreis-dim`.

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
| `sections`    | Abschnitte: optional `title` (Zwischenüberschrift; leer = ohne) und `items` (je Punkt `id`, `text`, optional `note`) |
| `notes`       | Optional: Notizfeld unter den Punkten, z. B. `{ "label": "Notizen" }`; wird auf dem Gerät gespeichert, gedruckt und beim Zurücksetzen geleert |

Die `id` eines Punkts (z. B. `abgasweg-pruefen`) muss innerhalb der Checkliste eindeutig sein und
**stabil bleiben**: Der gespeicherte Fortschritt auf den Geräten hängt daran. Wird ein Punkt nur
umformuliert, `id` beibehalten. Bei `verified` ist mindestens ein Abschnitt Pflicht.

## Fachmann-Codes (`expert-codes/`, Präfix `expert-code.`)

| Feld   | Inhalt                                                                |
|--------|-----------------------------------------------------------------------|
| `name` | Hersteller bzw. Regelung, z. B. „Brötje WBS“                          |
| `code` | Code oder Rechenweg, z. B. „00 (service), 17 (admin)“                 |

Graue Stellen werden mit Klammern markiert, die in der App entfallen: `[eckige Klammern]` =
**dunkelgrau**, `(runde Klammern)` = **hellgrau**; z. B. `00 (service)` oder
`[Bsp.:] (1)[9](.0)`. Klammern müssen paarweise stehen und dürfen nicht verschachtelt sein. Echte
Klammern im Text sind daher nicht möglich. Fachmann-Codes dürfen `public` sein und erscheinen dann auch
in der öffentlichen Version. In der App liegen sie im Bereich „Fachmann“ hinter einer PIN-Abfrage. Die
PIN ist nur eine Hürde, kein Schutz: Codes und PIN stehen lesbar im Bundle.

## Rechtliches (`legal/`, Präfix `legal.`)

| Feld       | Inhalt                                                                   |
|------------|--------------------------------------------------------------------------|
| `title`    | Seitentitel, z. B. „Impressum“                                           |
| `sections` | Abschnitte mit optional `heading` (Zwischenüberschrift) und `text`       |

Im `text` trennt eine Leerzeile (`

`) Absätze, `**Wort**` wird fett, ein Absatz, der nur aus
`**…**` besteht, wird Unterüberschrift. Web- und E-Mail-Adressen werden klickbar. HTML wird nie ausgeführt. Die Seiten sind in den Einstellungen unter
„Rechtliches“ verlinkt: `legal.impressum` (`/impressum`), `legal.datenschutz` (`/datenschutz`) und
`legal.haftung` (`/haftung`). Der Haftungshinweis erscheint außerdem beim ersten Besuch als Fenster, das
mit „Verstanden“ bestätigt werden muss; bei wesentlichen Änderungen `DISCLAIMER_VERSION` in
`src/modules/legal/DisclaimerDialog.tsx` erhöhen, dann wird er erneut abgefragt.
Die Texte liefert der Inhaber; sie werden nicht erfunden. Bei `verified` ist mindestens ein
Abschnitt Pflicht.

## News-Feeds (`news-feeds/`, Präfix `news-feed.`)

| Feld      | Inhalt                                              |
|-----------|-----------------------------------------------------|
| `name`    | Anbieter, wie er unter jeder Meldung steht          |
| `url`     | Adresse des RSS- oder Atom-Feeds                    |
| `website` | Startseite des Anbieters (Link unter „Quellen“)     |

Die GitHub-Pages-Action ruft die Feeds täglich ab (`npm run news`, schreibt `public/news.json`,
nicht im Repository) und veröffentlicht sie mit der App. Angezeigt werden nur Überschrift, Datum,
Quelle und Link, keine Teaser oder Bilder. Ein nicht erreichbarer Feed wird übersprungen und auf
der News-Seite genannt. Lokal ohne `npm run news` zeigt die Seite „Noch keine News vorhanden“.

## Stoffwerte (`materials/`, Präfix `material.`)

| Feld         | Inhalt                                                                  |
|--------------|-------------------------------------------------------------------------|
| `quantities` | Größen, für die die Werte gelten, z. B. `["Spezifische Wärmekapazität"]` |
| `unit`       | Einheit der Werte (mathjs), leer = ohne Einheit                          |
| `values`     | Werte: `name` (Stoff), optional `note` (Bedingung, z. B. „20 °C“), `value`, optional `unit` und `source`, wenn abweichend |

Neben Stoffwerten passen hier auch gängige Standardwerte hin, z. B. Verlegeabstände der
Fußbodenheizung. Im Formelrechner und in den Tools bekommt jedes Eingabefeld, dessen Name oder `term` einer Größe aus `quantities`
entspricht, rechts einen Pfeil mit diesen Werten zur Auswahl. Der gewählte Wert wird eingetragen
(bei passender Einheit mit dieser Einheit, sonst umgerechnet); freie Eingabe bleibt möglich. Werte
nur aus belegbaren Quellen übernehmen, keine Spannen in Einzelwerte umdeuten. Ein Test prüft, dass
jeder Wert in jedes passende Formelfeld umgerechnet werden kann.

## Lexikon (`lexicon/`, Präfix `lexicon.`)

| Feld         | Inhalt                                                        |
|--------------|---------------------------------------------------------------|
| `term`       | Begriff, wie er in der Liste erscheint                        |
| `synonyms`   | andere Bezeichnungen, Abkürzungen (werden mit durchsucht)     |
| `categories` | Kategorien, mindestens eine (`heizung`, `hydraulik`, `trinkwasser`, `abwasser`, `kaelte`, `lueftung`, `gas`, `solar`, `msr`, `werkstoffe`, `werkzeuge`, `normen`, `physik`, `einheiten`, `kuerzel`); ein Begriff darf in mehreren stehen |
| `definition` | Erklärung als Text; eine Leerzeile (`\n\n`) beginnt einen neuen Absatz, `**Wort**` wird fett |
| `related`    | IDs verwandter Lexikon-Einträge („Siehe auch“)                |

Datenbestand: Der erste Bestand (724 Einträge) ist `internal` und `draft`. Die Erklärungen sind
eigenständig formulierte Kurzbeschreibungen, Wikipedia diente als Recherche-Einstieg. Das ist keine
fachliche Freigabe: Sicherheits-, Normen-, Rechts- und herstellerspezifische Aussagen vor dem Setzen
auf `verified` gegen Normen, Regeln und Herstellerunterlagen prüfen.
