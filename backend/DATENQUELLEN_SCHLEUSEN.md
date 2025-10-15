# Datenquellen für Schleuseninformationen

Dokumentation der verfügbaren Datenquellen für Öffnungszeiten, Anmeldemöglichkeiten und Status von Schleusen in Deutschland.

**Erstellt:** 15. Oktober 2025
**Zuletzt aktualisiert:** 15. Oktober 2025

---

## 🎯 Zusammenfassung

### Primäre Datenquellen:
1. **ELWIS** - Offizielle Bundesbehörde, umfassendste Datenquelle
2. **SkipperGuide Wiki** - Community-Quelle mit VHF, km-Marken, praktischen Infos
3. **Wikipedia** - Technische Daten, Historie
4. **WSA-Websites** - Kontaktdaten, spezifische Behördeninformationen
5. **DoRIS** (Donau) - API-Zugang, XML-Format

### Anmeldemethoden:
- **VHF-Funk** (bevorzugt): Kanal meist vor Schleuse ausgeschildert
- **Telefon**: Alle Schleusen haben Telefonkontakt
- **Online**: Nur für Berufsschifffahrt, schriftliche Voranmeldung bis 19:00

---

## 📊 ELWIS - Elektronischer Wasserstraßen-Informationsservice

**Website:** https://www.elwis.de
**Betreiber:** Bundesanstalt für Gewässerkunde (BfG) / WSV
**Kostenfrei:** Ja

### Verfügbare Daten:

#### 1. Schleusenbetriebszeiten und -erreichbarkeiten
- **URL:** https://www.elwis.de/DE/dynamisch/Schleuseninformationen/
- **Suche:** Nach Name oder Wasserstraße
- **Inhalte:**
  - Öffnungszeiten (regulär und Feiertage)
  - Kontaktdaten (Telefon, teilweise VHF)
  - Abweichungen vom Regelbetrieb
  - Anstehende und aktuelle Sperrungen

#### 2. Nachrichten für die Binnenschifffahrt (NfB)
- **URL:** https://www.elwis.de/DE/dynamisch/mvc/main.php?modul=nfb
- **Inhalte:**
  - Aktuelle Sperrungen
  - Fahrwassereinschränkungen
  - Arbeiten an/in der Wasserstraße
  - Brücken- und Schleusensperrungen

#### 3. Abonnement-Service
- **URL:** https://www.elwis.de/DE/Service/ELWIS-Abo/
- **Features:**
  - Email-Benachrichtigungen
  - **XML-Anhang verfügbar!** (RIS-Standard konform)
  - Mehrsprachig
  - Filter nach Wasserstraßen

### Technische Integration:

**XML-Export:**
```
Option "mit XML-Anhang" aktivieren
→ Email enthält XML-Datei nach internationalem RIS-Standard
```

**Mögliche Nutzung:**
- Abonnement für relevante Wasserstraßen (Elbe, MLK, EHK, Havel)
- Python-Script zum Parsen der XML-Anhänge
- Automatische Aktualisierung der Schleusenstatus in DB

**Nachteil:**
- Kein direkter API-Zugang
- Web-Scraping oder Email-Parsing notwendig

---

## 🗺️ DoRIS - Donau River Information Services

**Website:** https://www.doris.bmk.gv.at
**Betreiber:** viadonau (Österreich)
**API-Zugang:** Ja (Open Service Portal)

### Verfügbare Daten:

- **Schleusenstatus** (Echtzeit)
  - Linke und rechte Kammer
  - Betriebszustand
  - Sperrungen
- **Wasserstand**
- **Fahrwasser-Verfügbarkeit**
- **Seichtstellen**

### Technische Integration:

**API:**
- Open Service Portal (ab 2020)
- Frei nutzbar ohne Registrierung
- Vordefinierte Web-Interfaces
- XML-Format (RIS-Standard)

**NfB-Abfrage:**
- URL: https://nts.doris.bmvit.gv.at
- Standardisiertes, maschinenlesbares XML

**Mobile App:**
- "DoRIS mobile" (iOS/Android)
- Internationale Resonanz

### Anwendung für BoatOS:

**Relevant für:** Donau-Abschnitte (wenn zukünftig erweitert)
**Vorbild für:** Deutsche Schleusen-Status-API (zeigt was möglich wäre)

**Beispiel-Integration:**
```python
# Für zukünftige Donau-Integration
def fetch_doris_lock_status(lock_id):
    # API-Call zu DoRIS Open Service Portal
    # Parse XML
    # Return status (offen/geschlossen/gestört)
    pass
```

---

## 📖 SkipperGuide Wiki

**Website:** https://www.skipperguide.de
**Community-basiert:** Ja (wie Wikipedia)
**Qualität:** Gut für Sportschifffahrt

### Verfügbare Daten:

#### Mittellandkanal (MLK)
- **URL:** https://www.skipperguide.de/wiki/Mittellandkanal
- **Inhalte:**
  - VHF-Kanäle (sehr wichtig!)
  - Kilometer-Marken
  - Hubhöhen
  - Anzahl Kammern
  - Praktische Hinweise (Wartezeiten, Besonderheiten)
  - Baujahre

