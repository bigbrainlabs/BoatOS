# BoatOS Roadmap

*Aktuell: **v1.7.3** · Stand Juli 2026*

---

## Umgesetzt — Amtliche Seekarten (IENC)

| Feature | Beschreibung | Kategorie |
|---------|-------------|-----------|
| ELWIS-ENC-Pipeline | Amtliche Inland-ENC der WSV per Katalog herunterladen (Hintergrund-Job mit Fortschritt), S-57 → Vektor-Tiles konvertieren; Katalog-Cache übersteht ELWIS-Ausfälle | Karte, Daten |
| IENC-Vektor-Darstellung | Tiefenbereiche, Fahrrinne, Brücken/Wehre/Freileitungen mit Durchfahrtshöhen, Binnenschifffahrtszeichen (CEVNI), Betonnung, Kilometrierung — mit Klick-Popups. Deck (MapLibre) und Helm (Flutter) | Karte |
| Route-Hindernis-Warnung | Nach der Routenberechnung Prüfung gegen die IENC-Daten: zu niedrige Brücken/Freileitungen vs. Bootshöhe, Flachstellen vs. Tiefgang (mit Pegel-Korrektur über W−MNW), Wehre — als Marker + Panel | Sicherheit, Routing |
| Routing: Umflutkanäle ausgeschlossen | Hochwasser-Entlastungsgewässer und Altarme (z.B. Elbe-Umflutkanal Magdeburg) werden nicht mehr als Fahrweg genutzt; explizit freigegebene (Dahme-Umflutkanal) bleiben befahrbar | Routing |

---

## v1.8 — Sicherheit & Komfort

### Umgesetzt

| Feature | Beschreibung | Kategorie |
|---------|-------------|-----------|
| **Marina & Ankerplatz POIs** | Häfen/Marinas (OSM) und Ankerplätze (OpenSeaMap-Seamarks) als Tropfen-Pins auf der Karte, mit Detail-Popup (Liegeplätze, UKW, Service-Ausstattung, Tiefe). **Offline-Vorabimport** alle 48 h statt Live-Abfrage pro Kartenbewegung → kein Rate-Limit, funktioniert ohne Netz. Ein-/Ausschalter in den Karten-Settings | Karte |
| **Gezeiten (MVP)** | Tidenkurve der nächsten Pegelstation (PegelOnline): aktueller Stand, Trend (Flut/Ebbe), letztes Hoch-/Niedrigwasser, SVG-Sparkline — folgt der Kartenmitte. Gemessen; harmonische Vorhersage siehe unten | Daten |

### Offen

| Feature | Beschreibung | Kategorie |
|---------|-------------|-----------|
| Kursabweichungs-Alert (XTE) | Warnung wenn Boot vom geplanten Kurs abweicht | Sicherheit |
| Gezeiten — Ausbau | Harmonische **Vorhersage** von Hoch-/Niedrigwasser (offline, aus Bezugsort-Konstanten) + ETA-Anpassung durch Tidenstrom für tideabhängige Abschnitte | Daten, Routing |

---

## v1.9 — 3D-Karte & Wetter

Der Entwicklungszweig `v1.9.x-dev`. Die 3D-Darstellung ist der Schwerpunkt dieser
Version — siehe die Vorschau oben in der [README](README_DE.md).

### Umgesetzt

