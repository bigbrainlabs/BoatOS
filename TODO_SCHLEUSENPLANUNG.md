# TODO: Schleusenplanung - Phase 1

## 📋 Gesamtübersicht

**Ziel:** Schleusendatenbank mit Öffnungszeiten und grundlegenden Anmeldefunktionen

**Hardware-Setup:**
- 🖥️ **Hauptsystem:** Raspberry Pi + Touchscreen (primäre Bedienung)
- 📱 **Remote-Zugriff:** Tablet, Handy, Laptop via Browser (wie bisher)

---

## Phase 1: Basis-Funktionen

### 1️⃣ Datenbank-Schema & Backend

- [ ] **1.1 Datenbank-Schema erstellen**
  - [ ] SQLite-Tabelle `locks` (Schleusen) anlegen
  - [ ] Felder: ID, Name, Lat/Lon, Waterway, Kontaktdaten
  - [ ] Felder: Öffnungszeiten (JSON), Technische Daten
  - [ ] Felder: VHF-Kanal, Website, Notizen
  - [ ] Migration-Script schreiben

- [ ] **1.2 Backend-Modul `locks.py` erstellen**
  - [ ] CRUD-Funktionen (Create, Read, Update, Delete)
  - [ ] `load_locks()` - Alle Schleusen laden
  - [ ] `get_lock_by_id(lock_id)` - Details abrufen
  - [ ] `get_locks_in_bounds(lat_min, lon_min, lat_max, lon_max)` - Für Karte
  - [ ] `check_lock_open(lock_id, datetime)` - Öffnungszeiten prüfen
  - [ ] Helper-Funktionen für Öffnungszeiten-Parsing

- [ ] **1.3 API-Endpoints in main.py**
  - [ ] `GET /api/locks` - Liste aller Schleusen
  - [ ] `GET /api/locks/{lock_id}` - Details einer Schleuse
  - [ ] `GET /api/locks/nearby?lat=X&lon=Y&radius=50` - Schleusen in Umgebung
  - [ ] `POST /api/locks/{lock_id}/notify` - Anmeldung triggern (Email/SMS vorbereitet)

### 2️⃣ Initiale Schleusendaten

- [ ] **2.1 Datensammlung Elbe**
  - [ ] Schleuse Geesthacht (Elbe-km 585)
  - [ ] Schleuse Uelzen I & II (Elbe-Seitenkanal)
  - [ ] Schleuse Lüneburg (Ilmenau)
  - [ ] Daten: Koordinaten, Öffnungszeiten, Telefon, VHF

- [ ] **2.2 Datensammlung Havel**
  - [ ] Schleuse Lehnitz
  - [ ] Schleuse Spandau
  - [ ] Schleuse Charlottenburg
  - [ ] Schleuse Brandenburg
  - [ ] Daten sammeln aus WSV-Quellen

- [ ] **2.3 Datensammlung Elbe-Havel-Kanal**
  - [ ] Schleuse Hohenwarthe
  - [ ] Schleuse Niegripp
  - [ ] Schleuse Wolmirstedt
  - [ ] Schleuse Rothensee

- [ ] **2.4 Import-Script**
  - [ ] CSV/JSON mit Schleusendaten vorbereiten
  - [ ] Import-Funktion `import_locks.py`
  - [ ] Validierung der Daten
  - [ ] Bulk-Insert in Datenbank

### 3️⃣ Frontend - Karten-Integration

- [ ] **3.1 Schleusensymbole auf Karte**
  - [ ] Lock-Icon erstellen (🔒 oder Custom SVG)
  - [ ] Marker auf Karte platzieren
  - [ ] Clustering bei vielen Schleusen
  - [ ] Farb-Codierung (offen/geschlossen/unbekannt)

- [ ] **3.2 Info-Popup bei Click**
  - [ ] Popup-Template erstellen
  - [ ] Anzeige: Name, Öffnungszeiten, Status
  - [ ] Anzeige: Telefon, VHF-Kanal, Email
  - [ ] Anzeige: Technische Daten (Länge, Breite, Tiefe)