#### Elbe-Havel-Kanal (EHK)
- **URL:** https://www.skipperguide.de/wiki/Elbe-Havel-Kanal
- **Inhalte:** Analog zu MLK

#### Weitere Wasserstraßen
- Alle relevanten deutschen Wasserstraßen dokumentiert
- Gute Abdeckung für Sportschifffahrt

### Qualität:
- ✅ VHF-Kanäle (oft in ELWIS/OSM fehlend!)
- ✅ Praktische Tipps (Wartezeiten, beste Zeiten)
- ✅ Aktuell gepflegt
- ⚠️ Keine Öffnungszeiten
- ⚠️ Teilweise unvollständige Kontaktdaten

### Integration:

**Manuell extrahiert in:** `enrich_locks_data.py`

**Beispiel:**
```python
"Schleuse Hohenwarthe": {
    "waterway": "Mittellandkanal / Elbe-Havel-Kanal",
    "river_km": 325.1,
    "vhf_channel": "26",  # ← Aus SkipperGuide!
    "max_height": 5.25,
    "avg_duration": 30,
    "notes": "Hub 18.55-19.05m. Größte Fallhöhe am MLK.",
    "source": "SkipperGuide MLK + Wikipedia"
}
```

---

## 🏛️ WSA-Websites (Wasserstraßen- und Schifffahrtsämter)

Jede Wasserstraße hat ein zuständiges WSA mit eigener Website.

### WSA Elbe
- **Website:** https://www.wsa-elbe.wsv.de
- **Zuständig:** Elbe, Rothenseer VK
- **Email:** wsa-elbe@wsv.bund.de
- **Telefon:** +49 (0)351 8432-50

### WSA Mittellandkanal / Elbe-Seitenkanal
- **Website:** https://www.wsa-mittellandkanal-elbe-seitenkanal.wsv.de
- **Zuständig:** MLK, ESK
- **Email:** wsa-mittellandkanal@wsv.bund.de

**Dienstorte:**
- Braunschweig: 0531 86603-1360/-1361
- Minden: 0571 6458-1360/-1361
- Uelzen: 0581 9079-1361/-1362

**Öffnungszeiten:**
- Mo-Do: 08:00-15:00
- Fr: 08:00-13:00

### WSA Spree-Havel
- **Website:** https://www.wsa-spree-havel.wsv.de
- **Zuständig:** Havel-Wasserstraße, Untere Havel
- **Email:** wsa-spree-havel@wsv.bund.de

### Verfügbare Daten:
- Kontaktdaten (Telefon, Email)
- Allgemeine Öffnungszeiten
- Sperrungen und Bauarbeiten
- Besondere Regelungen
- Informationszentren (Saisonale Öffnung)

### Integration:

**Waterway Defaults in `enrich_locks_data.py`:**
```python
WATERWAY_DEFAULTS = {
    "Mittellandkanal": {
        "max_height": 5.25,
        "max_width": 12.0,
        "email": "wsa-mittellandkanal@wsv.bund.de"
    },
    "Elbe-Havel-Kanal": {
        "email": "wsa-elbe@wsv.bund.de"
    }
}
```

---

## 📱 Apps und Dienste

### Navinaut
- **Website:** https://www.navinaut.de
- **Features:**
  - Routenplanung Binnengewässer
  - Hafen- und Schleusen-Kontakte
  - Betriebszeiten
  - Geeignete Routen für Schiffsgrößen

### NavShip
- **Platform:** Android (Google Play)
- **Features:**
  - Waterway Routing
  - Schleusen-Integration

### ADAC Skipper App
- **Features:**
  - Routenplanung Boot
  - Binnenreviere Navigation
  - Nützliche Funktionen für Skipper

**Anmerkung:** Diese Apps nutzen vermutlich ELWIS-Daten oder eigene Crowd-Sourcing-Datenbanken.

---

## 🔧 Anmeldemethoden (Sportschifffahrt)

### 1. VHF-Funk (Bevorzugt)

**Anforderung:**
- UBI (UKW-Sprechfunkzeugnis für Binnenschifffahrt)
- Bordsprechfunkanlage

**Ablauf:**
```
1. Mindestens 1 Stunde vor Ankunft anmelden
2. VHF-Kanal der Schleuse nutzen (meist vor Ort ausgeschildert)
3. Bootsname, Größe, Anzahl Crew, ETA durchgeben
4. Anweisungen der Schleuse befolgen
```

**Beispiel Elbe Traffic:**
- Kanal 71 (oder 16)
- "WILHELMSHAVEN LOCK" an Seeschleuse Wilhelmshaven

**VHF-Kanäle in BoatOS:**
- ✅ Bereits in DB-Schema (`vhf_channel` Feld)
- ✅ Von SkipperGuide extrahiert für MLK/EHK
- 📋 TODO: Mehr VHF-Daten aus SkipperGuide ergänzen

### 2. Telefon

