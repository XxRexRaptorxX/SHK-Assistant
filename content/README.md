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
| `constants`   | Feste Werte: `symbol`, `name`, `value` mit Einheit, z. B. `"1.163 Wh/(kg*K)"` |
| `result`      | Ergebnis: `symbol`, `name`, `unit`, optional `label`, `units`, `decimals` (Nachkommastellen, Standard 2; blieben damit weniger als zwei gültige Stellen, zeigt die App drei gültige Stellen), `min` (kleinstes sinnvolles Ergebnis) und `minMessage` (Hinweis, wenn es darunter liegt oder kein reelles Ergebnis entsteht) |
| `expression`  | Formel als mathjs-Ausdruck mit den Symbolen, z. B. `Q / (c * dT)`      |
| `examples`    | Testbeispiele: `inputs` je Symbol (Zahl in der Haupteinheit oder Text mit Einheit, z. B. `"10 kW"`), `expected` (Referenzwert), optional `tolerance` (relativ, Standard 0.001 = 0,1 %) |
| `figure`      | Optional: Skizze aus `figures/`, z. B. `"figure.kreis"`; erscheint auf der Formelseite unter den Formelzeichen |
| `hideFormula` | Optional: `true` lässt Formelzeile, Legende und die Überschrift „Rechner“ weg, z. B. bei einfachen Tools; Skizze, Eingaben und Ergebnis bleiben, der Löschen-Knopf steht dann im Ergebnisfeld |

In der Legende einer Formel sind Name und Einheit mit dem Lexikon verlinkt, wenn es dort einen
Eintrag mit genau diesem Begriff oder Synonym gibt. Ist der Name genauer als der Lexikon-Begriff
(z. B. „Masse des kalten Stoffes“), verweist das optionale Feld `term` auf den Begriff (`"term": "Masse"`);
das geht bei Variablen, Konstanten und beim Ergebnis.

Einheiten in mathjs-Schreibweise, z. B. `kW`, `m^3/h`, `kg/h`, `K`, `bar`. Für Temperatur­differenzen
`K` verwenden, nicht `degC` (°C ist eine Skala mit Nullpunkt-Verschiebung). Die spezifische
Wärmekapazität hat immer die Haupteinheit `Wh/(kg*K)`, `kJ/(kg*K)` steht als Alternative in `units`.

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
„Tools“ statt in der Formelsammlung. `category` gliedert die Tool-Liste, in dieser Reihenfolge: „Montage“ (Vorgaben für
den Einbau, z. B. Rohrschellenabstände), „Wartung“ (Richtwerte für Messungen, z. B. Abgaswerte),
„Demonstration“ (Faustwerte zum Zeigen beim Kunden), „Aufmaß“ (Mengen auf der Baustelle ermitteln),
„Auslegung“ (Bedarf vorab abschätzen), „Planung“ (Nachschlagen beim Planen, z. B. Sinnbilder in Schemata
oder zuständige Normen) und „Organisation“ (Büroarbeit rund um die Baustelle, z. B. Stundenzettel). Die Reihenfolge steht in `TOOL_CATEGORY_ORDER` (`src/modules/tools/tools.ts`), eine neue
Kategorie gehört dort dazu.

Jedes Tool jeder Art braucht zusätzlich `summary`: ein kurzer Satz, was das Tool leistet. Er steht in
der Tool-Übersicht und in der Suche unter dem Titel; die ausführliche Erklärung bleibt in `description`.

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
an einer Spalte setzt innerhalb des Blocks ab dieser Zeile eine Zwischenüberschrift; `"hideName": true`
zeigt nur den Wert, linksbündig (die Bezeichnung bleibt für Screenreader); `"valueFirst": true` setzt den
Wert nach links und die Bezeichnung dahinter (z. B. „90 × 75 cm davor“). Optional `bars`:
Leisten ganz oben, untereinander (`key`, `name`, `options` mit `key`, `label`, kleiner zweiter Zeile
`note`); jeweils die erste Option ist vorausgewählt. Abschnitte mit `when` (Leisten-key → Options-key)
erscheinen nur bei dieser Stellung; jede Stellung braucht mindestens einen Abschnitt. Optional
`floorBuildUp` (`name`, `unit`, `hint`, `baseLabel`, `raisedLabel`): ein Eingabefeld ganz oben, z. B. der
Fußbodenaufbau. Ist es ausgefüllt, zeigen Blöcke mit Spalten `"floorHeight": true` die Höhen nebeneinander
über Fertig- und Rohfußboden (`baseLabel`/`raisedLabel`, z. B. OKFF/OKRFB); Zahlen mit anderem Bezug
(„über Wannenrand“, „über Sitzhöhe“) und Abstände bleiben unverändert.

