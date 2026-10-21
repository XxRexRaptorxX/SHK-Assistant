# SHK-Helfer – Projektregeln für Claude

## Ziel
Offline-fähige PWA als Werkzeugkasten für Heizungsbauer.
Aktuell **intern** für unser Team, später als **öffentliche Version**.
Alle Fachinhalte werden vom Projektinhaber (SHK-Fachmann) geprüft und freigegeben.

## Stack
- Vite + React + TypeScript (`strict: true`)
- vite-plugin-pwa (`registerType: 'autoUpdate'`), offline-first: alle Inhalte werden vorgecacht
- React Router (HashRouter, damit es auf jedem Hoster ohne Server-Konfiguration läuft)
- Tailwind CSS, keine weitere UI-Bibliothek
- mathjs für Formelberechnung und Einheitenumrechnung (kein `eval()`)
- Fuse.js für die globale Suche (clientseitig)
- IndexedDB über `idb` für Favoriten und Checklisten-Fortschritt
- zod für Schema-Validierung der Inhalte
- Vitest für Tests

## Sprache
- UI-Texte deutsch, Code und Bezeichner englisch, Kommentare dürfen deutsch sein.

## Grundregel: Code und Inhalte trennen
- Fachinhalte liegen ausschließlich in `content/` als JSON oder Markdown. Niemals Fachdaten im Code hart codieren.
- **Erfinde niemals Fachinhalte.** Keine Fehlercodes, Zulassungsnummern, Formeln, Grenzwerte, Normverweise oder Herstellerangaben aus eigenem Wissen. Fehlen Inhalte für ein Feature: Platzhalter mit `"status": "draft"` und Text `TODO: Inhalt fehlt` anlegen und mir am Ende eine Liste der benötigten Daten geben.
- Jeder Inhaltseintrag hat Pflicht-Metadaten:
  ```json
  {
    "id": "stabile-eindeutige-id",
    "visibility": "internal | public",
    "status": "draft | verified",
    "source": "Quelle (Dokument, Seite, Link)",
    "verifiedBy": "Kürzel",
    "verifiedAt": "YYYY-MM-DD"
  }
  ```
- Einträge mit `status: "draft"` werden in der UI deutlich als **ungeprüft** markiert.
- Alle Inhalte werden beim Build mit zod validiert. Fehlende Pflichtfelder lassen den Build fehlschlagen.

## Interne vs. öffentliche Version
- Edition über Umgebungsvariable `VITE_EDITION=internal|public`.
- Im public-Build werden Einträge mit `visibility: "internal"` beim Build **entfernt**, nicht nur ausgeblendet (sonst stehen sie lesbar im JS-Bundle). Dafür einen Test schreiben, der das public-Bundle auf interne IDs prüft.
- Module, die nur intern existieren, über `src/config/edition.ts` schalten.
- Der public-Build enthält Seiten für Impressum, Datenschutzerklärung und Haftungshinweis. Nur Platzhalter anlegen, keine Rechtstexte erfinden.

## Urheberrecht
- Keine Normtexte, Herstelleranleitungen, Strangschemata oder Bilder Dritter in `content/` kopieren.
- Erlaubt: Normnummer, eigene Kurzbeschreibung, Link zur Quelle.

## Module
1. **Formelsammlung mit Rechner**
   - Formeln in `content/formulas/*.json`: Beschreibung, Variablen mit Einheit, Formel als mathjs-Ausdruck.
   - Jede Formel enthält mindestens ein Testbeispiel mit Referenzwert (vom Inhaber geliefert). Vitest prüft alle Formeln automatisch gegen ihre Testbeispiele.
   - Eingaben mit Einheit, Ergebnis mit sinnvoller Rundung und Einheit.
2. **Umrechner**: mathjs-Einheiten, SHK-typische Einheiten ergänzen (z. B. bar/mWS, kW/kcal/h). Neue Einheiten ebenfalls mit Tests.
3. **Checklisten** (Wartung usw.): `content/checklists/`. Fortschritt lokal speichern, Druckansicht per Print-CSS.
4. **Lexikon**: Bauteile und Begriffe im SHK-Bereich.
5. **Wiki**: kuratierte Links, gegliedert nach Hersteller und Kategorie (Anleitungen, Strangschemata, Normen, UVV/DGUV).
6. **Heizquellen-Vergleich**: Vor- und Nachteile je Heizquelle.
7. **Fehlerfinder**: Hersteller → Geräteserie → Fehlercode → Bedeutung, Ursachen in Prüfreihenfolge, Quelle. Codes immer pro Geräteserie, nie pro Hersteller pauschal.
8. **Brandschutz-Helfer**: Eingabe der Einbausituation, Ausgabe nur aus geprüften Datensätzen. Keine Logik, die Zulässigkeit aus allgemeinen Regeln ableitet. Jede Ausgabe nennt Produkt, Zulassungsnummer, Quelle und den Hinweis, die Originalzulassung zu prüfen.
9. **Fachmann-Codes**: nur `visibility: "internal"`.
10. **Branchen-News (RSS)**: später. Benötigt einen Proxy (Cloudflare Worker) wegen CORS. Nur Überschrift, Datum, Quelle und Link anzeigen.
11. **Favoriten**: Jedes Element (Formel, Checkliste, Begriff, Fehlercode …) ist über seine `id` favorisierbar. Speicherung in IndexedDB, Export/Import als JSON-Datei.
- **Globale Suche** über alle Module.

## Design
- Mobile first, große Touch-Ziele (Bedienung mit Handschuhen), hoher Kontrast (Keller, Sonnenlicht), Dark Mode.
- Jede Inhaltsseite zeigt Quelle und Prüfdatum.

## Arbeitsweise
- Nach jeder Änderung `npm run build` und `npm test` ausführen und Fehler selbst beheben.
- In kleinen Schritten arbeiten, ein Modul nach dem anderen. Vor größeren Umbauten erst einen Plan vorschlagen.
- Keine neuen Abhängigkeiten ohne kurze Begründung.

## Reihenfolge
- **Phase 1**: Grundgerüst, Navigation, Suche, Favoriten, Formelrechner, Umrechner, Checklisten, Lexikon
- **Phase 2**: Wiki, Heizquellen-Vergleich, Fehlerfinder
- **Phase 3**: Brandschutz-Helfer, News, Public-Edition
