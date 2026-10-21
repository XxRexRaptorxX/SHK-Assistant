# SHK-Assistant

Offline-fähige Web-App (PWA) als Werkzeugkasten für Heizungsbauer: Formeln mit Rechner, Umrechner,
Checklisten, Lexikon, Favoriten und Suche über alles. Läuft nach dem ersten Aufruf ohne Netz und
lässt sich auf dem Handy installieren („Zum Startbildschirm hinzufügen“).

Projektregeln: [CLAUDE.md](CLAUDE.md) · Inhalte pflegen: [content/README.md](content/README.md)

## Befehle

| Befehl                   | Wofür                                                        |
|--------------------------|--------------------------------------------------------------|
| `npm install`            | Abhängigkeiten installieren (einmalig, Node 22)              |
| `npm run dev`            | Entwicklungsserver mit automatischem Neuladen                |
| `npm run build`          | interne Edition nach `dist/` bauen (prüft alle Inhalte)      |
| `npm run build:public`   | öffentliche Edition: Einträge mit `visibility: "internal"` werden entfernt |
| `npm run preview`        | gebaute Version lokal ansehen (inkl. Offline-Betrieb)        |
| `npm test`               | alle Tests, u. a. jede Formel gegen ihre Testbeispiele       |
| `npm run content:report` | Übersicht: was ist geprüft, wo fehlen Quelle, Formel, Definition … |
| `npm run icons`          | Logo (`public/favicon.svg`) und App-Icons aus der SVG-Vorlage in `tools/generate-icons.ts` neu erzeugen (braucht Edge oder Chrome) |

## Inhalte

Alle Fachinhalte liegen als JSON in `content/`, nie im Code. Der Build prüft sie und bricht bei
Fehlern mit einer Meldung je Datei ab, z. B. fehlende Pflichtfelder, doppelte IDs, unbekannte
Einheiten oder Formeln, die ihr Testbeispiel nicht ergeben. Einträge mit `status: "draft"`
erscheinen in der App als **ungeprüft**. Freigeben: `status: "verified"`, Quelle, Kürzel und Datum.

## Aufbau

- `content/` – Fachinhalte (JSON), je Modul ein Ordner
- `src/modules/` – Module: Formeln, Umrechner, Checklisten, Lexikon, Einheiten
- `src/favorites/`, `src/search/`, `src/storage/` – Favoriten, Suche, lokale Speicherung (IndexedDB)
- `tools/` – Build-Werkzeuge: Inhalte laden und prüfen, Vite-Plugin, Berichte
- `tests/` – Tests für Build, Public-Bundle (keine internen Inhalte) und Offline-Fähigkeit

## Updates

Neue Versionen übernimmt die App beim nächsten Öffnen automatisch und lädt einmal neu.
Favoriten und Checklisten-Fortschritt bleiben erhalten (lokal auf dem Gerät).
