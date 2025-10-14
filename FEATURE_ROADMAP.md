# BoatOS Feature Roadmap

## 🚢 Navigation & Planung

### 1. Gezeiten-Vorhersage
- [ ] API-Anbindung BSH (Bundesamt für Seeschifffahrt)
- [ ] Tidenhub-Visualisierung auf Karte
- [ ] Gezeitenkalender für Nordsee/Ostsee
- [ ] Warnungen bei kritischen Wasserständen
- [ ] Integration in Routenplanung

### 2. Ankerplatz-Datenbank
- [ ] Backend: Datenbank-Schema für Ankerplätze
- [ ] Frontend: Ankerplatz-Marker auf Karte
- [ ] Eigenschaften: Tiefe, Bodengrund, Schutz
- [ ] Bewertungssystem & Kommentare
- [ ] Foto-Upload für Ankerplätze
- [ ] Offline-Verfügbarkeit

### 3. Schleusen-Planung
- [ ] Datenbank deutscher Schleusen (WSV)
- [ ] Öffnungszeiten-Integration
- [ ] Voranmeldung per API
- [ ] Wartezeiten-Schätzung basierend auf Verkehr
- [ ] Push-Benachrichtigungen
- [ ] Routing mit Schleusenzeiten

## 📊 Automatisierung & Monitoring

### 4. Tank-Monitoring
- [ ] Backend: Sensor-Integration (NMEA/Modbus)
- [ ] Füllstand-Visualisierung (Gauges)
- [ ] Reichweiten-Berechnung
- [ ] Low-Level Warnungen
- [ ] Verbrauchshistorie
- [ ] Kosten-Tracking pro Tankladung

### 5. Motor-Wartungsplan
- [ ] Betriebsstunden-Counter (NMEA Integration)
- [ ] Wartungsintervalle konfigurierbar
- [ ] Automatische Erinnerungen
- [ ] Service-Historie mit Fotos/Belegen
- [ ] Ersatzteil-Katalog
- [ ] Export für Versicherung

### 6. Automatisches Logbuch
- [ ] KI-basierte Eintrags-Generierung
- [ ] Automatische Wetter-Aufzeichnung
- [ ] Foto-Integration mit GPS-Tags
- [ ] Ereignis-Erkennung (Anker, Schleuse, etc.)
- [ ] Sprach-zu-Text Einträge
- [ ] PDF-Export mit Fotos

## 🌐 Social & Kommunikation

### 7. Törnplanung mit Crew
- [ ] Multi-User-Support
- [ ] Gemeinsame Routenplanung
- [ ] Aufgaben-Verteilung (Wache, Kochen, etc.)
- [ ] Proviant-/Einkaufsliste
- [ ] Chat-Funktion
- [ ] Kalender-Integration

### 8. Offline-Karten
- [ ] Regionen-Download-Manager
- [ ] Kartenkachel-Caching
- [ ] Offline-Routing
- [ ] Speicherplatz-Management
- [ ] Auto-Update bei WLAN
- [ ] Kompressions-Optimierung

### 9. Hafenführer
- [ ] POI-Datenbank: Häfen, Marinas
- [ ] Liegeplatz-Preise & Verfügbarkeit
- [ ] Versorgung: Wasser, Strom, Diesel
- [ ] Services: Restaurants, Supermärkte
- [ ] Bewertungen & Fotos
- [ ] Direkt-Buchung Integration

## 🔧 Technische Features

### 10. NMEA2000 Integration
- [ ] NMEA2000-Gateway einrichten
- [ ] Autopilot-Daten auslesen
- [ ] Echolot-Integration
- [ ] Windmesser-Daten
- [ ] Tank-Sensoren
- [ ] Batterie-Management-System

### 11. Backup & Sync
- [ ] Cloud-Backup (S3/NextCloud)
- [ ] Automatische Backups
- [ ] Multi-Device Sync
- [ ] Konflikt-Auflösung
- [ ] Selektive Sync (nur Logbuch, etc.)
- [ ] Verschlüsselung

