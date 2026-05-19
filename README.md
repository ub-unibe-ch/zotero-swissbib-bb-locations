# Zotero Swisscovery UB Bern Locations

`Zotero Swisscovery UB Bern Locations` ist ein Addon für das Literaturverwaltungsprogramm [Zotero](https://www.zotero.org/) sowie das darauf basierende [Jurism](https://juris-m.github.io/) zur Unterstützung des Bestandesaufbaus an der UB Bern. Das Addon kann über die SRU-Schnittstelle im [Swisscovery UB Bern](https://ubbern.swisscovery.slsp.ch/) Standortinformationen zu den ausgewählten Einträgen abrufen und -- je nach Ergebnis der Abfrage -- entsprechende Tags setzen. 

## Installation und Konfiguration

1. **Herunterladen der neuesten Version:**
   - Besuchen Sie die [Releases-Seite](https://github.com/ub-unibe-ch/zotero-swissbib-bb-locations/releases).
   - Unter Firefox: Rechtsklick auf die xpi-Datei -> "Speichern unter"; andernfalls wird versucht, das Plugin direkt in Firefox zu installieren, was zu einer Fehlermeldung führt.

2. **Installation in Zotero:**
   - Gehen Sie zu: Werkzeuge -> Plugins -> Zahnrad-Symbol -> "Add-on aus Datei installieren".

3. **API-Key Konfiguration:**
   - Damit die Ausleihbedingungen aus ALMA abgerufen werden können, muss der API-Key eingetragen werden. Je nach Zotero-Version finden Sie die Einstellung an folgenden Orten:
     - Zotero 6: Werkzeuge -> Einstellungen für Swisscovery UB Bern Standortabfrage -> API Key
     - Zotero 7: Allgemeines Zotero Einstellungsmenü -> Reiter "Swisscovery UB Bern Locations" -> API Key für Alma

## Benutzung

- **Kontextmenü-Funktionen:**
  - Rechtsklick auf einen oder mehrere Titel -> "Swisscovery UB Bern Standortabfrage". Es stehen folgende Funktionen zur Verfügung:
    - Standorte abfragen
    - Bestellnotiz eintragen
    - DDC-Tag hinzufügen…
    - Bestellcode wählen…

### Standorte eintragen

Die Funktion "Standorte eintragen" fragt die Standorte der markierten Titel an der UB Bern ab und schreibt die Ergebnisse ins Zielfeld (Standard: Zusammenfassung, konfigurierbar in den Einstellungen). Zusätzlich werden Tags basierend auf den Ergebnissen gesetzt, um eine schnelle Filterung zu ermöglichen.

Die gesetzten Tags beginnen alle mit dem Präfix `__UB Bern Standortcheck: …`, so dass sie in Zoteros Tag-Selektor ganz oben einsortiert werden.

### Bestellnotiz eintragen

Die Funktion "Bestellnotiz eintragen" erstellt basierend auf gesetzten Tags die korrekte Bestellnotiz für den Bestellworkflow im TGW/Unitobler und schreibt diese ins Feld "Band". Erkannt werden Tags nach folgendem Muster:
  - Etat: "Etat 20"
  - DDCs: Pro DDC ein Tag nach dem Muster "DDC 200"
  - Bestellcodes: Bestellcodes nach dem Muster "BC MEX"

Beispiel:
- Vergebene Tags:
  - "Etat 20"
  - "DDC 200"
  - "DDC 230"
  - "BC MEX"
  - "BC E+p"
  - "BC PB"

Ergebnis:
- "20 // 200, 230 // E+p, MEX, PB"

Der bequemste Weg, die DDC- und BC-Tags zu vergeben, sind die beiden Picker-Dialoge "DDC-Tag hinzufügen…" und "Bestellcode wählen…" (siehe unten). Alternativ lassen sich die wichtigsten Tags in Zotero auf die Tasten 1–9 legen, um sie noch schneller zuweisen zu können.

### DDC-Tag hinzufügen

Öffnet einen durchsuchbaren Dialog mit der DNB-CH-Klassifikation. Mehrere DDCs können in einer Session ausgewählt und gleichzeitig auf alle markierten Titel angewendet werden.

- **Footer-Chips** zeigen den aktuellen Stand:
  - "Vergeben (alle)" — bei allen markierten Items bereits gesetzt
  - "Vergeben (teilw.)" — nur bei einem Teil der Items gesetzt (orange)
  - "Auswahl" — aktuelle Picker-Auswahl, in Toggle-Reihenfolge
- **Tastenkürzel** im Dialog:
  - `Enter` — Eintrag auswählen
  - `Shift+Enter` — auswählen und Filter zurücksetzen
  - `Cmd/Ctrl+Enter` — Auswahl übernehmen
  - `Esc` — abbrechen
- **Globaler Shortcut** zum Öffnen des Pickers konfigurierbar unter Einstellungen → "Tastenkombinationen" → "DDC-Auswahl" (Default leer).

### Bestellcode wählen

Gleicher Dialog-Stil wie der DDC-Picker, aber für die Bestellcodes. Die Einträge sind in Gruppen organisiert:

- **Print / Verfügbarkeit** — MEX-Varianten (MEX, MEXo, MEXp), UBE, SLSP
- **E-Book** — E1/E3/E+ inklusive `p`-/`s`-/`ps`-Varianten, OA
- **Format** — PB (Paperback)
- **Bernensia** — Ausleihe-Varianten (Ausleihe, +Archiv, +Archiv+Ansicht), bb (Berner Belletristik)

Zusätzlich erlaubt der Dialog **Freitext-Eingabe** für seltene oder ad-hoc-Codes (`+ "<text>" hinzufügen` als letzter Treffer in der Filterliste).

Tastenkürzel im Dialog identisch zum DDC-Picker; globaler Shortcut konfigurierbar unter Einstellungen → "BC-Auswahl".

## Entwicklung

1. Repository klonen oder forken.

2. Abhängigkeiten installieren:
   ```bash
   npm install
   # oder pnpm install
   ```

3. Entwicklung mit Hot Reload:
   ```bash
   pnpm run start
   # oder npm start
   ```
   Startet den Entwicklungsserver mit automatischem Neuladen bei Änderungen.

4. Tests durchführen:
   ```bash
   pnpm run test
   # oder npm test
   ```

5. Changelog manuell aktualisieren (CHANGES.md):
   ```markdown
   ## vX.Y.Z (YYYY-MM-DD)
   - Änderungen hier eintragen
   ```

6. Release erstellen:
   ```bash
   # Im feature branch vor dem Merge:
   pnpm run bump         # Version bump (patch/minor/major)

   # Nach Merge nach master:
   git checkout master && git pull
   pnpm run tag          # Tag erstellen + pushen
   ```

   Der CI-Workflow erstellt dann automatisch das GitHub Release mit XPI und update.json.

   **Optionen:**
   - `pnpm run tag:dry` - Vorschau ohne Änderungen
   - `pnpm run tag:force` - Bestehenden Tag überschreiben

   **Hinweis:** `bump` ist optional — die Version kann auch manuell in `package.json` geändert werden.

## License

Copyright (C) 2019--2026 Denis Maier

Distributed under the GPLv3 License.