**Varianten-Tools** (`"kind": "variants"`) fassen mehrere Rechenwege zu einer Aufgabe zusammen, z. B. die
Länge einer Rohrrolle über die Wicklungen, über den Ringquerschnitt oder über mehrere verbrauchte Rollen.
Felder: `title`, `description`, `category`, `name` (Beschriftung der Leiste, z. B. „Berechnung“) und
`variants` (mindestens zwei) mit `key`, `label`, optional `note` (kleine zweite Zeile in der Leiste) und
allen Feldern einer Formel (`title`, `description`, `variables`, `result`, `expression`, `examples`,
`figure` …). Jede Variante wird wie eine Formel geprüft; ihre Testbeispiele laufen automatisch mit.

**Sinnbild-Tools** (`"kind": "symbols"`) zeigen Sinnbilder (Schaltzeichen) aus Strang- und
Anlagenschemata mit Suchfeld. Felder: `title`, `description`, `category` und `groups`, je Gruppe
`title`, `norm` (z. B. „DIN EN 806-1:2001-12“), optional `note` (Hinweis unter der Überschrift, z. B.
„Links Grundriss, rechts Aufriss“) und `symbols` mit `name` (je Gruppe eindeutig), optional `aliases` (weitere
Suchbegriffe, z. B. „RV“), `note` (z. B. was ein Stern im Sinnbild bedeutet) und `draw`: die Zeichnung
als Liste einfacher Formen auf einer Fläche von 48 × 32 (Leitung waagerecht auf Höhe 16). Formen:
`{"d": "M4 16H44"}` (SVG-Pfad, nur Pfadbefehle und Zahlen), `{"circle": [cx, cy, r]}` und
`{"text": "FV", "x": 24, "y": 16, "size": 7}`; Pfade und Kreise optional mit `"fill": true`
(gefüllt), `"dash": true` (gestrichelt), `"dashDot": true` (Strichpunkt), `"bold": true` (breiter
Strich) oder `"thin": true` (dünner Strich für dicht stehende Details). Alle Formen dürfen eine `color` haben (`rot`, `blau`, `gruen`, `gelb`, `violett`, `orange`,
`braun`, `grau`, `schwarz`, `weiss`), z. B. für Leitungsfarben; ohne Farbe gilt die Textfarbe. Sinnbilder
mit Farbe stehen wie auf einem Plan auf weißem Grund. Die Zeichnungen sind
eigene Nachzeichnungen, keine Bilder aus Normen oder Büchern. Der Build prüft doppelte Namen und
Koordinaten außerhalb der Fläche.

**Ablauf-Tools** (`"kind": "sequence"`) zeigen einen Programmablauf als Zeitdiagramm, z. B. den Start
eines Feuerungsautomaten, mit Stoppuhr zum Mitmessen und Fehlersuche. Felder: `title`, `description`,
`category`, `name` (was umgeschaltet wird, z. B. „Brennerart“) und `variants`, je Variante `key`,
`label`, optional `note` (kleine zweite Zeile in der Leiste), `title`, `description` (z. B.
Beispielgerät der Zeiten), `signals` (Zeilen: `key`, `label`), `phases` (Spalten in Ablauf-Reihenfolge:
`key`, `label`, `abbr` (Kürzel, höchstens 4 Zeichen), optional `duration` (Anzeige, z. B. „max. 3 s“),
`seconds` (Vergleichswert für die Stoppuhr) mit `limit` (`typ`, `max` oder `min`; nur Höchst- und
Mindestwerte werden bewertet, mit 1 s Spielraum), `event` (woran man den Beginn erkennt, z. B.
„Zündfunke hörbar“), `signals` (anliegende Signale), `description` und optional `term` (Lexikon-Begriff für die Verlinkung),
`repeat` (nur wenn die Phase wiederholt werden darf: `text` und, falls die Quelle sie nennt, die
Höchstzahl `count`, angezeigt als „max. 3×“) und `check`) und `faults`
(`symptom`, `phase`, `causes` in Prüfreihenfolge, optional `note`). Der Build prüft unbekannte Signale
und Phasen, doppelte Schlüssel und Signale, die in keiner Phase vorkommen.