- [ ] **3.3 Touch-Optimierung (für Pi-Touchscreen)**
  - [ ] Größere Touch-Targets (min 44x44px)
  - [ ] Popup-Buttons großzügig dimensionieren
  - [ ] Swipe-Gesten testen
  - [ ] Zoom-Level für Touchscreen anpassen

- [ ] **3.4 Responsive Design prüfen**
  - [ ] Test auf Pi-Touchscreen (7" oder 10"?)
  - [ ] Test auf Tablet (iPad/Android)
  - [ ] Test auf Smartphone
  - [ ] Layout-Anpassungen wo nötig

### 4️⃣ Frontend - Schleusen-Details-Panel

- [ ] **4.1 Detailansicht erstellen**
  - [ ] Seitenpanel oder Modal-Dialog?
  - [ ] Design: Ähnlich wie Wetter-Panel
  - [ ] Sections: Kontakt, Zeiten, Technik, Notizen

- [ ] **4.2 Öffnungszeiten-Anzeige**
  - [ ] Aktuelle Öffnungszeit hervorheben
  - [ ] Countdown bis Öffnung/Schließung
  - [ ] Wochenübersicht
  - [ ] Pausenzeiten anzeigen

- [ ] **4.3 Kontakt-Buttons**
  - [ ] "📞 Anrufen" Button (tel: Link)
  - [ ] "📧 Email" Button (mailto: Link)
  - [ ] "📻 VHF" Info-Display
  - [ ] "🌐 Website" Button (externes Link)

### 5️⃣ Anmelde-Funktion (Einfach)

- [ ] **5.1 Email-Template System**
  - [ ] Template für Schleusen-Anmeldung
  - [ ] Platzhalter: Bootsname, Größe, ETA, Crew
  - [ ] Betreff-Generierung
  - [ ] Template anpassbar in Settings

- [ ] **5.2 "Anmelden" Button**
  - [ ] Email-Client öffnen mit Pre-Fill
  - [ ] Bootsdaten aus Settings laden
  - [ ] ETA berechnen aus Route
  - [ ] Confirmation-Dialog

- [ ] **5.3 Anmelde-Historie**
  - [ ] Speichern: Wann welche Schleuse angemeldet
  - [ ] Anzeige im Logbuch
  - [ ] Status-Tracking (angemeldet/bestätigt/passiert)

### 6️⃣ Routing-Integration

- [ ] **6.1 Schleusen auf Route anzeigen**
  - [ ] Automatische Erkennung auf berechneter Route
  - [ ] Icons entlang der Route platzieren
  - [ ] Anzahl Schleusen in Route-Info

- [ ] **6.2 Zeitplanung mit Schleusen**
  - [ ] Basiszeit pro Schleuse (z.B. 15min)
  - [ ] Zur ETA hinzuaddieren
  - [ ] Anzeige in Route-Details
  - [ ] Warnung bei Schleuse außerhalb Öffnungszeiten

- [ ] **6.3 Quick-Anmeldung aus Route**
  - [ ] "Alle Schleusen anmelden" Button
  - [ ] Batch-Email-Generation
  - [ ] Liste der Schleusen auf Route

### 7️⃣ Settings & Konfiguration

- [ ] **7.1 Bootsdaten für Anmeldung**
  - [ ] Name/Rufzeichen
  - [ ] Länge, Breite, Tiefgang
  - [ ] Kontakt (Skipper Name, Telefon)
  - [ ] Standard-Crew-Anzahl

- [ ] **7.2 Schleusen-Einstellungen**
  - [ ] Standard-Vorlaufzeit für Anmeldung (z.B. 30min vorher)
  - [ ] Bevorzugte Kontakt-Methode
  - [ ] Schleusen-Filter (nur bestimmte Waterways)

- [ ] **7.3 Lokalisierung**
  - [ ] Deutsche Texte für alle UI-Elemente
  - [ ] Icons mit Tooltips
  - [ ] Hilfe-Texte

### 8️⃣ Testing & Optimierung

- [ ] **8.1 Touchscreen-Tests**
  - [ ] Buttons gut erreichbar?
  - [ ] Scrolling flüssig?
  - [ ] Keine versehentlichen Klicks
  - [ ] Performance auf Pi 4/5?

