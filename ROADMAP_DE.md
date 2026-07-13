# BoatOS Roadmap

*Aktuell: **v1.7.3** · Stand Juli 2026*

---

## v1.8 — Sicherheit & Komfort

| Feature | Beschreibung | Kategorie |
|---------|-------------|-----------|
| AIS-Kollisionswarnung | CPA/TCPA-Berechnung — Alert bei Kollisionskurs | Sicherheit |
| Kursabweichungs-Alert (XTE) | Warnung wenn Boot vom geplanten Kurs abweicht | Sicherheit |
| Marina & Ankerplatz POIs | Konfigurierbare POI-Datenbank (OpenSeaMap-Import), revier-unabhängig | Karte |
| Gezeitenintegration | Tidenkurven, ETA-Anpassung für tideabhängige Abschnitte | Daten, Routing |

---

## v1.9 — Offline-First

| Feature | Beschreibung | Kategorie |
|---------|-------------|-----------|
| Offline-Wetterdaten (GRIB) | Forecast für aktive Route herunterladen und ohne Internet nutzen | Daten |
| Wetter-Alarme | Konfigurierbare Schwellwerte für Sturm, Starkwind, Sichteinschränkung | Sicherheit |
| Wetter-Overlay auf Karte | Wind-Pfeile entlang der Route mit Farbcodierung nach Stärke | Karte |
| Logbuch-Export (PDF / HTML) | Törnbericht mit Track-Karte — für Versicherung, Archiv | UX |
| Fotos im Logbuch | Bilder zu Etappen hinzufügen — lokal auf dem Pi, kein Cloud-Upload | UX |

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

*Versionierungsschema: `major.month.release` — nur letztes Segment inkrementieren.*