**Kabel-Tools** (`"kind": "cables"`) zeigen zu einer gewählten Elektro-Komponente oder Einbausituation die
Kabelarten mit ihren Eigenschaften; oben schaltet eine Leiste zwischen beiden Listen um. Felder: `title`,
`summary`, `description`, `category` und:

- `properties`: was bei jeder Kabelart angezeigt wird, je `key`, `name` (z. B. „UV-beständig“).
- `cables`: je `key`, `name` (z. B. „NYM-J“), optional `aliases` (Suchbegriffe), `description` (eigene
  Kurzbeschreibung), `standard`, `voltage`, `temperature`, `use` (Verwendung laut Datenblatt), optional
  `limits` (Einschränkung), `source` (kurz, woher die Daten stammen) und `properties`: Eigenschafts-`key` →
  `{ "value": "yes" | "no" | "conditional", "note": "…" }`. Eine fehlende Eigenschaft bedeutet „die Quelle
  nennt dazu nichts“ und erscheint als „Keine Angabe“; `conditional` braucht `note`.
- `components`: je `key`, `label`, `group` (Gruppe in der Auswahl), optional `aliases`, `note` (Hinweis zur
  ganzen Komponente) und `recommendations`, je `cable` (`key` der Kabelart), `level`, `source` (kurz, woher
  die Zuordnung stammt) und `note` (Bedingung oder Grund; Pflicht außer bei `suitable`).
- `situations`: Einbausituationen, z. B. „Unterputz“ oder „Außen, im Freien“, gleicher Aufbau wie `components`.

`level` ist `required` („Vorgeschrieben“: nur wenn die Quelle es konkret verlangt, z. B. die Anleitung eines
bestimmten Geräts; das Gerät gehört in `note`), `suitable` („Geeignet“; ist die Zuordnung aus den
Verwendungsangaben eines Datenblatts abgeleitet, steht das in `source`) oder `avoid` („Nicht geeignet“, nur mit
Beleg). Nur Typnummern, eigene Kurzbeschreibungen und Links, keine Normtexte. Die Links aller Quellen stehen im
`source` des Eintrags. Fehlt eine belegte Kabelart, bleibt `recommendations` leer und `note` beginnt mit
`TODO: Inhalt fehlt`; bei `verified` ist das nicht erlaubt. Der Build prüft unbekannte Eigenschaften und
Kabelarten, doppelte Schlüssel und Kabelarten, die in keiner der beiden Listen vorkommen.

**Aderfarben-Tools** (`"kind": "wireColors"`) zeigen zu System, Kabeltyp und Aderzahl, welche Farbe wofür
genutzt wird. Felder: `title`, `summary`, `description`, `category` und:

- `systems`: Leiste oben, je `key`, `label` (z. B. „Starkstrom“), optional `note` (kleine zweite Zeile), `hint`
  (Hinweis unter der Leiste, wenn dieses System gewählt ist) und `warning` (deutliche Warnung, z. B. bei
  Altanlagen).
- `cables`: Kabeltypen, je `key`, `name` (z. B. „NYM-J“, alte Typen mit Nachfolger: „NYA (heute H07V-U)“),
  optional `aliases` (Suchbegriffe) und `note` (Hinweis, wenn der Typ gewählt ist).
- `assignments`: Belegungen, je `system`, `cables` (Liste von Kabel-`key`s, für die sie gilt), `cores` (Aderzahl
  in der Leiste, z. B. „3“, „6+“, „Einzeln“), optional `coresNote` (kleine zweite Zeile, trennt gleiche
  Aderzahlen, z. B. „mit N“ oder „vor 1965“), `wires`, optional `note` und `source` (kurz, woher die Belegung
  stammt). Je Ader in `wires`: `color` (`gruenGelb`, `blau`, `braun`, `schwarz`, `grau`, `rot`, `weiss`, `gruen`,
  `gelb`, `rosa`, `violett`), `use` (Nutzung) und optional `note`.