- [ ] **8.2 Multi-Device Tests**
  - [ ] Tablet im Querformat
  - [ ] Smartphone im Hochformat
  - [ ] Desktop-Browser
  - [ ] Sync zwischen Geräten (optional)

- [ ] **8.3 Praxis-Test**
  - [ ] Mit echten Schleusen-Daten testen
  - [ ] Email-Anmeldung durchspielen
  - [ ] Routing mit Schleusen testen
  - [ ] User-Feedback einholen

### 9️⃣ Dokumentation

- [ ] **9.1 User-Guide**
  - [ ] Schleusen-Feature erklären
  - [ ] Screenshots erstellen
  - [ ] Anmelde-Prozess dokumentieren

- [ ] **9.2 Daten-Pflege**
  - [ ] Anleitung: Neue Schleusen hinzufügen
  - [ ] CSV/JSON Format dokumentieren
  - [ ] API-Dokumentation

---

## 🎯 Meilensteine

### Milestone 1: Backend Ready (Tag 1-2)
- ✅ Datenbank-Schema
- ✅ Backend-Modul
- ✅ API-Endpoints
- ✅ Test mit Dummy-Daten

### Milestone 2: Initiale Daten (Tag 2-3)
- ✅ Elbe-Schleusen erfasst
- ✅ Havel-Schleusen erfasst
- ✅ Import-Script funktioniert
- ✅ Mindestens 15 Schleusen im System

### Milestone 3: Karten-Integration (Tag 3-4)
- ✅ Schleusen auf Karte sichtbar
- ✅ Popup funktioniert
- ✅ Touch-optimiert

### Milestone 4: Anmelde-Feature (Tag 4-5)
- ✅ Email-Template System
- ✅ Anmelden-Button funktioniert
- ✅ Bootsdaten in Settings

### Milestone 5: Routing-Integration (Tag 5-6)
- ✅ Schleusen auf Route erkannt
- ✅ Zeit-Berechnung
- ✅ Quick-Anmeldung

### Milestone 6: Testing & Polish (Tag 6-7)
- ✅ Touchscreen getestet
- ✅ Multi-Device funktioniert
- ✅ Praxis-Test erfolgreich

---

## 📊 Fortschritt

- [x] Phase 1: Basis-Funktionen (ABGESCHLOSSEN)
  - ✅ Datenbank-Schema & Backend
  - ✅ API-Endpoints
  - ✅ Schleusendaten: 99 hochwertige deutsche Schleusen
  - ✅ Karten-Integration (Marker, Popups)
  - ✅ Routing-Integration (Schleusen auf Route, Zeitplanung, Warnungen)
  - ✅ Datenbereinigung (566 → 99 Qualitäts-Locks)

**Datenbank-Status:**
- 99 hochwertige deutsche Schleusen
- 17 mit vollständigen technischen Daten (manuell kuratiert)
- 82 mit Kontaktdaten und deutschem Namen
- Keine Duplikate, keine internationalen Locks
- Qualitätskriterien: Dimensionen ODER (Kontakt UND deutscher Name)

**Nächste Schritte:**
- Daten-Anreicherung mit Wikipedia/WSV-Quellen
- Anmelde-Historie implementieren
- Bootsdaten-Settings erweitern

---

## 🔧 Technische Notizen

### Touchscreen-Specs benötigt:
- Größe? (7", 10", 11"?)
- Auflösung?
- Raspberry Pi Modell? (Pi 4, Pi 5?)

### Remote-Zugriff:
- Aktueller Ansatz (nginx proxy) beibehalten
- Keine zusätzliche Auth nötig (lokales Netzwerk)
- Optional: VPN für Remote-Zugriff von außerhalb

### Performance-Überlegungen:
- SQLite ausreichend für <1000 Schleusen
- Marker-Clustering ab ~50 Schleusen
- Lazy-Loading für Schleusen-Details

---

**Erstellt:** 14. Oktober 2025
**Letzte Aktualisierung:** Initial
**Verantwortlich:** Claude + User
