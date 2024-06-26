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

### Standorte eintragen

Die Funktion "Standorte eintragen" fragt die Standorte der markierten Titel an der UB Bern ab und schreibt die Ergebnisse ins Zielfeld (Standard: Zusammenfassung, konfigurierbar in den Einstellungen). Zusätzlich werden Tags basierend auf den Ergebnissen gesetzt, um eine schnelle Filterung zu ermöglichen.

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

Ergebnis:
- "20 // 200, 230 // E+p, MEX"

Durch die Zuordnung der wichtigsten Tags auf die Tasten 1-9 kann man sehr effizient Tags vergeben und dann per "Bestellnotiz eintragen" die Bestellnotizen für eine gesamte Bestellung en bloc eintragen lassen.

## Entwicklung

1. Repository klonen oder forken.
2. Einrichtung der Entwicklungsumgebung:
   - Befolgen Sie die Anweisungen zur [Einrichtung der Entwicklungsumgebung](https://www.zotero.org/support/dev/client_coding/plugin_development#setting_up_a_plugin_development_environment) und verwenden Sie die [Firefox Developer Tools](https://www.zotero.org/support/dev/zotero_7_for_developers#using_the_firefox_developer_tools).

3. Entwicklung in einem Branch.
4. Tests:
   - Führen Sie Tests mit `npm test` durch (vorausgesetzt `node` und `jest` sind installiert).
   - Passen Sie bestehende Tests an und erstellen Sie neue Tests, falls erforderlich.

5. Release-Workflow:
   - Der Befehl `make` führt den Release-Workflow aus.

## License

Copyright (C) 2019--2024 Denis Maier

Distributed under the GPLv3 License.