| Feature | Beschreibung | Kategorie |
|---------|-------------|-----------|
| **3D-/Look-ahead-Kartenansicht (Deck)** | Gekippte head-up-Perspektive der Fahrrinne voraus: Kamera folgt dem Kurs (COG), Blick in Fahrtrichtung, Boot in die untere Bildhälfte. Neigung per Tasten regelbar (20–75°, gemerkt), Zoom-Ziel je nach Bildschirmbreite (16.0 Handy … 17.5 Desktop). Basiert auf den bestehenden IENC-Vektordaten — keine zusätzlichen Daten nötig | Karte |
| **Echte 3D-Seezeichen (Deck)** | Tonnen und Baken als echte 3D-Objekte (three.js + MapLibre-Custom-Layer), datengetrieben aus den amtlichen IENC-Daten (`_cls`/`COLOUR`/`TOPSHP`/`CATCAM`) — Farben und Toppzeichen kommen aus der Karte, nicht aus einer Annahme. Performance auf dem Ziel-Pi verifiziert. Ausbau siehe unten | Karte |
| Wetter-Alarme | Amtliche Warnungen (DWD über Bright Sky, Standard) oder OpenWeather One Call 3.0 als Opt-in; zusätzlich eigener Wind-Schwellwert. Badge in der Kopfzeile + Panel; API-Key konfigurierbar (Settings → Wetter) | Sicherheit |
| Wind-Overlay auf der Karte | Wind-Pfeile entlang der Route — je Stützpunkt die Vorhersage zur **jeweiligen ETA** —, dazu der aktuelle Wind am Boot. Farbcodiert nach Stärke, Klick-Popup mit Böen und Herkunftsrichtung | Karte |
| Standortgenaues Wetter | Wetter und Warnungen kommen vom aktuellen Standort statt von einer festen Position; Neuabruf nach 15 min oder ab 10 km Ortswechsel | Daten |
| Route-Wetter offline nutzbar | `/api/weather/route` liefert den Forecast entlang der Route (an der jeweiligen ETA), mit Datei-Cache → ohne Internet nutzbar. **GRIB wird dafür nicht gebraucht** — der ursprüngliche GRIB-Punkt ist damit erledigt | Daten |
| Logbuch-Export (PDF) | Törnbericht als PDF (`pdf_export.py`, `GET /api/trip/pdf/{id}`), aus dem Logbuch heraus abrufbar (inzwischen auch in `main`) | UX |

### Offen

| Feature | Beschreibung | Kategorie |
|---------|-------------|-----------|
| 3D-Seezeichen — Ausbau & Feinschliff | Aufbauend auf den echten 3D-Tonnen (`js/buoy3d.js`): weitere `TOPSHP`-Codes, Baken als Stange statt Tonne, Leuchtfeuer(-Sektoren), `notmrk` als 3D-Tafelschilder, Klick-Popups auf 3D-Objekte; Feinschliff bei Beleuchtung/Anti-Aliasing, Größe & Sichtbarkeit (Zoom-Schwellen), Kardinal-Toppzeichen-Ausrichtung | Karte |
| Helm-Map-Engine für 3D-Perspektive | `flutter_map` (^8.1.1) ist 2D (nur Drehung, kein Pitch) — für die 3D-Ansicht auf dem Helm Wechsel auf eine MapLibre-native Flutter-Engine (GPU); flutter-pi-Ressourcen prüfen. Ohne Wechsel bleibt der Helm bei head-up 2D | Karte, Plattform |

---

## v1.10 — Plattform

| Feature | Beschreibung | Kategorie |
|---------|-------------|-----------|
| REST-API v1 stable | Versionierung, OpenAPI-Doku, Deprecation-Policy | Platform |
| Plugin-System | Event-Bus + Plugin-Verzeichnis für externe Erweiterungen ohne Fork | Platform |
| CI/CD & automatische Releases | GitHub Actions baut Image und Release automatisch | Platform |
| Test-Abdeckung Backend | Pytest für Routing-Logik, Strömungsberechnung, Schleusenzeitplanung | Platform |

---

## Backlog — Ideen & Zukunft

| Feature | Beschreibung | Hinweis |
|---------|-------------|---------|
| Ankerwacht | GPS-Drift-Alarm mit konfigurierbarem Radius | |
| Tiefenmesser | Echtzeit-Tiefe via MQTT, Warnungen, Tiefenverlauf | braucht Hardware |
| Multi-Route-Vergleich | Mehrere Optionen nebeneinander — Distanz, Schleusen, ETA | |
| NMEA 2000 | N2K-Bus-Anbindung für Motor, Tank, Wind, Tiefe | braucht CAN-Bus |
| Smartphone-Companion | Position, ETA, Warnungen als PWA auf dem Handy | |
| Autopilot-Anbindung | Kurs halten, Wegpunkt-Ansteuerung | braucht Hardware |
| Schleusen-Anmelde-Historie | Status-Tracking: angemeldet / bestätigt / passiert. Aktuell gibt es nur den „Anmelden"-Button ohne Zustand | Konzept offen |
| AIS-Kollisionswarnung | CPA/TCPA-Berechnung — Alert bei Kollisionskurs | braucht AIS-Empfang |

---

*Versionierungsschema: `major.features.bugfixes` — zweites Segment für neue Features, letztes für Bugfixes.*
