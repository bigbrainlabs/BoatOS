# ⚓ BoatOS

> **Modern Marine Navigation System - Open Source, Touch-Optimized, Offline-First**

Ein vollständiges Marine-Navigationssystem für Binnenschifffahrt und Küstennavigation. Gebaut für Raspberry Pi mit Touchscreen, läuft komplett offline, keine Abos, keine Cloud-Zwänge.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Raspberry%20Pi-red.svg)
![Python](https://img.shields.io/badge/python-3.9+-blue.svg)
![Status](https://img.shields.io/badge/status-production--ready-green.svg)

---

## 🌟 Highlights

- 🎨 **Visual Dashboard Editor** - Drag & Drop Interface ohne Coding
- 🗺️ **Binnengewässer-Routing** - Optimiert für Elbe, Kanäle & Schleusen
- 📡 **Live AIS Integration** - Echtzeit-Schiffsverkehr (Europe Bounding Box)
- ⚠️ **Wetter & Warnungen** - DWD API mit Unwetter-Alerts
- 📖 **Digitales Logbuch** - GPS-Tracks, Notizen, Export
- 🔌 **Sensor-Dashboard** - MQTT Integration für beliebige Sensoren
- 🏗️ **DSL-based Layout** - Konfigurierbare Dashboards per Text oder Visual Editor
- 👆 **Touch-optimiert** - 200ms Touch-Delay, große Buttons, perfekt für unterwegs

---

## 📸 Screenshots

<!-- TODO: Add screenshots here -->
```
Coming soon! Check Instagram @bigbrainlabs for live demos
```

---

## ✨ Features im Detail

### 🎨 Visual Dashboard Editor (Phase 2 - Complete!)
- **Drag & Drop** - Widgets aus Palette ziehen, im Canvas verschieben
- **Multi-Row Layouts** - Hero-Rows, Detail-Rows, beliebig strukturierbar
- **SHOW/HIDE Filter** - Checkbox-UI für Topic-Filter
- **Units (Einheiten)** - Input-Felder für °C, %, kn, V, etc.
- **Undo/Redo** - Ctrl+Z/Y mit 50-Step History
- **Cross-Row Drag** - Widgets zwischen Rows verschieben
- **Live Preview** - Vorschau mit echten Sensor-Daten
- **Bi-direktionale Sync** - Code ↔ Visual Editor

### 🗺️ Navigation & Routing
- **Interaktive Seekarten** - OpenSeaMap, OSM, Satellite View
- **Waterway Routing** - Optimierte Routen für Binnenschifffahrt
- **Schleusen-Datenbank** - OSM-basierte Lock-Informationen
- **Wegpunkte & Routen** - Speichern, Bearbeiten, Exportieren
- **Auto-Follow** - Intelligentes GPS-Tracking (respektiert manuelle Interaktion)
- **Ortssuche** - Nominatim (Häfen, Städte, Koordinaten)

### 📡 Sensoren & Daten
- **GPS Integration** - SignalK & MQTT Support
- **AIS Stream** - Live Schiffsverkehr (2% CPU statt 100%!)
- **MQTT Sensoren** - Beliebige externe Sensoren (Temp, Humidity, Voltage, etc.)
- **Persistent Topics** - Sensordaten bleiben über Neustarts erhalten
- **Sensor Aliases** - Eigene Namen für Sensoren vergeben
- **Zombie Cleanup** - Auto-Remove alter MQTT Topics

### 🌦️ Wetter & Umwelt
- **DWD Integration** - Deutscher Wetterdienst API
- **Unwetter-Warnungen** - Live Alerts mit Schweregrad
- **Pegeldaten** - ELWIS Integration für Wasserstände
- **Marine Weather** - Wind, Wellen, Sichtweite

### 📓 Logbuch & Tracking
- **GPS Track Recording** - Automatische Aufzeichnung
- **Crew Management** - Crew-Mitglieder verwalten
- **Fuel Tracking** - Tankfüllungen & Verbrauch
- **Statistics Dashboard** - Trips, Distanz, Durchschnitte
- **Data Export/Import** - JSON Backup & Restore

### 🎨 UI/UX
- **Touch-First Design** - Große Buttons, Touch-Delays, Active States
- **Dark Mode** - Perfekt für Nacht-Navigation
- **Responsive** - Desktop, Tablet, Mobile
- **Emoji Icons** - Noto Color Emoji Font
- **i18n** - Deutsch/Englisch mit Einheiten-Umrechnung
- **Settings UI** - Card-basierte Settings mit Live-Preview

---

## 🚀 Tech Stack

### Backend
- **FastAPI** - High-Performance Python API
- **MQTT** - Sensor Data Streaming (Mosquitto)
- **SignalK** - Marine Data Server
- **httpx** - Async HTTP Client
- **uvicorn** - ASGI Server

### Frontend
- **Vanilla JavaScript** - Kein Framework-Bloat, 100% Native
- **Leaflet.js** - Interactive Maps
- **Chart.js** - Statistiken & Graphen
- **SortableJS** - Drag & Drop Library
- **WebSocket** - Echtzeit-Updates
- **CSS Grid/Flexbox** - Modern Responsive Layout

### Infrastruktur
- **Nginx** - Reverse Proxy & SSL
- **Raspberry Pi 4** - Hardware Platform
- **Systemd** - Service Management
- **Git** - Version Control

### Datenquellen
- **OpenSeaMap** - Nautische Karten
- **OpenStreetMap** - Basiskarten & Routing
- **DWD API** - Deutscher Wetterdienst
- **ELWIS** - Wasserstraßen & Pegel
- **AISStream.io** - Live AIS Data
- **Nominatim** - Geocoding

---

## 📋 Systemanforderungen

### Hardware
- **Raspberry Pi 4** oder höher (min. 2GB RAM, 4GB empfohlen)
- **GPS Empfänger** - USB (z.B. u-blox, Garmin)
- **Touchscreen** - 7" Official Raspberry Pi Touch Display
- **SD Card** - Min. 16GB (32GB empfohlen)
- **Optional**: MQTT Sensoren (Temp, Voltage, etc.)

### Software
- **OS**: Raspberry Pi OS (Debian Bookworm) oder Ubuntu
- **Python**: 3.9+
- **Node.js**: Optional (nur für SignalK)
- **Internet**: Für Karten & Wetter (offline nach Init möglich)

---

## ⚡ Schnellstart

### 1. Installation

```bash
# Repository klonen
git clone https://github.com/bigbrainlabs/BoatOS.git
cd BoatOS

# Installations-Skript ausführen
chmod +x install.sh
./install.sh

# GPS konfigurieren (siehe INSTALL.md)

# System neu starten
sudo reboot
```

### 2. Zugriff

```bash
# Im Browser öffnen:
https://your-pi-ip/

# Oder auf dem Pi direkt:
https://localhost/
```

### 3. Konfiguration

1. **Settings** öffnen
2. **MQTT Broker** konfigurieren (falls externe Sensoren)
3. **Dashboard Layout** anpassen (Code oder Visual Editor)
4. **Weather API** Key eintragen (optional)

Detaillierte Anleitung: [INSTALL.md](INSTALL.md)

---

## 🔄 Update bestehender Installation

```bash
cd ~/BoatOS
./scripts/update.sh
```

Das Update-Skript:
- ✅ Git Pull für neueste Version
- ✅ Python Dependencies aktualisieren
- ✅ Frontend Cache Busting
- ✅ Services neu starten
- ✅ Status-Prüfung

---

## 🏗️ Architektur

```
┌─────────────────────────────────────────────────┐
│              Nginx (Port 80/443)                │
│   ┌──────────────┐  ┌───────────────┐          │
│   │   Frontend   │  │  SignalK      │          │
│   │  (HTML/JS)   │  │   Proxy       │          │
│   └──────┬───────┘  └───────┬───────┘          │
└──────────┼──────────────────┼──────────────────┘
           │                  │
           ▼                  ▼
    ┌─────────────┐    ┌─────────────────┐
    │   BoatOS    │◄───┤ SignalK Server  │
    │   Backend   │    │   (Port 3000)   │
    │ (Port 8000) │    │                 │
    └──────┬──────┘    └────────┬────────┘
           │                    │
           ▼                    ▼
    ┌─────────────┐      ┌─────────────┐
    │    MQTT     │      │ GPS Module  │
    │   Broker    │      │/dev/ttyACM* │
    │(Port 1883)  │      │             │
    └──────┬──────┘      └─────────────┘
           │
           ▼
    ┌─────────────────────┐
    │  External Sensors   │
    │  (Temp, Voltage,..) │
    └─────────────────────┘
```

---

## 📁 Verzeichnisstruktur

```
BoatOS/
├── backend/                    # FastAPI Backend
│   ├── app/
│   │   ├── main.py            # Haupt-API & WebSocket
│   │   ├── gps_service.py     # GPS Integration
│   │   └── dashboard_dsl.py   # DSL Parser
│   ├── requirements.txt
│   └── venv/
├── frontend/                  # Web-Frontend
│   ├── index.html            # Haupt-UI
│   ├── app.js                # App Logic
│   ├── dashboard_renderer.js # Dashboard Engine
│   ├── dashboard_visual_editor.js  # Visual Editor (Phase 2)
│   ├── settings_renderer.js  # Settings UI
│   ├── logbook.js           # Logbuch
│   ├── water_routing.js     # Routing
│   ├── weather_alerts.js    # Wetter-Warnungen
│   ├── locks.js             # Schleusen-Info
│   ├── i18n.js              # Übersetzungen
│   └── style.css
├── data/                     # User Data
│   ├── settings.json
│   ├── known_topics.json
│   └── dashboard_layout.dsl
├── scripts/
│   └── update.sh            # Update Script
├── INSTALL.md               # Installation Guide
├── DASHBOARD_DSL.md         # DSL Documentation
├── README.md                # Diese Datei
└── install.sh               # Installations-Skript
```

---

## 🎯 Dashboard DSL

BoatOS nutzt eine eigene **Domain Specific Language** für Dashboards:

```dsl
GRID 3

ROW hero
  SENSOR navigation/position SIZE 2 STYLE hero
  SENSOR navigation/gnss/satellites SIZE 1

ROW sensors
  SENSOR arielle/bilge/thermo SHOW temp,hum UNITS "temp:°C,hum:%" STYLE compact
  SENSOR navigation/gnss STYLE card
  TEXT "Weitere Sensoren..." STYLE subtitle
```

Oder nutze den **Visual Editor** - kein Code nötig! 🎨

Dokumentation: [DASHBOARD_DSL.md](DASHBOARD_DSL.md)

---

## 📡 API Endpoints

Nach Installation verfügbar unter: `http://your-pi-ip:8000/docs`

### Core Endpoints
- `GET /api/sensors/list` - Alle Sensoren mit Status
- `GET /api/sensors/{sensor_id}` - Sensor Details
- `GET /api/gps` - GPS-Daten (Position, Speed, Course)
- `GET /api/weather` - Wetterdaten
- `GET /api/weather/alerts` - DWD Unwetter-Warnungen
- `WS /ws` - WebSocket für Echtzeit-Updates

### Dashboard
- `GET /api/dashboard/layout` - Aktuelles Dashboard Layout
- `POST /api/dashboard/layout` - Layout speichern
- `POST /api/dashboard/parse` - DSL parsen & validieren

### Navigation
- `POST /api/route` - Route berechnen (Waterway)
- `GET /api/locks` - Schleusen-Datenbank
- `GET /api/waypoints` - Wegpunkte
- `POST /api/waypoints` - Wegpunkt hinzufügen

### Logbuch
- `GET /api/logbook/entries` - Logbuch-Einträge
- `POST /api/logbook/entry` - Eintrag hinzufügen
- `GET /api/crew` - Crew-Mitglieder
- `GET /api/fuel` - Tankfüllungen

### Settings
- `GET /api/settings` - System-Einstellungen
- `POST /api/settings` - Einstellungen speichern

---

## 🛠️ Entwicklung

### Backend entwickeln

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend entwickeln

```bash
cd frontend
# Einfach Dateien bearbeiten, kein Build nötig!
# Im Browser: http://localhost/
```

### MQTT Testing

```bash
# Subscribe to all topics
mosquitto_sub -h localhost -t '#' -v

# Publish test data
mosquitto_pub -h localhost -t 'arielle/bilge/thermo' \
  -m '{"temp": 22.5, "hum": 65.3}'
```

---

## 🗺️ Roadmap

### ✅ Completed (Phase 1 & 2)
- [x] GPS Integration (SignalK + MQTT)
- [x] Interactive Maps (Leaflet)
- [x] Waterway Routing
- [x] AIS Integration
- [x] Weather Alerts (DWD)
- [x] Digital Logbuch
- [x] Dashboard DSL System
- [x] Visual Dashboard Editor
- [x] Touch Optimization
- [x] Undo/Redo System
- [x] Multi-Row Layouts
- [x] SHOW/HIDE & UNITS UI

### 🚧 In Progress (Phase 3)
- [ ] Anker-Alarm mit Geofencing
- [ ] Tide-Vorhersagen (BSH API)
- [ ] Offline-Karten (MBTiles)
- [ ] AIS Target Details & CPA
- [ ] Route Import/Export (GPX)

### 🔮 Future (Phase 4+)
- [ ] Autopilot Integration
- [ ] Mobile Companion App
- [ ] Plugin System
- [ ] Chart Plotting Tools
- [ ] Marina Database
- [ ] MOB (Man Over Board) Alert

---

## 🤝 Contributing

Pull Requests sind herzlich willkommen! 🎉

### Contribution Guidelines

1. **Fork** das Projekt
2. **Branch** erstellen (`git checkout -b feature/AmazingFeature`)
3. **Commit** deine Änderungen (`git commit -m 'Add some AmazingFeature'`)
4. **Push** zum Branch (`git push origin feature/AmazingFeature`)
5. **Pull Request** öffnen

### Development Workflow

- Code Style: PEP8 (Python), Standard JS (JavaScript)
- Commit Messages: Conventional Commits Format
- PRs: Beschreibe was, warum, wie
- Tests: Bitte teste auf echtem Pi-Hardware

### Ideen für Contributors

- 🗺️ **Neue Kartenebenen** hinzufügen
- 🌍 **Übersetzungen** (Französisch, Spanisch, ...)
- 📊 **Dashboard Widgets** entwickeln
- 🔌 **Sensor Plugins** für neue Hardware
- 📖 **Dokumentation** verbessern
- 🐛 **Bugs** fixen

---

## 🐛 Troubleshooting

### BoatOS Backend startet nicht
```bash
# Status prüfen
sudo systemctl status boatos

# Logs ansehen
sudo journalctl -u boatos -f

# Neu starten
sudo systemctl restart boatos
```

### GPS keine Daten
```bash
# GPS Device prüfen
ls -la /dev/ttyACM*
ls -la /dev/ttyUSB*

# SignalK prüfen
curl http://localhost:3000/signalk/v1/api/vessels/self/navigation/position
```

### MQTT Sensoren erscheinen nicht
```bash
# MQTT Broker Status
sudo systemctl status mosquitto

# Topics debuggen
mosquitto_sub -h localhost -t '#' -v
```

Mehr: [INSTALL.md - Troubleshooting](INSTALL.md#fehlerbehebung)

---

## 📜 Lizenz

**MIT License** - siehe [LICENSE](LICENSE) Datei

Kurz gesagt: Du darfst alles damit machen! Kommerziell nutzen, modifizieren, verteilen. Einzige Bedingung: Copyright-Notice behalten.

---

## 👏 Credits & Danksagungen

### Entwicklung
- **Hauptentwicklung**: bigbrainlabs
- **AI-Pair-Programming**: Claude Code (Anthropic)

### Open Source Libraries
- [FastAPI](https://fastapi.tiangolo.com/) - Python Web Framework
- [Leaflet.js](https://leafletjs.com/) - Interactive Maps
- [SortableJS](https://sortablejs.github.io/Sortable/) - Drag & Drop
- [Chart.js](https://www.chartjs.org/) - Graphen & Diagramme
- [SignalK](https://signalk.org/) - Marine Data Standard

### Datenquellen
- [OpenSeaMap](https://www.openseamap.org/) - Nautische Karten
- [OpenStreetMap](https://www.openstreetmap.org/) - Kartendaten
- [DWD](https://www.dwd.de/) - Deutscher Wetterdienst
- [AISStream.io](https://aisstream.io/) - Live AIS Data
- [ELWIS](https://www.elwis.de/) - Wasserstraßen-Informationen

### Community
- SignalK Community
- OpenSeaMap Contributors
- Raspberry Pi Foundation
- Alle Beta-Tester & Issue-Reporter! 🙌

---

## 📞 Support & Community

- **Issues**: [GitHub Issues](https://github.com/bigbrainlabs/BoatOS/issues)
- **Discussions**: [GitHub Discussions](https://github.com/bigbrainlabs/BoatOS/discussions)
- **Instagram**: [@your_handle](https://instagram.com/your_handle) - Demos & Updates
- **Email**: your@email.com

---

## 🌟 Star History

Wenn dir BoatOS gefällt, gib uns einen ⭐ auf GitHub!

[![Star History Chart](https://api.star-history.com/svg?repos=bigbrainlabs/BoatOS&type=Date)](https://star-history.com/#bigbrainlabs/BoatOS&Date)

---

<div align="center">

**Gebaut mit ❤️ für die Schifffahrt**

*Von Skippern, für Skipper*

[⬆ Nach oben](#-boatos)

</div>
