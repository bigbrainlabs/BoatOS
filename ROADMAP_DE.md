# BoatOS Roadmap

*Aktuell: **v1.6.11** · Stand Juli 2026*

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

| Feature | Beschreibung | Kategorie |
|---------|-------------|-----------|
| AIS-Kollisionswarnung | CPA/TCPA-Berechnung — Alert bei Kollisionskurs | Sicherheit |
| Kursabweichungs-Alert (XTE) | Warnung wenn Boot vom geplanten Kurs abweicht | Sicherheit |
| Marina & Ankerplatz POIs | Konfigurierbare POI-Datenbank (OpenSeaMap-Import), revier-unabhängig | Karte |
| Gezeitenintegration | Tidenkurven, ETA-Anpassung für tideabhängige Abschnitte | Daten, Routing |

---

## Umgesetzt — 3D-Karte & Route-Wetter (im Beta-Zweig)

| Feature | Beschreibung | Kategorie |
|---------|-------------|-----------|
| 3D-/Look-ahead-Kartenansicht (Deck) | Gekippte head-up-Perspektive der Fahrrinne voraus (Kamera-Pitch + COG-Follow, Zoom-Ziel), auf den bestehenden IENC-Vektordaten | Karte |
| Echte 3D-Seezeichen (Deck) | Tonnen/Baken als echte 3D-Objekte via three.js + MapLibre-Custom-Layer, datengetrieben aus IENC (`TOPSHP`/`COLOUR`/`CATCAM`). Perf auf dem Ziel-Pi verifiziert. Ausbau siehe v1.9 | Karte |
| Route-Wetter offline nutzbar | `/api/weather/route` liefert den Forecast entlang der Route (an der jeweiligen ETA), mit Datei-Cache → ohne Internet nutzbar. **GRIB wird dafür nicht gebraucht** — der ursprüngliche GRIB-Punkt ist damit erledigt | Daten |
| Logbuch-Export (PDF) | Törnbericht als PDF (`pdf_export.py`, `GET /api/trip/pdf/{id}`), aus dem Logbuch heraus abrufbar | UX |

---

## v1.9 — Offline-First

| Feature | Beschreibung | Kategorie |
|---------|-------------|-----------|
| Wetter-Alarme | **Backend existiert bereits** (`weather_alerts`-Modul, `/api/weather/alerts` + `/cached`) — liefert amtliche Warnungen. Fehlt: die UI dafür, und die Entscheidung, ob zusätzlich eigene Schwellwerte (Sturm, Starkwind, Sicht) konfigurierbar sein sollen | Sicherheit |
| Wetter-Overlay auf Karte | Wind-Pfeile entlang der Route mit Farbcodierung nach Stärke. Aktuell gibt es nur ein DOM-Panel (`route-weather-overlay`), nichts auf der Karte selbst | Karte |
| Helm-Map-Engine für 3D-Perspektive | `flutter_map` (^8.1.1) ist 2D (nur Drehung, kein Pitch) — für die 3D-Ansicht auf dem Helm Wechsel auf eine MapLibre-native Flutter-Engine (GPU); flutter-pi-Ressourcen prüfen. Ohne Wechsel bleibt der Helm bei head-up 2D | Karte, Plattform |
| 3D-Seezeichen — Ausbau & Feinschliff | Aufbauend auf den echten 3D-Tonnen (three.js + MapLibre Custom-Layer, IALA/S-57 aus `TOPSHP`/`COLOUR`, `js/buoy3d.js`): weitere `TOPSHP`-Codes, Baken als Stange statt Tonne, Leuchtfeuer(-Sektoren), `notmrk` als 3D-Tafelschilder, Klick-Popups auf 3D-Objekte; Feinschliff bei Beleuchtung/Anti-Aliasing, Größe & Sichtbarkeit (Zoom-Schwellen), Kardinal-Toppzeichen-Ausrichtung | Karte |

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

---

*Versionierungsschema: `major.features.bugfixes` — zweites Segment für neue Features, letztes für Bugfixes.*