**Ablauf:**
- Mindestens 1 Stunde vorher anrufen
- Direktnummer der Schleuse (aus ELWIS oder Datenbank)
- Bootsdaten und ETA durchgeben

**Beispiel:**
```
Schleuse Anderten: +49 (0)511 ...
```

### 3. Email (Berufsschifffahrt)

**Nur für Berufsschifffahrt:**
- Schriftliche Voranmeldung bis 19:00 für Nachtschleusung
- Sportschifffahrt: Nicht üblich

---

## 📈 Empfohlene Integration in BoatOS

### Phase 1: Statische Daten (✅ Abgeschlossen)
- SkipperGuide-Daten manuell extrahiert
- OSM-Daten importiert
- `enrich_locks_data.py` System aufgebaut

### Phase 2: ELWIS-Integration (🔜 Geplant)

**Option A: Email-Abonnement + Parsing**
```python
# 1. ELWIS-Abo für relevante Wasserstraßen einrichten
# 2. Email mit XML-Anhang empfangen
# 3. Python-Script parst XML (RIS-Standard)
# 4. Aktualisiert Schleusenstatus in DB

def parse_elwis_nfb_xml(xml_file):
    # Parse RIS-Standard XML
    # Extract lock closures, operating times
    # Update locks database
    pass
```

**Option B: Web-Scraping**
```python
# Periodisches Scraping der ELWIS-Webseite
# Nicht ideal, aber funktional
# Backup-Lösung falls XML-Parsing nicht klappt
```

### Phase 3: Echtzeit-Status (🔮 Zukunft)

**Idealfall:** API-Zugang wie DoRIS
- Deutschland hat (noch) keine öffentliche Schleusen-API
- DoRIS zeigt, dass es technisch möglich ist
- Eventuell bei WSV anfragen?

**Zwischenlösung:**
- NfB-Meldungen auswerten
- User-Reports (Crowd-Sourcing)
- Integration mit Schiffs-AIS-Daten?

### Datenbank-Erweiterungen

**Neue Felder für Status:**
```sql
ALTER TABLE locks ADD COLUMN current_status TEXT; -- 'open', 'closed', 'limited', 'unknown'
ALTER TABLE locks ADD COLUMN status_updated TIMESTAMP;
ALTER TABLE locks ADD COLUMN status_source TEXT; -- 'elwis_nfb', 'user_report', 'api'
ALTER TABLE locks ADD COLUMN closure_reason TEXT;
ALTER TABLE locks ADD COLUMN estimated_reopen TIMESTAMP;
```

---

## 📚 Weitere Datenquellen

### Wikipedia (Technische Daten)
- Schleusenlänge, Breite, Tiefe
- Hubhöhen
- Baujahr, Sanierungen
- Historische Informationen
- Technische Besonderheiten

**Beispiel:**
- https://de.wikipedia.org/wiki/Schleuse_Hohenwarthe
- https://de.wikipedia.org/wiki/Schleuse_Rothensee

### Charter-Schulz Schleusenzeiten
- **Website:** https://www.charter-schulz.de/schleusenzeiten/
- Übersicht Betriebszeiten
- Nicht immer aktuell
- Gut für initiale Datensammlung

### Regionaler Content
- Wassersportvereine
- Hafenhandbücher
- Revierführer (Delius Klasing, etc.)

---

## 🎯 Prioritäten für Datenanreicherung

### Hoch (VHF-Kanäle)
1. **SkipperGuide systematisch durchgehen:**
   - Alle MLK-Schleusen
   - Alle EHK-Schleusen
   - Havel-Wasserstraße
   - Elbe-Schleusen

2. **VHF-Daten extrahieren:**
   - Wichtigstes fehlendes Feld!
   - Aktuell nur 18% Coverage

### Mittel (Öffnungszeiten)
1. **ELWIS-Daten:**
   - XML-Export einrichten
   - Parser entwickeln
   - Regelmäßig aktualisieren

2. **Öffnungszeiten-Format:**
   - Standardisieren (JSON-Schema)
   - Ausnahmen (Feiertage) beachten
   - Saisonale Unterschiede

### Niedrig (Nice-to-have)
1. **Detaillierte technische Daten:**
   - Wikipedia-Extraktion
   - Hubhöhen
   - Besonderheiten

2. **Fotos:**
   - Für Schleusenerkennung
   - User-Hilfe

---

## 🔗 Nützliche Links

### Offizielle Quellen:
- ELWIS: https://www.elwis.de
- GDWS: https://www.gdws.wsv.bund.de
- WSA-Verzeichnis: https://www.gdws.wsv.bund.de/DE/gdws/anfahrt-adressen/wsae/wsae-node.html

### Community-Quellen:
- SkipperGuide: https://www.skipperguide.de
- Binnenschifffahrt Online: https://binnenschifffahrt-online.de

### International:
- DoRIS (Donau): https://www.doris.bmk.gv.at
- RIS (River Information Services): https://www.ris.eu

---

**Dokumentation erstellt für BoatOS Schleusenplanungs-System**
**Nächster Schritt:** ELWIS XML-Integration planen