Angeboten wird nur, was eine Belegung hat: Kabeltypen und Aderzahlen ohne Belegung erscheinen nicht. Eine reine
Empfehlung, z. B. die Zuordnung zu L1, L2, L3, muss als solche im `note` stehen. Der Build prüft unbekannte
Systeme und Kabeltypen, doppelte Belegungen und ob eine Aderzahl wie „3“ zur Zahl der Einträge in `wires` passt.

**Normen-Tools** (`"kind": "normFinder"`) zeigen zu einem oder mehreren im Menü gewählten Themenbereichen die zuständigen
Regelwerke, sortiert nach rechtlichem Rang; innerhalb eines Rangs steht vorn, was zu mehreren gewählten Themen gehört.
Schalter blenden einzelne Arten (`type`, z. B. nur Normen) und alles mit `lowPractice` aus; standardmäßig sind alle an. Felder: `title`, `summary`,
`description`, `category` und:

- `closingNote`: Einschränkungen der Liste, z. B. Auswahl und Stand der Ausgaben; steht am Seitenende, damit `description`
  kurz bleibt und das Menü schnell erreichbar ist.
- `levels`: die Rangstufen, das Verbindlichste zuerst, je `key`, `label` (z. B. „Bundesverordnung“), `binding` (ob das
  Dokument selbst bindet; bindende Stufen müssen vorn stehen) und `description` (Erklärung unter „Wie wird sortiert?“).
  Landesrecht ist bisher nur für Bayern erfasst (Stufe `land`); solche Einträge müssen in `note` sagen, dass sie nur dort gelten.
- `levelNote`: Einordnung, die unter dieser Erklärung steht.
- `topics`: Themenbereiche, je `key`, `label` (z. B. „Heizöl“), optional `note` (Zusatz in Klammern im Menü), `aliases`
  (Suchbegriffe) und `practical` (Praxistipp: `norm` = key des Regelwerks, das in diesem Thema am meisten hilft, und
  `reason` = warum). Ohne `practical` zeigt das Thema keinen Tipp, z. B. wenn es für eine einzelne Empfehlung zu breit ist.
- `norms`: Regelwerke, je `key`, `name` (Kurzzeichen, z. B. „DVGW G 600 (TRGI)“), `title` (worum es geht), `type` (`law`:
  Gesetz/Verordnung, `standard`: Norm, `rule`: Technische Regel, `accident`: Unfallverhütung, `guide`: Fachbuch oder
  Muster), `level` (key der Rangstufe), `description` (eigene Kurzbeschreibung), `url` (https, zum Herausgeber oder
  Katalogeintrag), `topics` (Liste von Themen-`key`s), optional `aliases`, `edition` (Ausgabe laut Herausgeber oder
  Katalog; bei Gesetzen leer, ihr Link zeigt die geltende Fassung), `note` (wichtiger Zusatz) und `lowPractice` (Grund für
  die Kennzeichnung „Wenig Praxisbezug“, z. B. „Richtet sich vor allem an Kesselhersteller“; nicht beim Praxistipp eines Themas).

Nur Nummern, eigene Kurzbeschreibungen und Links, keine Normtexte. Der Build prüft unbekannte Themen, Rangstufen und
Praxistipps, doppelte Schlüssel und Namen sowie Themen und Rangstufen ohne Regelwerk.

**Stundenzettel** (`"kind": "workHours"`) notiert Arbeitsstunden je Bauvorhaben und exportiert sie. Felder: `title`, `summary`,
`description`, `category`, `closingNote` (Hinweis am Ende des Tools, z. B. wo die Daten bleiben) und optional `keywords`
(Suchbegriffe). In der unteren Leiste steht das Tool zusätzlich als eigener Reiter (`workHoursNavItem` in `src/app/modules.ts`);
ändert sich seine `id`, muss die Adresse dort mit. Die Einträge sind Nutzerdaten: Sie liegen nur auf dem Gerät
(IndexedDB, Einstellungen im localStorage) und gehören nicht in `content/` und nicht ins Favoriten-Backup. Ausnahme ist
der GPS-Knopf: Er sendet beim Drücken den Standort an Nominatim (OpenStreetMap), um die Adresse abzufragen; die verlangte
Quellenangabe steht in `source` des Eintrags.

