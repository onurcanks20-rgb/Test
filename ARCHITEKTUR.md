# Kostentracker: Dateiaufteilung der Testversion

Grundlage: die angeglichene Testversion aus deiner Hauptapp-vorbereitet(1).zip. Die Hauptapp wird nicht verändert. Reise-Umrechner und neue Zahlungsquellen sind nicht Teil dieses Umbaus.

## Aufbau

- `index.html`: bestehende Ansichten, Formulare und Verweise auf die Dateien.
- `css/app.css`: bisherige Grundgestaltung, Kategorien und Farbthemen.
- `css/bedienung.css`: bisherige Wisch- und Auswahlgestaltung.
- `js/kategorien/`: getrennte Dateien für Haushalt, Freizeit, Fixkosten, Versicherungen, Einnahmen, geplante Ausgaben, Sparen & Investieren und Reisen. Gemeinsame Alltagslisten stehen in `alltag-gemeinsam.js`.
- `js/core/`: Speicherung, Backup, Formatierung und Suchhilfen.
- `js/budget/`: Gehalt, Zeiträume, Fälligkeiten, Wochenbudget und Übersicht.
- `js/ui/`: Navigation, Einstellungen, Archiv, Formulare, Schnelleingabe, Verschieben, Rückgängig und Wischgesten.
- `js/grafik/diagramme.js`: Diagramme und Vergleiche.
- `js/server/synchronisierung.js`: bestehende Serveranbindung, Zuordnung, Prüfung, Import und Banner.
- `js/app/design-start.js`: frühe Anwendung des gespeicherten Designs.
- `js/app/start.js`: bestehende Dateninitialisierung, Migrationen, gemeinsamer Zustand, Listener und erstes Rendern in ihrer bisherigen Reihenfolge.
- `service-worker.js`: zusammenhängende Offline-Version aller benötigten HTML-, CSS- und JS-Dateien.
- `worker.js`: unveränderter Testserver; keine Zugangscodes enthalten.

## Bewusster erster Schritt

Die 398 bisherigen Funktionen sind nach Zuständigkeit auf Dateien verteilt. Ihre Funktionskörper sind unverändert. Der bestehende gemeinsame Zustand `daten` und `state` sowie die öffentlichen Funktionen für HTML-Handler bleiben bestehen. Das ist eine überprüfbare Dateiaufteilung, noch keine vollständige Entkopplung zu ES-Modulen.

Die kategorieweise Trennung ermöglicht den nächsten Umbau, ohne erneut die gesamte große Datei durchsuchen zu müssen. Wenn wir eine Kategorie erweitern, können wir anschließend deren Schnittstellen gezielt vom globalen Zustand lösen. Für diese erste Umstellung werden keine zusätzlichen Frameworks, Paketinstallation oder Build-Schritte benötigt.

## Ladefolge und Offline-Updates

Die Funktionsdateien werden synchron vor `js/app/start.js` geladen. Erst danach starten Wischgesten, Zurückwischen und Serveranbindung. `async` oder `defer` nicht einzeln ergänzen und die Reihenfolge nicht willkürlich ändern; die Migrationen benötigen bereits definierte Helfer.

`docs/ladefolge.json` zeigt die genaue Reihenfolge. `docs/funktionsindex.json` zeigt, in welcher Datei eine Funktion liegt. Das Original-HTML wird für den Betrieb nicht mehr gebraucht.

Beim Zurückwischen werden die Styles aus den geladenen lokalen Stylesheets gelesen, damit die Vorschau im Schatten-DOM weiterhin dieselbe Gestaltung erhält. Die Gestenabläufe bleiben gleich.

Der Service Worker installiert HTML und alle benötigten Skripte/Styles als vollständigen Satz. Fehlt eine Pflichtdatei, wird das neue Update nicht aktiviert. HTML und Code werden anschließend aus derselben Cache-Version gelesen. Bei späteren Änderungen immer die Revision der Dateiverweise UND die Worker-Version erhöhen und den vollständigen Satz veröffentlichen.

## Daten und Server

Lokale Daten: `kostenApp_test`. Zugang und Profil: `kostenApp_test_server`, `kostenApp_test_user` sowie der bisherige Backup-Prüfmarker. Keine Produktionsdaten werden geladen oder geschrieben. Server: `https://kostentracker-test.onurcanks20.workers.dev`. Bestehende Testcodes und Datenbank bleiben bestehen.

## Geprüft

- Vollständige Script-Ladefolge mit simuliertem DOM: gleiche Standarddaten und Migrationsergebnisse wie vor der Aufteilung.
- Alle 398 Funktionskörper und die Initialisierungs-Anweisungen unverändert; CSS-Inhalte unverändert.
- Such-/Sortierlisten, Löschen, Kategorien bearbeiten, Eingabe-Escaping und Reminder.
- Speichern, Fehler-Rollback, Wiederholen und Rückgängig über die Kategorien hinweg.
- Fingerführung, Öffnen/Schließen, Voll-Swipe, Lösch-/Ausblendanimation und Zurückwischen.
- Trade-Republic-Erkennung, Benutzertrennung, Doppelprüfung, Fixkosten-/Versicherungsabgleich, Bäckerei-Zuordnung und Banner.
- Gemeinsames Vorladen von HTML, 34 Skripten und zwei Stylesheets, Offline-Ressourcen, Ablehnung unvollständiger Updates und Trennung vom Hauptapp-Cache.

Keine echte iPhone-Darstellung geprüft. Ein lokaler Browserlauf war wegen fehlendem Browser und nicht verfügbarem Browserdownload nicht möglich. Das Ersetzen auf dem Handy bleibt deshalb ein abschließender Test in der Testumgebung.

## Funktionsdateien

| Datei | Funktionen |
| --- | ---: |
| `js/core/speicherung-backup.js` | 9 |
| `js/ui/rueckgaengig.js` | 7 |
| `js/ui/erinnerungen.js` | 16 |
| `js/core/formatierung.js` | 23 |
| `js/budget/gehalt.js` | 22 |
| `js/ui/navigation.js` | 24 |
| `js/ui/eintragsaktionen.js` | 15 |
| `js/ui/einstellungen.js` | 18 |
| `js/ui/archiv.js` | 19 |
| `js/budget/wochenbudget.js` | 7 |
| `js/ui/schnelleingabe.js` | 33 |
| `js/kategorien/geplante-ausgaben.js` | 18 |
| `js/kategorien/sparen-investieren.js` | 11 |
| `js/kategorien/reisen.js` | 31 |
| `js/kategorien/fixkosten.js` | 10 |
| `js/ui/listen.js` | 3 |
| `js/kategorien/versicherungen.js` | 14 |
| `js/budget/berechnungen.js` | 3 |
| `js/ui/verschieben.js` | 10 |
| `js/kategorien/einnahmen.js` | 8 |
| `js/kategorien/haushalt.js` | 11 |
| `js/kategorien/freizeit.js` | 10 |
| `js/ui/formulare.js` | 17 |
| `js/kategorien/alltag-gemeinsam.js` | 7 |
| `js/ui/ausgabenarchiv.js` | 6 |
| `js/budget/faelligkeiten.js` | 4 |
| `js/budget/zeitraeume.js` | 3 |
| `js/budget/uebersicht.js` | 6 |
| `js/grafik/diagramme.js` | 33 |