### 12. MOB-Funktion (Man Over Board)
- [ ] Notfall-Button im UI
- [ ] Sofortige GPS-Position speichern
- [ ] Akustischer Alarm
- [ ] Rückkehr-Navigation (großer Pfeil)
- [ ] Zeit-Tracking seit MOB
- [ ] Notfall-Kontakte benachrichtigen

## 📈 Analytics & Insights

### 13. Törn-Statistiken
- [ ] Dashboard: Jahresübersicht
- [ ] Metriken: Distanz, Tage, Häfen
- [ ] Vergleich zu Vorjahren
- [ ] Kosten pro Seemeile
- [ ] CO2-Bilanz
- [ ] Export als Infografik

### 14. Wetter-Historie
- [ ] Wetterdaten bei Fahrten speichern
- [ ] Analyse: Beste Reisezeiten
- [ ] Routen-Empfehlungen basierend auf Wetter
- [ ] Langzeit-Wettertrends
- [ ] Klimadaten-Integration

## 🎨 UI/UX Verbesserungen

### 15. Themes & Customization
- [ ] Dark/Light Mode Toggle
- [ ] Farb-Themes (Blau, Grün, etc.)
- [ ] Dashboard-Widgets anpassbar
- [ ] Kachelgröße konfigurierbar
- [ ] Personalisierte Startseite

### 16. Mehrsprachigkeit
- [ ] Englisch
- [ ] Niederländisch
- [ ] Französisch
- [ ] Sprachdateien auslagern

### 17. Mobile Optimierung
- [ ] Progressive Web App (PWA)
- [ ] Offline-First Strategie
- [ ] Touch-Gesten verbessern
- [ ] Installierbar auf Smartphone

## 🔐 Sicherheit & Datenschutz

### 18. Benutzer-Verwaltung
- [ ] Login-System
- [ ] Rollen: Skipper, Crew, Gast
- [ ] Permissions-System
- [ ] 2-Faktor-Authentifizierung
- [ ] Session-Management

### 19. Datenschutz
- [ ] DSGVO-Konformität
- [ ] Daten-Export (GDPR)
- [ ] Daten-Löschung
- [ ] Privacy Policy
- [ ] Cookie-Banner (falls Cloud)

## 📱 Hardware-Integration

### 20. Raspberry Pi Optimierung
- [ ] Auto-Start bei Boot
- [ ] Watchdog für Crash-Recovery
- [ ] Logging & Monitoring
- [ ] System-Status Dashboard
- [ ] OTA-Updates

### 21. Display-Modi
- [ ] Nachtmodus (rotes Licht)
- [ ] Helligkeits-Anpassung
- [ ] Screensaver
- [ ] Portrait/Landscape Auto-Rotate

## 🌊 Spezial-Features

### 22. Wetterstrategie
- [ ] Optimale Route basierend auf Wettervorhersage
- [ ] Wind-Routing für Segelboote
- [ ] Wellenhöhen-Visualisierung
- [ ] Sturm-Vermeidung

### 23. Kollisionsvermeidung
- [ ] AIS-Alarm bei nahenden Schiffen
- [ ] CPA/TCPA Berechnung
- [ ] Visuelle/Akustische Warnungen
- [ ] Integration mit Radar (falls vorhanden)

### 24. Virtueller Copilot
- [ ] KI-Assistent für Routenplanung
- [ ] Vorschläge für Zwischenstopps
- [ ] Wetterbasierte Empfehlungen
- [ ] Sprachsteuerung

---

## Prioritäten

### 🔥 Hohe Priorität (Nächste 3 Monate)
1. Tank-Monitoring
2. Motor-Wartungsplan
3. Offline-Karten
4. MOB-Funktion

### ⭐ Mittlere Priorität (3-6 Monate)
1. Gezeiten-Vorhersage
2. Ankerplatz-Datenbank
3. NMEA2000 Integration
4. Backup & Sync

### 💡 Niedrige Priorität (6+ Monate)
1. Törnplanung mit Crew
2. Virtueller Copilot
3. Mehrsprachigkeit
4. Kollisionsvermeidung

---

**Stand:** 14. Oktober 2025
**Letzte Aktualisierung:** Initial erstellt