**Faktor-Tools** (`"kind": "factor"`) rechnen Richtwerte hoch, z. B. Kollektorfläche pro Person
oder Dämmdicke nach Rohrdurchmesser. Felder:

- `inputs`: Eingabefelder, je `symbol`, `name`, optional `label` (Formelzeichen), `unit`, `min`,
  `max`, `default` (Vorbelegung, z. B. ein Standardwert), `whenEmpty` (Feld darf leer bleiben,
  dann wird mit diesem Wert gerechnet), `optional` (Feld darf leer bleiben; Ergebnisse, die es brauchen,
  bleiben offen, die übrigen erscheinen trotzdem), `when` (Feld nur anzeigen, wenn eine Auswahl so steht) und
  `unless` (Feld ausblenden, wenn die Auswahl so steht). Darf leer sein, wenn das Ergebnis nur von der Auswahl abhängt.
- `choices`: Varianten zum Antippen, je `key`, `name`, `options` (je `key`, `label`, optional `when`:
  Option nur anbieten, wenn eine andere Auswahl so steht), optional `default` (vorausgewählte Option),
  `display` (`"bar"`: Knöpfe nebeneinander, Standard; `"dropdown"`: Auswahlliste) und `top` (über den
  Eingabefeldern anzeigen statt darunter, z. B. ein Umschalter für den Rechenweg). Eine Option darf `info`
  haben: Der Text steht hinter einem Info-Knopf im Schaltfeld und wird mit durchsucht (nur bei `"bar"`).
- `hideHeading`: `true` lässt die Überschrift „Rechner“ weg; der Löschen-Knopf steht dann im Ergebnisfeld.
- `results`: je `symbol`, `name`, `unit`, `decimals` und `cases`. Ein Fall nennt `when` (für welche
  Auswahl er gilt, fehlende Auswahl = alle) und genau eins von: `factor` mit `per` (Bezugsgröße: das
  Symbol einer Eingabe oder eines vorher stehenden Ergebnisses), festem `value`, `text` (z. B.
  „keine Anforderung“), `expression` (Rechenausdruck ohne Einheiten mit Eingaben und vorherigen
  Ergebnissen) oder `table` (Nachschlagetabelle: `rowOf` und `colOf` nennen die Größen, `rows` und `cols`
  die aufsteigenden Grenzen, `values` die Werte je Zeile, `beyond` den Text über der letzten Grenze; bei
  Zwischenwerten gilt die nächsthöhere Grenze). Dazu `rule`: der Richtwert in Worten wie in der Quelle. Hängt ein Ergebnis von der
  Größe eines Werts ab (z. B. Dämmdicke vom Innendurchmesser), grenzen `above` (über,
  ausschließlich) und `upTo` (bis, einschließlich) den Bereich ein; `of` nennt den Wert (Standard:
  erste Eingabe). Die Bereiche müssen lückenlos aneinander anschließen. Optional je Ergebnis: `hidden`
  (nur Zwischenwert für spätere Ergebnisse, wird nicht angezeigt), `whenMissing` (Hinweis, solange das
  Ergebnis offen ist, weil optionale Felder fehlen), `when` und `unless` (Ergebnis nur bei dieser bzw. nicht
  bei dieser Auswahl berechnen und anzeigen).
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
PIN ist nur eine Hürde, kein Schutz: Codes und PINs stehen lesbar im Bundle.

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
| `formulas`   | Optional: IDs von Formeln, die mit dem Begriff zu tun haben (Abschnitt „Formeln“) |
| `tools`      | Optional: IDs von Tools, die mit dem Begriff zu tun haben (Abschnitt „Tools“) |

`formulas` und `tools` nur setzen, wenn der Begriff Ergebnis oder Kern der Formel bzw. des Tools ist, nicht
bei bloßen Eingabegrößen wie Länge oder Zeit. Neue Formeln und Tools hier von Hand eintragen.

Datenbestand: Der erste Bestand (724 Einträge) ist `internal` und `draft`. Die Erklärungen sind
eigenständig formulierte Kurzbeschreibungen, Wikipedia diente als Recherche-Einstieg. Das ist keine
fachliche Freigabe: Sicherheits-, Normen-, Rechts- und herstellerspezifische Aussagen vor dem Setzen
auf `verified` gegen Normen, Regeln und Herstellerunterlagen prüfen.
