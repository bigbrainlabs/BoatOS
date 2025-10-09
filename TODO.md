# BoatOS TODO Liste

## ✅ Abgeschlossen (v1.1.0)

- [x] GPS-Integration über SignalK
- [x] GPS-Panel mit allen Daten (Satelliten, Höhe, Speed, Heading, Fix-Status, Timestamp)
- [x] Mehrsprachigkeit (DE/EN) für gesamte UI
- [x] Wetter-Panel mit aktuellen Daten
- [x] Interaktive Karten (OpenSeaMap, OSM)
- [x] Wegpunkte erstellen und verwalten
- [x] Routen planen
- [x] Track-Aufzeichnung (Logbuch)
- [x] Echtzeit-Updates via WebSocket
- [x] Responsive Design
- [x] Automatisches Installations-Skript
- [x] Vollständige Dokumentation
- [x] **Einstellungen-Screen** (v1.1.0)
  - [x] Settings-Modal mit Tabs (Allgemein, Karten, Navigation, GPS, Wetter, Sensoren, Daten)
  - [x] Sprach-Einstellungen (DE/EN)
  - [x] Theme-Auswahl (Auto, Hell, Dunkel, Nacht)
  - [x] Einheiten-Konfiguration (Geschwindigkeit, Distanz, Tiefe)
  - [x] Persistente Speicherung (LocalStorage + Backend)
- [x] **Karten-Manager** (v1.1.0)
  - [x] In Einstellungen integriert (Tab "Karten")
  - [x] KAP-Chart Upload & Konvertierung (GDAL)
  - [x] ENC-Chart Upload & Konvertierung
  - [x] ELWIS ENC Download-Integration
  - [x] Progress-Modal für Konvertierung (1-3 Min. Feedback)
  - [x] Flexible Upload-Optionen (einzelne Dateien oder Ordner)
  - [x] Karten aktivieren/deaktivieren
  - [x] Karten löschen
  - [x] Nginx 2GB Upload-Limit für große Kartendateien
  - [x] GDAL-Installation im Installer

---

## 🚧 In Arbeit

### GPS & Navigation
- [ ] GPS-Qualitätsanzeige verbessern (HDOP/VDOP)
- [ ] GPS-Track-Historie auf Karte anzeigen
- [ ] Kompass-Rose mit Heading-Anzeige

### Karten
- [ ] Offline-Karten Caching implementieren
- [ ] Weitere Kartenebenen hinzufügen (Satellit, Topo)

### Wetter
- [ ] 3-Tage-Vorhersage im Weather-Panel
- [ ] Wind-Richtungs-Rose
- [ ] Tide-Vorhersagen integrieren
- [ ] Wetter-Alarme bei extremen Bedingungen

---

## 📋 Geplante Features

### Navigation & Sicherheit
- [ ] **Anker-Alarm**
  - Position beim Ankern speichern
  - Alarm bei Abdrift
  - Konfigurierbare Alarm-Distanz
  
- [ ] **MOB (Man Over Board) Funktion**
  - Schnell-Button für MOB
  - Automatische Wegpunkt-Setzung
  - Kurs zurück zum MOB-Punkt

- [ ] **Autopilot-Integration**
  - Kurs-Halten-Modus
  - Wegpunkt-Ansteuerung
  - Windwinkel-Modus (für Segelboote)

### Sensoren & Daten
- [ ] **AIS-Integration**
  - AIS-Schiffe auf Karte anzeigen
  - Kollisionswarnung (CPA/TCPA)
  - AIS-Details-Panel
  
- [ ] **Tiefenmesser-Integration**
  - Aktuelle Tiefe anzeigen
  - Tiefenwarnungen
  - Tiefen-Log

- [ ] **Sensor-Dashboard erweitern**
  - Motor-Daten (RPM, Temperatur, Öldruck)
  - Batterie-Monitoring (Spannung, Strom, Ladezustand)
  - Tank-Füllstände (Diesel, Wasser, Abwasser)
  - Wind-Daten (Geschwindigkeit, Richtung, apparent/true)

### Logbuch & Tracking
- [ ] **GPX-Export**
  - Tracks als GPX exportieren
  - Import von GPX-Tracks
  - Routen als GPX speichern

- [ ] **Track-Statistiken**
  - Durchschnittsgeschwindigkeit
  - Maximale Geschwindigkeit
  - Zurückgelegte Distanz
  - Fahrzeit vs. Gesamtzeit

- [ ] **Logbuch-Einträge**
  - Manuelle Einträge mit Zeitstempel
  - Fotos zu Einträgen
  - Crew-Management
  - Wetter-Bedingungen festhalten

### Routen & Planung
- [ ] **Routen-Bibliothek**
  - Routen speichern und laden
  - Routen teilen (Export/Import)
  - Favoriten-Routen

- [ ] **Erweiterte Routenplanung**
  - Automatisches Routing (Wasserstraßen)
  - Routenoptimierung (kürzeste/sicherste Route)
  - Tide-berücksichtigende Routen
  - Brücken-Höhen beachten

- [ ] **Wegpunkt-Kategorien**
  - Marinas
  - Ankerplätze
  - Gefahrenstellen
  - POIs (Points of Interest)

### UI/UX Verbesserungen
- [ ] **Einstellungen erweitern**
  - [ ] Navigation-Tab: Standardposition, Zoom-Level, Kurs-Up vs North-Up
  - [ ] GPS-Tab: SignalK-Verbindung testen, Update-Intervall
  - [ ] Wetter-Tab: API-Key Eingabe, Update-Intervall
  - [ ] Sensoren-Tab: MQTT-Konfiguration, Sensor-Mapping
  - [ ] Alarme-Tab: Anker-Alarm, Tiefen-Alarm, Kollisions-Alarm
  - [ ] Daten-Tab: GPX Import/Export, Backup/Restore

- [ ] **Dark Mode / Night Mode**
  - [ ] Automatischer Wechsel bei Sonnenuntergang
  - [ ] Rote Beleuchtung-Modus für Nachtfahrten

- [ ] **PWA Optimierung**
  - Offline-Funktionalität
  - App-Installation auf Mobile
  - Push-Benachrichtigungen

- [ ] **Touch-Gesten**
  - Pinch-to-Zoom optimieren
  - Swipe-Navigation zwischen Panels
  - Long-Press für Kontext-Menüs

- [ ] **Anpassbare Dashboard-Tiles**
  - Drag & Drop für Tile-Anordnung
  - Tile-Größen änderbar
  - Eigene Tiles erstellen

### Weitere Integrationen
- [ ] **NMEA 2000 Support**
  - N2K-Sensoren einbinden
  - PGN-Nachrichten verarbeiten

- [ ] **VHF-Radio-Integration**
  - DSC-Positionen anzeigen
  - Kanal-Übersicht

- [ ] **Wetter-Routing**
  - Optimale Route basierend auf Wettervorhersage
  - Wind-Vorhersage für Segler

### Community & Sharing
- [ ] **Daten-Synchronisation**
  - Cloud-Backup
  - Multi-Device-Sync
  - Offline-First Architektur

- [ ] **Hafen-Informationen**
  - Marinas-Datenbank
  - Liegeplatzverfügbarkeit
  - Preise und Kontakte
  - Bewertungen

---

## 🐛 Bekannte Bugs / Verbesserungsbedarf

- [ ] Sensor-Details-Modal implementieren (app.js:TODO)
- [ ] OSM Waterway Routing mit lokalen Daten (osm_routing.py:TODO)
- [ ] GPS-Höhe wird als 0 angezeigt (SignalK liefert keine Altitude)
- [ ] Cache-Buster automatisch generieren bei Deployment

---

## 🔧 Technische Verbesserungen

### Performance
- [ ] Lazy Loading für Karten-Tiles
- [ ] WebSocket-Reconnect optimieren
- [ ] Datenbank für lokale Speicherung (IndexedDB)
- [ ] Service Worker für besseres Caching

### Code-Qualität
- [ ] Unit Tests für Backend
- [ ] E2E Tests für Frontend
- [ ] ESLint/Prettier für Frontend
- [ ] Type Hints für alle Python-Funktionen
- [ ] API-Dokumentation (Swagger) erweitern

### DevOps
- [ ] CI/CD Pipeline (GitHub Actions)
- [ ] Automatische Releases
- [ ] Docker-Container für einfache Deployment
- [ ] Monitoring & Logging (Prometheus/Grafana)

### Sicherheit
- [ ] HTTPS-Erzwingung
- [ ] Authentifizierung/Login-System
- [ ] Rate-Limiting für API
- [ ] Input-Validierung härten

---

## 📱 Mobile App (Zukunft)

- [ ] React Native App
- [ ] Native GPS-Zugriff
- [ ] Offline-Karten auf Device
- [ ] Background-Tracking
- [ ] App Store / Play Store Release

---

## Prioritäten

### High Priority (v1.2.0)
1. Anker-Alarm
2. AIS-Integration
3. GPX-Export
4. Dark Mode / Night Mode Auto-Switch
5. Track-Statistiken
6. Einstellungen-Tabs vervollständigen (GPS, Wetter, Sensoren, Daten)

### Medium Priority
1. Tide-Vorhersagen
2. Offline-Karten
3. Tiefenmesser-Integration
4. 3-Tage-Wettervorhersage
5. Routen-Bibliothek

### Low Priority (Nice-to-have)
1. VHF-Integration
2. Autopilot
3. Wetter-Routing
4. Mobile Native App
5. Cloud-Sync

---

**Stand**: 2025-10-09
**Version**: 1.1.0
